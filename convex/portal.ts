import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { readActorValidator, requireQueryRole } from "./authz";
import { taskPriority, toProject, toQuoteSummary } from "./portalUtils";

export const dashboard = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    const invoiceStatuses = ["sent", "partially_paid", "overdue"] as const;

    const [customers, projects, quotes, projectTasks, invoicesByStatus] = await Promise.all([
      ctx.db
        .query("customers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("quotes")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("projectTasks")
        .withIndex("by_status", (q: any) => q.eq("tenantId", tenant._id).eq("status", "open"))
        .collect(),
      Promise.all(
        invoiceStatuses.map((status) =>
          ctx.db
            .query("invoices")
            .withIndex("by_status", (q: any) => q.eq("tenantId", tenant._id).eq("status", status))
            .collect()
        )
      )
    ]);

    const allOpenInvoices: Doc<"invoices">[] = invoicesByStatus.flat();
    const now = Date.now();
    const openAmount = allOpenInvoices.reduce(
      (sum, inv) => sum + (inv.totaalInclBtw - inv.betaaldBedrag),
      0
    );
    const overdueCount = allOpenInvoices.filter(
      (inv) => inv.status === "overdue" || inv.vervaldatum < now
    ).length;
    const customerById = new Map(
      customers.map((customer: Doc<"customers">) => [String(customer._id), customer.weergaveNaam])
    );
    const projectById = new Map(
      projects.map((project: Doc<"projects">) => [String(project._id), project])
    );
    const openTaskProjectIds = new Set(
      projectTasks.map((task: Doc<"projectTasks">) => String(task.projectId))
    );
    const openQuotes = quotes
      .filter((quote: Doc<"quotes">) => quote.status === "draft" || quote.status === "sent")
      .sort((left: Doc<"quotes">, right: Doc<"quotes">) => right.gewijzigdOp - left.gewijzigdOp);
    const plannedWorkProjects = projects.filter((project: Doc<"projects">) =>
      ["measurement_planned", "execution_planned", "ordering", "in_progress"].includes(
        project.status
      )
    );
    const taskWorkItems = projectTasks.map((task: Doc<"projectTasks">) => {
      const project = projectById.get(String(task.projectId));
      const priority = taskPriority(task.vervaltOp);

      return {
        id: `project-task-${task._id}`,
        title: task.titel,
        description: `${project?.titel ?? "Dossier"} - deadline ${new Intl.DateTimeFormat("nl-NL").format(new Date(task.vervaltOp))}`,
        href: `/portal/projecten/${task.projectId}`,
        label: priority.label,
        tone: priority.tone,
        updatedAt: task.vervaltOp,
        priorityRank: priority.rank
      };
    });
    const workItems = [
      ...taskWorkItems,
      ...projects
        .filter((project: Doc<"projects">) => project.status === "lead")
        .map((project: Doc<"projects">) => ({
          id: `project-lead-${project._id}`,
          title: "Nieuwe aanvraag opvolgen",
          description: `${project.titel} - ${customerById.get(String(project.klantId)) ?? "Onbekende klant"}`,
          href: `/portal/projecten/${project._id}`,
          label: "Aanvraag",
          tone: "warning",
          updatedAt: project.gewijzigdOp,
          priorityRank: 1
        })),
      ...quotes
        .filter((quote: Doc<"quotes">) => quote.status === "draft")
        .map((quote: Doc<"quotes">) => {
          const project = projectById.get(String(quote.projectId));

          return {
            id: `quote-draft-${quote._id}`,
            title: "Offerte afmaken",
            description: `${quote.titel} - ${customerById.get(String(quote.klantId)) ?? project?.titel ?? "Geen klant"}`,
            href: `/portal/offertes/${quote._id}`,
            label: "Concept",
            tone: "warning",
            updatedAt: quote.gewijzigdOp,
            priorityRank: 1
          };
        }),
      ...quotes
        .filter((quote: Doc<"quotes">) => quote.status === "sent")
        .map((quote: Doc<"quotes">) => {
          const project = projectById.get(String(quote.projectId));

          return {
            id: `quote-sent-${quote._id}`,
            title: "Offerte opvolgen",
            description: `${quote.titel} - ${customerById.get(String(quote.klantId)) ?? project?.titel ?? "Geen klant"}`,
            href: `/portal/offertes/${quote._id}`,
            label: "Verzonden",
            tone: "info",
            updatedAt: quote.gewijzigdOp,
            priorityRank: 2
          };
        }),
      ...projects
        .filter((project: Doc<"projects">) => project.status === "measurement_planned")
        .map((project: Doc<"projects">) => ({
          id: `measurement-${project._id}`,
          title: "Inmeting voorbereiden",
          description: `${project.titel} - ${customerById.get(String(project.klantId)) ?? "Onbekende klant"}`,
          href: `/portal/projecten/${project._id}`,
          label: "Inmeting",
          tone: "info",
          updatedAt: project.gewijzigdOp,
          priorityRank: 2
        })),
      ...projects
        .filter(
          (project: Doc<"projects">) =>
            project.status === "quote_accepted" && !openTaskProjectIds.has(String(project._id))
        )
        .map((project: Doc<"projects">) => ({
          id: `accepted-${project._id}`,
          title: "Akkoord opvolgen",
          description: `${project.titel} - ${customerById.get(String(project.klantId)) ?? "Onbekende klant"}`,
          href: `/portal/projecten/${project._id}`,
          label: "Opvolging",
          tone: "info",
          updatedAt: project.gewijzigdOp,
          priorityRank: 2
        })),
      ...projects
        .filter((project: Doc<"projects">) =>
          ["execution_planned", "ordering", "in_progress"].includes(project.status)
        )
        .map((project: Doc<"projects">) => ({
          id: `execution-${project._id}`,
          title: "Uitvoering opvolgen",
          description: `${project.titel} - ${customerById.get(String(project.klantId)) ?? "Onbekende klant"}`,
          href: `/portal/projecten/${project._id}`,
          label: "Uitvoering",
          tone: "success",
          updatedAt: project.gewijzigdOp,
          priorityRank: 2
        }))
    ].sort((left, right) => left.priorityRank - right.priorityRank || left.updatedAt - right.updatedAt);

    const visibleProjects = await Promise.all(
      projects
        .filter(
          (project: Doc<"projects">) =>
            !["closed", "cancelled", "paid"].includes(project.status)
        )
        .sort((left: Doc<"projects">, right: Doc<"projects">) => right.gewijzigdOp - left.gewijzigdOp)
        .slice(0, 6)
        .map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
    );

    return {
      openQuoteCount: openQuotes.length,
      plannedWorkCount: plannedWorkProjects.length,
      workItemCount: workItems.length,
      workItems: workItems.slice(0, 8),
      quoteFollowUps: openQuotes.slice(0, 5).map((quote: Doc<"quotes">) => {
        const project = projectById.get(String(quote.projectId));

        return {
          ...toQuoteSummary(tenant.slug, quote),
          customerName: customerById.get(String(quote.klantId)) ?? "Onbekende klant",
          projectTitle: project?.titel
        };
      }),
      projects: visibleProjects,
      invoiceStats: { openAmount, overdueCount }
    };
  }
});

// Re-exports
export { listCustomers, createCustomer, updateCustomer, customerDetail, createCustomerContact } from "./beheer/customers";
export { listTeamMembers } from "./beheer/users";
export {
  listProjects,
  dossierWorkspace,
  createProject,
  updateProject,
  projectDetail,
  addProjectRoom,
  updateProjectRoom,
  deleteProjectRoom,
  updateProjectStatus,
  startOrPlanMeasurement,
  createWorkflowEvent,
  processProjectAction,
  updateProjectTaskStatus
} from "./projecten/core";
export {
  listQuotesWorkspace,
  quoteDetailWorkspace,
  createQuote,
  updateQuote,
  addQuoteLine,
  importMeasurementLinesToQuote,
  deleteQuoteLine,
  updateQuoteLine,
  updateQuoteStatus,
  updateQuoteTerms
} from "./offertes/core";
export { listSuppliers, createSupplier, updateSupplier, updateSupplierProductListStatus } from "./beheer/suppliers";
export { listQuoteTemplates, updateQuoteTemplateContent } from "./offertes/templates";
export { listCategories, upsertCategory } from "./beheer/categories";
export { listServiceRules, upsertServiceRule } from "./beheer/serviceCostRules";
export { fieldServiceWorkspace, fieldProjectWorkspace } from "./projecten/fieldService";
export { listInvoices, invoiceDetail, createInvoice, createInvoiceFromQuote, updateInvoiceStatus, markInvoicePaid } from "./facturen/core";
export {
  agendaWeek,
  getMonteurWerktijden,
  setMonteurWerktijden,
  listAfwezigheid,
  addAfwezigheid,
  removeAfwezigheid
} from "./beheer/agenda";
// clearTenantData is INTERN (internalMutation) en wordt bewust NIET geherexporteerd in de publieke portal-API.
// Aanroepen via Convex dashboard of `npx convex run beheer/clearTenantData:clearTenantData`.

