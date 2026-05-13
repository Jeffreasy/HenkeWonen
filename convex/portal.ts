import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutationActorValidator, requireMutationRole } from "./authz";
import { pilotHiddenReason } from "./pilotCatalog";

const customerType = v.union(v.literal("private"), v.literal("business"));
const customerStatus = v.union(
  v.literal("lead"),
  v.literal("active"),
  v.literal("inactive"),
  v.literal("archived")
);

const customerContactType = v.union(
  v.literal("note"),
  v.literal("call"),
  v.literal("email"),
  v.literal("visit"),
  v.literal("loaned_item"),
  v.literal("agreement")
);

const projectStatus = v.union(
  v.literal("lead"),
  v.literal("quote_draft"),
  v.literal("quote_sent"),
  v.literal("quote_accepted"),
  v.literal("quote_rejected"),
  v.literal("measurement_planned"),
  v.literal("execution_planned"),
  v.literal("ordering"),
  v.literal("in_progress"),
  v.literal("invoiced"),
  v.literal("paid"),
  v.literal("closed"),
  v.literal("cancelled")
);

const quoteStatus = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("expired"),
  v.literal("cancelled")
);

const activeStatus = v.union(v.literal("active"), v.literal("inactive"));
const supplierStatus = v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"));

const serviceRuleCalculationType = v.union(
  v.literal("fixed"),
  v.literal("per_m2"),
  v.literal("per_meter"),
  v.literal("per_roll"),
  v.literal("per_side"),
  v.literal("per_staircase"),
  v.literal("manual")
);

const quoteLineType = v.union(
  v.literal("product"),
  v.literal("service"),
  v.literal("labor"),
  v.literal("material"),
  v.literal("discount"),
  v.literal("text"),
  v.literal("manual")
);

const workflowEventType = v.union(
  v.literal("customer_contact"),
  v.literal("quote_created"),
  v.literal("measurement_requested"),
  v.literal("measurement_planned"),
  v.literal("quote_sent"),
  v.literal("quote_accepted"),
  v.literal("thank_you_letter_sent"),
  v.literal("execution_planned"),
  v.literal("supplier_order_created"),
  v.literal("invoice_created"),
  v.literal("payment_reminder_sent"),
  v.literal("payment_received"),
  v.literal("bookkeeper_export_sent"),
  v.literal("closed")
);

const projectTaskStatus = v.union(
  v.literal("open"),
  v.literal("done"),
  v.literal("dismissed")
);

const productListStatus = v.union(
  v.literal("unknown"),
  v.literal("requested"),
  v.literal("received"),
  v.literal("download_available"),
  v.literal("not_available"),
  v.literal("manual_only")
);

function hasArg<T extends object>(args: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(args, key);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addCalendarDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function invoicePaymentTermDays(customer?: Doc<"customers"> | null) {
  return customer?.type === "business" ? 21 : 8;
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

async function getTenant(ctx: any, tenantSlug: string): Promise<Doc<"tenants"> | null> {
  return await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q: any) => q.eq("slug", tenantSlug))
    .first();
}

async function requireTenant(ctx: any, tenantSlug: string): Promise<Doc<"tenants">> {
  const tenant = await getTenant(ctx, tenantSlug);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateLineTotals(
  lineType: string,
  quantity: number,
  unitPriceExVat: number,
  vatRate: number,
  discountExVat?: number
) {
  if (lineType === "text") {
    return { lineTotalExVat: 0, lineVatTotal: 0, lineTotalIncVat: 0 };
  }

  const lineTotalExVat = roundMoney(quantity * unitPriceExVat - (discountExVat ?? 0));
  const lineVatTotal = roundMoney(lineTotalExVat * (vatRate / 100));

  return {
    lineTotalExVat,
    lineVatTotal,
    lineTotalIncVat: roundMoney(lineTotalExVat + lineVatTotal)
  };
}

async function recalculateQuote(ctx: any, tenantId: Id<"tenants">, quoteId: Id<"quotes">) {
  const quote = await ctx.db.get(quoteId);

  if (!quote || quote.tenantId !== tenantId) {
    throw new Error("Quote not found");
  }

  const lines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", tenantId).eq("quoteId", quoteId))
    .collect();
  const subtotalExVat = roundMoney(
    lines.reduce((sum: number, line: Doc<"quoteLines">) => sum + line.lineTotalExVat, 0)
  );
  const vatTotal = roundMoney(
    lines.reduce((sum: number, line: Doc<"quoteLines">) => sum + line.lineVatTotal, 0)
  );

  await ctx.db.patch(quoteId, {
    subtotalExVat,
    vatTotal,
    totalIncVat: roundMoney(subtotalExVat + vatTotal),
    updatedAt: Date.now()
  });
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

function toContact(tenantSlug: string, contact: Doc<"customerContacts">) {
  return {
    id: String(contact._id),
    tenantId: tenantSlug,
    customerId: String(contact.customerId),
    type: contact.type,
    title: contact.title,
    description: contact.description,
    loanedItemName: contact.loanedItemName,
    expectedReturnDate: contact.expectedReturnDate,
    returnedAt: contact.returnedAt,
    visibleToCustomer: contact.visibleToCustomer,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt
  };
}

function toWorkflowEvent(tenantSlug: string, event: Doc<"projectWorkflowEvents">) {
  return {
    id: String(event._id),
    tenantId: tenantSlug,
    projectId: String(event.projectId),
    type: event.type,
    title: event.title,
    description: event.description,
    visibleToCustomer: event.visibleToCustomer,
    createdAt: event.createdAt
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
    .filter((quote) => quote.status === "draft" || quote.status === "sent")
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
  return project.measurementDate ?? project.measurementPlannedAt ?? measurement?.measurementDate;
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

  if (firstOpenTask) {
    return "followUp";
  }

  if (isDueTodayOrEarlier(fieldVisitTimestamp(project, measurement), now)) {
    return "today";
  }

  if (
    quote?.status === "draft" ||
    project.status === "quote_draft" ||
    measurement?.status === "measured" ||
    measurement?.status === "reviewed"
  ) {
    return "quote";
  }

  if (quote?.status === "sent" || project.status === "quote_sent") {
    return "followUp";
  }

  if (["lead", "quote_accepted", "measurement_planned"].includes(project.status)) {
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

function toSupplier(
  tenantSlug: string,
  supplier: Doc<"suppliers">,
  metrics?: {
    activeProductCount?: number;
    importProfileCount?: number;
    importBatchCount?: number;
    sourceFileCount?: number;
    sourceFileNames?: string[];
    latestImportStatus?: string;
    latestImportAt?: number;
  }
) {
  return {
    id: String(supplier._id),
    tenantId: tenantSlug,
    name: supplier.name,
    contactName: supplier.contactName,
    email: supplier.email,
    phone: supplier.phone,
    productListStatus: supplier.productListStatus,
    status: supplier.status ?? "active",
    notes: supplier.notes,
    lastContactAt: supplier.lastContactAt,
    expectedAt: supplier.expectedAt,
    activeProductCount: metrics?.activeProductCount ?? 0,
    importProfileCount: metrics?.importProfileCount ?? 0,
    importBatchCount: metrics?.importBatchCount ?? 0,
    sourceFileCount: metrics?.sourceFileCount ?? 0,
    sourceFileNames: metrics?.sourceFileNames ?? [],
    latestImportStatus: metrics?.latestImportStatus,
    latestImportAt: metrics?.latestImportAt,
    updatedAt: supplier.updatedAt
  };
}

async function findSupplierByName(ctx: any, tenantId: Id<"tenants">, name: string) {
  return await ctx.db
    .query("suppliers")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("name"), name))
    .first();
}

async function latestQuoteForProject(ctx: any, tenantId: Id<"tenants">, projectId: Id<"projects">) {
  const quotes = await ctx.db
    .query("quotes")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();

  return quotes.sort((left: Doc<"quotes">, right: Doc<"quotes">) => right.updatedAt - left.updatedAt)[0];
}

async function addProjectEvent(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  type: Doc<"projectWorkflowEvents">["type"],
  title: string,
  externalUserId?: string,
  description?: string
) {
  await ctx.db.insert("projectWorkflowEvents", {
    tenantId,
    projectId,
    type,
    title,
    description,
    visibleToCustomer: false,
    createdByExternalUserId: externalUserId,
    createdAt: Date.now()
  });
}

async function upsertProjectTask(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  type: Doc<"projectTasks">["type"],
  title: string,
  dueAt: number,
  externalUserId?: string,
  quoteId?: Id<"quotes">
) {
  const existing = (
    await ctx.db
      .query("projectTasks")
      .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
      .collect()
  ).find(
    (task: Doc<"projectTasks">) =>
      task.status === "open" &&
      task.type === type &&
      String(task.quoteId ?? "") === String(quoteId ?? "")
  );
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      title,
      dueAt,
      updatedAt: now
    });
    return existing._id;
  }

  return await ctx.db.insert("projectTasks", {
    tenantId,
    projectId,
    quoteId,
    type,
    title,
    dueAt,
    status: "open",
    createdByExternalUserId: externalUserId,
    createdAt: now,
    updatedAt: now
  });
}

async function closeOpenProjectTasks(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  type: Doc<"projectTasks">["type"],
  status: "done" | "dismissed",
  quoteId?: Id<"quotes">
) {
  const tasks = await ctx.db
    .query("projectTasks")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();
  const now = Date.now();

  await Promise.all(
    tasks
      .filter(
        (task: Doc<"projectTasks">) =>
          task.status === "open" &&
          task.type === type &&
          (quoteId === undefined || String(task.quoteId ?? "") === String(quoteId))
      )
      .map((task: Doc<"projectTasks">) =>
        ctx.db.patch(task._id, {
          status,
          completedAt: status === "done" ? now : task.completedAt,
          dismissedAt: status === "dismissed" ? now : task.dismissedAt,
          updatedAt: now
        })
      )
  );
}

async function validateQuoteLineProduct(
  ctx: any,
  tenantId: Id<"tenants">,
  productId?: string
) {
  if (!productId) {
    return undefined;
  }

  const product = await ctx.db.get(productId as Id<"products">);

  if (!product || product.tenantId !== tenantId) {
    throw new Error("Product not found");
  }

  const category = product.categoryId ? await ctx.db.get(product.categoryId) : null;
  const hiddenReason = pilotHiddenReason(product, category?.name);

  if (hiddenReason) {
    throw new Error(hiddenReason);
  }

  return product._id;
}

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

export const listCustomers = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .order("desc")
      .collect();

    return customers.map((customer: Doc<"customers">) => toCustomer(tenant.slug, customer));
  }
});

export const createCustomer = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    type: customerType,
    displayName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    houseNumber: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const now = Date.now();

    return await ctx.db.insert("customers", {
      tenantId: tenant._id,
      type: args.type,
      displayName: args.displayName,
      email: args.email,
      phone: args.phone,
      street: args.street,
      houseNumber: args.houseNumber,
      postalCode: args.postalCode,
      city: args.city,
      country: "Nederland",
      notes: args.notes,
      status: "lead",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateCustomer = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    customerId: v.string(),
    type: v.optional(customerType),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    houseNumber: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(customerStatus)
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const customer = await ctx.db.get(args.customerId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new Error("Customer not found");
    }

    const patch: Partial<Doc<"customers">> = { updatedAt: Date.now() };

    if (args.type !== undefined) patch.type = args.type;
    if (args.displayName !== undefined) patch.displayName = args.displayName;
    if (hasArg(args, "email")) patch.email = args.email;
    if (hasArg(args, "phone")) patch.phone = args.phone;
    if (hasArg(args, "street")) patch.street = args.street;
    if (hasArg(args, "houseNumber")) patch.houseNumber = args.houseNumber;
    if (hasArg(args, "postalCode")) patch.postalCode = args.postalCode;
    if (hasArg(args, "city")) patch.city = args.city;
    if (hasArg(args, "notes")) patch.notes = args.notes;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(customer._id, patch);

    return customer._id;
  }
});

export const customerDetail = query({
  args: {
    tenantSlug: v.string(),
    customerId: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const customer = await ctx.db.get(args.customerId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      return null;
    }

    const [projects, contacts] = await Promise.all([
      ctx.db
        .query("projects")
        .withIndex("by_customer", (q: any) =>
          q.eq("tenantId", tenant._id).eq("customerId", customer._id)
        )
        .collect(),
      ctx.db
        .query("customerContacts")
        .withIndex("by_customer", (q: any) =>
          q.eq("tenantId", tenant._id).eq("customerId", customer._id)
        )
        .order("desc")
        .collect()
    ]);

    return {
      customer: toCustomer(tenant.slug, customer),
      projects: await Promise.all(
        projects.map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
      ),
      contacts: contacts.map((contact: Doc<"customerContacts">) =>
        toContact(tenant.slug, contact)
      )
    };
  }
});

export const createCustomerContact = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    customerId: v.string(),
    type: customerContactType,
    title: v.string(),
    description: v.optional(v.string()),
    loanedItemName: v.optional(v.string()),
    expectedReturnDate: v.optional(v.number()),
    visibleToCustomer: v.boolean(),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const customer = await ctx.db.get(args.customerId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new Error("Customer not found");
    }

    const now = Date.now();

    return await ctx.db.insert("customerContacts", {
      tenantId: tenant._id,
      customerId: customer._id,
      type: args.type,
      title: args.title,
      description: args.description,
      loanedItemName: args.loanedItemName,
      expectedReturnDate: args.expectedReturnDate,
      visibleToCustomer: args.visibleToCustomer,
      createdByExternalUserId: externalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const listProjects = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const [customers, projects] = await Promise.all([
      ctx.db
        .query("customers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect()
    ]);
    const customerById = new Map(
      customers.map((customer: Doc<"customers">) => [String(customer._id), customer.displayName])
    );

    return await Promise.all(
      projects.map(async (project: Doc<"projects">) => ({
        ...(await toProject(ctx, tenant.slug, project)),
        customerName: customerById.get(String(project.customerId)) ?? "-"
      }))
    );
  }
});

export const dossierWorkspace = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const [customers, projects, quotes] = await Promise.all([
      ctx.db
        .query("customers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("quotes")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect()
    ]);

    return {
      customers: customers.map((customer: Doc<"customers">) => toCustomer(tenant.slug, customer)),
      projects: await Promise.all(
        projects.map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
      ),
      quotes: quotes.map((quote: Doc<"quotes">) => toQuoteSummary(tenant.slug, quote))
    };
  }
});

export const fieldServiceWorkspace = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const [customers, projects, quotes, measurements, projectTasks] = await Promise.all([
      ctx.db
        .query("customers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("quotes")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("measurements")
        .withIndex("by_status", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("projectTasks")
        .withIndex("by_status", (q: any) => q.eq("tenantId", tenant._id).eq("status", "open"))
        .collect()
    ]);
    const customerById = new Map(
      customers.map((customer: Doc<"customers">) => [String(customer._id), customer])
    );
    const tasksByProjectId = new Map<string, Doc<"projectTasks">[]>();

    for (const task of projectTasks) {
      const projectTasksForProject = tasksByProjectId.get(String(task.projectId)) ?? [];
      projectTasksForProject.push(task);
      tasksByProjectId.set(String(task.projectId), projectTasksForProject);
    }

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
    projectId: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

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
          .filter((quote: Doc<"quotes">) => quote.status === "draft" || quote.status === "sent")
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

export const createProject = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    customerId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const customer = await ctx.db.get(args.customerId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new Error("Customer not found");
    }

    const now = Date.now();

    return await ctx.db.insert("projects", {
      tenantId: tenant._id,
      customerId: customer._id,
      title: args.title,
      description: args.description,
      status: "lead",
      createdByExternalUserId: externalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateProject = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    preferredExecutionDate: v.optional(v.number()),
    measurementDate: v.optional(v.number()),
    executionDate: v.optional(v.number()),
    internalNotes: v.optional(v.string()),
    customerNotes: v.optional(v.string()),
    status: v.optional(projectStatus)
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    const patch: Partial<Doc<"projects">> = { updatedAt: Date.now() };

    if (args.title !== undefined) patch.title = args.title;
    if (hasArg(args, "description")) patch.description = args.description;
    if (hasArg(args, "preferredExecutionDate")) {
      patch.preferredExecutionDate = args.preferredExecutionDate;
    }
    if (hasArg(args, "measurementDate")) patch.measurementDate = args.measurementDate;
    if (hasArg(args, "executionDate")) patch.executionDate = args.executionDate;
    if (hasArg(args, "internalNotes")) patch.internalNotes = args.internalNotes;
    if (hasArg(args, "customerNotes")) patch.customerNotes = args.customerNotes;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(project._id, patch);

    return project._id;
  }
});

export const projectDetail = query({
  args: {
    tenantSlug: v.string(),
    projectId: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      return null;
    }

    const [customer, workflowEvents, projectTasks] = await Promise.all([
      ctx.db.get(project.customerId),
      ctx.db
        .query("projectWorkflowEvents")
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

    return {
      project: await toProject(ctx, tenant.slug, project),
      customer: customer ? toCustomer(tenant.slug, customer) : null,
      workflowEvents: workflowEvents
        .sort(
          (left: Doc<"projectWorkflowEvents">, right: Doc<"projectWorkflowEvents">) =>
            right.createdAt - left.createdAt
        )
        .map((event: Doc<"projectWorkflowEvents">) => toWorkflowEvent(tenant.slug, event)),
      projectTasks: sortProjectTasks(projectTasks).map((task: Doc<"projectTasks">) =>
        toProjectTask(tenant.slug, task)
      )
    };
  }
});

export const addProjectRoom = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    name: v.string(),
    areaM2: v.optional(v.number()),
    perimeterMeter: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    const rooms = await getRooms(ctx, tenant._id, project._id);
    const now = Date.now();
    const roomId = await ctx.db.insert("projectRooms", {
      tenantId: tenant._id,
      projectId: project._id,
      name: args.name,
      areaM2: args.areaM2,
      perimeterMeter: args.perimeterMeter,
      sortOrder: rooms.length + 1,
      createdAt: now,
      updatedAt: now
    });

    await ctx.db.patch(project._id, { updatedAt: now });

    return roomId;
  }
});

export const updateProjectRoom = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    roomId: v.string(),
    name: v.string(),
    floor: v.optional(v.string()),
    areaM2: v.optional(v.number()),
    perimeterMeter: v.optional(v.number()),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const room = await ctx.db.get(args.roomId as Id<"projectRooms">);

    if (!room || room.tenantId !== tenant._id) {
      throw new Error("Project room not found");
    }

    const now = Date.now();
    await ctx.db.patch(room._id, {
      name: args.name,
      floor: args.floor,
      areaM2: args.areaM2,
      perimeterMeter: args.perimeterMeter,
      notes: args.notes,
      updatedAt: now
    });
    await ctx.db.patch(room.projectId, { updatedAt: now });

    return room._id;
  }
});

export const deleteProjectRoom = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    roomId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const room = await ctx.db.get(args.roomId as Id<"projectRooms">);

    if (!room || room.tenantId !== tenant._id) {
      throw new Error("Project room not found");
    }

    const [measurementRoom, quoteLine] = await Promise.all([
      ctx.db
        .query("measurementRooms")
        .withIndex("by_project_room", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectRoomId", room._id)
        )
        .first(),
      ctx.db
        .query("quoteLines")
        .withIndex("by_room", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectRoomId", room._id)
        )
        .first()
    ]);

    if (measurementRoom || quoteLine) {
      throw new Error("Ruimte is al gebruikt in een inmeting of offerte en kan niet veilig worden verwijderd.");
    }

    await ctx.db.delete(room._id);
    await ctx.db.patch(room.projectId, { updatedAt: Date.now() });

    return room._id;
  }
});

export const updateProjectStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    status: projectStatus,
    workflowType: v.optional(workflowEventType),
    workflowTitle: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    const now = Date.now();

    await ctx.db.patch(project._id, {
      status: args.status,
      acceptedAt: args.status === "quote_accepted" ? now : project.acceptedAt,
      measurementPlannedAt:
        args.status === "measurement_planned" ? now : project.measurementPlannedAt,
      executionPlannedAt:
        args.status === "execution_planned" ? now : project.executionPlannedAt,
      orderedAt: args.status === "ordering" ? now : project.orderedAt,
      invoicedAt: args.status === "invoiced" ? now : project.invoicedAt,
      paidAt: args.status === "paid" ? now : project.paidAt,
      closedAt: args.status === "closed" ? now : project.closedAt,
      updatedAt: now
    });

    if (args.workflowType && args.workflowTitle) {
      await ctx.db.insert("projectWorkflowEvents", {
        tenantId: tenant._id,
        projectId: project._id,
        type: args.workflowType,
        title: args.workflowTitle,
        visibleToCustomer: false,
        createdByExternalUserId: externalUserId,
        createdAt: now
      });
    }

    return project._id;
  }
});

export const createWorkflowEvent = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    type: workflowEventType,
    title: v.string(),
    description: v.optional(v.string()),
    visibleToCustomer: v.boolean(),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    return await ctx.db.insert("projectWorkflowEvents", {
      tenantId: tenant._id,
      projectId: project._id,
      type: args.type,
      title: args.title,
      description: args.description,
      visibleToCustomer: args.visibleToCustomer,
      createdByExternalUserId: externalUserId,
      createdAt: Date.now()
    });
  }
});

export const processProjectAction = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    action: v.union(
      v.literal("quote_accepted"),
      v.literal("supplier_order_created"),
      v.literal("invoice_created"),
      v.literal("bookkeeper_export_sent"),
      v.literal("closed"),
      v.literal("cancelled")
    ),
    invoiceDueAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    const now = Date.now();
    const customer =
      args.action === "invoice_created" ? await ctx.db.get(project.customerId) : null;
    const invoiceTermDays = invoicePaymentTermDays(
      customer && customer.tenantId === tenant._id ? customer : null
    );
    const actionConfig = {
      quote_accepted: {
        projectStatus: "quote_accepted" as const,
        eventType: "quote_accepted" as const,
        eventTitle: "Offerte akkoord"
      },
      supplier_order_created: {
        projectStatus: "ordering" as const,
        eventType: "supplier_order_created" as const,
        eventTitle: "Bestelling aangemaakt"
      },
      invoice_created: {
        projectStatus: "invoiced" as const,
        eventType: "invoice_created" as const,
        eventTitle: "Factuur aangemaakt"
      },
      bookkeeper_export_sent: {
        projectStatus: "invoiced" as const,
        eventType: "bookkeeper_export_sent" as const,
        eventTitle: "Naar boekhouder verwerkt"
      },
      closed: {
        projectStatus: "closed" as const,
        eventType: "closed" as const,
        eventTitle: "Dossier gesloten"
      },
      cancelled: {
        projectStatus: "cancelled" as const,
        eventType: "closed" as const,
        eventTitle: "Dossier geannuleerd"
      }
    }[args.action];

    await ctx.db.patch(project._id, {
      status: actionConfig.projectStatus,
      acceptedAt:
        actionConfig.projectStatus === "quote_accepted" ? now : project.acceptedAt,
      orderedAt: actionConfig.projectStatus === "ordering" ? now : project.orderedAt,
      invoicedAt: actionConfig.projectStatus === "invoiced" ? now : project.invoicedAt,
      closedAt:
        actionConfig.projectStatus === "closed" ||
        actionConfig.projectStatus === "cancelled"
          ? now
          : project.closedAt,
      updatedAt: now
    });

    if (args.action === "quote_accepted") {
      const quote = await latestQuoteForProject(ctx, tenant._id, project._id);
      if (quote && quote.status !== "accepted") {
        await ctx.db.patch(quote._id, {
          status: "accepted",
          acceptedAt: now,
          updatedAt: now
        });
      }

      await closeOpenProjectTasks(
        ctx,
        tenant._id,
        project._id,
        "quote_follow_up",
        "done",
        quote?._id
      );
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "confirmation_payment",
        "Bevestigingsmail / betaling binnen 5 dagen",
        addCalendarDays(now, 5),
        externalUserId,
        quote?._id
      );
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "execution_call",
        "Bellen / afspraak maken voor uitvoering",
        addCalendarDays(now, 5),
        externalUserId,
        quote?._id
      );
    }

    if (args.action === "supplier_order_created") {
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "execution_call", "done");
    }

    if (args.action === "invoice_created") {
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "confirmation_payment", "done");
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "invoice_payment",
        "Factuurbetaling opvolgen",
        args.invoiceDueAt ?? addCalendarDays(now, invoiceTermDays),
        externalUserId
      );
    }

    if (args.action === "cancelled") {
      const quote = await latestQuoteForProject(ctx, tenant._id, project._id);
      if (quote && ["draft", "sent"].includes(quote.status)) {
        await ctx.db.patch(quote._id, {
          status: "cancelled",
          updatedAt: now
        });
      }
    }

    if (args.action === "closed" || args.action === "cancelled") {
      const finalTaskStatus = args.action === "closed" ? "done" : "dismissed";

      await Promise.all(
        (["quote_follow_up", "confirmation_payment", "execution_call", "invoice_payment"] as const)
          .map((type) =>
            closeOpenProjectTasks(ctx, tenant._id, project._id, type, finalTaskStatus)
          )
      );
    }

    await addProjectEvent(
      ctx,
      tenant._id,
      project._id,
      actionConfig.eventType,
      actionConfig.eventTitle,
      externalUserId
    );

    return project._id;
  }
});

export const updateProjectTaskStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    taskId: v.string(),
    status: projectTaskStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const task = await ctx.db.get(args.taskId as Id<"projectTasks">);

    if (!task || task.tenantId !== tenant._id) {
      throw new Error("Project task not found");
    }

    const now = Date.now();

    await ctx.db.patch(task._id, {
      status: args.status,
      completedAt: args.status === "done" ? now : undefined,
      dismissedAt: args.status === "dismissed" ? now : undefined,
      updatedAt: now
    });

    return task._id;
  }
});

export const listQuotesWorkspace = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const [customers, projects, quotes, templates] = await Promise.all([
      ctx.db
        .query("customers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("quotes")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("quoteTemplates")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect()
    ]);

    return {
      customers: customers.map((customer: Doc<"customers">) => toCustomer(tenant.slug, customer)),
      projects: await Promise.all(
        projects.map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
      ),
      quotes: await Promise.all(
        quotes.map((quote: Doc<"quotes">) => toQuote(ctx, tenant.slug, quote))
      ),
      templates: templates
        .filter((template: Doc<"quoteTemplates">) => template.status === "active")
        .map((template: Doc<"quoteTemplates">) => toQuoteTemplate(tenant.slug, template))
    };
  }
});

export const createQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    title: v.string(),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    const template = await ctx.db
      .query("quoteTemplates")
      .withIndex("by_type", (q: any) => q.eq("tenantId", tenant._id).eq("type", "default"))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .first();
    const now = Date.now();
    const quoteId = await ctx.db.insert("quotes", {
      tenantId: tenant._id,
      projectId: project._id,
      customerId: project.customerId,
      quoteNumber: `OFF-${new Date(now).getFullYear()}-${now}`,
      title: args.title,
      status: "draft",
      introText: template?.introText,
      closingText: template?.closingText,
      terms: template?.defaultTerms ?? [],
      paymentTerms: template?.paymentTerms ?? [],
      subtotalExVat: 0,
      vatTotal: 0,
      totalIncVat: 0,
      createdByExternalUserId: externalUserId,
      createdAt: now,
      updatedAt: now
    });

    await ctx.db.patch(project._id, {
      status: "quote_draft",
      updatedAt: now
    });
    await ctx.db.insert("projectWorkflowEvents", {
      tenantId: tenant._id,
      projectId: project._id,
      type: "quote_created",
      title: "Offerte aangemaakt",
      visibleToCustomer: false,
      createdByExternalUserId: externalUserId,
      createdAt: now
    });

    return quoteId;
  }
});

export const updateQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    title: v.optional(v.string()),
    validUntil: v.optional(v.number()),
    introText: v.optional(v.string()),
    closingText: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new Error("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new Error("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const patch: Partial<Doc<"quotes">> = { updatedAt: Date.now() };

    if (args.title !== undefined) patch.title = args.title;
    if (hasArg(args, "validUntil")) patch.validUntil = args.validUntil;
    if (hasArg(args, "introText")) patch.introText = args.introText;
    if (hasArg(args, "closingText")) patch.closingText = args.closingText;

    await ctx.db.patch(quote._id, patch);

    return quote._id;
  }
});

export const addQuoteLine = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    projectRoomId: v.optional(v.string()),
    productId: v.optional(v.string()),
    lineType: quoteLineType,
    title: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    unitPriceExVat: v.number(),
    vatRate: v.number(),
    discountExVat: v.optional(v.number()),
    sortOrder: v.number(),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new Error("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new Error("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const projectRoomId = args.projectRoomId
      ? (args.projectRoomId as Id<"projectRooms">)
      : undefined;

    if (projectRoomId) {
      const projectRoom = await ctx.db.get(projectRoomId);

      if (
        !projectRoom ||
        projectRoom.tenantId !== tenant._id ||
        projectRoom.projectId !== quote.projectId
      ) {
        throw new Error("Project room not found");
      }
    }

    const productId = args.lineType === "product"
      ? await validateQuoteLineProduct(ctx, tenant._id, args.productId)
      : undefined;

    const totals = calculateLineTotals(
      args.lineType,
      args.quantity,
      args.unitPriceExVat,
      args.vatRate,
      args.discountExVat
    );
    const now = Date.now();
    const lineId = await ctx.db.insert("quoteLines", {
      tenantId: tenant._id,
      quoteId: quote._id,
      projectRoomId,
      productId,
      lineType: args.lineType,
      title: args.title,
      description: args.description,
      quantity: args.quantity,
      unit: args.unit,
      unitPriceExVat: args.unitPriceExVat,
      vatRate: args.vatRate,
      discountExVat: args.discountExVat,
      lineTotalExVat: totals.lineTotalExVat,
      lineVatTotal: totals.lineVatTotal,
      lineTotalIncVat: totals.lineTotalIncVat,
      sortOrder: args.sortOrder,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now
    });

    await recalculateQuote(ctx, tenant._id, quote._id);

    return lineId;
  }
});

export const deleteQuoteLine = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    lineId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const line = await ctx.db.get(args.lineId as Id<"quoteLines">);

    if (!line || line.tenantId !== tenant._id) {
      throw new Error("Quote line not found");
    }

    const quote = await ctx.db.get(line.quoteId);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new Error("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new Error("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    await ctx.db.delete(line._id);
    await recalculateQuote(ctx, tenant._id, line.quoteId);

    return line._id;
  }
});

export const updateQuoteLine = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    lineId: v.string(),
    projectRoomId: v.optional(v.string()),
    productId: v.optional(v.string()),
    lineType: quoteLineType,
    title: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    unitPriceExVat: v.number(),
    vatRate: v.number(),
    discountExVat: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const line = await ctx.db.get(args.lineId as Id<"quoteLines">);

    if (!line || line.tenantId !== tenant._id) {
      throw new Error("Quote line not found");
    }

    const quote = await ctx.db.get(line.quoteId);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new Error("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new Error("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const projectRoomId = args.projectRoomId
      ? (args.projectRoomId as Id<"projectRooms">)
      : undefined;

    if (projectRoomId) {
      const projectRoom = await ctx.db.get(projectRoomId);

      if (
        !projectRoom ||
        projectRoom.tenantId !== tenant._id ||
        projectRoom.projectId !== quote.projectId
      ) {
        throw new Error("Project room not found");
      }
    }

    const productId = args.lineType === "product"
      ? await validateQuoteLineProduct(ctx, tenant._id, args.productId)
      : undefined;

    const totals = calculateLineTotals(
      args.lineType,
      args.quantity,
      args.unitPriceExVat,
      args.vatRate,
      args.discountExVat
    );

    await ctx.db.patch(line._id, {
      projectRoomId,
      productId,
      lineType: args.lineType,
      title: args.title,
      description: args.description,
      quantity: args.quantity,
      unit: args.unit,
      unitPriceExVat: args.unitPriceExVat,
      vatRate: args.vatRate,
      discountExVat: args.discountExVat,
      lineTotalExVat: totals.lineTotalExVat,
      lineVatTotal: totals.lineVatTotal,
      lineTotalIncVat: totals.lineTotalIncVat,
      sortOrder: args.sortOrder ?? line.sortOrder,
      metadata: args.metadata,
      updatedAt: Date.now()
    });
    await recalculateQuote(ctx, tenant._id, line.quoteId);

    return line._id;
  }
});

export const updateQuoteTerms = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    terms: v.array(v.string()),
    paymentTerms: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new Error("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new Error("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    await ctx.db.patch(quote._id, {
      terms: args.terms,
      paymentTerms: args.paymentTerms ?? [],
      updatedAt: Date.now()
    });

    return quote._id;
  }
});

export const updateQuoteStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    status: quoteStatus
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new Error("Quote not found");
    }

    const project = await ctx.db.get(quote.projectId);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    const now = Date.now();
    const quotePatch: Partial<Doc<"quotes">> = {
      status: args.status,
      sentAt: args.status === "sent" ? quote.sentAt ?? now : quote.sentAt,
      validUntil:
        args.status === "sent" ? quote.validUntil ?? addCalendarDays(now, 30) : quote.validUntil,
      acceptedAt: args.status === "accepted" ? now : quote.acceptedAt,
      rejectedAt: args.status === "rejected" ? now : quote.rejectedAt,
      updatedAt: now
    };

    await ctx.db.patch(quote._id, quotePatch);

    const statusMap: Partial<Record<Doc<"quotes">["status"], Doc<"projects">["status"]>> = {
      draft: "quote_draft",
      sent: "quote_sent",
      accepted: "quote_accepted",
      rejected: "quote_rejected",
      cancelled: "cancelled"
    };
    const nextProjectStatus = statusMap[args.status];

    if (nextProjectStatus) {
      await ctx.db.patch(project._id, {
        status: nextProjectStatus,
        acceptedAt: args.status === "accepted" ? now : project.acceptedAt,
        updatedAt: now
      });
    }

    if (args.status === "sent") {
      await addProjectEvent(ctx, tenant._id, project._id, "quote_sent", "Offerte verzonden", externalUserId);
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "quote_follow_up",
        "Offerte opvolgen",
        addCalendarDays(now, 18),
        externalUserId,
        quote._id
      );
    }

    if (args.status === "accepted") {
      await addProjectEvent(ctx, tenant._id, project._id, "quote_accepted", "Offerte akkoord", externalUserId);
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "quote_follow_up", "done", quote._id);
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "confirmation_payment",
        "Bevestigingsmail / betaling binnen 5 dagen",
        addCalendarDays(now, 5),
        externalUserId,
        quote._id
      );
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "execution_call",
        "Bellen / afspraak maken voor uitvoering",
        addCalendarDays(now, 5),
        externalUserId,
        quote._id
      );
    }

    if (args.status === "cancelled") {
      await addProjectEvent(ctx, tenant._id, project._id, "closed", "Offerte geannuleerd", externalUserId);
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "quote_follow_up", "dismissed", quote._id);
    }

    if (args.status === "rejected") {
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "quote_follow_up", "dismissed", quote._id);
    }

    return quote._id;
  }
});

export const listSuppliers = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    const profiles = await ctx.db
      .query("importProfiles")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    const supplierMetrics = new Map<string, {
      activeProductCount: number;
      importProfileCount: number;
      importBatchCount: number;
      sourceFileCount: number;
      sourceFileNames: string[];
      latestImportStatus?: string;
      latestImportAt?: number;
    }>();

    await Promise.all(
      suppliers.map(async (supplier: Doc<"suppliers">) => {
        const [products, batches, priceLists] = await Promise.all([
          ctx.db
            .query("products")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
            )
            .collect(),
          ctx.db
            .query("productImportBatches")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
            )
            .order("desc")
            .collect(),
          ctx.db
            .query("priceLists")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
            )
            .collect()
        ]);

        const importProfileCount = profiles.filter(
          (profile: Doc<"importProfiles">) =>
            profile.status === "active" &&
            (String(profile.supplierId ?? "") === String(supplier._id) ||
              profile.supplierName === supplier.name)
        ).length;
        const latestBatch = batches[0];
        const sourceFileNames = Array.from(
          new Set(
            [
              ...priceLists.map((priceList: Doc<"priceLists">) => priceList.sourceFileName),
              ...batches.map(
                (batch: Doc<"productImportBatches">) => batch.sourceFileName ?? batch.fileName
              )
            ].filter(Boolean)
          )
        ).sort((left, right) => left.localeCompare(right, "nl"));

        supplierMetrics.set(String(supplier._id), {
          activeProductCount: products.filter((product: Doc<"products">) => product.status === "active")
            .length,
          importProfileCount,
          importBatchCount: batches.length,
          sourceFileCount: sourceFileNames.length,
          sourceFileNames,
          latestImportStatus: latestBatch?.status,
          latestImportAt: latestBatch?.committedAt ?? latestBatch?.importedAt ?? latestBatch?.createdAt
        });
      })
    );

    return suppliers
      .sort((left: Doc<"suppliers">, right: Doc<"suppliers">) =>
        left.name.localeCompare(right.name, "nl")
      )
      .map((supplier: Doc<"suppliers">) =>
        toSupplier(tenant.slug, supplier, supplierMetrics.get(String(supplier._id)))
      );
  }
});

export const createSupplier = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    productListStatus: v.optional(productListStatus),
    lastContactAt: v.optional(v.number()),
    expectedAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const existing = await findSupplierByName(ctx, tenant._id, args.name);

    if (existing) {
      return existing._id;
    }

    const now = Date.now();

    return await ctx.db.insert("suppliers", {
      tenantId: tenant._id,
      name: args.name,
      contactName: args.contactName,
      email: args.email,
      phone: args.phone,
      notes: args.notes,
      status: "active",
      productListStatus: args.productListStatus ?? "unknown",
      lastContactAt: args.lastContactAt,
      expectedAt: args.expectedAt,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateSupplier = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    supplierId: v.string(),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    productListStatus: v.optional(productListStatus),
    lastContactAt: v.optional(v.number()),
    expectedAt: v.optional(v.number()),
    status: v.optional(supplierStatus)
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const supplier = await ctx.db.get(args.supplierId as Id<"suppliers">);

    if (!supplier || supplier.tenantId !== tenant._id) {
      throw new Error("Supplier not found");
    }

    const patch: Partial<Doc<"suppliers">> = {
      name: args.name,
      updatedAt: Date.now()
    };

    if (hasArg(args, "contactName")) patch.contactName = args.contactName;
    if (hasArg(args, "email")) patch.email = args.email;
    if (hasArg(args, "phone")) patch.phone = args.phone;
    if (hasArg(args, "notes")) patch.notes = args.notes;
    if (args.productListStatus !== undefined) patch.productListStatus = args.productListStatus;
    if (hasArg(args, "lastContactAt")) patch.lastContactAt = args.lastContactAt;
    if (hasArg(args, "expectedAt")) patch.expectedAt = args.expectedAt;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(supplier._id, patch);

    return supplier._id;
  }
});

export const updateSupplierProductListStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    supplierId: v.string(),
    productListStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const supplier = await ctx.db.get(args.supplierId as Id<"suppliers">);

    if (!supplier || supplier.tenantId !== tenant._id) {
      throw new Error("Supplier not found");
    }

    await ctx.db.patch(supplier._id, {
      productListStatus: args.productListStatus,
      updatedAt: Date.now()
    });

    return supplier._id;
  }
});

export const listQuoteTemplates = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const templates = await ctx.db
      .query("quoteTemplates")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return templates.map((template: Doc<"quoteTemplates">) => ({
      id: String(template._id),
      tenantId: tenant.slug,
      name: template.name,
      type: template.type,
      status: template.status,
      introText: template.introText,
      closingText: template.closingText,
      sections: template.sections ?? [],
      defaultTerms: template.defaultTerms,
      paymentTerms: template.paymentTerms ?? [],
      defaultLines: template.defaultLines
    }));
  }
});

export const updateQuoteTemplateContent = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    templateId: v.string(),
    defaultTerms: v.array(v.string()),
    paymentTerms: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const template = await ctx.db.get(args.templateId as Id<"quoteTemplates">);

    if (!template || template.tenantId !== tenant._id) {
      throw new Error("Quote template not found");
    }

    await ctx.db.patch(template._id, {
      defaultTerms: args.defaultTerms,
      paymentTerms: args.paymentTerms ?? [],
      updatedAt: Date.now()
    });

    return template._id;
  }
});

export const listCategories = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return categories
      .sort((left: Doc<"categories">, right: Doc<"categories">) => left.sortOrder - right.sortOrder)
      .map((category: Doc<"categories">) => ({
        id: String(category._id),
        tenantId: tenant.slug,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        status: category.status
      }));
  }
});

export const upsertCategory = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    categoryId: v.optional(v.string()),
    name: v.string(),
    slug: v.string(),
    sortOrder: v.number(),
    status: activeStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const now = Date.now();

    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId as Id<"categories">);

      if (!category || category.tenantId !== tenant._id) {
        throw new Error("Category not found");
      }

      await ctx.db.patch(category._id, {
        name: args.name,
        slug: args.slug,
        sortOrder: args.sortOrder,
        status: args.status,
        updatedAt: now
      });

      return category._id;
    }

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q: any) => q.eq("tenantId", tenant._id).eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        sortOrder: args.sortOrder,
        status: args.status,
        updatedAt: now
      });

      return existing._id;
    }

    return await ctx.db.insert("categories", {
      tenantId: tenant._id,
      name: args.name,
      slug: args.slug,
      sortOrder: args.sortOrder,
      status: args.status,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const listServiceRules = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const rules = await ctx.db
      .query("serviceCostRules")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return rules
      .sort((left: Doc<"serviceCostRules">, right: Doc<"serviceCostRules">) =>
        left.name.localeCompare(right.name, "nl")
      )
      .map((rule: Doc<"serviceCostRules">) => ({
        id: String(rule._id),
        tenantId: tenant.slug,
        name: rule.name,
        description: rule.description,
        calculationType: rule.calculationType,
        priceExVat: rule.priceExVat,
        vatRate: rule.vatRate,
        status: rule.status
      }));
  }
});

export const upsertServiceRule = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    ruleId: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    calculationType: serviceRuleCalculationType,
    priceExVat: v.number(),
    vatRate: v.number(),
    status: activeStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const now = Date.now();

    if (args.ruleId) {
      const rule = await ctx.db.get(args.ruleId as Id<"serviceCostRules">);

      if (!rule || rule.tenantId !== tenant._id) {
        throw new Error("Service rule not found");
      }

      await ctx.db.patch(rule._id, {
        name: args.name,
        description: args.description,
        calculationType: args.calculationType,
        priceExVat: args.priceExVat,
        vatRate: args.vatRate,
        status: args.status,
        updatedAt: now
      });

      return rule._id;
    }

    return await ctx.db.insert("serviceCostRules", {
      tenantId: tenant._id,
      name: args.name,
      description: args.description,
      calculationType: args.calculationType,
      priceExVat: args.priceExVat,
      vatRate: args.vatRate,
      status: args.status,
      createdAt: now,
      updatedAt: now
    });
  }
});
