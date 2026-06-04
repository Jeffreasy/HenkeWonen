import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { pilotHiddenReason } from "./catalog/pilot";

export const customerType = v.union(v.literal("private"), v.literal("business"));
export const customerStatus = v.union(
  v.literal("lead"),
  v.literal("active"),
  v.literal("inactive"),
  v.literal("archived")
);

export const customerContactType = v.union(
  v.literal("note"),
  v.literal("call"),
  v.literal("email"),
  v.literal("visit"),
  v.literal("loaned_item"),
  v.literal("agreement")
);

export const projectStatus = v.union(
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

export const quoteStatus = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("expired"),
  v.literal("cancelled")
);

export const activeStatus = v.union(v.literal("active"), v.literal("inactive"));
export const supplierStatus = v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"));

export const serviceRuleCalculationType = v.union(
  v.literal("fixed"),
  v.literal("per_m2"),
  v.literal("per_meter"),
  v.literal("per_roll"),
  v.literal("per_side"),
  v.literal("per_staircase"),
  v.literal("manual")
);

export const quoteLineType = v.union(
  v.literal("product"),
  v.literal("service"),
  v.literal("labor"),
  v.literal("material"),
  v.literal("discount"),
  v.literal("text"),
  v.literal("manual")
);

export const workflowEventType = v.union(
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

export const projectTaskStatus = v.union(
  v.literal("open"),
  v.literal("done"),
  v.literal("dismissed")
);

export const productListStatus = v.union(
  v.literal("unknown"),
  v.literal("requested"),
  v.literal("received"),
  v.literal("download_available"),
  v.literal("not_available"),
  v.literal("manual_only")
);

export function hasArg<T extends object>(args: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(args, key);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function addCalendarDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function normalizeProjectId(ctx: any, projectId: string): Id<"projects"> | null {
  return ctx.db.normalizeId("projects", projectId);
}

export function invoicePaymentTermDays(customer?: Doc<"customers"> | null) {
  return customer?.type === "business" ? 21 : 8;
}

export function taskPriority(dueAt: number, now = Date.now()) {
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

export async function getTenant(ctx: any, tenantSlug: string): Promise<Doc<"tenants"> | null> {
  return await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q: any) => q.eq("slug", tenantSlug))
    .first();
}

export async function requireTenant(ctx: any, tenantSlug: string): Promise<Doc<"tenants">> {
  const tenant = await getTenant(ctx, tenantSlug);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLineTotals(
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

export async function recalculateQuote(ctx: any, tenantId: Id<"tenants">, quoteId: Id<"quotes">) {
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

export function toCustomer(tenantSlug: string, customer: Doc<"customers">) {
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

export function toRoom(room: Doc<"projectRooms">) {
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

export async function getRooms(ctx: any, tenantId: Id<"tenants">, projectId: Id<"projects">) {
  const rooms = await ctx.db
    .query("projectRooms")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();

  return rooms.sort((left: Doc<"projectRooms">, right: Doc<"projectRooms">) => {
    return left.sortOrder - right.sortOrder;
  });
}

export async function toProject(ctx: any, tenantSlug: string, project: Doc<"projects">) {
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

export function toContact(tenantSlug: string, contact: Doc<"customerContacts">) {
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

export function toWorkflowEvent(tenantSlug: string, event: Doc<"projectWorkflowEvents">) {
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

export function toProjectTask(tenantSlug: string, task: Doc<"projectTasks">) {
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

export function toQuoteLine(line: Doc<"quoteLines">) {
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

export async function toQuote(ctx: any, tenantSlug: string, quote: Doc<"quotes">) {
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

export function toQuoteSummary(tenantSlug: string, quote: Doc<"quotes">) {
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

export function toQuoteTemplate(tenantSlug: string, template: Doc<"quoteTemplates">) {
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

export function customerAddress(customer: Doc<"customers"> | undefined | null) {
  if (!customer) {
    return undefined;
  }

  return [customer.street, customer.houseNumber, customer.postalCode, customer.city]
    .filter(Boolean)
    .join(" ");
}

export function activeFieldQuote(quotes: Doc<"quotes">[], projectId: Id<"projects">) {
  return quotes
    .filter((quote) => quote.projectId === projectId)
    .filter((quote) => quote.status === "draft" || quote.status === "sent")
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

export function latestMeasurement(measurements: Doc<"measurements">[], projectId: Id<"projects">) {
  return measurements
    .filter((measurement) => measurement.projectId === projectId)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

export function fieldVisitTimestamp(
  project: Doc<"projects">,
  measurement: Doc<"measurements"> | undefined
) {
  return project.measurementDate ?? measurement?.measurementDate;
}

export function isDueTodayOrEarlier(timestamp: number | undefined, now: number) {
  if (!timestamp) {
    return false;
  }

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  return timestamp <= todayEnd.getTime();
}

export function sortProjectTasks(tasks: Doc<"projectTasks">[]) {
  return tasks.slice().sort((left, right) => {
    if (left.status === right.status) {
      return left.dueAt - right.dueAt || right.updatedAt - left.updatedAt;
    }

    return left.status === "open" ? -1 : 1;
  });
}

export function fieldBucket(
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

export function fieldNextAction(bucket: "today" | "measure" | "quote" | "followUp") {
  const labels = {
    today: "Vandaag bezoeken",
    measure: "Inmeten",
    quote: "Conceptofferte maken",
    followUp: "Opvolgen"
  };

  return labels[bucket];
}

export function toSupplier(
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

export async function findSupplierByName(ctx: any, tenantId: Id<"tenants">, name: string) {
  return await ctx.db
    .query("suppliers")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("name"), name))
    .first();
}

export async function latestQuoteForProject(ctx: any, tenantId: Id<"tenants">, projectId: Id<"projects">) {
  const quotes = await ctx.db
    .query("quotes")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();

  return quotes.sort((left: Doc<"quotes">, right: Doc<"quotes">) => right.updatedAt - left.updatedAt)[0];
}

export async function latestMeasurementForProject(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">
) {
  const measurements = await ctx.db
    .query("measurements")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();

  return measurements.sort((left: Doc<"measurements">, right: Doc<"measurements">) =>
    right.updatedAt - left.updatedAt
  )[0];
}

export async function hasProjectEvent(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  type: Doc<"projectWorkflowEvents">["type"]
) {
  const events = await ctx.db
    .query("projectWorkflowEvents")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();

  return events.some((event: Doc<"projectWorkflowEvents">) => event.type === type);
}

export async function addProjectEvent(
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

export async function upsertProjectTask(
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

export async function closeOpenProjectTasks(
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

export async function validateQuoteLineProduct(
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

export const measurementProductGroupLabels: Record<string, string> = {
  flooring: "Vloeren",
  plinths: "Plinten",
  wallpaper: "Behang",
  wall_panels: "Wandpanelen",
  curtains: "Gordijnen",
  rails: "Rails",
  stairs: "Trap",
  other: "Overig"
};

export const measurementCalculationTypeLabels: Record<string, string> = {
  area: "Oppervlakte",
  perimeter: "Omtrek",
  rolls: "Rollen",
  panels: "Panelen",
  stairs: "Trap",
  manual: "Handmatig"
};

export function readableMeasurementFallback(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function importedMeasurementLineTitle(
  line: Doc<"measurementLines">,
  room: Doc<"measurementRooms"> | null
) {
  return [
    measurementProductGroupLabels[line.productGroup] ?? readableMeasurementFallback(line.productGroup),
    measurementCalculationTypeLabels[line.calculationType] ??
      readableMeasurementFallback(line.calculationType),
    room?.name
  ]
    .filter(Boolean)
    .join(" - ");
}

export function importedMeasurementLineDescription(line: Doc<"measurementLines">) {
  return [
    "Overgenomen uit inmeting.",
    "Richtprijs. Kies product, verkoopprijs en btw bewust voordat je de offerte verstuurt.",
    line.wastePercent !== undefined ? `Snijverlies: ${line.wastePercent}%.` : undefined,
    line.notes ? `Meetnotitie: ${line.notes}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
}
