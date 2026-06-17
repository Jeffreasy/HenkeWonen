import { query } from "../_generated/server";
import { v } from "convex/values";
import { readActorValidator, requireQueryRole } from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import type {
  PortalCustomer,
  PortalRoom,
  PortalProject,
  PortalProjectTask,
  PortalQuoteLine,
  PortalQuote,
  QuoteTemplate,
  FieldWorkspaceCard
} from "../../src/lib/portalTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeProjectId(ctx: any, projectId: string): Id<"projects"> | null {
  return ctx.db.normalizeId("projects", projectId);
}

function taskPriority(dueAt: number, now = Date.now()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.floor((dueAt - today.getTime()) / DAY_MS);

  if (daysUntilDue <= 1) {
    return { level: "red" as const, label: "Rood" as const, tone: "danger" as const, rank: 0 };
  }

  if (daysUntilDue <= 7) {
    return { level: "orange" as const, label: "Oranje" as const, tone: "warning" as const, rank: 1 };
  }

  return { level: "green" as const, label: "Groen" as const, tone: "success" as const, rank: 2 };
}

function toCustomer(tenantSlug: string, customer: Doc<"customers">): PortalCustomer {
  return {
    id: String(customer._id),
    tenantId: tenantSlug,
    type: customer.type,
    weergaveNaam: customer.weergaveNaam,
    email: customer.email,
    telefoon: customer.telefoon,
    straat: customer.straat,
    huisnummer: customer.huisnummer,
    postcode: customer.postcode,
    plaats: customer.plaats,
    notities: customer.notities,
    status: customer.status,
    aangemaaktOp: customer.aangemaaktOp,
    gewijzigdOp: customer.gewijzigdOp
  };
}

function toRoom(room: Doc<"projectRooms">): PortalRoom {
  return {
    id: String(room._id),
    projectId: String(room.projectId),
    naam: room.naam,
    verdieping: room.verdieping,
    breedteCm: room.breedteCm,
    lengteCm: room.lengteCm,
    oppervlakteM2: room.oppervlakteM2,
    omtrekMeter: room.omtrekMeter,
    notities: room.notities,
    sortOrder: room.sortOrder
  };
}

async function getRooms(ctx: any, tenantId: Id<"tenants">, projectId: Id<"projects">) {
  const rooms = await ctx.db
    .query("projectRooms")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();

  return rooms.sort((left: Doc<"projectRooms">, right: Doc<"projectRooms">) => {
    return left.sortOrder - right.sortOrder;
  });
}

async function toProject(
  ctx: any,
  tenantSlug: string,
  project: Doc<"projects">
): Promise<PortalProject> {
  const rooms = await getRooms(ctx, project.tenantId, project._id);

  return {
    id: String(project._id),
    tenantId: tenantSlug,
    klantId: String(project.klantId),
    titel: project.titel,
    omschrijving: project.omschrijving,
    status: project.status,
    inmeetdatum: project.inmeetdatum,
    uitvoerdatum: project.uitvoerdatum,
    interneNotities: project.interneNotities,
    klantNotities: project.klantNotities,
    geaccepteerdOp: project.geaccepteerdOp,
    inmeetGeplandOp: project.inmeetGeplandOp,
    uitvoerGeplandOp: project.uitvoerGeplandOp,
    besteldOp: project.besteldOp,
    gefactureerdOp: project.gefactureerdOp,
    betaaldOp: project.betaaldOp,
    afgeslotenOp: project.afgeslotenOp,
    rooms: rooms.map(toRoom),
    createdByExternalUserId: project.createdByExternalUserId,
    aangemaaktOp: project.aangemaaktOp,
    gewijzigdOp: project.gewijzigdOp
  };
}

function toProjectTask(tenantSlug: string, task: Doc<"projectTasks">): PortalProjectTask {
  const priority = taskPriority(task.vervaltOp);

  return {
    id: String(task._id),
    tenantId: tenantSlug,
    projectId: String(task.projectId),
    quoteId: task.quoteId ? String(task.quoteId) : undefined,
    type: task.type,
    titel: task.titel,
    vervaltOp: task.vervaltOp,
    status: task.status,
    priority,
    voltooidOp: task.voltooidOp,
    afgewezenOp: task.afgewezenOp,
    aangemaaktOp: task.aangemaaktOp,
    gewijzigdOp: task.gewijzigdOp
  };
}

function toQuoteLine(line: Doc<"quoteLines">): PortalQuoteLine {
  return {
    id: String(line._id),
    quoteId: String(line.quoteId),
    projectRuimteId: line.projectRuimteId ? String(line.projectRuimteId) : undefined,
    productId: line.productId ? String(line.productId) : undefined,
    regelType: line.regelType,
    titel: line.titel,
    omschrijving: line.omschrijving,
    aantal: line.aantal,
    eenheid: line.eenheid,
    eenheidsprijsExBtw: line.eenheidsprijsExBtw,
    btwTarief: line.btwTarief,
    kortingExBtw: line.kortingExBtw,
    regelTotaalExBtw: line.regelTotaalExBtw,
    regelBtwTotaal: line.regelBtwTotaal,
    regelTotaalInclBtw: line.regelTotaalInclBtw,
    sortOrder: line.sortOrder,
    metadata: line.metadata
  };
}

async function toQuote(
  ctx: any,
  tenantSlug: string,
  quote: Doc<"quotes">
): Promise<PortalQuote> {
  const lines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", quote.tenantId).eq("quoteId", quote._id))
    .collect();

  return {
    id: String(quote._id),
    tenantId: tenantSlug,
    projectId: String(quote.projectId),
    klantId: String(quote.klantId),
    offertenummer: quote.offertenummer,
    titel: quote.titel,
    status: quote.status,
    verzondenOp: quote.verzondenOp,
    geldigTot: quote.geldigTot,
    inleidingTekst: quote.inleidingTekst,
    afsluitTekst: quote.afsluitTekst,
    voorwaarden: quote.voorwaarden,
    betalingsvoorwaarden: quote.betalingsvoorwaarden,
    subtotaalExBtw: quote.subtotaalExBtw,
    btwTotaal: quote.btwTotaal,
    totaalInclBtw: quote.totaalInclBtw,
    lines: lines
      .sort((left: Doc<"quoteLines">, right: Doc<"quoteLines">) => left.sortOrder - right.sortOrder)
      .map(toQuoteLine),
    createdByExternalUserId: quote.createdByExternalUserId,
    aangemaaktOp: quote.aangemaaktOp,
    gewijzigdOp: quote.gewijzigdOp
  };
}

function toQuoteSummary(
  tenantSlug: string,
  quote: Doc<"quotes">
): Omit<PortalQuote, "lines"> {
  return {
    id: String(quote._id),
    tenantId: tenantSlug,
    projectId: String(quote.projectId),
    klantId: String(quote.klantId),
    offertenummer: quote.offertenummer,
    titel: quote.titel,
    status: quote.status,
    verzondenOp: quote.verzondenOp,
    geldigTot: quote.geldigTot,
    subtotaalExBtw: quote.subtotaalExBtw,
    btwTotaal: quote.btwTotaal,
    totaalInclBtw: quote.totaalInclBtw,
    createdByExternalUserId: quote.createdByExternalUserId,
    aangemaaktOp: quote.aangemaaktOp,
    gewijzigdOp: quote.gewijzigdOp
  };
}

function toQuoteTemplate(tenantSlug: string, template: Doc<"quoteTemplates">): QuoteTemplate {
  return {
    id: String(template._id),
    tenantId: tenantSlug,
    naam: template.naam,
    type: template.type,
    status: template.status,
    inleidingTekst: template.inleidingTekst,
    afsluitTekst: template.afsluitTekst,
    secties: template.secties ?? [],
    standaardVoorwaarden: template.standaardVoorwaarden,
    betalingsvoorwaarden: template.betalingsvoorwaarden ?? [],
    standaardRegels: template.standaardRegels
  };
}

function customerAddress(customer: Doc<"customers"> | undefined | null) {
  if (!customer) {
    return undefined;
  }

  return [customer.straat, customer.huisnummer, customer.postcode, customer.plaats]
    .filter(Boolean)
    .join(" ");
}

function activeFieldQuote(quotes: Doc<"quotes">[], projectId: Id<"projects">) {
  return quotes
    .filter((quote) => quote.projectId === projectId)
    .filter((quote) =>
      quote.status === "draft" ||
      quote.status === "sent" ||
      quote.status === "accepted"
    )
    .sort((left, right) => right.gewijzigdOp - left.gewijzigdOp)[0];
}

function latestMeasurement(measurements: Doc<"measurements">[], projectId: Id<"projects">) {
  return measurements
    .filter((measurement) => measurement.projectId === projectId)
    .sort((left, right) => right.gewijzigdOp - left.gewijzigdOp)[0];
}

function fieldVisitTimestamp(
  project: Doc<"projects">,
  measurement: Doc<"measurements"> | undefined
) {
  if (project.status === "execution_planned" || project.status === "in_progress") {
    return project.uitvoerdatum ?? project.inmeetdatum ?? measurement?.inmeetdatum;
  }

  return project.inmeetdatum ?? measurement?.inmeetdatum;
}

function isDueTodayOrEarlier(timestamp: number | undefined, now: number) {
  if (!timestamp) {
    return false;
  }

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  return timestamp <= todayEnd.getTime();
}

function sortProjectTasks(tasks: Doc<"projectTasks">[]) {
  return tasks.slice().sort((left, right) => {
    if (left.status === right.status) {
      return left.vervaltOp - right.vervaltOp || right.gewijzigdOp - left.gewijzigdOp;
    }

    return left.status === "open" ? -1 : 1;
  });
}

function fieldBucket(
  project: Doc<"projects">,
  quote: Doc<"quotes"> | undefined,
  measurement: Doc<"measurements"> | undefined,
  now: number,
  tasks: Doc<"projectTasks">[] = []
) {
  const firstOpenTask = sortProjectTasks(tasks).find((task) => task.status === "open");

  if (isDueTodayOrEarlier(firstOpenTask?.vervaltOp, now)) {
    return "today";
  }

  if (isDueTodayOrEarlier(fieldVisitTimestamp(project, measurement), now)) {
    return "today";
  }

  if (firstOpenTask) {
    return "followUp";
  }

  if (project.status === "execution_planned" || project.status === "in_progress") {
    return "followUp";
  }

  if (
    quote?.status === "draft" ||
    project.status === "quote_draft" ||
    measurement?.status === "measured" ||
    measurement?.status === "reviewed"
  ) {
    return "quote";
  }

  if (
    quote?.status === "sent" ||
    quote?.status === "accepted" ||
    project.status === "quote_sent" ||
    project.status === "quote_accepted"
  ) {
    return "followUp";
  }

  if (["lead", "measurement_planned"].includes(project.status)) {
    return "measure";
  }

  return "followUp";
}

function fieldNextAction(bucket: "today" | "measure" | "quote" | "followUp") {
  const labels = {
    today: "Vandaag bezoeken",
    measure: "Inmeten",
    quote: "Conceptofferte maken",
    followUp: "Opvolgen"
  };

  return labels[bucket];
}

export const fieldServiceWorkspace = query({
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

    const allowedStatuses = [
      "lead",
      "quote_draft",
      "quote_sent",
      "quote_accepted",
      "measurement_planned",
      "execution_planned",
      "ordering",
      "in_progress",
      "invoiced"
    ];

    // Fetch only projects matching active statuses using status index
    const projectsPromises = allowedStatuses.map((status) =>
      ctx.db
        .query("projects")
        .withIndex("by_status", (q: any) => q.eq("tenantId", tenant._id).eq("status", status))
        .collect()
    );
    const projectsList = await Promise.all(projectsPromises);
    const projects = projectsList.flat().sort((left, right) => right.aangemaaktOp - left.aangemaaktOp);

    if (projects.length === 0) {
      return {
        today: [],
        measure: [],
        quote: [],
        followUp: [],
        counts: { today: 0, measure: 0, quote: 0, followUp: 0 }
      };
    }

    const projectIds = projects.map((p) => p._id);
    const customerIds = [...new Set(projects.map((p) => p.klantId))];

    // Fetch related records scoped to the active projects/customers
    const [customers, quotesList, measurementsList, projectTasksList] = await Promise.all([
      Promise.all(customerIds.map((id) => ctx.db.get(id))),
      Promise.all(
        projectIds.map((projectId) =>
          ctx.db
            .query("quotes")
            .withIndex("by_project", (q: any) => q.eq("tenantId", tenant._id).eq("projectId", projectId))
            .collect()
        )
      ),
      Promise.all(
        projectIds.map((projectId) =>
          ctx.db
            .query("measurements")
            .withIndex("by_project", (q: any) => q.eq("tenantId", tenant._id).eq("projectId", projectId))
            .collect()
        )
      ),
      Promise.all(
        projectIds.map((projectId) =>
          ctx.db
            .query("projectTasks")
            .withIndex("by_project", (q: any) => q.eq("tenantId", tenant._id).eq("projectId", projectId))
            .collect()
        )
      )
    ]);

    const activeCustomers = customers.filter(Boolean) as Doc<"customers">[];
    const quotes = quotesList.flat();
    const measurements = measurementsList.flat();
    const projectTasks = projectTasksList.flat().filter((t) => t.status === "open");

    const customerById = new Map(
      activeCustomers.map((customer: Doc<"customers">) => [String(customer._id), customer])
    );
    const tasksByProjectId = new Map<string, Doc<"projectTasks">[]>();

    for (const task of projectTasks) {
      const projectTasksForProject = tasksByProjectId.get(String(task.projectId)) ?? [];
      projectTasksForProject.push(task);
      tasksByProjectId.set(String(task.projectId), projectTasksForProject);
    }
    const grouped = {
      today: [] as any[],
      measure: [] as any[],
      quote: [] as any[],
      followUp: [] as any[]
    };
    const now = Date.now();

    const cards = await Promise.all(
      projects
        .filter((project: Doc<"projects">) => allowedStatuses.includes(project.status))
        .map(async (project: Doc<"projects">): Promise<FieldWorkspaceCard> => {
          const customer = customerById.get(String(project.klantId));
          const quote = activeFieldQuote(quotes, project._id);
          const measurement = latestMeasurement(measurements, project._id);
          const tasks = sortProjectTasks(tasksByProjectId.get(String(project._id)) ?? []);
          const nextTask = tasks.find((task) => task.status === "open");
          const bucket = fieldBucket(project, quote, measurement, now, tasks);
          const visitAt = fieldVisitTimestamp(project, measurement);

          return {
            id: String(project._id),
            href: `/portal/buitendienst/projecten/${project._id}`,
            bucket,
            nextAction: nextTask?.titel ?? fieldNextAction(bucket),
            visitAt,
            address: customerAddress(customer),
            telefoon: customer?.telefoon,
            email: customer?.email,
            gewijzigdOp: Math.max(
              project.gewijzigdOp,
              quote?.gewijzigdOp ?? 0,
              measurement?.gewijzigdOp ?? 0,
              nextTask?.gewijzigdOp ?? 0
            ),
            project: await toProject(ctx, tenant.slug, project),
            customer: customer ? toCustomer(tenant.slug, customer) : null,
            latestQuote: quote ? toQuoteSummary(tenant.slug, quote) : null,
            tasks: tasks.map((task) => toProjectTask(tenant.slug, task)),
            measurement: measurement
              ? {
                  id: String(measurement._id),
                  status: measurement.status,
                  inmeetdatum: measurement.inmeetdatum,
                  gemetenDoor: measurement.gemetenDoor,
                  gewijzigdOp: measurement.gewijzigdOp
                }
              : null
          };
        })
    );

    for (const card of cards.sort((left, right) => right.gewijzigdOp - left.gewijzigdOp)) {
      grouped[card.bucket as keyof typeof grouped].push(card);
    }

    return {
      today: grouped.today,
      measure: grouped.measure,
      quote: grouped.quote,
      followUp: grouped.followUp,
      counts: {
        today: grouped.today.length,
        measure: grouped.measure.length,
        quote: grouped.quote.length,
        followUp: grouped.followUp.length
      }
    };
  }
});

export const fieldProjectWorkspace = query({
  args: {
    tenantSlug: v.string(),
    projectId: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    const projectId = normalizeProjectId(ctx, args.projectId);

    if (!projectId) {
      return null;
    }

    const project = await ctx.db.get(projectId);

    if (!project || project.tenantId !== tenant._id) {
      return null;
    }

    const [customer, quotes, templates, measurements, projectTasks] = await Promise.all([
      ctx.db.get(project.klantId),
      ctx.db
        .query("quotes")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .order("desc")
        .collect(),
      ctx.db
        .query("quoteTemplates")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("measurements")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect(),
      ctx.db
        .query("projectTasks")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect()
    ]);
    const measurement = latestMeasurement(measurements, project._id);
    const visitAt = fieldVisitTimestamp(project, measurement);

    return {
      project: await toProject(ctx, tenant.slug, project),
      customer: customer ? toCustomer(tenant.slug, customer) : null,
      quotes: await Promise.all(
        quotes
          .filter((quote: Doc<"quotes">) =>
            quote.status === "draft" ||
            quote.status === "sent" ||
            quote.status === "accepted"
          )
          .map((quote: Doc<"quotes">) => toQuote(ctx, tenant.slug, quote))
      ),
      templates: templates
        .filter((template: Doc<"quoteTemplates">) => template.status === "active")
        .map((template: Doc<"quoteTemplates">) => toQuoteTemplate(tenant.slug, template)),
      tasks: sortProjectTasks(projectTasks).map((task: Doc<"projectTasks">) =>
        toProjectTask(tenant.slug, task)
      ),
      visit: {
        status: visitAt ? "Afspraak bekend" : "Nog geen meetmoment",
        visitAt,
        measurementStatus: measurement?.status,
        gemetenDoor: measurement?.gemetenDoor,
        omvang: measurement?.omvang
      }
    };
  }
});
