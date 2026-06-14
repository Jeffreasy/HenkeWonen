import { query } from "../_generated/server";
import { v } from "convex/values";
import { readActorValidator, requireQueryRole } from "../authz";
import type { Doc, Id } from "../_generated/dataModel";

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

function toCustomer(tenantSlug: string, customer: Doc<"customers">) {
  return {
    id: String(customer._id),
    tenantId: tenantSlug,
    type: customer.type,
    displayName: customer.weergaveNaam,
    email: customer.email,
    phone: customer.telefoon,
    street: customer.straat,
    houseNumber: customer.huisnummer,
    postalCode: customer.postcode,
    city: customer.plaats,
    notes: customer.notities,
    status: customer.status,
    createdAt: customer.aangemaaktOp,
    updatedAt: customer.gewijzigdOp
  };
}

function toRoom(room: Doc<"projectRooms">) {
  return {
    id: String(room._id),
    projectId: String(room.projectId),
    name: room.naam,
    floor: room.verdieping,
    widthCm: room.breedteCm,
    lengthCm: room.lengteCm,
    areaM2: room.oppervlakteM2,
    perimeterMeter: room.omtrekMeter,
    notes: room.notities,
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

async function toProject(ctx: any, tenantSlug: string, project: Doc<"projects">) {
  const rooms = await getRooms(ctx, project.tenantId, project._id);

  return {
    id: String(project._id),
    tenantId: tenantSlug,
    customerId: String(project.klantId),
    title: project.titel,
    description: project.omschrijving,
    status: project.status,
    measurementDate: project.inmeetdatum,
    executionDate: project.uitvoerdatum,
    internalNotes: project.interneNotities,
    customerNotes: project.klantNotities,
    acceptedAt: project.geaccepteerdOp,
    measurementPlannedAt: project.inmeetGeplandOp,
    executionPlannedAt: project.uitvoerGeplandOp,
    orderedAt: project.besteldOp,
    invoicedAt: project.gefactureerdOp,
    paidAt: project.betaaldOp,
    closedAt: project.afgeslotenOp,
    rooms: rooms.map(toRoom),
    createdByExternalUserId: project.createdByExternalUserId,
    createdAt: project.aangemaaktOp,
    updatedAt: project.gewijzigdOp
  };
}

function toProjectTask(tenantSlug: string, task: Doc<"projectTasks">) {
  const priority = taskPriority(task.vervaltOp);

  return {
    id: String(task._id),
    tenantId: tenantSlug,
    projectId: String(task.projectId),
    quoteId: task.quoteId ? String(task.quoteId) : undefined,
    type: task.type,
    title: task.titel,
    dueAt: task.vervaltOp,
    status: task.status,
    priority,
    completedAt: task.voltooidOp,
    dismissedAt: task.afgewezenOp,
    createdAt: task.aangemaaktOp,
    updatedAt: task.gewijzigdOp
  };
}

function toQuoteLine(line: Doc<"quoteLines">) {
  return {
    id: String(line._id),
    quoteId: String(line.quoteId),
    projectRoomId: line.projectRuimteId ? String(line.projectRuimteId) : undefined,
    productId: line.productId ? String(line.productId) : undefined,
    lineType: line.regelType,
    title: line.titel,
    description: line.omschrijving,
    quantity: line.aantal,
    unit: line.eenheid,
    unitPriceExVat: line.eenheidsprijsExBtw,
    vatRate: line.btwTarief,
    discountExVat: line.kortingExBtw,
    lineTotalExVat: line.regelTotaalExBtw,
    lineVatTotal: line.regelBtwTotaal,
    lineTotalIncVat: line.regelTotaalInclBtw,
    sortOrder: line.sortOrder,
    metadata: line.metadata
  };
}

async function toQuote(ctx: any, tenantSlug: string, quote: Doc<"quotes">) {
  const lines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", quote.tenantId).eq("quoteId", quote._id))
    .collect();

  return {
    id: String(quote._id),
    tenantId: tenantSlug,
    projectId: String(quote.projectId),
    customerId: String(quote.klantId),
    quoteNumber: quote.offertenummer,
    title: quote.titel,
    status: quote.status,
    sentAt: quote.verzondenOp,
    validUntil: quote.geldigTot,
    introText: quote.inleidingTekst,
    closingText: quote.afsluitTekst,
    terms: quote.voorwaarden,
    paymentTerms: quote.betalingsvoorwaarden,
    subtotalExVat: quote.subtotaalExBtw,
    vatTotal: quote.btwTotaal,
    totalIncVat: quote.totaalInclBtw,
    lines: lines
      .sort((left: Doc<"quoteLines">, right: Doc<"quoteLines">) => left.sortOrder - right.sortOrder)
      .map(toQuoteLine),
    createdByExternalUserId: quote.createdByExternalUserId,
    createdAt: quote.aangemaaktOp,
    updatedAt: quote.gewijzigdOp
  };
}

function toQuoteSummary(tenantSlug: string, quote: Doc<"quotes">) {
  return {
    id: String(quote._id),
    tenantId: tenantSlug,
    projectId: String(quote.projectId),
    customerId: String(quote.klantId),
    quoteNumber: quote.offertenummer,
    title: quote.titel,
    status: quote.status,
    sentAt: quote.verzondenOp,
    validUntil: quote.geldigTot,
    subtotalExVat: quote.subtotaalExBtw,
    vatTotal: quote.btwTotaal,
    totalIncVat: quote.totaalInclBtw,
    createdByExternalUserId: quote.createdByExternalUserId,
    createdAt: quote.aangemaaktOp,
    updatedAt: quote.gewijzigdOp
  };
}

function toQuoteTemplate(tenantSlug: string, template: Doc<"quoteTemplates">) {
  return {
    id: String(template._id),
    tenantId: tenantSlug,
    name: template.naam,
    type: template.type,
    status: template.status,
    introText: template.inleidingTekst,
    closingText: template.afsluitTekst,
    sections: template.secties ?? [],
    defaultTerms: template.standaardVoorwaarden,
    paymentTerms: template.betalingsvoorwaarden ?? [],
    defaultLines: template.standaardRegels
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
        .map(async (project: Doc<"projects">) => {
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
            phone: customer?.telefoon,
            email: customer?.email,
            updatedAt: Math.max(
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
                  measurementDate: measurement.inmeetdatum,
                  updatedAt: measurement.gewijzigdOp
                }
              : null
          };
        })
    );

    for (const card of cards.sort((left, right) => right.updatedAt - left.updatedAt)) {
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
        measurementStatus: measurement?.status
      }
    };
  }
});
