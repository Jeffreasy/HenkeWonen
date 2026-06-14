import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
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

export async function nextInvoiceNumber(ctx: any, tenantId: Id<"tenants">): Promise<string> {
  const now = Date.now();
  const year = new Date(now).getFullYear();
  const prefix = `FAC-${year}-`;
  const tenant = (await ctx.db.get(tenantId)) as (Doc<"tenants"> & {
    invoiceSequenceYear?: number;
    invoiceSequenceValue?: number;
  }) | null;
  let nextSequence: number;

  if (tenant?.invoiceSequenceYear === year && typeof tenant.invoiceSequenceValue === "number") {
    nextSequence = tenant.invoiceSequenceValue + 1;
  } else {
    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect();
    const highest = existing
      .filter((inv: Doc<"invoices">) => inv.factuurnummer.startsWith(prefix))
      .reduce((max: number, inv: Doc<"invoices">) => {
        const num = parseInt(inv.factuurnummer.replace(prefix, ""), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);

    nextSequence = highest + 1;
  }

  await ctx.db.patch(tenantId, {
    invoiceSequenceYear: year,
    invoiceSequenceValue: nextSequence,
    gewijzigdOp: now
  });

  return `${prefix}${String(nextSequence).padStart(3, "0")}`;
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
    throw new ConvexError("Tenant not found");
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

  // Bedragvalidatie (chokepoint voor alle regeltotalen). Bewust GEEN >= 0-guard op
  // quantity/unitPrice: kortingsregels (lineType "discount") gebruiken legitiem een
  // negatieve unitPriceExVat. Wel: niet-eindige waarden (NaN/Infinity) weren — die
  // corrumperen offerte-/factuurtotalen — en het btw-percentage begrenzen.
  if (![quantity, unitPriceExVat, vatRate, discountExVat ?? 0].every((n) => Number.isFinite(n))) {
    throw new ConvexError("Ongeldige regelbedragen: aantal, prijs, btw en korting moeten eindige getallen zijn.");
  }
  if (vatRate < 0 || vatRate > 100) {
    throw new ConvexError("Ongeldig btw-percentage: moet tussen 0 en 100 liggen.");
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
    throw new ConvexError("Quote not found");
  }

  const lines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", tenantId).eq("quoteId", quoteId))
    .collect();
  const subtotalExVat = roundMoney(
    lines.reduce((sum: number, line: Doc<"quoteLines">) => sum + line.regelTotaalExBtw, 0)
  );
  const vatTotal = roundMoney(
    lines.reduce((sum: number, line: Doc<"quoteLines">) => sum + line.regelBtwTotaal, 0)
  );

  await ctx.db.patch(quoteId, {
    subtotaalExBtw: subtotalExVat,
    btwTotaal: vatTotal,
    totaalInclBtw: roundMoney(subtotalExVat + vatTotal),
    gewijzigdOp: Date.now()
  });
}

export function toCustomer(tenantSlug: string, customer: Doc<"customers">) {
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

export function toRoom(room: Doc<"projectRooms">) {
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

export function toContact(tenantSlug: string, contact: Doc<"customerContacts">) {
  return {
    id: String(contact._id),
    tenantId: tenantSlug,
    customerId: String(contact.klantId),
    type: contact.type,
    title: contact.titel,
    description: contact.omschrijving,
    loanedItemName: contact.uitgeleendItemNaam,
    expectedReturnDate: contact.verwachteRetourdatum,
    returnedAt: contact.geretourneerdOp,
    visibleToCustomer: contact.zichtbaarVoorKlant,
    createdAt: contact.aangemaaktOp,
    updatedAt: contact.gewijzigdOp
  };
}

export function toWorkflowEvent(tenantSlug: string, event: Doc<"projectWorkflowEvents">) {
  return {
    id: String(event._id),
    tenantId: tenantSlug,
    projectId: String(event.projectId),
    type: event.type,
    title: event.titel,
    description: event.omschrijving,
    visibleToCustomer: event.zichtbaarVoorKlant,
    createdAt: event.aangemaaktOp
  };
}

export function toProjectTask(tenantSlug: string, task: Doc<"projectTasks">) {
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

export function toQuoteLine(line: Doc<"quoteLines">) {
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

export async function toQuote(ctx: any, tenantSlug: string, quote: Doc<"quotes">) {
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

export function toQuoteSummary(tenantSlug: string, quote: Doc<"quotes">) {
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

export function toQuoteTemplate(tenantSlug: string, template: Doc<"quoteTemplates">) {
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

export function customerAddress(customer: Doc<"customers"> | undefined | null) {
  if (!customer) {
    return undefined;
  }

  return [customer.straat, customer.huisnummer, customer.postcode, customer.plaats]
    .filter(Boolean)
    .join(" ");
}

export function activeFieldQuote(quotes: Doc<"quotes">[], projectId: Id<"projects">) {
  return quotes
    .filter((quote) => quote.projectId === projectId)
    .filter((quote) =>
      quote.status === "draft" ||
      quote.status === "sent" ||
      quote.status === "accepted"
    )
    .sort((left, right) => right.gewijzigdOp - left.gewijzigdOp)[0];
}

export function latestMeasurement(measurements: Doc<"measurements">[], projectId: Id<"projects">) {
  return measurements
    .filter((measurement) => measurement.projectId === projectId)
    .sort((left, right) => right.gewijzigdOp - left.gewijzigdOp)[0];
}

export function fieldVisitTimestamp(
  project: Doc<"projects">,
  measurement: Doc<"measurements"> | undefined
) {
  if (project.status === "execution_planned" || project.status === "in_progress") {
    return project.uitvoerdatum ?? project.inmeetdatum ?? measurement?.inmeetdatum;
  }

  return project.inmeetdatum ?? measurement?.inmeetdatum;
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
      return left.vervaltOp - right.vervaltOp || right.gewijzigdOp - left.gewijzigdOp;
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

  if (isDueTodayOrEarlier(firstOpenTask?.vervaltOp, now)) {
    return "today";
  }

  if (firstOpenTask) {
    return "followUp";
  }

  if (isDueTodayOrEarlier(fieldVisitTimestamp(project, measurement), now)) {
    return "today";
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
    name: supplier.naam,
    contactName: supplier.contactpersoon,
    email: supplier.email,
    phone: supplier.telefoon,
    productListStatus: supplier.prijslijstStatus,
    status: supplier.status ?? "active",
    notes: supplier.notities,
    lastContactAt: supplier.laatsteContactOp,
    expectedAt: supplier.verwachtOp,
    activeProductCount: metrics?.activeProductCount ?? 0,
    importProfileCount: metrics?.importProfileCount ?? 0,
    importBatchCount: metrics?.importBatchCount ?? 0,
    sourceFileCount: metrics?.sourceFileCount ?? 0,
    sourceFileNames: metrics?.sourceFileNames ?? [],
    latestImportStatus: metrics?.latestImportStatus,
    latestImportAt: metrics?.latestImportAt,
    updatedAt: supplier.gewijzigdOp
  };
}

export async function findSupplierByName(ctx: any, tenantId: Id<"tenants">, name: string) {
  return await ctx.db
    .query("suppliers")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("naam"), name))
    .first();
}

export async function latestQuoteForProject(ctx: any, tenantId: Id<"tenants">, projectId: Id<"projects">) {
  const quotes = await ctx.db
    .query("quotes")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();

  return quotes.sort((left: Doc<"quotes">, right: Doc<"quotes">) => right.gewijzigdOp - left.gewijzigdOp)[0];
}

export async function latestAcceptedQuoteForProject(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">
) {
  const quotes = await ctx.db
    .query("quotes")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();

  return quotes
    .filter((quote: Doc<"quotes">) => quote.status === "accepted")
    .sort((left: Doc<"quotes">, right: Doc<"quotes">) => right.gewijzigdOp - left.gewijzigdOp)[0];
}

export async function existingInvoiceForQuote(
  ctx: any,
  tenantId: Id<"tenants">,
  quoteId: Id<"quotes">
) {
  return await ctx.db
    .query("invoices")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("quoteId"), quoteId))
    .first();
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
    right.gewijzigdOp - left.gewijzigdOp
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
    titel: title,
    omschrijving: description,
    zichtbaarVoorKlant: false,
    createdByExternalUserId: externalUserId,
    aangemaaktOp: Date.now()
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
      titel: title,
      vervaltOp: dueAt,
      gewijzigdOp: now
    });
    return existing._id;
  }

  return await ctx.db.insert("projectTasks", {
    tenantId,
    projectId,
    quoteId,
    type,
    titel: title,
    vervaltOp: dueAt,
    status: "open",
    createdByExternalUserId: externalUserId,
    aangemaaktOp: now,
    gewijzigdOp: now
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
          voltooidOp: status === "done" ? now : task.voltooidOp,
          afgewezenOp: status === "dismissed" ? now : task.afgewezenOp,
          gewijzigdOp: now
        })
      )
  );
}

export async function completeInvoiceWorkflow(
  ctx: any,
  tenantId: Id<"tenants">,
  project: Doc<"projects">,
  dueAt: number,
  externalUserId?: string
) {
  await closeOpenProjectTasks(ctx, tenantId, project._id, "confirmation_payment", "done");
  await upsertProjectTask(
    ctx,
    tenantId,
    project._id,
    "invoice_payment",
    "Factuurbetaling opvolgen",
    dueAt,
    externalUserId
  );

  if (!(await hasProjectEvent(ctx, tenantId, project._id, "invoice_created"))) {
    await addProjectEvent(ctx, tenantId, project._id, "invoice_created", "Factuur aangemaakt", externalUserId);
  }
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
    throw new ConvexError("Product not found");
  }

  const category = product.categoryId ? await ctx.db.get(product.categoryId) : null;
  const hiddenReason = pilotHiddenReason(product, category?.name);

  if (hiddenReason) {
    throw new ConvexError(hiddenReason);
  }

  if (product.status !== "active") {
    throw new ConvexError("Dit product is niet (meer) actief en kan niet worden gekozen.");
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
  matrix: "Matrix (breedte × hoogte)",
  manual: "Handmatig"
};

export function readableMeasurementFallback(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function importedMeasurementLineTitle(
  line: Doc<"measurementLines">,
  room: Doc<"measurementRooms"> | null
) {
  if (line.productNaam) {
    return [line.productNaam, room?.naam].filter(Boolean).join(" - ");
  }

  return [
    measurementProductGroupLabels[line.productGroep] ?? readableMeasurementFallback(line.productGroep),
    measurementCalculationTypeLabels[line.berekeningType] ??
      readableMeasurementFallback(line.berekeningType),
    room?.naam
  ]
    .filter(Boolean)
    .join(" - ");
}

export function importedMeasurementLineDescription(
  line: Doc<"measurementLines">,
  priceWasPrefilled?: boolean
) {
  const isMatrixLine = line.indicatievePrijsSoort === "matrix";
  const hasIndicativePrice =
    priceWasPrefilled ??
    ((line.productId !== undefined || isMatrixLine) &&
      line.indicatieveEenheidsprijsExBtw !== undefined &&
      line.indicatiefBtwTarief !== undefined);

  const matrixInput = isMatrixLine && line.invoer ? (line.invoer as any) : null;
  const matrixContext = matrixInput
    ? `Raambekleding (matrix): ${[matrixInput.bronBlad, matrixInput.prijsgroep]
        .filter(Boolean)
        .join(" – ")}${
        matrixInput.breedteCm && matrixInput.hoogteCm
          ? ` – ${matrixInput.breedteCm}×${matrixInput.hoogteCm} cm`
          : ""
      }.`
    : undefined;

  return [
    "Overgenomen uit inmeting.",
    isMatrixLine
      ? "Matrix-richtprijs uit de inmeting overgenomen. Controleer verkoopprijs en btw bewust voordat je de offerte verstuurt."
      : hasIndicativePrice
        ? "Richtprijs uit de inmeting overgenomen. Controleer product, verkoopprijs en btw bewust voordat je de offerte verstuurt."
        : "Richtprijs. Kies product, verkoopprijs en btw bewust voordat je de offerte verstuurt.",
    matrixContext,
    line.snijverliesPct !== undefined ? `Snijverlies: ${line.snijverliesPct}%.` : undefined,
    line.notities ? `Meetnotitie: ${line.notities}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
}
