import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { readActorValidator, requireQueryRole } from "./authz";
import { taskPriority, toProject, toQuoteSummary } from "./portalUtils";
import { isMeasurementCompleted, projectWorklistItem } from "./projecten/nextStep";
import {
  DAG_MS,
  INMEET_CAPACITEIT,
  hoortBijMonteur,
  isInmeetdag,
  omvangUnits,
  startVanWeekMs,
  weekdagVanMs
} from "./beheer/agenda";

export const dashboard = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant, workspaceMode } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    const invoiceStatuses = ["sent", "partially_paid", "overdue"] as const;

    const [customers, projects, quotes, projectTasks, invoicesByStatus, alleMetingen] =
      await Promise.all([
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
        ),
        // Laatste inmetingsstatus per dossier (laagvolume: ~1 per project): nodig om in
        // de werklijst het overdrachtsmoment te tonen ("Inmeting afgerond — offerte
        // maken") i.p.v. te blijven hangen op "Inmeting voorbereiden".
        ctx.db
          .query("measurements")
          .withIndex("by_project", (q: any) => q.eq("tenantId", tenant._id))
          .collect()
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
    // Project-status-items linken naar het dossier. quote_draft/quote_sent komen uit
    // de quotes-collectie (zie hieronder, link naar de offerte), dus die slaan we hier
    // over om dubbeltelling te voorkomen. Alle copy/badges/rangen komen uit de centrale
    // projectWorklistItem() zodat dashboard en cockpit niet kunnen uiteenlopen.
    const laatsteMetingPerProject = new Map<string, Doc<"measurements">>();
    for (const meting of alleMetingen) {
      const key = String(meting.projectId);
      const huidige = laatsteMetingPerProject.get(key);
      if (!huidige || meting.gewijzigdOp > huidige.gewijzigdOp) {
        laatsteMetingPerProject.set(key, meting);
      }
    }
    const projectWorkItems = projects.flatMap((project: Doc<"projects">) => {
      if (["quote_draft", "quote_sent"].includes(project.status)) {
        return [];
      }
      if (project.status === "quote_accepted" && openTaskProjectIds.has(String(project._id))) {
        return [];
      }
      const meta = projectWorklistItem(project.status, {
        measurementCompleted: isMeasurementCompleted(
          laatsteMetingPerProject.get(String(project._id))?.status ?? null
        )
      });
      if (!meta) {
        return [];
      }
      return [
        {
          id: `project-${project._id}`,
          title: meta.title,
          description: `${project.titel} - ${customerById.get(String(project.klantId)) ?? "Onbekende klant"}`,
          href: `/portal/projecten/${project._id}`,
          label: meta.badge,
          tone: meta.tone,
          updatedAt: project.gewijzigdOp,
          priorityRank: meta.rank
        }
      ];
    });
    const quoteWorkItems = quotes.flatMap((quote: Doc<"quotes">) => {
      // "Afwijzing opvolgen" hangt aan de dossierstatus (projectWorkItems), niet aan de
      // losse offerte: anders krijgt elke historisch afgewezen offerte een eigen item,
      // ook op dossiers die allang met een nieuwe offerte verder zijn.
      if (quote.status === "rejected") {
        return [];
      }
      const meta = projectWorklistItem(`quote_${quote.status}`);
      if (!meta) {
        return [];
      }
      const project = projectById.get(String(quote.projectId));
      return [
        {
          id: `quote-${quote.status}-${quote._id}`,
          title: meta.title,
          description: `${quote.titel} - ${customerById.get(String(quote.klantId)) ?? project?.titel ?? "Geen klant"}`,
          href: `/portal/offertes/${quote._id}`,
          label: meta.badge,
          tone: meta.tone,
          updatedAt: quote.gewijzigdOp,
          priorityRank: meta.rank
        }
      ];
    });
    const workItems = [...taskWorkItems, ...projectWorkItems, ...quoteWorkItems].sort(
      (left, right) => left.priorityRank - right.priorityRank || left.updatedAt - right.updatedAt
    );

    const visibleProjects = await Promise.all(
      projects
        .filter(
          (project: Doc<"projects">) => !["closed", "cancelled", "paid"].includes(project.status)
        )
        .sort(
          (left: Doc<"projects">, right: Doc<"projects">) => right.gewijzigdOp - left.gewijzigdOp
        )
        .slice(0, 6)
        .map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
    );

    // ── Agenda: lichte week-aggregatie voor de dashboard-widget ──────────────
    // Geen volledige agendaWeek-payload; alleen per inmeetdag (di/wo/do) de geboekte
    // en vrije capaciteit over de zichtbare monteurs + het aantal niet-toegewezen
    // inmetingen. inmeetdata bevat geen bedragen, dus niet field-gemaskeerd.
    const nu = Date.now();
    const agendaWeekStart = startVanWeekMs(nu);
    const agendaWeekEnd = agendaWeekStart + 7 * DAG_MS;
    const [weekMetingen, agendaUsers] = await Promise.all([
      ctx.db
        .query("measurements")
        .withIndex("by_measurement_date", (q: any) =>
          q
            .eq("tenantId", tenant._id)
            .gte("inmeetdatum", agendaWeekStart)
            .lt("inmeetdatum", agendaWeekEnd)
        )
        .collect(),
      ctx.db
        .query("users")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect()
    ]);
    const agendaNietViewers = agendaUsers.filter((u: Doc<"users">) => u.role !== "viewer");
    const agendaAangevinkt = agendaNietViewers.filter((u: Doc<"users">) => u.toonInAgenda === true);
    const zichtbareMonteurs = agendaAangevinkt.length > 0 ? agendaAangevinkt : agendaNietViewers;
    const maxCapaciteitPerDag = Math.max(1, zichtbareMonteurs.length) * INMEET_CAPACITEIT;

    const geboektPerWeekdag = new Map<number, number>();
    let agendaNietToegewezenCount = 0;
    for (const m of weekMetingen) {
      // Toetsen tegen de GETOONDE monteurs (zelfde set als agendaWeek), niet tegen alle
      // niet-viewers: een bezoek van een uitgevinkte monteur telde anders wél mee als
      // "geboekt" tegen een capaciteit die op de whitelist is gebaseerd, terwijl het in
      // de week-agenda nergens zichtbaar was (dashboard zei "vol", agenda toonde leeg).
      const zichtbaarInKolom = zichtbareMonteurs.some((u: Doc<"users">) =>
        hoortBijMonteur(m, u._id, u.naam ?? u.email)
      );
      if (!zichtbaarInKolom) {
        agendaNietToegewezenCount += 1;
        continue;
      }
      const wd = weekdagVanMs(m.inmeetdatum as number);
      geboektPerWeekdag.set(wd, (geboektPerWeekdag.get(wd) ?? 0) + omvangUnits(m.omvang));
    }

    const agendaDagen = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(agendaWeekStart);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      // isInmeetdag (backend) verwacht een timestamp, niet een weekdag-index.
      if (!isInmeetdag(d.getTime())) continue;
      const geboekt = geboektPerWeekdag.get(i) ?? 0;
      agendaDagen.push({
        datumMs: d.getTime(),
        weekdag: i,
        geboekt,
        maxCapaciteit: maxCapaciteitPerDag,
        vrijeCapaciteit: Math.max(0, maxCapaciteitPerDag - geboekt)
      });
    }

    return {
      openQuoteCount: openQuotes.length,
      plannedWorkCount: plannedWorkProjects.length,
      workItemCount: workItems.length,
      // Ruime bovengrens i.p.v. 8 zodat "Toon alles" in de praktijk alles toont.
      // Boven de grens benoemt DashboardWorkOverview het verschil expliciet
      // ("x van y") o.b.v. workItemCount, zodat pill en lijst nooit stil uiteenlopen.
      workItems: workItems.slice(0, 50),
      quoteFollowUps: openQuotes.slice(0, 5).map((quote: Doc<"quotes">) => {
        const project = projectById.get(String(quote.projectId));

        return {
          ...toQuoteSummary(tenant.slug, quote),
          customerName: customerById.get(String(quote.klantId)) ?? "Onbekende klant",
          projectTitle: project?.titel
        };
      }),
      projects: visibleProjects,
      // Buitendienst (field-mode) ziet bewust geen factuurbedragen — consistent met de
      // ensureNotFieldMode-grens op de facturen zelf. Genormaliseerd op 0 i.p.v. de echte stand.
      invoiceStats:
        workspaceMode === "field"
          ? { openAmount: 0, overdueCount: 0 }
          : { openAmount, overdueCount },
      agenda: {
        weekStart: agendaWeekStart,
        dagen: agendaDagen,
        nietToegewezenCount: agendaNietToegewezenCount
      }
    };
  }
});

// Re-exports
export {
  listCustomers,
  createCustomer,
  updateCustomer,
  customerDetail,
  createCustomerContact,
  deleteCustomer
} from "./beheer/customers";
export {
  generateDossierAttachmentUploadUrl,
  createDossierAttachment,
  archiveDossierAttachment
} from "./dossiers/attachments";
export {
  generateSupplierOrdersFromQuote,
  listSupplierOrders,
  supplierOrderDetail,
  updateSupplierOrderStatus,
  cancelSupplierOrder
} from "./inkoop/core";
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
export {
  listSuppliers,
  createSupplier,
  updateSupplier,
  updateSupplierProductListStatus
} from "./beheer/suppliers";
export { listQuoteTemplates, updateQuoteTemplateContent } from "./offertes/templates";
export { listCategories, upsertCategory } from "./beheer/categories";
export { listServiceRules, upsertServiceRule } from "./beheer/serviceCostRules";
export { fieldServiceWorkspace, fieldProjectWorkspace } from "./projecten/fieldService";
export {
  listInvoices,
  invoiceDetail,
  createInvoice,
  createInvoiceFromQuote,
  updateInvoiceStatus,
  markInvoicePaid
} from "./facturen/core";
export {
  agendaWeek,
  inmeetBeschikbaarheid,
  getMonteurWerktijden,
  setMonteurWerktijden,
  listAfwezigheid,
  addAfwezigheid,
  removeAfwezigheid,
  setAgendaZichtbaarheid,
  setAgendaWeergaveNaam
} from "./beheer/agenda";
// clearTenantData is INTERN (internalMutation) en wordt bewust NIET geherexporteerd in de publieke portal-API.
// Aanroepen via Convex dashboard of `npx convex run beheer/clearTenantData:clearTenantData`.
