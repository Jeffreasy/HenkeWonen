import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getTenant, taskPriority, toProject, toQuoteSummary } from "./portalUtils";

export const dashboard = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await getTenant(ctx, args.tenantSlug);

    if (!tenant) {
      return {
        openQuoteCount: 0,
        plannedWorkCount: 0,
        workItemCount: 0,
        workItems: [],
        quoteFollowUps: [],
        projects: []
      };
    }

    const [customers, projects, quotes, projectTasks] = await Promise.all([
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
        .collect()
    ]);
    const customerById = new Map(
      customers.map((customer: Doc<"customers">) => [String(customer._id), customer.displayName])
    );
    const projectById = new Map(
      projects.map((project: Doc<"projects">) => [String(project._id), project])
    );
    const openQuotes = quotes
      .filter((quote: Doc<"quotes">) => quote.status === "draft" || quote.status === "sent")
      .sort((left: Doc<"quotes">, right: Doc<"quotes">) => right.updatedAt - left.updatedAt);
    const plannedWorkProjects = projects.filter((project: Doc<"projects">) =>
      ["measurement_planned", "execution_planned", "ordering", "in_progress"].includes(
        project.status
      )
    );
    const taskWorkItems = projectTasks.map((task: Doc<"projectTasks">) => {
      const project = projectById.get(String(task.projectId));
      const priority = taskPriority(task.dueAt);

      return {
        id: `project-task-${task._id}`,
        title: task.title,
        description: `${project?.title ?? "Dossier"} - deadline ${new Intl.DateTimeFormat("nl-NL").format(new Date(task.dueAt))}`,
        href: `/portal/projecten/${task.projectId}`,
        label: priority.label,
        tone: priority.tone,
        updatedAt: task.dueAt,
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
          description: `${project.title} - ${customerById.get(String(project.customerId)) ?? "Onbekende klant"}`,
          href: `/portal/projecten/${project._id}`,
          label: "Aanvraag",
          tone: "warning",
          updatedAt: project.updatedAt,
          priorityRank: 1
        })),
      ...quotes
        .filter((quote: Doc<"quotes">) => quote.status === "draft")
        .map((quote: Doc<"quotes">) => {
          const project = projectById.get(String(quote.projectId));

          return {
            id: `quote-draft-${quote._id}`,
            title: "Offerte afmaken",
            description: `${quote.title} - ${customerById.get(String(quote.customerId)) ?? project?.title ?? "Geen klant"}`,
            href: `/portal/offertes/${quote._id}`,
            label: "Concept",
            tone: "warning",
            updatedAt: quote.updatedAt,
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
            description: `${quote.title} - ${customerById.get(String(quote.customerId)) ?? project?.title ?? "Geen klant"}`,
            href: `/portal/offertes/${quote._id}`,
            label: "Verzonden",
            tone: "info",
            updatedAt: quote.updatedAt,
            priorityRank: 2
          };
        }),
      ...projects
        .filter((project: Doc<"projects">) =>
          ["quote_accepted", "measurement_planned"].includes(project.status)
        )
        .map((project: Doc<"projects">) => ({
          id: `measurement-${project._id}`,
          title: "Inmeting voorbereiden",
          description: `${project.title} - ${customerById.get(String(project.customerId)) ?? "Onbekende klant"}`,
          href: `/portal/projecten/${project._id}`,
          label: "Inmeting",
          tone: "info",
          updatedAt: project.updatedAt,
          priorityRank: 2
        })),
      ...projects
        .filter((project: Doc<"projects">) =>
          ["execution_planned", "ordering", "in_progress"].includes(project.status)
        )
        .map((project: Doc<"projects">) => ({
          id: `execution-${project._id}`,
          title: "Uitvoering opvolgen",
          description: `${project.title} - ${customerById.get(String(project.customerId)) ?? "Onbekende klant"}`,
          href: `/portal/projecten/${project._id}`,
          label: "Uitvoering",
          tone: "success",
          updatedAt: project.updatedAt,
          priorityRank: 2
        }))
    ].sort((left, right) => left.priorityRank - right.priorityRank || left.updatedAt - right.updatedAt);

    const visibleProjects = await Promise.all(
      projects
        .filter(
          (project: Doc<"projects">) =>
            !["closed", "cancelled", "paid"].includes(project.status)
        )
        .sort((left: Doc<"projects">, right: Doc<"projects">) => right.updatedAt - left.updatedAt)
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
          customerName: customerById.get(String(quote.customerId)) ?? "Onbekende klant",
          projectTitle: project?.title
        };
      }),
      projects: visibleProjects
    };
  }
});

// Re-exports
export { listCustomers, createCustomer, updateCustomer, customerDetail, createCustomerContact } from "./beheer/customers";
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
