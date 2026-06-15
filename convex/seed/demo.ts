import { internalMutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireConvexToolingEnabled } from "../authz";

const tenantSlug = "henke-wonen";
const nowUser = "demo-seed";

function now() {
  return Date.now();
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

async function ensureTenant(ctx: any): Promise<Id<"tenants">> {
  const existing = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q: any) => q.eq("slug", tenantSlug))
    .first();

  if (existing) {
    return existing._id;
  }

  const timestamp = now();

  return await ctx.db.insert("tenants", {
    slug: tenantSlug,
    naam: "Henke Wonen",
    status: "active",
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

async function findCustomer(ctx: any, tenantId: Id<"tenants">, displayName: string) {
  return await ctx.db
    .query("customers")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("weergaveNaam"), displayName))
    .first();
}

async function ensureCustomer(
  ctx: any,
  tenantId: Id<"tenants">,
  customer: {
    type: "private" | "business";
    displayName: string;
    email?: string;
    phone?: string;
    city?: string;
    status: "lead" | "active";
    notes?: string;
  }
) {
  const existing = await findCustomer(ctx, tenantId, customer.displayName);
  const timestamp = now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      type: customer.type,
      email: customer.email,
      telefoon: customer.phone,
      plaats: customer.city,
      status: customer.status,
      notities: customer.notes,
      gewijzigdOp: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("customers", {
    tenantId,
    type: customer.type,
    weergaveNaam: customer.displayName,
    email: customer.email,
    telefoon: customer.phone,
    plaats: customer.city,
    land: "Nederland",
    notities: customer.notes,
    status: customer.status,
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

async function findProject(ctx: any, tenantId: Id<"tenants">, title: string) {
  return await ctx.db
    .query("projects")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("titel"), title))
    .first();
}

async function ensureProject(
  ctx: any,
  tenantId: Id<"tenants">,
  project: {
    customerId: Id<"customers">;
    title: string;
    description: string;
    status:
      | "lead"
      | "quote_draft"
      | "quote_sent"
      | "quote_accepted"
      | "quote_rejected"
      | "measurement_planned"
      | "execution_planned"
      | "ordering"
      | "in_progress"
      | "invoiced"
      | "paid"
      | "closed"
      | "cancelled";
    internalNotes?: string;
    customerNotes?: string;
  }
) {
  const existing = await findProject(ctx, tenantId, project.title);
  const timestamp = now();
  // Statussen die "verder" in de flow zitten impliceren dat eerdere mijlpalen al gehaald zijn.
  const past = (stages: string[]) => stages.includes(project.status);
  const statusDates = {
    geaccepteerdOp: past(["quote_accepted", "execution_planned", "ordering", "in_progress", "invoiced", "paid", "closed"]) ? timestamp : undefined,
    inmeetGeplandOp: project.status === "measurement_planned" ? timestamp : undefined,
    uitvoerGeplandOp: past(["execution_planned", "ordering", "in_progress", "invoiced", "paid", "closed"]) ? timestamp : undefined,
    besteldOp: past(["ordering", "in_progress", "invoiced", "paid", "closed"]) ? timestamp : undefined,
    gefactureerdOp: past(["invoiced", "paid", "closed"]) ? timestamp : undefined
  };

  if (existing) {
    await ctx.db.patch(existing._id, {
      klantId: project.customerId,
      titel: project.title,
      omschrijving: project.description,
      status: project.status,
      interneNotities: project.internalNotes,
      klantNotities: project.customerNotes,
      ...statusDates,
      gewijzigdOp: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("projects", {
    tenantId,
    klantId: project.customerId,
    titel: project.title,
    omschrijving: project.description,
    status: project.status,
    interneNotities: project.internalNotes,
    klantNotities: project.customerNotes,
    createdByExternalUserId: nowUser,
    ...statusDates,
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

async function ensureRoom(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  room: { name: string; areaM2?: number; perimeterMeter?: number; sortOrder: number }
) {
  const existing = await ctx.db
    .query("projectRooms")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .filter((q: any) => q.eq(q.field("naam"), room.name))
    .first();
  const timestamp = now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      oppervlakteM2: room.areaM2,
      omtrekMeter: room.perimeterMeter,
      sortOrder: room.sortOrder,
      gewijzigdOp: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("projectRooms", {
    tenantId,
    projectId,
    naam: room.name,
    oppervlakteM2: room.areaM2,
    omtrekMeter: room.perimeterMeter,
    sortOrder: room.sortOrder,
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

async function ensureContact(
  ctx: any,
  tenantId: Id<"tenants">,
  customerId: Id<"customers">,
  contact: {
    type: "note" | "call" | "email" | "visit" | "loaned_item" | "agreement";
    title: string;
    description?: string;
    loanedItemName?: string;
    expectedReturnDate?: number;
    returnedAt?: number;
    visibleToCustomer: boolean;
  }
) {
  const existing = await ctx.db
    .query("customerContacts")
    .withIndex("by_customer", (q: any) => q.eq("tenantId", tenantId).eq("klantId", customerId))
    .filter((q: any) => q.eq(q.field("titel"), contact.title))
    .first();
  const timestamp = now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      omschrijving: contact.description,
      uitgeleendItemNaam: contact.loanedItemName,
      verwachteRetourdatum: contact.expectedReturnDate,
      geretourneerdOp: contact.returnedAt,
      zichtbaarVoorKlant: contact.visibleToCustomer,
      gewijzigdOp: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("customerContacts", {
    tenantId,
    klantId: customerId,
    type: contact.type,
    titel: contact.title,
    omschrijving: contact.description,
    uitgeleendItemNaam: contact.loanedItemName,
    verwachteRetourdatum: contact.expectedReturnDate,
    geretourneerdOp: contact.returnedAt,
    zichtbaarVoorKlant: contact.visibleToCustomer,
    createdByExternalUserId: nowUser,
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

async function ensureWorkflowEvent(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  event: {
    type:
      | "customer_contact"
      | "quote_created"
      | "measurement_requested"
      | "measurement_planned"
      | "quote_sent"
      | "quote_accepted"
      | "execution_planned"
      | "supplier_order_created"
      | "invoice_created";
    title: string;
    description?: string;
    visibleToCustomer: boolean;
  }
) {
  const existing = await ctx.db
    .query("projectWorkflowEvents")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .filter((q: any) => q.eq(q.field("titel"), event.title))
    .first();
  const timestamp = now();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("projectWorkflowEvents", {
    tenantId,
    projectId,
    type: event.type,
    titel: event.title,
    omschrijving: event.description,
    zichtbaarVoorKlant: event.visibleToCustomer,
    createdByExternalUserId: nowUser,
    aangemaaktOp: timestamp
  });
}

async function findQuote(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  title: string
) {
  return await ctx.db
    .query("quotes")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .filter((q: any) => q.eq(q.field("titel"), title))
    .first();
}

async function ensureQuote(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  customerId: Id<"customers">,
  quote: {
    quoteNumber: string;
    title: string;
    status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "cancelled";
  }
) {
  const existing = await findQuote(ctx, tenantId, projectId, quote.title);
  const timestamp = now();
  const terms = [
    "Prijzen zijn inclusief 21% btw.",
    "De te leggen ruimtes dienen volledig leeg te zijn bij aanvang van de werkzaamheden.",
    "Water en stroom zijn beschikbaar.",
    "Bij overschrijving hanteert Henke Wonen een betalingstermijn van 8 dagen."
  ];
  // Een verstuurde/afgehandelde offerte is altijd ook verzonden geweest.
  const isSentOrLater = ["sent", "accepted", "rejected", "expired"].includes(quote.status);
  const statusDates = {
    verzondenOp: isSentOrLater ? timestamp : undefined,
    geaccepteerdOp: quote.status === "accepted" ? timestamp : undefined,
    afgewezenOp: quote.status === "rejected" ? timestamp : undefined
  };

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: quote.status,
      voorwaarden: terms,
      ...statusDates,
      gewijzigdOp: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("quotes", {
    tenantId,
    projectId,
    klantId: customerId,
    offertenummer: quote.quoteNumber,
    titel: quote.title,
    status: quote.status,
    inleidingTekst: "Hartelijk dank voor uw bezoek aan Henke Wonen. Hieronder vindt u onze offerte.",
    afsluitTekst: "Wij horen graag of alles naar wens is.",
    voorwaarden: terms,
    subtotaalExBtw: 0,
    btwTotaal: 0,
    totaalInclBtw: 0,
    ...statusDates,
    createdByExternalUserId: nowUser,
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

async function ensureQuoteLine(
  ctx: any,
  tenantId: Id<"tenants">,
  quoteId: Id<"quotes">,
  line: {
    lineType: "product" | "service" | "labor" | "material" | "discount" | "text" | "manual";
    title: string;
    quantity: number;
    unit: string;
    unitPriceExVat: number;
    vatRate: number;
    discountExVat?: number;
    sortOrder: number;
  }
) {
  const existing = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", tenantId).eq("quoteId", quoteId))
    .filter((q: any) => q.eq(q.field("titel"), line.title))
    .first();
  const totals = calculateLineTotals(
    line.lineType,
    line.quantity,
    line.unitPriceExVat,
    line.vatRate,
    line.discountExVat
  );
  const timestamp = now();

  // Het demo-line-contract is Engels; map expliciet naar de NL offerteregel-velden
  // (geen spread — anders lekken Engelse sleutels de NL-tabel in).
  const lineDoc = {
    regelType: line.lineType,
    titel: line.title,
    aantal: line.quantity,
    eenheid: line.unit,
    eenheidsprijsExBtw: line.unitPriceExVat,
    btwTarief: line.vatRate,
    kortingExBtw: line.discountExVat,
    sortOrder: line.sortOrder,
    regelTotaalExBtw: totals.lineTotalExVat,
    regelBtwTotaal: totals.lineVatTotal,
    regelTotaalInclBtw: totals.lineTotalIncVat
  };

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...lineDoc,
      gewijzigdOp: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("quoteLines", {
    tenantId,
    quoteId,
    ...lineDoc,
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

async function recalculateQuote(ctx: any, tenantId: Id<"tenants">, quoteId: Id<"quotes">) {
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
    gewijzigdOp: now()
  });
}

// ── Inmeet-calculators (server-side replica van src/lib/calculators) ───────────
// Houden invoer/resultaat in dezelfde shape als de UI, zodat de meetregels correct
// renderen in MeasurementPanel en de buitendienst-flow van Wim.
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const ceil2 = (value: number) => Math.ceil((value + Number.EPSILON) * 100) / 100;

function calcFlooring(input: { lengthM: number; widthM: number; patternType: string; wastePercent: number }) {
  const areaM2 = round2(input.lengthM * input.widthM);
  const wasteM2 = round2(areaM2 * (input.wastePercent / 100));
  const totalM2 = round2(areaM2 + wasteM2);
  return { areaM2, wasteM2, totalM2, quoteQuantityM2: ceil2(totalM2), isIndicative: true as const };
}

function calcPlinths(input: { perimeterM: number; doorOpeningM: number; wastePercent: number }) {
  const netMeter = round2(Math.max(input.perimeterM - input.doorOpeningM, 0));
  const wasteMeter = round2(netMeter * (input.wastePercent / 100));
  const totalMeter = round2(netMeter + wasteMeter);
  return { netMeter, wasteMeter, totalMeter, quoteQuantityMeter: ceil2(totalMeter), isIndicative: true as const };
}

function calcWallpaper(input: {
  wallWidthM: number;
  wallHeightM: number;
  rollWidthCm?: number;
  rollLengthM?: number;
  patternRepeatCm?: number;
  wastePercent?: number;
}) {
  const rollWidthCm = input.rollWidthCm ?? 53;
  const rollLengthM = input.rollLengthM ?? 10.05;
  const patternRepeatCm = input.patternRepeatCm ?? 0;
  const wastePercent = input.wastePercent ?? 10;
  const banenNeeded = Math.ceil((input.wallWidthM * 100) / rollWidthCm);
  const baanLengteM = input.wallHeightM + patternRepeatCm / 100;
  const banenPerRol = Math.floor(rollLengthM / baanLengteM);
  const baseRollsNeeded = Math.max(1, Math.ceil(banenNeeded / banenPerRol));
  const rollsNeeded = Math.max(1, Math.ceil(baseRollsNeeded * (1 + wastePercent / 100)));
  return {
    banenNeeded,
    baanLengteM,
    banenPerRol,
    baseRollsNeeded,
    rollsNeeded,
    wasteExtraRolls: Math.max(0, rollsNeeded - baseRollsNeeded),
    isIndicative: true as const
  };
}

function calcStairs(input: { stairType: string; treadCount: number; riserCount: number; stripLengthM?: number }) {
  const notes = [
    `stairType:${input.stairType}`,
    `treadCount:${input.treadCount}`,
    `riserCount:${input.riserCount}`
  ];
  if (input.stairType === "open") notes.push("open staircase");
  if (input.stairType === "closed") notes.push("closed staircase");
  if (input.stripLengthM !== undefined) notes.push(`stripLengthM:${round2(input.stripLengthM)}`);
  return {
    treadCount: input.treadCount,
    riserCount: input.riserCount,
    quoteQuantity: 1,
    unit: "stairs" as const,
    notes,
    isIndicative: true as const
  };
}

// Zoekt een echt, actief, niet pilot-verborgen product binnen een categorie op naam-substring.
async function findProductId(
  ctx: any,
  tenantId: Id<"tenants">,
  categoryName: string,
  nameContains: string
): Promise<{ id: Id<"products">; naam: string } | null> {
  const category = await ctx.db
    .query("categories")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("naam"), categoryName))
    .first();

  if (!category) {
    return null;
  }

  const products = await ctx.db
    .query("products")
    .withIndex("by_category_status", (q: any) =>
      q.eq("tenantId", tenantId).eq("categorieId", category._id).eq("status", "active")
    )
    .take(500);
  const needle = nameContains.toLowerCase();
  const match = products.find((p: any) => (p.naam ?? "").toLowerCase().includes(needle)) ?? products[0];

  return match ? { id: match._id as Id<"products">, naam: match.naam as string } : null;
}

async function ensureMeasurement(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  customerId: Id<"customers">,
  fields: {
    status: "draft" | "measured" | "reviewed" | "converted_to_quote";
    inmeetdatum?: number;
    gemetenDoor?: string;
    notities?: string;
  }
): Promise<Id<"measurements">> {
  const existing = await ctx.db
    .query("measurements")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .first();
  const timestamp = now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: fields.status,
      inmeetdatum: fields.inmeetdatum,
      gemetenDoor: fields.gemetenDoor,
      notities: fields.notities,
      gewijzigdOp: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("measurements", {
    tenantId,
    projectId,
    klantId: customerId,
    status: fields.status,
    inmeetdatum: fields.inmeetdatum,
    gemetenDoor: fields.gemetenDoor,
    notities: fields.notities,
    createdByExternalUserId: nowUser,
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

async function ensureMeasurementRoom(
  ctx: any,
  tenantId: Id<"tenants">,
  inmetingId: Id<"measurements">,
  projectRuimteId: Id<"projectRooms">,
  room: {
    naam: string;
    breedteM?: number;
    lengteM?: number;
    hoogteM?: number;
    oppervlakteM2?: number;
    omtrekM?: number;
    sortOrder: number;
  }
): Promise<Id<"measurementRooms">> {
  const existing = await ctx.db
    .query("measurementRooms")
    .withIndex("by_measurement", (q: any) => q.eq("tenantId", tenantId).eq("inmetingId", inmetingId))
    .filter((q: any) => q.eq(q.field("naam"), room.naam))
    .first();
  const timestamp = now();
  const fields = {
    projectRuimteId,
    naam: room.naam,
    breedteM: room.breedteM,
    lengteM: room.lengteM,
    hoogteM: room.hoogteM,
    oppervlakteM2: room.oppervlakteM2,
    omtrekM: room.omtrekM,
    sortOrder: room.sortOrder
  };

  if (existing) {
    await ctx.db.patch(existing._id, { ...fields, gewijzigdOp: timestamp });

    return existing._id;
  }

  return await ctx.db.insert("measurementRooms", {
    tenantId,
    inmetingId,
    ...fields,
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

async function ensureMeasurementLine(
  ctx: any,
  tenantId: Id<"tenants">,
  inmetingId: Id<"measurements">,
  ruimteId: Id<"measurementRooms">,
  line: {
    productGroep: string;
    berekeningType: string;
    invoer: unknown;
    resultaat: unknown;
    snijverliesPct?: number;
    aantal: number;
    eenheid: string;
    notities?: string;
    offerteRegelType: string;
    quotePreparationStatus: "draft" | "ready_for_quote";
    product?: { id: Id<"products">; naam: string } | null;
    indicatieveEenheidsprijsExBtw?: number;
    indicatiefBtwTarief?: number;
    indicatievePrijsEenheid?: string;
    indicatievePrijsSoort?: string;
  }
): Promise<Id<"measurementLines">> {
  const existing = await ctx.db
    .query("measurementLines")
    .withIndex("by_measurement", (q: any) => q.eq("tenantId", tenantId).eq("inmetingId", inmetingId))
    .filter((q: any) =>
      q.and(q.eq(q.field("ruimteId"), ruimteId), q.eq(q.field("productGroep"), line.productGroep))
    )
    .first();
  const timestamp = now();
  const keepSnapshot = Boolean(line.product) || line.indicatieveEenheidsprijsExBtw !== undefined;
  const doc = {
    ruimteId,
    productGroep: line.productGroep,
    berekeningType: line.berekeningType,
    invoer: line.invoer,
    resultaat: line.resultaat,
    snijverliesPct: line.snijverliesPct,
    aantal: line.aantal,
    eenheid: line.eenheid,
    notities: line.notities,
    offerteRegelType: line.offerteRegelType,
    quotePreparationStatus: line.quotePreparationStatus,
    productId: line.product?.id,
    productNaam: keepSnapshot ? line.product?.naam : undefined,
    indicatieveEenheidsprijsExBtw: keepSnapshot ? line.indicatieveEenheidsprijsExBtw : undefined,
    indicatiefBtwTarief: keepSnapshot ? line.indicatiefBtwTarief : undefined,
    indicatievePrijsEenheid: keepSnapshot ? line.indicatievePrijsEenheid : undefined,
    indicatievePrijsSoort: keepSnapshot ? line.indicatievePrijsSoort : undefined,
    indicatiefVastgelegdOp: keepSnapshot ? timestamp : undefined
  };

  if (existing) {
    await ctx.db.patch(existing._id, { ...doc, gewijzigdOp: timestamp });

    return existing._id;
  }

  return await ctx.db.insert("measurementLines", {
    tenantId,
    inmetingId,
    ...doc,
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

function calcWallPanels(input: {
  wallWidthM: number;
  wallHeightM: number;
  panelWidthM: number;
  panelHeightM: number;
  wastePercent: number;
}) {
  const wallAreaM2 = round2(input.wallWidthM * input.wallHeightM);
  const panelAreaM2 = round2(input.panelWidthM * input.panelHeightM);
  const columns = Math.ceil(input.wallWidthM / input.panelWidthM);
  const rows = Math.ceil(input.wallHeightM / input.panelHeightM);
  const panelsNeeded = columns * rows;
  const totalPanels = Math.ceil(panelsNeeded * (1 + input.wastePercent / 100));
  return {
    wallAreaM2,
    panelAreaM2,
    columns,
    rows,
    panelsNeeded,
    wastePanels: Math.max(0, totalPanels - panelsNeeded),
    totalPanels,
    quoteQuantityPieces: totalPanels,
    isIndicative: true as const
  };
}

async function ensureInvoice(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  customerId: Id<"customers">,
  quoteId: Id<"quotes"> | null,
  invoice: {
    invoiceNumber: string;
    status: "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";
    factuurdatum: number;
    vervaldatum: number;
    /** Aandeel betaald (0..1) van het totaal incl. btw. paid=1, partially_paid=0.5, anders 0. */
    betaaldFractie?: number;
    betaaldOp?: number;
    herinneringVerzondenOp?: number;
  }
): Promise<Id<"invoices">> {
  const quote = quoteId ? await ctx.db.get(quoteId) : null;
  const subtotaalExBtw = quote?.subtotaalExBtw ?? 0;
  const btwTotaal = quote?.btwTotaal ?? 0;
  const totaalInclBtw = quote?.totaalInclBtw ?? 0;
  const betaaldBedrag = round2(totaalInclBtw * (invoice.betaaldFractie ?? 0));
  const existing = await ctx.db
    .query("invoices")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("factuurnummer"), invoice.invoiceNumber))
    .first();
  const timestamp = now();
  const fields = {
    projectId,
    klantId: customerId,
    quoteId: quoteId ?? undefined,
    factuurnummer: invoice.invoiceNumber,
    status: invoice.status,
    factuurdatum: invoice.factuurdatum,
    vervaldatum: invoice.vervaldatum,
    subtotaalExBtw,
    btwTotaal,
    totaalInclBtw,
    betaaldBedrag,
    betaaldOp: invoice.betaaldOp,
    herinneringVerzondenOp: invoice.herinneringVerzondenOp
  };

  if (existing) {
    await ctx.db.patch(existing._id, { ...fields, gewijzigdOp: timestamp });

    return existing._id;
  }

  return await ctx.db.insert("invoices", {
    tenantId,
    ...fields,
    aangemaaktOp: timestamp,
    gewijzigdOp: timestamp
  });
}

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireConvexToolingEnabled("demoSeed.run");
    const timestamp = now();
    const tenantId = await ensureTenant(ctx);

    const day = 24 * 60 * 60 * 1000;

    // ── Klanten ─────────────────────────────────────────────────────────────────
    const bakkerId = await ensureCustomer(ctx, tenantId, {
      type: "private",
      displayName: "Familie Bakker",
      email: "fam.bakker@example.test",
      phone: "06-21847503",
      city: "Dronten",
      status: "active",
      notes: "PVC dryback voor woonkamer en hal; bestaande plavuizen egaliseren."
    });
    const visserId = await ensureCustomer(ctx, tenantId, {
      type: "private",
      displayName: "Familie Visser",
      email: "visser.swifterbant@example.test",
      phone: "06-38194726",
      city: "Swifterbant",
      status: "active",
      notes: "Traprenovatie PVC rechte trap + gordijnen woonkamer. Offerte akkoord."
    });
    const fysioId = await ensureCustomer(ctx, tenantId, {
      type: "business",
      displayName: "Fysiotherapie Hartog",
      email: "info@fysiohartog.example.test",
      phone: "0320-745210",
      city: "Lelystad",
      status: "active",
      notes: "Projecttapijt wachtruimte en gang; inmeten buiten behandeltijden."
    });
    const smitId = await ensureCustomer(ctx, tenantId, {
      type: "private",
      displayName: "Mevrouw Smit",
      email: "j.smit@example.test",
      phone: "06-50923184",
      city: "Biddinghuizen",
      status: "active",
      notes: "Behang slaapkamer (Masureel) en vinyl badkamer."
    });
    const mulderId = await ensureCustomer(ctx, tenantId, {
      type: "private",
      displayName: "De heer Mulder",
      email: "h.mulder@example.test",
      phone: "06-14702938",
      city: "Dronten",
      status: "lead",
      notes: "Oriënteert op karpet (VT Wonen) en raamdecoratie. Nog geen afspraak."
    });

    // ── Contactmomenten ───────────────────────────────────────────────────────────
    await ensureContact(ctx, tenantId, bakkerId, {
      type: "visit",
      title: "Winkelbezoek met PVC-stalen",
      description: "Floorlife Wide board natural en sun kissed bekeken.",
      visibleToCustomer: false
    });
    await ensureContact(ctx, tenantId, bakkerId, {
      type: "loaned_item",
      title: "Stalenmap PVC meegegeven",
      loanedItemName: "Stalenmap Floorlife dryback",
      expectedReturnDate: timestamp + 7 * day,
      visibleToCustomer: false
    });
    await ensureContact(ctx, tenantId, visserId, {
      type: "agreement",
      title: "Akkoord traprenovatie en gordijnen",
      description: "Stripkleur zwart, gordijnstof Headlam 66MV Touw.",
      visibleToCustomer: false
    });
    await ensureContact(ctx, tenantId, fysioId, {
      type: "call",
      title: "Telefoongesprek inmeetafspraak",
      description: "Wachtruimte en gang opnemen; vloer moet onderhoudsarm en stroef.",
      visibleToCustomer: false
    });
    await ensureContact(ctx, tenantId, mulderId, {
      type: "note",
      title: "Lead karpet en raamdecoratie",
      description: "Wil prijsindicatie Nature Cord karpet en plissé.",
      visibleToCustomer: false
    });

    // ── Projecten ───────────────────────────────────────────────────────────────
    const bakkerProjectId = await ensureProject(ctx, tenantId, {
      customerId: bakkerId,
      title: "PVC dryback woonkamer en hal",
      description: "Floorlife PVC dryback in woonkamer en hal, incl. egaliseren en plinten.",
      status: "quote_sent",
      internalNotes: "Bestaande plavuizen — droogtijd egalisatie inplannen.",
      customerNotes: "Ruimtes leeg opleveren bij aanvang."
    });
    const visserProjectId = await ensureProject(ctx, tenantId, {
      customerId: visserId,
      title: "Traprenovatie PVC en gordijnen",
      description: "PVC rechte trap met zwarte strip en gordijnen woonkamer.",
      status: "execution_planned",
      internalNotes: "Co-pro trapprofielset zwart bestellen.",
      customerNotes: "Uitvoering in overleg gepland."
    });
    const fysioProjectId = await ensureProject(ctx, tenantId, {
      customerId: fysioId,
      title: "Projecttapijt wachtruimte en gang",
      description: "Interfloor projecttapijt in wachtruimte en gang.",
      status: "measurement_planned",
      internalNotes: "Inmeten buiten behandeltijden; egaliseren ondergrond.",
      customerNotes: "Wachtruimte blijft toegankelijk tot uitvoering."
    });
    const smitProjectId = await ensureProject(ctx, tenantId, {
      customerId: smitId,
      title: "Behang slaapkamer en vinyl badkamer",
      description: "Masureel behang slaapkamer en Ambiant vinyl badkamer.",
      status: "quote_draft",
      internalNotes: "Behangrapport controleren i.v.m. patroon."
    });
    const mulderProjectId = await ensureProject(ctx, tenantId, {
      customerId: mulderId,
      title: "Oriëntatie karpet en raamdecoratie",
      description: "Prijsindicatie karpet en plissé; nog geen inmeting.",
      status: "lead",
      internalNotes: "Follow-up bellen na 2 weken."
    });

    // ── Ruimtes ─────────────────────────────────────────────────────────────────
    const bakkerWoonkamerRoomId = await ensureRoom(ctx, tenantId, bakkerProjectId, { name: "Woonkamer", areaM2: 38.4, perimeterMeter: 26.2, sortOrder: 1 });
    const bakkerHalRoomId = await ensureRoom(ctx, tenantId, bakkerProjectId, { name: "Hal", areaM2: 7.8, perimeterMeter: 12.6, sortOrder: 2 });
    const visserTrapRoomId = await ensureRoom(ctx, tenantId, visserProjectId, { name: "Trap", areaM2: 0, perimeterMeter: 0, sortOrder: 1 });
    const visserWoonkamerRoomId = await ensureRoom(ctx, tenantId, visserProjectId, { name: "Woonkamer", areaM2: 32.0, perimeterMeter: 23.4, sortOrder: 2 });
    const fysioWachtruimteRoomId = await ensureRoom(ctx, tenantId, fysioProjectId, { name: "Wachtruimte", areaM2: 42.0, perimeterMeter: 27.6, sortOrder: 1 });
    const fysioGangRoomId = await ensureRoom(ctx, tenantId, fysioProjectId, { name: "Gang", areaM2: 18.5, perimeterMeter: 24.0, sortOrder: 2 });
    const smitSlaapkamerRoomId = await ensureRoom(ctx, tenantId, smitProjectId, { name: "Slaapkamer", areaM2: 14.0, perimeterMeter: 15.2, sortOrder: 1 });
    const smitBadkamerRoomId = await ensureRoom(ctx, tenantId, smitProjectId, { name: "Badkamer", areaM2: 6.4, perimeterMeter: 10.4, sortOrder: 2 });

    // ── Workflow-events ─────────────────────────────────────────────────────────
    await ensureWorkflowEvent(ctx, tenantId, bakkerProjectId, {
      type: "quote_sent",
      title: "Offerte verstuurd",
      description: "Offerte PVC dryback woonkamer en hal verstuurd.",
      visibleToCustomer: false
    });
    await ensureWorkflowEvent(ctx, tenantId, visserProjectId, {
      type: "quote_accepted",
      title: "Offerte geaccepteerd",
      description: "Klant akkoord op traprenovatie en gordijnen.",
      visibleToCustomer: false
    });
    await ensureWorkflowEvent(ctx, tenantId, visserProjectId, {
      type: "execution_planned",
      title: "Uitvoering ingepland",
      description: "Traprenovatie en montage gordijnen gepland.",
      visibleToCustomer: false
    });
    await ensureWorkflowEvent(ctx, tenantId, fysioProjectId, {
      type: "measurement_planned",
      title: "Inmeting gepland",
      description: "Wachtruimte en gang inmeten buiten behandeltijden.",
      visibleToCustomer: false
    });
    await ensureWorkflowEvent(ctx, tenantId, smitProjectId, {
      type: "quote_created",
      title: "Conceptofferte aangemaakt",
      description: "Behang en vinyl in concept.",
      visibleToCustomer: false
    });

    // ── Offertes ────────────────────────────────────────────────────────────────
    const bakkerQuoteId = await ensureQuote(ctx, tenantId, bakkerProjectId, bakkerId, {
      quoteNumber: "OFF-2026-0101",
      title: "PVC dryback woonkamer en hal",
      status: "sent"
    });
    const visserQuoteId = await ensureQuote(ctx, tenantId, visserProjectId, visserId, {
      quoteNumber: "OFF-2026-0102",
      title: "Traprenovatie PVC en gordijnen",
      status: "accepted"
    });
    const smitQuoteId = await ensureQuote(ctx, tenantId, smitProjectId, smitId, {
      quoteNumber: "OFF-2026-0103",
      title: "Behang slaapkamer en vinyl badkamer",
      status: "draft"
    });

    const bakkerLines = [
      { lineType: "product" as const, title: "Floorlife PVC dryback Wide board natural", quantity: 48, unit: "m2", unitPriceExVat: 44.95, vatRate: 21, sortOrder: 1 },
      { lineType: "material" as const, title: "PVC plakondervloer", quantity: 48, unit: "m2", unitPriceExVat: 22.95, vatRate: 21, sortOrder: 2 },
      { lineType: "service" as const, title: "Primeren en egaliseren", quantity: 48, unit: "m2", unitPriceExVat: 15.95, vatRate: 21, sortOrder: 3 },
      { lineType: "labor" as const, title: "Legkosten PVC rechte plank", quantity: 48, unit: "m2", unitPriceExVat: 17.5, vatRate: 21, sortOrder: 4 },
      { lineType: "product" as const, title: "Co-pro plint Amsterdam (recht) lakfolie wit, geplaatst", quantity: 38, unit: "meter", unitPriceExVat: 8.95, vatRate: 21, sortOrder: 5 },
      { lineType: "text" as const, title: "Ruimtes dienen leeg te zijn bij aanvang van de werkzaamheden.", quantity: 0, unit: "tekst", unitPriceExVat: 0, vatRate: 0, sortOrder: 6 }
    ];
    const visserLines = [
      { lineType: "manual" as const, title: "Traprenovatie PVC rechte trap incl. Co-pro trapprofielset zwart", quantity: 1, unit: "trap", unitPriceExVat: 1595, vatRate: 21, sortOrder: 1 },
      { lineType: "product" as const, title: "Headlam gordijnstof 66MV Touw, op maat", quantity: 7.5, unit: "meter", unitPriceExVat: 38.5, vatRate: 21, sortOrder: 2 },
      { lineType: "product" as const, title: "Gordijnrails wit incl. ophangen", quantity: 7.5, unit: "meter", unitPriceExVat: 14.95, vatRate: 21, sortOrder: 3 },
      { lineType: "labor" as const, title: "Maken en monteren gordijnen", quantity: 2, unit: "stuk", unitPriceExVat: 55, vatRate: 21, sortOrder: 4 }
    ];
    const smitLines = [
      { lineType: "product" as const, title: "Masureel behang Gaio Oyster", quantity: 6, unit: "rol", unitPriceExVat: 34.95, vatRate: 21, sortOrder: 1 },
      { lineType: "labor" as const, title: "Aanbrengen behang (patroon)", quantity: 6, unit: "rol", unitPriceExVat: 65, vatRate: 21, sortOrder: 2 },
      { lineType: "product" as const, title: "Ambiant vinyl Calandro eiken", quantity: 9, unit: "m2", unitPriceExVat: 29.95, vatRate: 21, sortOrder: 3 },
      { lineType: "service" as const, title: "Egaliseren badkamervloer", quantity: 6.4, unit: "m2", unitPriceExVat: 15.95, vatRate: 21, sortOrder: 4 }
    ];

    for (const line of bakkerLines) {
      await ensureQuoteLine(ctx, tenantId, bakkerQuoteId, line);
    }
    for (const line of visserLines) {
      await ensureQuoteLine(ctx, tenantId, visserQuoteId, line);
    }
    for (const line of smitLines) {
      await ensureQuoteLine(ctx, tenantId, smitQuoteId, line);
    }
    await recalculateQuote(ctx, tenantId, bakkerQuoteId);
    await recalculateQuote(ctx, tenantId, visserQuoteId);
    await recalculateQuote(ctx, tenantId, smitQuoteId);

    // ── Inmetingen (buitendienst-flow: ruimtes + meetregels met productkeuze) ─────
    // Echte producten als richtprijs-snapshot; definitieve prijs blijft in de offerte.
    const floorProduct = await findProductId(ctx, tenantId, "PVC Dryback", "wide board natural");
    const plintProduct = await findProductId(ctx, tenantId, "Plinten", "amsterdam");
    const trapProduct = await findProductId(ctx, tenantId, "Traprenovatie", "trapprofielset zwart");
    const tapijtProduct = await findProductId(ctx, tenantId, "Tapijt", "400 ab active");
    const behangProduct = await findProductId(ctx, tenantId, "Behang", "gaio oyster");
    const vinylProduct = await findProductId(ctx, tenantId, "Vinyl", "calandro eiken");

    // Bakker — volledig ingemeten door Wim (PVC dryback + plinten)
    const bakkerMeasurementId = await ensureMeasurement(ctx, tenantId, bakkerProjectId, bakkerId, {
      status: "measured",
      inmeetdatum: timestamp - 5 * day,
      gemetenDoor: "Wim",
      notities: "Plavuizen vlak; egaliseren nodig in woonkamer. Hal smalle doorgang."
    });
    const bakkerMWoonkamer = await ensureMeasurementRoom(ctx, tenantId, bakkerMeasurementId, bakkerWoonkamerRoomId, {
      naam: "Woonkamer", breedteM: 4.8, lengteM: 8.0, hoogteM: 2.6, oppervlakteM2: 38.4, omtrekM: 26.2, sortOrder: 1
    });
    const bakkerWoonInvoer = { lengthM: 8.0, widthM: 4.8, patternType: "straight", wastePercent: 7 };
    const bakkerWoonResultaat = calcFlooring(bakkerWoonInvoer);
    await ensureMeasurementLine(ctx, tenantId, bakkerMeasurementId, bakkerMWoonkamer, {
      productGroep: "flooring", berekeningType: "area", invoer: bakkerWoonInvoer, resultaat: bakkerWoonResultaat,
      snijverliesPct: 7, aantal: bakkerWoonResultaat.quoteQuantityM2, eenheid: "m2", offerteRegelType: "product",
      quotePreparationStatus: "ready_for_quote", notities: "Floorlife dryback rechte plank.",
      product: floorProduct, indicatieveEenheidsprijsExBtw: 44.95, indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "m2", indicatievePrijsSoort: "advice_retail"
    });
    const bakkerPlintInvoer = { perimeterM: 26.2, doorOpeningM: 1.8, wastePercent: 5 };
    const bakkerPlintResultaat = calcPlinths(bakkerPlintInvoer);
    await ensureMeasurementLine(ctx, tenantId, bakkerMeasurementId, bakkerMWoonkamer, {
      productGroep: "plinths", berekeningType: "perimeter", invoer: bakkerPlintInvoer, resultaat: bakkerPlintResultaat,
      snijverliesPct: 5, aantal: bakkerPlintResultaat.quoteQuantityMeter, eenheid: "meter", offerteRegelType: "product",
      quotePreparationStatus: "ready_for_quote", notities: "Plint rondom woonkamer, deuropening afgetrokken.",
      product: plintProduct, indicatieveEenheidsprijsExBtw: 8.95, indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "meter", indicatievePrijsSoort: "advice_retail"
    });
    const bakkerMHal = await ensureMeasurementRoom(ctx, tenantId, bakkerMeasurementId, bakkerHalRoomId, {
      naam: "Hal", breedteM: 1.95, lengteM: 4.0, hoogteM: 2.6, oppervlakteM2: 7.8, omtrekM: 12.6, sortOrder: 2
    });
    const bakkerHalInvoer = { lengthM: 4.0, widthM: 1.95, patternType: "straight", wastePercent: 7 };
    const bakkerHalResultaat = calcFlooring(bakkerHalInvoer);
    await ensureMeasurementLine(ctx, tenantId, bakkerMeasurementId, bakkerMHal, {
      productGroep: "flooring", berekeningType: "area", invoer: bakkerHalInvoer, resultaat: bakkerHalResultaat,
      snijverliesPct: 7, aantal: bakkerHalResultaat.quoteQuantityM2, eenheid: "m2", offerteRegelType: "product",
      quotePreparationStatus: "draft", notities: "Zelfde vloer doorleggen in hal.",
      product: floorProduct, indicatieveEenheidsprijsExBtw: 44.95, indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "m2", indicatievePrijsSoort: "advice_retail"
    });

    // Visser — ingemeten en gereviewd: rechte trap + gordijnen
    const visserMeasurementId = await ensureMeasurement(ctx, tenantId, visserProjectId, visserId, {
      status: "reviewed",
      inmeetdatum: timestamp - 12 * day,
      gemetenDoor: "Wim",
      notities: "Rechte trap 13 treden, zwarte strip. Gordijnen woonkamer kamerhoog."
    });
    const visserMTrap = await ensureMeasurementRoom(ctx, tenantId, visserMeasurementId, visserTrapRoomId, {
      naam: "Trap", sortOrder: 1
    });
    const visserTrapInvoer = { stairType: "straight", treadCount: 13, riserCount: 13, stripLengthM: 0.9 };
    const visserTrapResultaat = calcStairs(visserTrapInvoer);
    await ensureMeasurementLine(ctx, tenantId, visserMeasurementId, visserMTrap, {
      productGroep: "stairs", berekeningType: "stairs", invoer: visserTrapInvoer, resultaat: visserTrapResultaat,
      aantal: 1, eenheid: "trap", offerteRegelType: "manual",
      quotePreparationStatus: "ready_for_quote", notities: "PVC rechte trap, strip zwart (Co-pro trapprofielset).",
      product: trapProduct, indicatieveEenheidsprijsExBtw: 1595, indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "trap", indicatievePrijsSoort: "manual"
    });
    const visserMWoonkamer = await ensureMeasurementRoom(ctx, tenantId, visserMeasurementId, visserWoonkamerRoomId, {
      naam: "Woonkamer", breedteM: 5.0, lengteM: 6.4, hoogteM: 2.7, oppervlakteM2: 32.0, omtrekM: 23.4, sortOrder: 2
    });
    const visserGordijnInvoer = { railLengteM: 7.5, afwerking: "kamerhoog", stof: "Headlam 66MV Touw" };
    const visserGordijnResultaat = { isIndicative: true as const, opmerking: "Maatwerk gordijnen; definitieve prijs in offerte." };
    await ensureMeasurementLine(ctx, tenantId, visserMeasurementId, visserMWoonkamer, {
      productGroep: "curtains", berekeningType: "manual", invoer: visserGordijnInvoer, resultaat: visserGordijnResultaat,
      aantal: 7.5, eenheid: "meter", offerteRegelType: "manual",
      quotePreparationStatus: "draft", notities: "Gordijnstof Headlam 66MV Touw, kamerhoog, railbreedte 7,5 m."
    });

    // Fysiotherapie Hartog — inmeting gepland door Wim (nog niet uitgevoerd)
    const fysioMeasurementId = await ensureMeasurement(ctx, tenantId, fysioProjectId, fysioId, {
      status: "draft",
      inmeetdatum: timestamp + 3 * day,
      gemetenDoor: "Wim",
      notities: "Inmeten buiten behandeltijden; stroef projecttapijt, ondergrond egaliseren."
    });
    const fysioMWacht = await ensureMeasurementRoom(ctx, tenantId, fysioMeasurementId, fysioWachtruimteRoomId, {
      naam: "Wachtruimte", breedteM: 6.0, lengteM: 7.0, hoogteM: 2.7, oppervlakteM2: 42.0, omtrekM: 27.6, sortOrder: 1
    });
    const fysioWachtInvoer = { lengthM: 7.0, widthM: 6.0, patternType: "straight", wastePercent: 10 };
    const fysioWachtResultaat = calcFlooring(fysioWachtInvoer);
    await ensureMeasurementLine(ctx, tenantId, fysioMeasurementId, fysioMWacht, {
      productGroep: "flooring", berekeningType: "area", invoer: fysioWachtInvoer, resultaat: fysioWachtResultaat,
      snijverliesPct: 10, aantal: fysioWachtResultaat.quoteQuantityM2, eenheid: "m2", offerteRegelType: "product",
      quotePreparationStatus: "draft", notities: "Projecttapijt wachtruimte; richtprijs bij inmeting.",
      product: tapijtProduct, indicatieveEenheidsprijsExBtw: 39.95, indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "m2", indicatievePrijsSoort: "advice_retail"
    });
    await ensureMeasurementRoom(ctx, tenantId, fysioMeasurementId, fysioGangRoomId, {
      naam: "Gang", breedteM: 1.85, lengteM: 10.0, hoogteM: 2.7, oppervlakteM2: 18.5, omtrekM: 24.0, sortOrder: 2
    });

    // Mevrouw Smit — ingemeten: behang slaapkamer + vinyl badkamer
    const smitMeasurementId = await ensureMeasurement(ctx, tenantId, smitProjectId, smitId, {
      status: "measured",
      inmeetdatum: timestamp - 2 * day,
      gemetenDoor: "Wim",
      notities: "Behang op accentwand slaapkamer; vinyl op badkamervloer."
    });
    const smitMSlaap = await ensureMeasurementRoom(ctx, tenantId, smitMeasurementId, smitSlaapkamerRoomId, {
      naam: "Slaapkamer", breedteM: 3.5, lengteM: 4.0, hoogteM: 2.6, oppervlakteM2: 14.0, omtrekM: 15.2, sortOrder: 1
    });
    const smitBehangInvoer = { wallWidthM: 3.5, wallHeightM: 2.6, rollWidthCm: 53, rollLengthM: 10.05, patternRepeatCm: 32, wastePercent: 10 };
    const smitBehangResultaat = calcWallpaper(smitBehangInvoer);
    await ensureMeasurementLine(ctx, tenantId, smitMeasurementId, smitMSlaap, {
      productGroep: "wallpaper", berekeningType: "rolls", invoer: smitBehangInvoer, resultaat: smitBehangResultaat,
      snijverliesPct: 10, aantal: smitBehangResultaat.rollsNeeded, eenheid: "rol", offerteRegelType: "product",
      quotePreparationStatus: "ready_for_quote", notities: "Accentwand achter bed; patroonrapport 32 cm.",
      product: behangProduct, indicatieveEenheidsprijsExBtw: 34.95, indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "rol", indicatievePrijsSoort: "advice_retail"
    });
    const smitMBad = await ensureMeasurementRoom(ctx, tenantId, smitMeasurementId, smitBadkamerRoomId, {
      naam: "Badkamer", breedteM: 2.0, lengteM: 3.2, hoogteM: 2.6, oppervlakteM2: 6.4, omtrekM: 10.4, sortOrder: 2
    });
    const smitVinylInvoer = { lengthM: 3.2, widthM: 2.0, patternType: "straight", wastePercent: 10 };
    const smitVinylResultaat = calcFlooring(smitVinylInvoer);
    await ensureMeasurementLine(ctx, tenantId, smitMeasurementId, smitMBad, {
      productGroep: "flooring", berekeningType: "area", invoer: smitVinylInvoer, resultaat: smitVinylResultaat,
      snijverliesPct: 10, aantal: smitVinylResultaat.quoteQuantityM2, eenheid: "m2", offerteRegelType: "product",
      quotePreparationStatus: "draft", notities: "Vinyl badkamervloer; vochtbestendig.",
      product: vinylProduct, indicatieveEenheidsprijsExBtw: 29.95, indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "m2", indicatievePrijsSoort: "advice_retail"
    });

    // ════════════════════════════════════════════════════════════════════════════
    // Bredere keten-dekking: extra klanten/projecten over álle statussen + facturen.
    // Doel: zeker weten dat elke stap (lead → bestellen → factureren → betaald/gesloten),
    // elke offerte-/factuurstatus en elk calculator-type ergens voorkomt.
    // ════════════════════════════════════════════════════════════════════════════

    const deGrootId = await ensureCustomer(ctx, tenantId, { type: "private", displayName: "Familie De Groot", email: "degroot@example.test", phone: "06-29384756", city: "Dronten", status: "active", notes: "PVC visgraat woonkamer; offerte akkoord, materiaal in bestelling." });
    const bistroId = await ensureCustomer(ctx, tenantId, { type: "business", displayName: "Bistro 't Centrum", email: "info@bistrocentrum.example.test", phone: "0321-612340", city: "Lelystad", status: "active", notes: "Vinyl horecavloer; opgeleverd en gefactureerd." });
    const kosterId = await ensureCustomer(ctx, tenantId, { type: "private", displayName: "Familie Koster", email: "koster@example.test", phone: "06-47382910", city: "Swifterbant", status: "active", notes: "Compleet woonpakket; afgerond en betaald." });
    const woltersId = await ensureCustomer(ctx, tenantId, { type: "private", displayName: "Familie Wolters", email: "wolters@example.test", phone: "06-58291037", city: "Biddinghuizen", status: "active", notes: "Trap en hal PVC; factuur openstaand en vervallen." });
    const zorgId = await ensureCustomer(ctx, tenantId, { type: "business", displayName: "Zorgcentrum De Brink", email: "facilitair@debrink.example.test", phone: "0321-778820", city: "Dronten", status: "active", notes: "Wandpanelen behandelruimtes; factuur deels betaald." });
    const dekkerId = await ensureCustomer(ctx, tenantId, { type: "private", displayName: "Mevrouw Dekker", email: "dekker@example.test", phone: "06-90817263", city: "Lelystad", status: "active", notes: "Raamdecoratie woonkamer; offerte afgewezen (te duur)." });
    const bosId = await ensureCustomer(ctx, tenantId, { type: "private", displayName: "De heer Bos", email: "bos@example.test", phone: "06-12039485", city: "Dronten", status: "lead", notes: "Vloeropdracht geannuleerd door klant." });

    const deGrootProjectId = await ensureProject(ctx, tenantId, { customerId: deGrootId, title: "PVC visgraat woonkamer", description: "PVC visgraat met onderlaag; materiaal in bestelling.", status: "ordering", internalNotes: "Visgraat hoog snijverlies; ruim bestellen." });
    const bistroProjectId = await ensureProject(ctx, tenantId, { customerId: bistroId, title: "Vinyl horecavloer bistro", description: "Onderhoudsarme vinyl in eetzaal; opgeleverd.", status: "invoiced", internalNotes: "Buiten openingstijden gelegd." });
    const kosterProjectId = await ensureProject(ctx, tenantId, { customerId: kosterId, title: "Compleet woonpakket", description: "PVC, plinten en gordijnen; volledig afgerond.", status: "paid", internalNotes: "Klant tevreden; referentie mogelijk." });
    const woltersProjectId = await ensureProject(ctx, tenantId, { customerId: woltersId, title: "Trap en hal PVC", description: "Traprenovatie en hal; gefactureerd.", status: "invoiced", internalNotes: "Betaalherinnering verstuurd." });
    const zorgProjectId = await ensureProject(ctx, tenantId, { customerId: zorgId, title: "Wandpanelen behandelruimtes", description: "Vochtbestendige wandpanelen in behandelruimtes.", status: "invoiced", internalNotes: "Aanbetaling ontvangen, restant openstaand." });
    const dekkerProjectId = await ensureProject(ctx, tenantId, { customerId: dekkerId, title: "Raamdecoratie woonkamer", description: "Plissé en jaloezieën woonkamer.", status: "quote_rejected", internalNotes: "Klant vond prijs te hoog; mogelijk later." });
    const bosProjectId = await ensureProject(ctx, tenantId, { customerId: bosId, title: "Geannuleerde vloeropdracht", description: "PVC woonkamer; door klant geannuleerd.", status: "cancelled", internalNotes: "Geannuleerd vóór inmeting." });

    const kosterWoonkamerRoomId = await ensureRoom(ctx, tenantId, kosterProjectId, { name: "Woonkamer", areaM2: 40.0, perimeterMeter: 26.0, sortOrder: 1 });
    const zorgBehandelRoomId = await ensureRoom(ctx, tenantId, zorgProjectId, { name: "Behandelruimte 1", areaM2: 16.0, perimeterMeter: 16.4, sortOrder: 1 });
    const dekkerWoonkamerRoomId = await ensureRoom(ctx, tenantId, dekkerProjectId, { name: "Woonkamer", areaM2: 28.0, perimeterMeter: 21.0, sortOrder: 1 });

    async function quoteWithLines(
      projectId: Id<"projects">,
      customerId: Id<"customers">,
      number: string,
      title: string,
      status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "cancelled",
      lines: Array<{
        lineType: "product" | "service" | "labor" | "material" | "discount" | "text" | "manual";
        title: string;
        quantity: number;
        unit: string;
        unitPriceExVat: number;
        vatRate: number;
        discountExVat?: number;
        sortOrder: number;
      }>
    ): Promise<Id<"quotes">> {
      const id = await ensureQuote(ctx, tenantId, projectId, customerId, { quoteNumber: number, title, status });
      for (const line of lines) {
        await ensureQuoteLine(ctx, tenantId, id, line);
      }
      await recalculateQuote(ctx, tenantId, id);

      return id;
    }

    const deGrootQuoteId = await quoteWithLines(deGrootProjectId, deGrootId, "OFF-2026-0104", "PVC visgraat woonkamer", "accepted", [
      { lineType: "product", title: "Floorlife PVC dryback visgraat", quantity: 40, unit: "m2", unitPriceExVat: 49.95, vatRate: 21, sortOrder: 1 },
      { lineType: "labor", title: "Legkosten PVC visgraat", quantity: 40, unit: "m2", unitPriceExVat: 22.5, vatRate: 21, sortOrder: 2 }
    ]);
    const bistroQuoteId = await quoteWithLines(bistroProjectId, bistroId, "OFF-2026-0105", "Vinyl horecavloer bistro", "accepted", [
      { lineType: "product", title: "Ambiant vinyl Nardini", quantity: 55, unit: "m2", unitPriceExVat: 27.95, vatRate: 21, sortOrder: 1 },
      { lineType: "service", title: "Egaliseren en primeren", quantity: 55, unit: "m2", unitPriceExVat: 15.95, vatRate: 21, sortOrder: 2 }
    ]);
    const kosterQuoteId = await quoteWithLines(kosterProjectId, kosterId, "OFF-2026-0106", "Compleet woonpakket", "accepted", [
      { lineType: "product", title: "Floorlife PVC dryback Wide board sun kissed", quantity: 40, unit: "m2", unitPriceExVat: 44.95, vatRate: 21, sortOrder: 1 },
      { lineType: "product", title: "Co-pro plint Amsterdam (recht) lakfolie wit", quantity: 26, unit: "meter", unitPriceExVat: 8.95, vatRate: 21, sortOrder: 2 },
      { lineType: "labor", title: "Legkosten PVC rechte plank", quantity: 40, unit: "m2", unitPriceExVat: 17.5, vatRate: 21, sortOrder: 3 }
    ]);
    const woltersQuoteId = await quoteWithLines(woltersProjectId, woltersId, "OFF-2026-0107", "Trap en hal PVC", "accepted", [
      { lineType: "manual", title: "Traprenovatie PVC kwart draai", quantity: 1, unit: "trap", unitPriceExVat: 1695, vatRate: 21, sortOrder: 1 },
      { lineType: "product", title: "Floorlife PVC dryback hal", quantity: 9, unit: "m2", unitPriceExVat: 44.95, vatRate: 21, sortOrder: 2 }
    ]);
    const zorgQuoteId = await quoteWithLines(zorgProjectId, zorgId, "OFF-2026-0108", "Wandpanelen behandelruimtes", "accepted", [
      { lineType: "product", title: "Co-pro Torino touch wandpaneel taupe", quantity: 24, unit: "stuk", unitPriceExVat: 34.5, vatRate: 21, sortOrder: 1 },
      { lineType: "labor", title: "Montage wandpanelen", quantity: 32, unit: "m2", unitPriceExVat: 18.5, vatRate: 21, sortOrder: 2 }
    ]);
    const dekkerQuoteId = await quoteWithLines(dekkerProjectId, dekkerId, "OFF-2026-0109", "Raamdecoratie woonkamer", "rejected", [
      { lineType: "manual", title: "Plissé raamdecoratie op maat", quantity: 4, unit: "stuk", unitPriceExVat: 245, vatRate: 21, sortOrder: 1 },
      { lineType: "manual", title: "Houten jaloezieën op maat", quantity: 2, unit: "stuk", unitPriceExVat: 189, vatRate: 21, sortOrder: 2 }
    ]);
    const bosQuoteId = await quoteWithLines(bosProjectId, bosId, "OFF-2026-0110", "Geannuleerde vloeropdracht", "cancelled", [
      { lineType: "product", title: "PVC woonkamer (geannuleerd)", quantity: 30, unit: "m2", unitPriceExVat: 39.95, vatRate: 21, sortOrder: 1 }
    ]);

    // Familie Jong — offerte verlopen zonder reactie, project afgesloten (expired + closed)
    const jongId = await ensureCustomer(ctx, tenantId, { type: "private", displayName: "Familie Jong", email: "jong@example.test", phone: "06-73625481", city: "Swifterbant", status: "lead", notes: "Offerte verstuurd maar verlopen zonder reactie; dossier afgesloten." });
    const jongProjectId = await ensureProject(ctx, tenantId, { customerId: jongId, title: "PVC slaapkamers (verlopen)", description: "PVC twee slaapkamers; offerte verlopen, dossier afgesloten.", status: "closed", internalNotes: "Geen reactie binnen geldigheidsduur; afgesloten." });
    const jongQuoteId = await quoteWithLines(jongProjectId, jongId, "OFF-2026-0111", "PVC slaapkamers", "expired", [
      { lineType: "product", title: "Floorlife PVC dryback Herringbone natural", quantity: 22, unit: "m2", unitPriceExVat: 46.95, vatRate: 21, sortOrder: 1 },
      { lineType: "labor", title: "Legkosten PVC visgraat", quantity: 22, unit: "m2", unitPriceExVat: 22.5, vatRate: 21, sortOrder: 2 }
    ]);

    // ── Facturen in alle 6 statussen ──────────────────────────────────────────────
    await ensureInvoice(ctx, tenantId, deGrootProjectId, deGrootId, deGrootQuoteId, { invoiceNumber: "FCT-2026-0101", status: "draft", factuurdatum: timestamp, vervaldatum: timestamp + 8 * day });
    await ensureInvoice(ctx, tenantId, bistroProjectId, bistroId, bistroQuoteId, { invoiceNumber: "FCT-2026-0102", status: "sent", factuurdatum: timestamp - 3 * day, vervaldatum: timestamp + 5 * day });
    await ensureInvoice(ctx, tenantId, kosterProjectId, kosterId, kosterQuoteId, { invoiceNumber: "FCT-2026-0103", status: "paid", factuurdatum: timestamp - 20 * day, vervaldatum: timestamp - 12 * day, betaaldFractie: 1, betaaldOp: timestamp - 10 * day });
    await ensureInvoice(ctx, tenantId, woltersProjectId, woltersId, woltersQuoteId, { invoiceNumber: "FCT-2026-0104", status: "overdue", factuurdatum: timestamp - 30 * day, vervaldatum: timestamp - 22 * day, herinneringVerzondenOp: timestamp - 10 * day });
    await ensureInvoice(ctx, tenantId, zorgProjectId, zorgId, zorgQuoteId, { invoiceNumber: "FCT-2026-0105", status: "partially_paid", factuurdatum: timestamp - 15 * day, vervaldatum: timestamp - 7 * day, betaaldFractie: 0.5 });
    await ensureInvoice(ctx, tenantId, bosProjectId, bosId, bosQuoteId, { invoiceNumber: "FCT-2026-0106", status: "cancelled", factuurdatum: timestamp - 10 * day, vervaldatum: timestamp - 2 * day });

    // ── Workflow-events op de nieuwe projecten (kort) ─────────────────────────────
    await ensureWorkflowEvent(ctx, tenantId, deGrootProjectId, { type: "supplier_order_created", title: "Bestelling geplaatst", description: "PVC visgraat besteld bij leverancier.", visibleToCustomer: false });
    await ensureWorkflowEvent(ctx, tenantId, bistroProjectId, { type: "invoice_created", title: "Factuur verstuurd", description: "Factuur vinyl horecavloer verstuurd.", visibleToCustomer: false });
    await ensureWorkflowEvent(ctx, tenantId, kosterProjectId, { type: "invoice_created", title: "Factuur voldaan", description: "Volledige betaling ontvangen.", visibleToCustomer: false });

    // ── Measurements voor de resterende calculator-types (panels, matrix, rails) ──
    const panelProduct = await findProductId(ctx, tenantId, "Wandpanelen", "torino touch paneel taupe");

    // Koster — afgerond, ingemeten (flooring/area)
    const kosterMeasurementId = await ensureMeasurement(ctx, tenantId, kosterProjectId, kosterId, { status: "reviewed", inmeetdatum: timestamp - 25 * day, gemetenDoor: "Wim", notities: "Compleet pakket ingemeten en uitgevoerd." });
    const kosterMWoon = await ensureMeasurementRoom(ctx, tenantId, kosterMeasurementId, kosterWoonkamerRoomId, { naam: "Woonkamer", breedteM: 5.0, lengteM: 8.0, hoogteM: 2.6, oppervlakteM2: 40.0, omtrekM: 26.0, sortOrder: 1 });
    const kosterInvoer = { lengthM: 8.0, widthM: 5.0, patternType: "straight", wastePercent: 7 };
    const kosterResultaat = calcFlooring(kosterInvoer);
    await ensureMeasurementLine(ctx, tenantId, kosterMeasurementId, kosterMWoon, { productGroep: "flooring", berekeningType: "area", invoer: kosterInvoer, resultaat: kosterResultaat, snijverliesPct: 7, aantal: kosterResultaat.quoteQuantityM2, eenheid: "m2", offerteRegelType: "product", quotePreparationStatus: "ready_for_quote", notities: "Wide board sun kissed.", product: floorProduct, indicatieveEenheidsprijsExBtw: 44.95, indicatiefBtwTarief: 21, indicatievePrijsEenheid: "m2", indicatievePrijsSoort: "advice_retail" });

    // Zorgcentrum — wandpanelen (panels-calculator)
    const zorgMeasurementId = await ensureMeasurement(ctx, tenantId, zorgProjectId, zorgId, { status: "measured", inmeetdatum: timestamp - 18 * day, gemetenDoor: "Wim", notities: "Twee behandelruimtes; vochtbestendige wandpanelen." });
    const zorgMBehandel = await ensureMeasurementRoom(ctx, tenantId, zorgMeasurementId, zorgBehandelRoomId, { naam: "Behandelruimte 1", breedteM: 4.0, lengteM: 4.0, hoogteM: 2.7, oppervlakteM2: 16.0, omtrekM: 16.4, sortOrder: 1 });
    const zorgPanelInvoer = { wallWidthM: 4.0, wallHeightM: 2.7, panelWidthM: 0.6, panelHeightM: 2.7, wastePercent: 8 };
    const zorgPanelResultaat = calcWallPanels(zorgPanelInvoer);
    await ensureMeasurementLine(ctx, tenantId, zorgMeasurementId, zorgMBehandel, { productGroep: "wall_panels", berekeningType: "panels", invoer: zorgPanelInvoer, resultaat: zorgPanelResultaat, snijverliesPct: 8, aantal: zorgPanelResultaat.quoteQuantityPieces, eenheid: "stuk", offerteRegelType: "product", quotePreparationStatus: "ready_for_quote", notities: "Wandpanelen 1 wand behandelruimte.", product: panelProduct, indicatieveEenheidsprijsExBtw: 34.5, indicatiefBtwTarief: 21, indicatievePrijsEenheid: "stuk", indicatievePrijsSoort: "advice_retail" });

    // Mevrouw Dekker — raambekleding: matrix-richtprijs + rail (matrix + manual/rails)
    const dekkerMeasurementId = await ensureMeasurement(ctx, tenantId, dekkerProjectId, dekkerId, { status: "measured", inmeetdatum: timestamp - 8 * day, gemetenDoor: "Wim", notities: "Raambekleding ingemeten; offerte uiteindelijk afgewezen." });
    const dekkerMWoon = await ensureMeasurementRoom(ctx, tenantId, dekkerMeasurementId, dekkerWoonkamerRoomId, { naam: "Woonkamer", breedteM: 4.5, lengteM: 6.2, hoogteM: 2.6, oppervlakteM2: 28.0, omtrekM: 21.0, sortOrder: 1 });
    const dekkerMatrixInvoer = { breedteCm: 180, hoogteCm: 240, quantity: 2 };
    const dekkerMatrixResultaat = { outOfRange: false, matchedWidthCm: 200, matchedHeightCm: 240, unitPrice: 189, quantity: 2, totalPrice: 378, isIndicative: true as const };
    await ensureMeasurementLine(ctx, tenantId, dekkerMeasurementId, dekkerMWoon, { productGroep: "curtains", berekeningType: "matrix", invoer: dekkerMatrixInvoer, resultaat: dekkerMatrixResultaat, aantal: 2, eenheid: "stuk", offerteRegelType: "manual", quotePreparationStatus: "draft", notities: "Plissé matrix-richtprijs (maatklasse 200×240).", indicatieveEenheidsprijsExBtw: 189, indicatiefBtwTarief: 21, indicatievePrijsEenheid: "stuk", indicatievePrijsSoort: "matrix" });
    const dekkerRailInvoer = { railLengteM: 4.2, montage: "plafond" };
    const dekkerRailResultaat = { isIndicative: true as const, opmerking: "Gordijnrail op maat." };
    await ensureMeasurementLine(ctx, tenantId, dekkerMeasurementId, dekkerMWoon, { productGroep: "rails", berekeningType: "manual", invoer: dekkerRailInvoer, resultaat: dekkerRailResultaat, aantal: 4.2, eenheid: "meter", offerteRegelType: "manual", quotePreparationStatus: "draft", notities: "Gordijnrail 4,2 m, plafondmontage." });

    // ── Resterende projectstatussen + volledige inmeting→offerte-conversie ────────
    // Familie Smeets — offerte geaccepteerd, nog in te plannen (quote_accepted)
    const smeetsId = await ensureCustomer(ctx, tenantId, { type: "private", displayName: "Familie Smeets", email: "smeets@example.test", phone: "06-33445566", city: "Dronten", status: "active", notes: "PVC keuken en bijkeuken; offerte akkoord, inmeting/uitvoering nog plannen." });
    const smeetsProjectId = await ensureProject(ctx, tenantId, { customerId: smeetsId, title: "PVC keuken en bijkeuken", description: "PVC dryback keuken en bijkeuken; offerte geaccepteerd.", status: "quote_accepted", internalNotes: "Inmeting en uitvoering nog inplannen." });
    const smeetsQuoteId = await quoteWithLines(smeetsProjectId, smeetsId, "OFF-2026-0112", "PVC keuken en bijkeuken", "accepted", [
      { lineType: "product", title: "Floorlife PVC dryback Wide board warm natural", quantity: 24, unit: "m2", unitPriceExVat: 44.95, vatRate: 21, sortOrder: 1 },
      { lineType: "labor", title: "Legkosten PVC rechte plank", quantity: 24, unit: "m2", unitPriceExVat: 17.5, vatRate: 21, sortOrder: 2 }
    ]);

    // Familie Prins — vloer in uitvoering (in_progress) met een ECHT geconverteerde meetregel:
    // measurement converted_to_quote → meetregel 'converted' gekoppeld aan een offerteregel.
    const prinsId = await ensureCustomer(ctx, tenantId, { type: "private", displayName: "Familie Prins", email: "prins@example.test", phone: "06-77889900", city: "Lelystad", status: "active", notes: "PVC woonkamer; ingemeten, offerte akkoord, vloer wordt gelegd." });
    const prinsProjectId = await ensureProject(ctx, tenantId, { customerId: prinsId, title: "PVC woonkamer in uitvoering", description: "PVC dryback woonkamer; meetregel verwerkt tot offerteregel, in uitvoering.", status: "in_progress", internalNotes: "Legwerk gepland; meetregel is verwerkt naar de offerte." });
    const prinsRoomId = await ensureRoom(ctx, tenantId, prinsProjectId, { name: "Woonkamer", areaM2: 34.0, perimeterMeter: 24.0, sortOrder: 1 });
    const prinsQuoteId = await ensureQuote(ctx, tenantId, prinsProjectId, prinsId, { quoteNumber: "OFF-2026-0113", title: "PVC woonkamer", status: "accepted" });
    const prinsQuoteLineId = await ensureQuoteLine(ctx, tenantId, prinsQuoteId, { lineType: "product", title: "Floorlife PVC dryback Wide board natural", quantity: 36.38, unit: "m2", unitPriceExVat: 44.95, vatRate: 21, sortOrder: 1 });
    await ensureQuoteLine(ctx, tenantId, prinsQuoteId, { lineType: "labor", title: "Legkosten PVC rechte plank", quantity: 36.38, unit: "m2", unitPriceExVat: 17.5, vatRate: 21, sortOrder: 2 });
    await recalculateQuote(ctx, tenantId, prinsQuoteId);
    const prinsMeasurementId = await ensureMeasurement(ctx, tenantId, prinsProjectId, prinsId, { status: "converted_to_quote", inmeetdatum: timestamp - 6 * day, gemetenDoor: "Wim", notities: "Ingemeten en verwerkt naar offerte." });
    const prinsMRoom = await ensureMeasurementRoom(ctx, tenantId, prinsMeasurementId, prinsRoomId, { naam: "Woonkamer", breedteM: 4.25, lengteM: 8.0, hoogteM: 2.6, oppervlakteM2: 34.0, omtrekM: 24.0, sortOrder: 1 });
    const prinsInvoer = { lengthM: 8.0, widthM: 4.25, patternType: "straight", wastePercent: 7 };
    const prinsResultaat = calcFlooring(prinsInvoer);
    const prinsLineId = await ensureMeasurementLine(ctx, tenantId, prinsMeasurementId, prinsMRoom, { productGroep: "flooring", berekeningType: "area", invoer: prinsInvoer, resultaat: prinsResultaat, snijverliesPct: 7, aantal: prinsResultaat.quoteQuantityM2, eenheid: "m2", offerteRegelType: "product", quotePreparationStatus: "ready_for_quote", notities: "Verwerkt naar offerteregel.", product: floorProduct, indicatieveEenheidsprijsExBtw: 44.95, indicatiefBtwTarief: 21, indicatievePrijsEenheid: "m2", indicatievePrijsSoort: "advice_retail" });
    await ctx.db.patch(prinsLineId, { quotePreparationStatus: "converted", geconverteerdeOfferteId: prinsQuoteId, geconverteerdeOfferteregelId: prinsQuoteLineId, gewijzigdOp: now() });

    return {
      tenantSlug,
      customers: {
        mulderId, smitId, bakkerId, fysioId, visserId,
        deGrootId, bistroId, kosterId, woltersId, zorgId, dekkerId, bosId, jongId, smeetsId, prinsId
      },
      projects: {
        mulderProjectId, smitProjectId, bakkerProjectId, fysioProjectId, visserProjectId,
        deGrootProjectId, bistroProjectId, kosterProjectId, woltersProjectId, zorgProjectId, dekkerProjectId, bosProjectId, jongProjectId, smeetsProjectId, prinsProjectId
      },
      quotes: {
        bakkerQuoteId, visserQuoteId, smitQuoteId,
        deGrootQuoteId, bistroQuoteId, kosterQuoteId, woltersQuoteId, zorgQuoteId, dekkerQuoteId, bosQuoteId, jongQuoteId, smeetsQuoteId, prinsQuoteId
      },
      measurements: {
        bakkerMeasurementId, visserMeasurementId, fysioMeasurementId, smitMeasurementId,
        kosterMeasurementId, zorgMeasurementId, dekkerMeasurementId, prinsMeasurementId
      },
      counts: { customers: 15, projects: 15, quotes: 13, invoices: 6, measurements: 8 }
    };
  }
});
