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
    displayName: customer.displayName,
    email: customer.email,
    phone: customer.phone,
    street: customer.street,
    houseNumber: customer.houseNumber,
    postalCode: customer.postalCode,
    city: customer.city,
    notes: customer.notes,
    status: customer.status,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt
  };
}

function toRoom(room: Doc<"projectRooms">) {
  return {
    id: String(room._id),
    projectId: String(room.projectId),
    name: room.name,
    floor: room.floor,
    widthCm: room.widthCm,
    lengthCm: room.lengthCm,
    areaM2: room.areaM2,
    perimeterMeter: room.perimeterMeter,
    notes: room.notes,
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
    customerId: String(project.customerId),
    title: project.title,
    description: project.description,
    status: project.status,
    measurementDate: project.measurementDate,
    executionDate: project.executionDate,
    internalNotes: project.internalNotes,
    customerNotes: project.customerNotes,
    acceptedAt: project.acceptedAt,
    measurementPlannedAt: project.measurementPlannedAt,
    executionPlannedAt: project.executionPlannedAt,
    orderedAt: project.orderedAt,
    invoicedAt: project.invoicedAt,
    paidAt: project.paidAt,
    closedAt: project.closedAt,
    rooms: rooms.map(toRoom),
    createdByExternalUserId: project.createdByExternalUserId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function toProjectTask(tenantSlug: string, task: Doc<"projectTasks">) {
  const priority = taskPriority(task.dueAt);

  return {
    id: String(task._id),
    tenantId: tenantSlug,
    projectId: String(task.projectId),
    quoteId: task.quoteId ? String(task.quoteId) : undefined,
    type: task.type,
    title: task.title,
    dueAt: task.dueAt,
    status: task.status,
    priority,
    completedAt: task.completedAt,
    dismissedAt: task.dismissedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function toQuoteLine(line: Doc<"quoteLines">) {
  return {
    id: String(line._id),
    quoteId: String(line.quoteId),
    projectRoomId: line.projectRoomId ? String(line.projectRoomId) : undefined,
    productId: line.productId ? String(line.productId) : undefined,
    lineType: line.lineType,
    title: line.title,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPriceExVat: line.unitPriceExVat,
    vatRate: line.vatRate,
    discountExVat: line.discountExVat,
    lineTotalExVat: line.lineTotalExVat,
    lineVatTotal: line.lineVatTotal,
    lineTotalIncVat: line.lineTotalIncVat,
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
    customerId: String(quote.customerId),
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    status: quote.status,
    sentAt: quote.sentAt,
    validUntil: quote.validUntil,
    introText: quote.introText,
    closingText: quote.closingText,
    terms: quote.terms,
    paymentTerms: quote.paymentTerms,
    subtotalExVat: quote.subtotalExVat,
    vatTotal: quote.vatTotal,
    totalIncVat: quote.totalIncVat,
    lines: lines
      .sort((left: Doc<"quoteLines">, right: Doc<"quoteLines">) => left.sortOrder - right.sortOrder)
      .map(toQuoteLine),
    createdByExternalUserId: quote.createdByExternalUserId,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt
  };
}

function toQuoteSummary(tenantSlug: string, quote: Doc<"quotes">) {
  return {
    id: String(quote._id),
    tenantId: tenantSlug,
    projectId: String(quote.projectId),
    customerId: String(quote.customerId),
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    status: quote.status,
    sentAt: quote.sentAt,
    validUntil: quote.validUntil,
    subtotalExVat: quote.subtotalExVat,
    vatTotal: quote.vatTotal,
    totalIncVat: quote.totalIncVat,
    createdByExternalUserId: quote.createdByExternalUserId,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt
  };
}

function toQuoteTemplate(tenantSlug: string, template: Doc<"quoteTemplates">) {
  return {
    id: String(template._id),
    tenantId: tenantSlug,
    name: template.name,
    type: template.type,
    status: template.status,
    introText: template.introText,
    closingText: template.closingText,
    sections: template.sections ?? [],
    defaultTerms: template.defaultTerms,
    paymentTerms: template.paymentTerms ?? [],
    defaultLines: template.defaultLines
  };
}

function customerAddress(customer: Doc<"customers"> | undefined | null) {
  if (!customer) {
    return undefined;
  }

  return [customer.street, customer.houseNumber, customer.postalCode, customer.city]
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
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

function latestMeasurement(measurements: Doc<"measurements">[], projectId: Id<"projects">) {
  return measurements
    .filter((measurement) => measurement.projectId === projectId)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

function fieldVisitTimestamp(
  project: Doc<"projects">,
  measurement: Doc<"measurements"> | undefined
) {
  if (project.status === "execution_planned" || project.status === "in_progress") {
    return project.executionDate ?? project.measurementDate ?? measurement?.measurementDate;
  }

  return project.measurementDate ?? measurement?.measurementDate;
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
      return left.dueAt - right.dueAt || right.updatedAt - left.updatedAt;
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

  if (isDueTodayOrEarlier(firstOpenTask?.dueAt, now)) {
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
    const projects = projectsList.flat().sort((left, right) => right.createdAt - left.createdAt);

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
    const customerIds = [...new Set(projects.map((p) => p.customerId))];

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
          const customer = customerById.get(String(project.customerId));
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
            nextAction: nextTask?.title ?? fieldNextAction(bucket),
            visitAt,
            address: customerAddress(customer),
            phone: customer?.phone,
            email: customer?.email,
            updatedAt: Math.max(
              project.updatedAt,
              quote?.updatedAt ?? 0,
              measurement?.updatedAt ?? 0,
              nextTask?.updatedAt ?? 0
            ),
            project: await toProject(ctx, tenant.slug, project),
            customer: customer ? toCustomer(tenant.slug, customer) : null,
            latestQuote: quote ? toQuoteSummary(tenant.slug, quote) : null,
            tasks: tasks.map((task) => toProjectTask(tenant.slug, task)),
            measurement: measurement
              ? {
                  id: String(measurement._id),
                  status: measurement.status,
                  measurementDate: measurement.measurementDate,
                  updatedAt: measurement.updatedAt
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
      ctx.db.get(project.customerId),
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
