import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRoleForTenantId,
  requireMutationRole,
  requireQueryRole,
  requireQueryRoleForTenantId
} from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import { pilotHiddenReason } from "../catalog/pilot";
import {
  toQuote,
  toCustomer,
  toQuoteTemplate,
  quoteLineType,
  toProject,
  importedMeasurementLineTitle,
  importedMeasurementLineDescription,
  calculateLineTotals,
  existingInvoiceForQuote,
  restoreMeasurementLinesForQuote,
  assertQuoteAcceptable,
  cancelOtherOpenQuotesAndRestore,
  assertQuoteStatusTransition,
  assertNoOtherAcceptedQuote,
  cancelOpenSupplierOrders,
  applyProjectStatusForNewQuote,
  syncProjectStatusFromQuotes
} from "../portalUtils";
import {
  assertCompleteBundleFields,
  assertValidQuoteStairBundles,
  assertValidStairRenovationBundle,
  getMeasurementBundleLines,
  hasAnyBundleField,
  isConvertedOrLinked,
  stairBundleProductMetadataSnapshot,
  type StairBundleLineLike
} from "../stairBundles";
import { assertGuidedStairServiceHasBundle } from "../stairServiceProducts";

const quoteStatus = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("expired"),
  v.literal("cancelled")
);

const lineType = v.union(
  v.literal("product"),
  v.literal("service"),
  v.literal("labor"),
  v.literal("material"),
  v.literal("discount"),
  v.literal("text"),
  v.literal("manual")
);

const measurementProductGroup = v.union(
  v.literal("flooring"),
  v.literal("plinths"),
  v.literal("wallpaper"),
  v.literal("wall_panels"),
  v.literal("curtains"),
  v.literal("rails"),
  v.literal("stairs"),
  v.literal("other")
);

const measurementCalculationType = v.union(
  v.literal("area"),
  v.literal("perimeter"),
  v.literal("rolls"),
  v.literal("panels"),
  v.literal("stairs"),
  v.literal("matrix"),
  v.literal("manual")
);

const measurementCompositionRuleFields = {
  ruimteId: v.optional(v.id("measurementRooms")),
  productGroep: measurementProductGroup,
  berekeningType: measurementCalculationType,
  invoer: v.any(),
  resultaat: v.any(),
  snijverliesPct: v.optional(v.number()),
  aantal: v.number(),
  eenheid: v.string(),
  notities: v.optional(v.string()),
  offerteRegelType: quoteLineType,
  bundleId: v.optional(v.string()),
  bundleType: v.optional(v.literal("stair_renovation")),
  bundleRole: v.optional(
    v.union(v.literal("material"), v.literal("labor"), v.literal("surcharge"))
  ),
  sectionKey: v.optional(v.string()),
  productId: v.optional(v.id("products")),
  productNaam: v.optional(v.string()),
  indicatieveEenheidsprijsExBtw: v.optional(v.number()),
  indicatiefBtwTarief: v.optional(v.number()),
  indicatievePrijsEenheid: v.optional(v.string()),
  indicatievePrijsSoort: v.optional(v.string()),
  indicatiefVastgelegdOp: v.optional(v.number())
};

const MAX_COMPOSED_MEASUREMENT_LINES = 200;
function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const list = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    return await ctx.db
      .query("quotes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  }
});

export const get = query({
  args: {
    tenantId: v.id("tenants"),
    quoteId: v.id("quotes"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId);

    if (!quote || quote.tenantId !== args.tenantId) {
      return null;
    }

    const lines = await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) => q.eq("tenantId", args.tenantId).eq("quoteId", args.quoteId))
      .collect();

    return {
      quote,
      lines: lines.sort((a, b) => a.sortOrder - b.sortOrder)
    };
  }
});

// De legacy-mutaties "create" en "addLine" zijn verwijderd (audit 2026-07-09):
// nergens door de UI gebruikt en met zwakkere validatie dan createQuote/addQuoteLine
// (geen tenant-check op productId/projectRuimteId/werktariefRegelId). De portal-
// varianten in portal.ts zijn de enige ondersteunde route.

export const recalculate = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    quoteId: v.id("quotes")
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    await recalculateQuote(ctx, args.tenantId, args.quoteId);
    return args.quoteId;
  }
});

async function recalculateQuote(ctx: any, tenantId: any, quoteId: any) {
  const quote = await ctx.db.get(quoteId);

  if (!quote || quote.tenantId !== tenantId) {
    throw new ConvexError("Offerte niet gevonden.");
  }

  const lines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", tenantId).eq("quoteId", quoteId))
    .collect();

  const subtotalExVat = roundMoney(
    lines.reduce((sum: number, line: any) => sum + line.regelTotaalExBtw, 0)
  );
  const vatTotal = roundMoney(
    lines.reduce((sum: number, line: any) => sum + line.regelBtwTotaal, 0)
  );
  const totalIncVat = roundMoney(subtotalExVat + vatTotal);

  await ctx.db.patch(quoteId, {
    subtotaalExBtw: subtotalExVat,
    btwTotaal: vatTotal,
    totaalInclBtw: totalIncVat,
    gewijzigdOp: Date.now()
  });
}

function addCalendarDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function quoteLineSupportsCatalogProduct(regelType: string) {
  return (
    regelType === "product" ||
    regelType === "material" ||
    regelType === "service" ||
    regelType === "labor"
  );
}

async function validateQuoteLineProduct(
  ctx: any,
  tenantId: Id<"tenants">,
  regelType: string,
  productId?: string
) {
  if (!quoteLineSupportsCatalogProduct(regelType)) {
    return undefined;
  }

  if (!productId) {
    return undefined;
  }

  const product = await ctx.db.get(productId as Id<"products">);

  if (!product || product.tenantId !== tenantId) {
    throw new ConvexError("Product niet gevonden.");
  }

  const category = product.categorieId ? await ctx.db.get(product.categorieId) : null;
  const hiddenReason = pilotHiddenReason(product, category?.naam);

  if (hiddenReason) {
    throw new ConvexError(hiddenReason);
  }

  if (product.status !== "active") {
    throw new ConvexError("Dit product is niet (meer) actief en kan niet worden gekozen.");
  }

  const isServiceProduct = product.productAard === "service";

  if ((regelType === "product" || regelType === "material") && isServiceProduct) {
    throw new ConvexError(
      "Een dienstproduct kan niet als materiaal- of productregel worden opgeslagen."
    );
  }

  if ((regelType === "service" || regelType === "labor") && !isServiceProduct) {
    throw new ConvexError(
      "Een service- of arbeidsregel met productkoppeling vereist een dienstproduct."
    );
  }

  return product._id;
}

async function assertQuoteProductHasRequiredBundle(
  ctx: any,
  productId: Id<"products"> | undefined,
  isBundleMember: boolean
): Promise<void> {
  if (!productId) return;

  const product = await ctx.db.get(productId);
  if (product) {
    assertGuidedStairServiceHasBundle(product, isBundleMember);
  }
}

function importedMeasurementContext(invoer: unknown): Record<string, string | number | boolean> {
  if (!invoer || typeof invoer !== "object" || Array.isArray(invoer)) {
    return {};
  }

  const source = invoer as Record<string, unknown>;
  const context: Record<string, string | number | boolean> = {};
  const keys = [
    "recipeKey",
    "recipeVersion",
    "covering",
    "stairShape",
    "stairConstruction",
    "stairType",
    "treadCount",
    "riserCount",
    "doubleTreadCount",
    "stripLengthM",
    "materialCompatibilityConfirmed",
    "quantityMode",
    "calculatedQuantity",
    "quantityOverrideReason"
  ] as const;

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      context[key] = value;
    }
  }

  return context;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasQuoteBundleMetadata(value: unknown): boolean {
  const metadata = metadataRecord(value);
  return (
    metadata.bundleId !== undefined ||
    metadata.bundleType !== undefined ||
    metadata.bundleRole !== undefined ||
    metadata.sectionKey !== undefined
  );
}
async function requireDraftQuoteCalculationContext(
  ctx: any,
  tenantId: Id<"tenants">,
  quoteId: Id<"quotes">
) {
  const quote = await ctx.db.get(quoteId);
  if (!quote || quote.tenantId !== tenantId) {
    throw new ConvexError("Offerte niet gevonden.");
  }
  if (quote.status !== "draft") {
    throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
  }

  const project = await ctx.db.get(quote.projectId);
  if (
    !project ||
    project.tenantId !== tenantId ||
    String(project.klantId) !== String(quote.klantId)
  ) {
    throw new ConvexError("Project van deze offerte is niet geldig.");
  }

  const customer = await ctx.db.get(quote.klantId);
  if (
    !customer ||
    customer.tenantId !== tenantId ||
    String(customer._id) !== String(project.klantId)
  ) {
    throw new ConvexError("Klant van deze offerte is niet geldig.");
  }

  return { quote, project, customer };
}

function validateComposedMeasurementQuantities(aantal: number, snijverliesPct?: number): void {
  if (!Number.isFinite(aantal) || aantal < 0) {
    throw new ConvexError("Aantal moet een eindig, niet-negatief getal zijn.");
  }
  if (
    snijverliesPct !== undefined &&
    (!Number.isFinite(snijverliesPct) || snijverliesPct < 0 || snijverliesPct > 100)
  ) {
    throw new ConvexError("Snijverlies-% moet een getal tussen 0 en 100 zijn.");
  }
}
function validateComposedMeasurementSnapshot(
  eenheid: string,
  unitPriceExVat?: number,
  vatRate?: number,
  capturedAt?: number
): void {
  if (!eenheid.trim()) {
    throw new ConvexError("Eenheid mag niet leeg zijn.");
  }
  if (unitPriceExVat !== undefined && (!Number.isFinite(unitPriceExVat) || unitPriceExVat < 0)) {
    throw new ConvexError("Indicatieve eenheidsprijs moet een eindig, niet-negatief getal zijn.");
  }
  if (vatRate !== undefined && (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100)) {
    throw new ConvexError("Indicatief btw-tarief moet een getal tussen 0 en 100 zijn.");
  }
  if (capturedAt !== undefined && (!Number.isFinite(capturedAt) || capturedAt < 0)) {
    throw new ConvexError(
      "Tijdstip van de indicatieve prijs moet een eindig, niet-negatief getal zijn."
    );
  }
}

async function requireMeasurementRoomForQuote(
  ctx: any,
  tenantId: Id<"tenants">,
  quote: Doc<"quotes">,
  measurement: Doc<"measurements">,
  roomId?: Id<"measurementRooms">
): Promise<Doc<"measurementRooms"> | null> {
  if (!roomId) return null;

  const room = await ctx.db.get(roomId);
  if (!room || room.tenantId !== tenantId || room.inmetingId !== measurement._id) {
    throw new ConvexError("Meetruimte niet gevonden.");
  }

  const projectRoom = await ctx.db.get(room.projectRuimteId);
  if (
    !projectRoom ||
    projectRoom.tenantId !== tenantId ||
    projectRoom.projectId !== quote.projectId
  ) {
    throw new ConvexError("Ruimte niet gevonden bij het project van deze offerte.");
  }

  return room;
}

async function nextQuoteLineSortOrder(
  ctx: any,
  tenantId: Id<"tenants">,
  quoteId: Id<"quotes">,
  requestedStartSortOrder: number
): Promise<number> {
  const existingQuoteLines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", tenantId).eq("quoteId", quoteId))
    .collect();
  const requestedSortOrder = Number.isFinite(requestedStartSortOrder)
    ? Math.max(1, Math.round(requestedStartSortOrder))
    : 1;
  const nextAvailableSortOrder =
    existingQuoteLines.reduce(
      (highest: number, line: Doc<"quoteLines">) => Math.max(highest, line.sortOrder),
      0
    ) + 1;

  return Math.max(requestedSortOrder, nextAvailableSortOrder);
}

async function insertQuoteLineFromMeasurement(
  ctx: any,
  tenantId: Id<"tenants">,
  quote: Doc<"quotes">,
  measurement: Doc<"measurements">,
  room: Doc<"measurementRooms"> | null,
  line: Doc<"measurementLines">,
  sortOrder: number,
  now: number,
  strictProductValidation: boolean
): Promise<Id<"quoteLines">> {
  // Richtprijs-snapshot van de meetregel als voorinvulling gebruiken. De prijsreview
  // blijft altijd verplicht. De directe offertecomposer valideert een gekozen product
  // strikt; de historische import behoudt zijn tolerante gedrag voor gearchiveerde data.
  let prefilledProductId: Id<"products"> | undefined;

  if (line.productId) {
    await assertQuoteProductHasRequiredBundle(ctx, line.productId, Boolean(line.bundleId));
    if (line.bundleId || strictProductValidation) {
      prefilledProductId = await validateQuoteLineProduct(
        ctx,
        tenantId,
        line.offerteRegelType,
        String(line.productId)
      );
    } else {
      try {
        prefilledProductId = await validateQuoteLineProduct(
          ctx,
          tenantId,
          line.offerteRegelType,
          String(line.productId)
        );
      } catch {
        prefilledProductId = undefined;
      }
    }
  }

  const isTrustedProductlessLine =
    !line.productId &&
    ((line.indicatievePrijsSoort === "matrix" &&
      line.berekeningType === "matrix" &&
      line.offerteRegelType === "product") ||
      (line.indicatievePrijsSoort === "service_rule" &&
        (line.offerteRegelType === "service" || line.offerteRegelType === "labor")));
  const bundleProductMetadata = line.bundleId
    ? await stairBundleProductMetadataSnapshot(ctx, tenantId, line)
    : {};
  const hasIndicativePrice =
    (prefilledProductId !== undefined || isTrustedProductlessLine) &&
    line.indicatieveEenheidsprijsExBtw !== undefined &&
    line.indicatiefBtwTarief !== undefined;
  const unitPriceExVat = hasIndicativePrice ? line.indicatieveEenheidsprijsExBtw! : 0;
  const vatRate = hasIndicativePrice ? line.indicatiefBtwTarief! : 0;
  const totals = calculateLineTotals(line.offerteRegelType, line.aantal, unitPriceExVat, vatRate);

  return await ctx.db.insert("quoteLines", {
    tenantId,
    quoteId: quote._id,
    projectRuimteId: room?.projectRuimteId,
    regelType: line.offerteRegelType,
    titel: importedMeasurementLineTitle(line, room),
    omschrijving: importedMeasurementLineDescription(line, hasIndicativePrice),
    aantal: line.aantal,
    eenheid: line.eenheid,
    eenheidsprijsExBtw: unitPriceExVat,
    btwTarief: vatRate,
    productId: prefilledProductId,
    regelTotaalExBtw: totals.lineTotalExVat,
    regelBtwTotaal: totals.lineVatTotal,
    regelTotaalInclBtw: totals.lineTotalIncVat,
    sortOrder,
    metadata: {
      source: "measurement",
      measurementId: measurement._id,
      measurementLineId: line._id,
      measurementRoomId: room?._id,
      productGroup: line.productGroep,
      calculationType: line.berekeningType,
      wastePercent: line.snijverliesPct,
      isIndicative: true,
      productId: prefilledProductId ? line.productId : undefined,
      productName: prefilledProductId || isTrustedProductlessLine ? line.productNaam : undefined,
      sectionKey: line.sectionKey,
      bundleId: line.bundleId,
      bundleType: line.bundleType,
      bundleRole: line.bundleRole,
      ...importedMeasurementContext(line.invoer),
      ...bundleProductMetadata,
      indicativePriceType: hasIndicativePrice ? line.indicatievePrijsSoort : undefined,
      indicativePriceUnit: hasIndicativePrice ? line.indicatievePrijsEenheid : undefined,
      requiresManualProductReview: !prefilledProductId && !isTrustedProductlessLine,
      requiresManualPriceReview: true,
      requiresManualVatReview: !hasIndicativePrice
    },
    aangemaaktOp: now,
    gewijzigdOp: now
  });
}

function assertImmutableImportedBundleMetadata(existingValue: unknown, nextValue: unknown): void {
  const existing = metadataRecord(existingValue);
  const next = metadataRecord(nextValue);
  const immutableKeys = [
    "source",
    "measurementId",
    "productId",
    "measurementLineId",
    "measurementRoomId",
    "productGroup",
    "calculationType",
    "sectionKey",
    "bundleId",
    "bundleType",
    "bundleRole",
    "covering",
    "stairShape",
    "recipeKey",
    "recipeVersion",
    "stairConstruction",
    "treadCount",
    "riserCount",
    "doubleTreadCount",
    "stripLengthM",
    "materialCompatibilityConfirmed",
    "quantityMode",
    "calculatedQuantity",
    "quantityOverrideReason",
    "stairCatalogSalesUnit",
    "stairMaterialFamily",
    "stairMaterialCovering",
    "stairMaterialComponentRole",
    "stairMaterialIsPrimary",
    "stairMaterialPiecesPerPack",
    "stairMaterialOrderUnit",
    "stairMaterialLengthMPerUnit",
    "stairServiceSku",
    "stairServiceFamily",
    "stairServiceCovering",
    "stairServiceShape",
    "stairServiceRole",
    "stairServiceSectionKey"
  ] as const;

  for (const key of immutableKeys) {
    if (existing[key] !== next[key]) {
      throw new ConvexError(
        "De koppeling en rol van een geimporteerde trapbundel zijn onveranderlijk."
      );
    }
  }
}

/**
 * Verwijdert de `requiresManualPriceReview`-vlag uit regel-metadata. Een bewuste
 * updateQuoteLine geldt als de vereiste prijsreview, zodat de regel daarna door de
 * status-gate mag. De rest van de metadata (bv. isIndicative) blijft staan.
 */
function clearedPriceReviewMetadata(metadata: unknown): unknown {
  if (!metadata || typeof metadata !== "object") {
    return metadata;
  }
  if (!("requiresManualPriceReview" in (metadata as Record<string, unknown>))) {
    return metadata;
  }
  const { requiresManualPriceReview: _drop, ...rest } = metadata as Record<string, unknown>;
  return rest;
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
    titel: title,
    omschrijving: description,
    zichtbaarVoorKlant: false,
    createdByExternalUserId: externalUserId,
    aangemaaktOp: Date.now()
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
          voltooidOp: status === "done" ? now : task.voltooidOp,
          afgewezenOp: status === "dismissed" ? now : task.afgewezenOp,
          gewijzigdOp: now
        })
      )
  );
}

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
      throw new ConvexError("Offerteregel niet gevonden.");
    }

    const quote = await ctx.db.get(line.quoteId);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Offerte niet gevonden.");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    // Herstel eventueel gekoppelde meetregel (measurementLine)
    const measurements = await ctx.db
      .query("measurements")
      .withIndex("by_project", (q: any) =>
        q.eq("tenantId", tenant._id).eq("projectId", quote.projectId)
      )
      .collect();

    const quoteLineIdsToDelete = new Set<string>([String(line._id)]);
    let restoredBundleLink = false;

    for (const measurement of measurements) {
      const mLines = await ctx.db
        .query("measurementLines")
        .withIndex("by_measurement", (q: any) =>
          q.eq("tenantId", tenant._id).eq("inmetingId", measurement._id)
        )
        .collect();

      const linkedLine = mLines.find((ml: any) => ml.geconverteerdeOfferteregelId === line._id);

      if (linkedLine?.bundleId) {
        const restoreLines = await getMeasurementBundleLines(
          ctx,
          tenant._id,
          measurement._id,
          linkedLine.bundleId
        );
        if (restoreLines.length === 0) {
          throw new ConvexError("De gekoppelde trapbundel kan niet volledig worden hersteld.");
        }

        for (const restoreLine of restoreLines) {
          if (
            restoreLine.quotePreparationStatus !== "converted" ||
            restoreLine.geconverteerdeOfferteId !== quote._id ||
            !restoreLine.geconverteerdeOfferteregelId
          ) {
            throw new ConvexError(
              "De gekoppelde trapbundel is niet volledig aan deze offerte gekoppeld."
            );
          }

          const linkedQuoteLine = await ctx.db.get(restoreLine.geconverteerdeOfferteregelId);
          if (
            !linkedQuoteLine ||
            linkedQuoteLine.tenantId !== tenant._id ||
            linkedQuoteLine.quoteId !== quote._id
          ) {
            throw new ConvexError("De gekoppelde trapbundel bevat een ongeldige offerteregel.");
          }
          quoteLineIdsToDelete.add(String(linkedQuoteLine._id));
        }

        const now = Date.now();
        if (measurement.contextQuoteId) {
          if (measurement.contextQuoteId !== quote._id) {
            throw new ConvexError("Offerte-rekencontext hoort niet bij deze offerte.");
          }
          for (const restoreLine of restoreLines) {
            await ctx.db.delete(restoreLine._id);
          }
          await ctx.db.patch(measurement._id, { gewijzigdOp: now });
        } else {
          for (const restoreLine of restoreLines) {
            await ctx.db.patch(restoreLine._id, {
              quotePreparationStatus: "ready_for_quote",
              geconverteerdeOfferteId: undefined,
              geconverteerdeOfferteregelId: undefined,
              gewijzigdOp: now
            });
          }

          const restoredIds = new Set(restoreLines.map((restoreLine) => String(restoreLine._id)));
          const nogGeconverteerd = mLines.some(
            (measurementLine: Doc<"measurementLines">) =>
              !restoredIds.has(String(measurementLine._id)) && isConvertedOrLinked(measurementLine)
          );
          await ctx.db.patch(measurement._id, {
            ...(measurement.status === "converted_to_quote" && !nogGeconverteerd
              ? { status: "reviewed" as const }
              : {}),
            gewijzigdOp: now
          });
        }
        restoredBundleLink = true;
        break;
      }

      if (linkedLine) {
        const now = Date.now();
        if (measurement.contextQuoteId) {
          if (measurement.contextQuoteId !== quote._id) {
            throw new ConvexError("Offerte-rekencontext hoort niet bij deze offerte.");
          }
          await ctx.db.delete(linkedLine._id);
          await ctx.db.patch(measurement._id, { gewijzigdOp: now });
        } else {
          await ctx.db.patch(linkedLine._id, {
            quotePreparationStatus: "ready_for_quote",
            geconverteerdeOfferteId: undefined,
            geconverteerdeOfferteregelId: undefined,
            gewijzigdOp: now
          });
          // De inmeting is pas niet langer 'verwerkt naar offerte' als er ook geen
          // andere geconverteerde regels meer op staan.
          const nogGeconverteerd = mLines.some(
            (ml: any) => ml._id !== linkedLine._id && ml.quotePreparationStatus === "converted"
          );
          await ctx.db.patch(measurement._id, {
            ...(measurement.status === "converted_to_quote" && !nogGeconverteerd
              ? { status: "reviewed" as const }
              : {}),
            gewijzigdOp: now
          });
        }
      }
    }

    if (hasQuoteBundleMetadata(line.metadata) && !restoredBundleLink) {
      throw new ConvexError("De gekoppelde trapbundel kan niet veilig worden verwijderd.");
    }

    for (const quoteLineId of quoteLineIdsToDelete) {
      await ctx.db.delete(quoteLineId as Id<"quoteLines">);
    }
    await recalculateQuote(ctx, tenant._id, line.quoteId);

    return line._id;
  }
});

export const updateQuoteLine = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    lineId: v.string(),
    projectRuimteId: v.optional(v.string()),
    productId: v.optional(v.string()),
    regelType: lineType,
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    aantal: v.number(),
    eenheid: v.string(),
    eenheidsprijsExBtw: v.number(),
    btwTarief: v.number(),
    kortingExBtw: v.optional(v.number()),
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
      throw new ConvexError("Offerteregel niet gevonden.");
    }

    const quote = await ctx.db.get(line.quoteId);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Offerte niet gevonden.");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const projectRoomId = args.projectRuimteId
      ? (args.projectRuimteId as Id<"projectRooms">)
      : undefined;

    if (projectRoomId) {
      const projectRoom = await ctx.db.get(projectRoomId);

      if (
        !projectRoom ||
        projectRoom.tenantId !== tenant._id ||
        projectRoom.projectId !== quote.projectId
      ) {
        throw new ConvexError("Ruimte niet gevonden.");
      }
    }

    const isImportedBundleLine = hasQuoteBundleMetadata(line.metadata);
    const nextMetadata = args.metadata === undefined ? line.metadata : args.metadata;
    if (isImportedBundleLine) {
      if (String(projectRoomId ?? "") !== String(line.projectRuimteId ?? "")) {
        throw new ConvexError(
          "De ruimte van een geimporteerde trapbundel kan niet per losse regel worden gewijzigd."
        );
      }
      assertImmutableImportedBundleMetadata(line.metadata, nextMetadata);
    } else if (hasQuoteBundleMetadata(nextMetadata)) {
      throw new ConvexError(
        "Een trapbundel kan alleen als volledige set vanuit een inmeting worden geimporteerd."
      );
    }

    const storedMetadata = clearedPriceReviewMetadata(nextMetadata);
    // Valideer het product alleen wanneer het daadwerkelijk WIJZIGT. Een ongewijzigd
    // product mag een latere deactivatie/pilot-verberging niet blokkeren — anders kan
    // een monteur de prijs of het aantal van een bestaande regel niet meer corrigeren.
    const productUnchanged =
      quoteLineSupportsCatalogProduct(args.regelType) &&
      args.regelType === line.regelType &&
      !!args.productId &&
      !!line.productId &&
      args.productId === String(line.productId);
    const productId = !quoteLineSupportsCatalogProduct(args.regelType)
      ? undefined
      : productUnchanged
        ? line.productId
        : await validateQuoteLineProduct(ctx, tenant._id, args.regelType, args.productId);
    await assertQuoteProductHasRequiredBundle(ctx, productId, isImportedBundleLine);

    if (isImportedBundleLine) {
      const quoteLines = await ctx.db
        .query("quoteLines")
        .withIndex("by_quote", (q: any) => q.eq("tenantId", tenant._id).eq("quoteId", quote._id))
        .collect();
      const prospectiveLines = quoteLines.map((quoteLine: Doc<"quoteLines">) =>
        quoteLine._id === line._id
          ? ({
              ...quoteLine,
              projectRuimteId: projectRoomId,
              productId,
              regelType: args.regelType,
              eenheid: args.eenheid,
              aantal: args.aantal,
              metadata: storedMetadata
            } as Doc<"quoteLines">)
          : quoteLine
      );
      await assertValidQuoteStairBundles(ctx, tenant._id, prospectiveLines);
    }

    const totals = calculateLineTotals(
      args.regelType,
      args.aantal,
      args.eenheidsprijsExBtw,
      args.btwTarief,
      args.kortingExBtw
    );

    await ctx.db.patch(line._id, {
      projectRuimteId: projectRoomId,
      productId,
      regelType: args.regelType,
      titel: args.titel,
      omschrijving: args.omschrijving,
      aantal: args.aantal,
      eenheid: args.eenheid,
      eenheidsprijsExBtw: args.eenheidsprijsExBtw,
      btwTarief: args.btwTarief,
      kortingExBtw: args.kortingExBtw,
      regelTotaalExBtw: totals.lineTotalExVat,
      regelBtwTotaal: totals.lineVatTotal,
      regelTotaalInclBtw: totals.lineTotalIncVat,
      sortOrder: args.sortOrder ?? line.sortOrder,
      // Een bewuste regel-bewerking telt als prijsreview: wis de review-vlag.
      metadata: storedMetadata,
      gewijzigdOp: Date.now()
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
    voorwaarden: v.array(v.string()),
    betalingsvoorwaarden: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Offerte niet gevonden.");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    await ctx.db.patch(quote._id, {
      voorwaarden: args.voorwaarden,
      betalingsvoorwaarden: args.betalingsvoorwaarden ?? [],
      gewijzigdOp: Date.now()
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
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Offerte niet gevonden.");
    }

    const project = await ctx.db.get(quote.projectId);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
    }

    // Idempotent: dezelfde status opnieuw zetten is een no-op (voorkomt dubbele
    // workflow-events en een herhaalde sibling-cancel bij een dubbelklik).
    if (args.status === quote.status) {
      return quote._id;
    }

    if (project.status === "cancelled" || project.status === "closed") {
      throw new ConvexError(
        project.status === "cancelled"
          ? "Dit dossier is geannuleerd; de offertestatus kan niet meer worden gewijzigd."
          : "Dit dossier is afgesloten; de offertestatus kan niet meer worden gewijzigd."
      );
    }

    // Een al-gefactureerde offerte is bevroren op 'akkoord': hij mag niet uit akkoord worden
    // gehaald (terug naar concept, of op afgewezen/geannuleerd/verlopen) — anders wijkt de
    // offerte stil af van de reeds aangemaakte factuur (die de offerteregels live toont). Maak
    // zo nodig een creditfactuur via de factuur-flow. Bewust vóór de overgangsguard: deze
    // melding is specifieker dan de generieke "alleen annuleren"-melding.
    if (args.status !== "accepted") {
      const reedsGefactureerd = await existingInvoiceForQuote(ctx, tenant._id, quote._id);
      if (reedsGefactureerd) {
        throw new ConvexError(
          "Deze offerte is al gefactureerd en kan niet meer worden gewijzigd. Maak zo nodig een creditfactuur via de factuur-flow."
        );
      }
    }

    // Bewaak de toegestane overgang: een terminale offerte mag niet herleven naar
    // verstuurd/akkoord (zou dezelfde inmeting dubbel factureerbaar maken), en een
    // geaccepteerde offerte gaat alleen nog naar 'geannuleerd'.
    assertQuoteStatusTransition(quote.status, args.status);

    // Eén leidende geaccepteerde offerte per dossier.
    if (args.status === "accepted") {
      await assertNoOtherAcceptedQuote(ctx, tenant._id, project._id, quote._id);
    }

    // Prijs-/richtprijs-/leeg-gate vóór 'verstuurd'/'akkoord' — gedeeld met het winkel-
    // dossierpad (processProjectAction) zodat beide accept-paden dezelfde controle dragen.
    if (args.status === "sent" || args.status === "accepted") {
      await assertQuoteAcceptable(ctx, tenant._id, quote._id);
    }

    const now = Date.now();
    const returningToDraft = args.status === "draft";
    const quotePatch: Partial<Doc<"quotes">> = {
      status: args.status,
      verzondenOp: returningToDraft ? undefined : args.status === "sent" ? now : quote.verzondenOp,
      geldigTot: returningToDraft
        ? undefined
        : args.status === "sent"
          ? (quote.geldigTot ?? addCalendarDays(now, 30))
          : quote.geldigTot,
      geaccepteerdOp: returningToDraft
        ? undefined
        : args.status === "accepted"
          ? now
          : quote.geaccepteerdOp,
      afgewezenOp: returningToDraft
        ? undefined
        : args.status === "rejected"
          ? now
          : quote.afgewezenOp,
      gewijzigdOp: now
    };

    await ctx.db.patch(quote._id, quotePatch);

    // Annuleer de overige open offertes van dit project en bevrijd hun inmeetregels (gedeeld
    // met het winkel-accept-pad zodat er nooit twee 'levende' offertes op één dossier blijven).
    if (args.status === "accepted") {
      await cancelOtherOpenQuotesAndRestore(
        ctx,
        tenant._id,
        project._id,
        quote._id,
        now,
        externalUserId
      );
    }

    await syncProjectStatusFromQuotes(ctx, tenant._id, project, now);

    if (args.status === "sent") {
      await addProjectEvent(
        ctx,
        tenant._id,
        project._id,
        "quote_sent",
        "Offerte verzonden",
        externalUserId
      );
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
      await addProjectEvent(
        ctx,
        tenant._id,
        project._id,
        "quote_accepted",
        "Offerte akkoord",
        externalUserId
      );
      await closeOpenProjectTasks(
        ctx,
        tenant._id,
        project._id,
        "quote_follow_up",
        "done",
        quote._id
      );
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

    // Terminale offerte-staat (afgewezen/geannuleerd/verlopen): sluit de opvolgtaak,
    // bevrijd de inmeetregels (anders blijven ze permanent 'converted' en verdwijnen ze
    // uit de import-picker) en annuleer de nog-open leveranciersbestellingen van déze
    // offerte (een eerder geaccepteerde offerte kan al bestellingen hebben; ontvangen
    // bestellingen blijven staan). De telling gaat mee in het workflow-event, zodat het
    // annuleren van bestellingen nooit onzichtbaar gebeurt.
    if (args.status === "cancelled" || args.status === "rejected" || args.status === "expired") {
      await Promise.all(
        (["quote_follow_up", "confirmation_payment", "execution_call"] as const).map((type) =>
          closeOpenProjectTasks(ctx, tenant._id, project._id, type, "dismissed", quote._id)
        )
      );
      await restoreMeasurementLinesForQuote(ctx, tenant._id, project._id, quote._id);
      const cancelledOrderCount = await cancelOpenSupplierOrders(
        ctx,
        tenant._id,
        project._id,
        now,
        quote._id
      );
      const orderNote =
        cancelledOrderCount > 0
          ? `${cancelledOrderCount} openstaande leveranciersbestelling(en) geannuleerd.`
          : undefined;

      // Elke terminale overgang laat een spoor na in de dossier-tijdlijn: wie hierna het
      // dossier opent (winkel óf buitendienst) moet kunnen zien dat en wanneer de offerte
      // is gestopt — een afwijzing was voorheen onzichtbaar (dood einde).
      if (args.status === "cancelled") {
        await addProjectEvent(
          ctx,
          tenant._id,
          project._id,
          "closed",
          "Offerte geannuleerd",
          externalUserId,
          orderNote
        );
      } else {
        await addProjectEvent(
          ctx,
          tenant._id,
          project._id,
          "quote_rejected",
          args.status === "rejected" ? "Offerte afgewezen" : "Offerte verlopen",
          externalUserId,
          orderNote
        );
      }
    }

    return quote._id;
  }
});

export const listQuotesWorkspace = query({
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

// Detailpagina (/portal/offertes/[id]): zelfde vorm als listQuotesWorkspace,
// maar geschaald naar één offerte zodat niet de hele catalogus aan offertes
// wordt geladen om er één te tonen.
export const quoteDetailWorkspace = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    quoteId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    const quoteDoc = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quoteDoc || quoteDoc.tenantId !== tenant._id) {
      return { customers: [], projects: [], quotes: [], templates: [], klantAfspraken: [] };
    }

    const [customerDoc, projectDoc, templates, klantContacten] = await Promise.all([
      ctx.db.get(quoteDoc.klantId),
      ctx.db.get(quoteDoc.projectId),
      ctx.db
        .query("quoteTemplates")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("customerContacts")
        .withIndex("by_customer", (q: any) =>
          q.eq("tenantId", tenant._id).eq("klantId", quoteDoc.klantId)
        )
        .collect()
    ]);

    return {
      customers:
        customerDoc && customerDoc.tenantId === tenant._id
          ? [toCustomer(tenant.slug, customerDoc)]
          : [],
      projects:
        projectDoc && projectDoc.tenantId === tenant._id
          ? [await toProject(ctx, tenant.slug, projectDoc)]
          : [],
      quotes: [await toQuote(ctx, tenant.slug, quoteDoc)],
      templates: templates
        .filter((template: Doc<"quoteTemplates">) => template.status === "active")
        .map((template: Doc<"quoteTemplates">) => toQuoteTemplate(tenant.slug, template)),
      // Afspraken die de klant mag zien ("zichtbaar voor klant"): verschijnen als
      // Afspraken-blok op de klantversie van de offerte. Oudste eerst (leesvolgorde).
      klantAfspraken: (klantContacten as Doc<"customerContacts">[])
        .filter((contact) => contact.zichtbaarVoorKlant)
        .sort((a, b) => a.aangemaaktOp - b.aangemaaktOp)
        .map((contact) => ({
          titel: contact.titel,
          omschrijving: contact.omschrijving
        }))
    };
  }
});

export const createQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    titel: v.string(),
    // Optioneel gekozen offertesjabloon; zonder keuze valt hij terug op het
    // sjabloon van type "default" (het vorige, vaste gedrag).
    templateId: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
    }

    let template;
    if (args.templateId) {
      const chosen = await ctx.db.get(args.templateId as Id<"quoteTemplates">);
      if (!chosen || chosen.tenantId !== tenant._id || chosen.status !== "active") {
        throw new ConvexError("Offertesjabloon niet gevonden.");
      }
      template = chosen;
    } else {
      template = await ctx.db
        .query("quoteTemplates")
        .withIndex("by_type", (q: any) => q.eq("tenantId", tenant._id).eq("type", "default"))
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .first();
    }
    const now = Date.now();

    // Guard + statuszet vóór de insert: geen nieuwe offerte op een geannuleerd/gesloten
    // dossier, en geen statusregressie van een dossier dat al voorbij de offerte-fase is
    // (meerwerk-offerte op een lopend dossier laat de projectstatus staan).
    await applyProjectStatusForNewQuote(ctx, project, now);

    const quoteId = await ctx.db.insert("quotes", {
      tenantId: tenant._id,
      projectId: project._id,
      klantId: project.klantId,
      offertenummer: `OFF-${new Date(now).getFullYear()}-${now}`,
      titel: args.titel,
      status: "draft",
      inleidingTekst: template?.inleidingTekst,
      afsluitTekst: template?.afsluitTekst,
      voorwaarden: template?.standaardVoorwaarden ?? [],
      betalingsvoorwaarden: template?.betalingsvoorwaarden ?? [],
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    await ctx.db.insert("projectWorkflowEvents", {
      tenantId: tenant._id,
      projectId: project._id,
      type: "quote_created",
      titel: "Offerte aangemaakt",
      zichtbaarVoorKlant: false,
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now
    });

    return quoteId;
  }
});

export const updateQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    titel: v.optional(v.string()),
    geldigTot: v.optional(v.number()),
    inleidingTekst: v.optional(v.string()),
    afsluitTekst: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Offerte niet gevonden.");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const patch: Partial<Doc<"quotes">> = { gewijzigdOp: Date.now() };

    if (args.titel !== undefined) patch.titel = args.titel;
    const hasArg = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
    if (hasArg(args, "geldigTot")) patch.geldigTot = args.geldigTot;
    if (hasArg(args, "inleidingTekst")) patch.inleidingTekst = args.inleidingTekst;
    if (hasArg(args, "afsluitTekst")) patch.afsluitTekst = args.afsluitTekst;

    await ctx.db.patch(quote._id, patch);

    return quote._id;
  }
});

export const addQuoteLine = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    projectRuimteId: v.optional(v.string()),
    productId: v.optional(v.string()),
    regelType: quoteLineType,
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    aantal: v.number(),
    eenheid: v.string(),
    eenheidsprijsExBtw: v.number(),
    btwTarief: v.number(),
    kortingExBtw: v.optional(v.number()),
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
      throw new ConvexError("Offerte niet gevonden.");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const projectRoomId = args.projectRuimteId
      ? (args.projectRuimteId as Id<"projectRooms">)
      : undefined;

    if (projectRoomId) {
      const projectRoom = await ctx.db.get(projectRoomId);

      if (
        !projectRoom ||
        projectRoom.tenantId !== tenant._id ||
        projectRoom.projectId !== quote.projectId
      ) {
        throw new ConvexError("Ruimte niet gevonden.");
      }
    }

    if (hasQuoteBundleMetadata(args.metadata)) {
      throw new ConvexError(
        "Een trapbundel kan alleen als volledige set vanuit een inmeting worden geimporteerd."
      );
    }

    const productId = await validateQuoteLineProduct(
      ctx,
      tenant._id,
      args.regelType,
      args.productId
    );
    await assertQuoteProductHasRequiredBundle(ctx, productId, false);

    const totals = calculateLineTotals(
      args.regelType,
      args.aantal,
      args.eenheidsprijsExBtw,
      args.btwTarief,
      args.kortingExBtw
    );
    const now = Date.now();
    const lineId = await ctx.db.insert("quoteLines", {
      tenantId: tenant._id,
      quoteId: quote._id,
      projectRuimteId: projectRoomId,
      productId,
      regelType: args.regelType,
      titel: args.titel,
      omschrijving: args.omschrijving,
      aantal: args.aantal,
      eenheid: args.eenheid,
      eenheidsprijsExBtw: args.eenheidsprijsExBtw,
      btwTarief: args.btwTarief,
      kortingExBtw: args.kortingExBtw,
      regelTotaalExBtw: totals.lineTotalExVat,
      regelBtwTotaal: totals.lineVatTotal,
      regelTotaalInclBtw: totals.lineTotalIncVat,
      sortOrder: args.sortOrder,
      metadata: args.metadata,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    await recalculateQuote(ctx, tenant._id, quote._id);

    return lineId;
  }
});

/**
 * Maakt de minimale, interne inmeetcontext voor offerte-rekenhulpen klaar.
 *
 * Dit pad is nadrukkelijk géén planningactie: projectstatus, inmeetdatum en
 * workflow-events blijven onaangeraakt. Bestaande echte dossier-ruimtes worden
 * gekoppeld; zonder ruimtes blijft de context leeg totdat de gebruiker een echte
 * ruimte toevoegt.
 */
export const ensureQuoteCalculationContext = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    projectRuimteId: v.optional(v.id("projectRooms"))
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const { quote, project } = await requireDraftQuoteCalculationContext(
      ctx,
      tenant._id,
      args.quoteId as Id<"quotes">
    );
    const now = Date.now();

    const contextMeasurements = await ctx.db
      .query("measurements")
      .withIndex("by_quote_context", (q: any) =>
        q.eq("tenantId", tenant._id).eq("contextQuoteId", quote._id)
      )
      .order("desc")
      .collect();

    let measurement: Doc<"measurements"> | null | undefined = contextMeasurements.find(
      (candidate: Doc<"measurements">) =>
        candidate.status === "draft" &&
        candidate.projectId === project._id &&
        candidate.klantId === quote.klantId
    );
    let createdMeasurement = false;
    if (!measurement) {
      const measurementId = await ctx.db.insert("measurements", {
        contextQuoteId: quote._id,
        tenantId: tenant._id,
        projectId: project._id,
        klantId: quote.klantId,
        status: "draft",
        notities: "Interne rekencontext voor de offerteopbouwer.",
        createdByExternalUserId: externalUserId,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      measurement = await ctx.db.get(measurementId);
      createdMeasurement = true;
    }
    if (!measurement) {
      throw new ConvexError("Inmeetcontext kon niet worden aangemaakt.");
    }

    let targetProjectRooms: Doc<"projectRooms">[];
    if (args.projectRuimteId) {
      const requestedProjectRoom = await ctx.db.get(args.projectRuimteId);
      if (
        !requestedProjectRoom ||
        requestedProjectRoom.tenantId !== tenant._id ||
        requestedProjectRoom.projectId !== project._id
      ) {
        throw new ConvexError("Ruimte niet gevonden bij het project van deze offerte.");
      }
      targetProjectRooms = [requestedProjectRoom];
    } else {
      targetProjectRooms = (
        await ctx.db
          .query("projectRooms")
          .withIndex("by_project", (q: any) =>
            q.eq("tenantId", tenant._id).eq("projectId", project._id)
          )
          .collect()
      )
        .filter(
          (room: Doc<"projectRooms">) =>
            room.naam.trim().toLocaleLowerCase("nl-NL") !== "offertecalculatie"
        )
        .sort(
          (left: Doc<"projectRooms">, right: Doc<"projectRooms">) =>
            left.sortOrder - right.sortOrder || left.aangemaaktOp - right.aangemaaktOp
        );
    }

    const existingMeasurementRooms = await ctx.db
      .query("measurementRooms")
      .withIndex("by_measurement", (q: any) =>
        q.eq("tenantId", tenant._id).eq("inmetingId", measurement._id)
      )
      .collect();
    const measurementRoomsByProjectRoom = new Map(
      existingMeasurementRooms.map((room: Doc<"measurementRooms">) => [
        String(room.projectRuimteId),
        room
      ])
    );
    let createdMeasurementRoom = false;
    let nextSortOrder =
      existingMeasurementRooms.reduce(
        (highest: number, room: Doc<"measurementRooms">) => Math.max(highest, room.sortOrder),
        0
      ) + 1;

    for (const projectRoom of targetProjectRooms) {
      if (measurementRoomsByProjectRoom.has(String(projectRoom._id))) continue;

      const measurementRoomId = await ctx.db.insert("measurementRooms", {
        tenantId: tenant._id,
        inmetingId: measurement._id,
        projectRuimteId: projectRoom._id,
        naam: projectRoom.naam,
        verdieping: projectRoom.verdieping,
        breedteM: projectRoom.breedteCm !== undefined ? projectRoom.breedteCm / 100 : undefined,
        lengteM: projectRoom.lengteCm !== undefined ? projectRoom.lengteCm / 100 : undefined,
        hoogteM: projectRoom.hoogteCm !== undefined ? projectRoom.hoogteCm / 100 : undefined,
        oppervlakteM2: projectRoom.oppervlakteM2,
        omtrekM: projectRoom.omtrekMeter,
        notities: projectRoom.notities,
        sortOrder: nextSortOrder,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      const insertedRoom = await ctx.db.get(measurementRoomId);
      if (!insertedRoom) {
        throw new ConvexError("Meetruimte kon niet worden aangemaakt.");
      }
      measurementRoomsByProjectRoom.set(String(projectRoom._id), insertedRoom);
      nextSortOrder += 1;
      createdMeasurementRoom = true;
    }

    const preferredProjectRoom = targetProjectRooms[0];
    const preferredMeasurementRoom = preferredProjectRoom
      ? measurementRoomsByProjectRoom.get(String(preferredProjectRoom._id))
      : undefined;

    return {
      measurementId: measurement._id,
      measurementRoomId: preferredMeasurementRoom?._id,
      projectRoomId: preferredProjectRoom?._id,
      createdMeasurement,
      createdMeasurementRoom
    };
  }
});

/**
 * Slaat rekenresultaten en offerteregels in één Convex-transactie op.
 *
 * Anders dan addMeasurementLinesBulk + importMeasurementLinesToQuote kan hier
 * nooit een tussenstaat zichtbaar worden: elke meetregel wordt direct gekoppeld
 * en als converted opgeslagen, of de volledige mutatie rolt terug.
 */
export const composeMeasurementLinesIntoQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    measurementId: v.id("measurements"),
    startSortOrder: v.number(),
    regels: v.array(v.object(measurementCompositionRuleFields))
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const { quote } = await requireDraftQuoteCalculationContext(
      ctx,
      tenant._id,
      args.quoteId as Id<"quotes">
    );
    const measurement = await ctx.db.get(args.measurementId);
    if (
      !measurement ||
      measurement.tenantId !== tenant._id ||
      measurement.projectId !== quote.projectId ||
      measurement.klantId !== quote.klantId ||
      measurement.contextQuoteId !== quote._id
    ) {
      throw new ConvexError("Inmeting niet gevonden bij het project van deze offerte.");
    }
    if (measurement.status !== "draft") {
      throw new ConvexError("Offerte-rekenhulpen vereisen een concept-inmeting.");
    }

    if (args.regels.length === 0) {
      return { measurementLineIds: [], quoteLineIds: [], count: 0 };
    }
    if (args.regels.length > MAX_COMPOSED_MEASUREMENT_LINES) {
      throw new ConvexError("Maximaal " + MAX_COMPOSED_MEASUREMENT_LINES + " regels per keer.");
    }

    const roomsById = new Map<string, Doc<"measurementRooms">>();
    const requestedBundles = new Map<string, StairBundleLineLike[]>();

    // Alle externe verwijzingen en de volledige traprecepten worden gecontroleerd
    // vóór de eerste insert. Convex biedt daarnaast transactierollback als een
    // latere snapshotcontrole onverwacht toch faalt.
    for (const regel of args.regels) {
      validateComposedMeasurementSnapshot(
        regel.eenheid,
        regel.indicatieveEenheidsprijsExBtw,
        regel.indicatiefBtwTarief,
        regel.indicatiefVastgelegdOp
      );
      validateComposedMeasurementQuantities(regel.aantal, regel.snijverliesPct);
      assertCompleteBundleFields(regel);

      if (regel.ruimteId && !roomsById.has(String(regel.ruimteId))) {
        const room = await requireMeasurementRoomForQuote(
          ctx,
          tenant._id,
          quote,
          measurement,
          regel.ruimteId
        );
        if (room) roomsById.set(String(room._id), room);
      }

      if (regel.productId) {
        await validateQuoteLineProduct(
          ctx,
          tenant._id,
          regel.offerteRegelType,
          String(regel.productId)
        );
        await assertQuoteProductHasRequiredBundle(ctx, regel.productId, hasAnyBundleField(regel));
      }

      if (hasAnyBundleField(regel)) {
        const bundleId = regel.bundleId!.trim();
        requestedBundles.set(bundleId, [
          ...(requestedBundles.get(bundleId) ?? []),
          regel as StairBundleLineLike
        ]);
      }
    }

    if (requestedBundles.size > 0) {
      const existingMeasurementLines = await ctx.db
        .query("measurementLines")
        .withIndex("by_measurement", (q: any) =>
          q.eq("tenantId", tenant._id).eq("inmetingId", measurement._id)
        )
        .collect();
      for (const [bundleId, bundleLines] of requestedBundles) {
        if (
          existingMeasurementLines.some(
            (line: Doc<"measurementLines">) => line.bundleId?.trim() === bundleId
          )
        ) {
          throw new ConvexError("Deze trapbundel bestaat al binnen de inmeting.");
        }
        await assertValidStairRenovationBundle(ctx, tenant._id, bundleLines);
      }
    }

    const now = Date.now();
    const startSortOrder = await nextQuoteLineSortOrder(
      ctx,
      tenant._id,
      quote._id,
      args.startSortOrder
    );
    const measurementLineIds: Id<"measurementLines">[] = [];
    const quoteLineIds: Id<"quoteLines">[] = [];

    for (const [index, regel] of args.regels.entries()) {
      const keepSnapshot =
        Boolean(regel.productId) || regel.indicatieveEenheidsprijsExBtw !== undefined;
      const measurementLineId = await ctx.db.insert("measurementLines", {
        tenantId: tenant._id,
        inmetingId: measurement._id,
        ruimteId: regel.ruimteId,
        productGroep: regel.productGroep,
        berekeningType: regel.berekeningType,
        invoer: regel.invoer,
        resultaat: regel.resultaat,
        snijverliesPct: regel.snijverliesPct,
        aantal: regel.aantal,
        eenheid: regel.eenheid,
        notities: regel.notities,
        offerteRegelType: regel.offerteRegelType,
        quotePreparationStatus: "draft",
        bundleId: regel.bundleId?.trim(),
        bundleType: regel.bundleType,
        bundleRole: regel.bundleRole,
        sectionKey: regel.sectionKey,
        productId: regel.productId,
        productNaam: keepSnapshot ? regel.productNaam : undefined,
        indicatieveEenheidsprijsExBtw: keepSnapshot
          ? regel.indicatieveEenheidsprijsExBtw
          : undefined,
        indicatiefBtwTarief: keepSnapshot ? regel.indicatiefBtwTarief : undefined,
        indicatievePrijsEenheid: keepSnapshot ? regel.indicatievePrijsEenheid : undefined,
        indicatievePrijsSoort: keepSnapshot ? regel.indicatievePrijsSoort : undefined,
        indicatiefVastgelegdOp: keepSnapshot ? (regel.indicatiefVastgelegdOp ?? now) : undefined,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      const measurementLine = await ctx.db.get(measurementLineId);
      if (!measurementLine) {
        throw new ConvexError("Meetregel kon niet worden aangemaakt.");
      }

      const room = regel.ruimteId ? (roomsById.get(String(regel.ruimteId)) ?? null) : null;
      const quoteLineId = await insertQuoteLineFromMeasurement(
        ctx,
        tenant._id,
        quote,
        measurement,
        room,
        measurementLine,
        startSortOrder + index,
        now,
        true
      );
      await ctx.db.patch(measurementLineId, {
        quotePreparationStatus: "converted",
        geconverteerdeOfferteId: quote._id,
        geconverteerdeOfferteregelId: quoteLineId,
        gewijzigdOp: now
      });
      measurementLineIds.push(measurementLineId);
      quoteLineIds.push(quoteLineId);
    }

    // De interne context blijft draft zodat meerdere rekenhulpen in dezelfde
    // offerte overzichtelijk dezelfde context en ruimte kunnen hergebruiken.
    await ctx.db.patch(measurement._id, { gewijzigdOp: now });
    await recalculateQuote(ctx, tenant._id, quote._id);

    return {
      measurementLineIds,
      quoteLineIds,
      count: quoteLineIds.length
    };
  }
});

export const importMeasurementLinesToQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    lineIds: v.array(v.id("measurementLines")),
    startSortOrder: v.number()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Offerte niet gevonden.");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    if (args.lineIds.length === 0) {
      return [];
    }

    if (new Set(args.lineIds.map((lineId) => String(lineId))).size !== args.lineIds.length) {
      throw new ConvexError("Meetregels mogen maar een keer worden geimporteerd.");
    }

    const now = Date.now();
    const insertedLineIds: Id<"quoteLines">[] = [];
    const touchedMeasurementIds = new Set<Id<"measurements">>();
    const requestedLineIds = new Set(args.lineIds.map((lineId) => String(lineId)));
    const validatedBundleKeys = new Set<string>();
    const existingQuoteLines = await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q: any) => q.eq("tenantId", tenant._id).eq("quoteId", quote._id))
      .collect();
    const requestedSortOrder = Number.isFinite(args.startSortOrder)
      ? Math.max(1, Math.round(args.startSortOrder))
      : 1;
    const nextSortOrder =
      existingQuoteLines.reduce(
        (highest: number, line: Doc<"quoteLines">) => Math.max(highest, line.sortOrder),
        0
      ) + 1;
    const startSortOrder = Math.max(requestedSortOrder, nextSortOrder);

    for (const [index, lineId] of args.lineIds.entries()) {
      const line = await ctx.db.get(lineId);

      if (!line || line.tenantId !== tenant._id) {
        throw new ConvexError("Inmeetregel niet gevonden.");
      }

      if (line.quotePreparationStatus !== "ready_for_quote" || isConvertedOrLinked(line)) {
        throw new ConvexError(
          "Deze inmeetregel is nog niet klaar voor een offerte. Zet de regel eerst op 'klaar voor offerte'."
        );
      }

      if (line.bundleId) {
        const bundleKey = `${String(line.inmetingId)}:${line.bundleId.trim()}`;

        if (!validatedBundleKeys.has(bundleKey)) {
          const bundleLines = await getMeasurementBundleLines(
            ctx,
            tenant._id,
            line.inmetingId,
            line.bundleId
          );

          if (
            bundleLines.some(
              (bundleLine: Doc<"measurementLines">) =>
                bundleLine.quotePreparationStatus !== "ready_for_quote" ||
                isConvertedOrLinked(bundleLine)
            )
          ) {
            throw new ConvexError(
              "Alle gekoppelde regels in deze bundel moeten klaar voor offerte zijn."
            );
          }

          if (
            bundleLines.some(
              (bundleLine: Doc<"measurementLines">) => !requestedLineIds.has(String(bundleLine._id))
            )
          ) {
            throw new ConvexError(
              "Een gekoppelde meetregelbundel moet volledig naar de offerte worden overgenomen."
            );
          }

          await assertValidStairRenovationBundle(ctx, tenant._id, bundleLines);
          validatedBundleKeys.add(bundleKey);
        }
      } else if (hasAnyBundleField(line)) {
        throw new ConvexError("Deze meetregel bevat een onvolledige trapbundelkoppeling.");
      }

      const measurement = await ctx.db.get(line.inmetingId);

      if (
        !measurement ||
        measurement.tenantId !== tenant._id ||
        measurement.projectId !== quote.projectId
      ) {
        throw new ConvexError("Inmeting niet gevonden bij het project van deze offerte.");
      }

      const room = line.ruimteId ? await ctx.db.get(line.ruimteId) : null;

      if (room && (room.tenantId !== tenant._id || room.inmetingId !== measurement._id)) {
        throw new ConvexError("Meetruimte niet gevonden.");
      }

      if (room?.projectRuimteId) {
        const projectRoom = await ctx.db.get(room.projectRuimteId);

        if (
          !projectRoom ||
          projectRoom.tenantId !== tenant._id ||
          projectRoom.projectId !== quote.projectId
        ) {
          throw new ConvexError("Ruimte niet gevonden.");
        }
      }

      // Richtprijs-snapshot van de meetregel als voorinvulling gebruiken.
      // Prijsreview blijft altijd verplicht; de offerte is en blijft de
      // plek waar de prijs definitief wordt gecontroleerd.
      // Een inmiddels verwijderd of pilot-verborgen product mag de batch niet
      // blokkeren: die regel komt dan zonder product/prijs binnen (zoals voorheen).
      let prefilledProductId: Id<"products"> | undefined;

      if (line.productId) {
        await assertQuoteProductHasRequiredBundle(ctx, line.productId, Boolean(line.bundleId));
        if (line.bundleId) {
          prefilledProductId = await validateQuoteLineProduct(
            ctx,
            tenant._id,
            line.offerteRegelType,
            String(line.productId)
          );
        } else {
          try {
            prefilledProductId = await validateQuoteLineProduct(
              ctx,
              tenant._id,
              line.offerteRegelType,
              String(line.productId)
            );
          } catch {
            prefilledProductId = undefined;
          }
        }
      }

      // Productloze maar vertrouwde richtprijzen mogen wél overgenomen worden:
      // raambekleding-matrix ("matrix") en eigen diensten/legkosten ("service_rule")
      // hebben géén catalogusproduct maar hun prijs komt uit eigen beheer (zelfde
      // regel als de staleness-guard in projecten/measurements.ts). Een verwijderd/
      // inactief catalogusproduct (productId stond er ooit, maar valideert niet
      // meer) blijft bewust leeg-geprijsd binnenkomen.
      const isTrustedProductlessLine =
        !line.productId &&
        ((line.indicatievePrijsSoort === "matrix" &&
          line.berekeningType === "matrix" &&
          line.offerteRegelType === "product") ||
          (line.indicatievePrijsSoort === "service_rule" &&
            (line.offerteRegelType === "service" || line.offerteRegelType === "labor")));
      const bundleProductMetadata = line.bundleId
        ? await stairBundleProductMetadataSnapshot(ctx, tenant._id, line)
        : {};
      const hasIndicativePrice =
        (prefilledProductId !== undefined || isTrustedProductlessLine) &&
        line.indicatieveEenheidsprijsExBtw !== undefined &&
        line.indicatiefBtwTarief !== undefined;
      const unitPriceExVat = hasIndicativePrice ? line.indicatieveEenheidsprijsExBtw! : 0;
      const vatRate = hasIndicativePrice ? line.indicatiefBtwTarief! : 0;
      const totals = calculateLineTotals(
        line.offerteRegelType,
        line.aantal,
        unitPriceExVat,
        vatRate
      );
      const quoteLineId = await ctx.db.insert("quoteLines", {
        tenantId: tenant._id,
        quoteId: quote._id,
        projectRuimteId: room?.projectRuimteId,
        regelType: line.offerteRegelType,
        titel: importedMeasurementLineTitle(line, room),
        omschrijving: importedMeasurementLineDescription(line, hasIndicativePrice),
        aantal: line.aantal,
        eenheid: line.eenheid,
        eenheidsprijsExBtw: unitPriceExVat,
        btwTarief: vatRate,
        productId: prefilledProductId,
        regelTotaalExBtw: totals.lineTotalExVat,
        regelBtwTotaal: totals.lineVatTotal,
        regelTotaalInclBtw: totals.lineTotalIncVat,
        sortOrder: startSortOrder + index,
        metadata: {
          source: "measurement",
          measurementId: measurement._id,
          measurementLineId: line._id,
          measurementRoomId: room?._id,
          productGroup: line.productGroep,
          calculationType: line.berekeningType,
          wastePercent: line.snijverliesPct,
          isIndicative: true,
          productId: prefilledProductId ? line.productId : undefined,
          productName:
            prefilledProductId || isTrustedProductlessLine ? line.productNaam : undefined,
          sectionKey: line.sectionKey,
          bundleId: line.bundleId,
          bundleType: line.bundleType,
          bundleRole: line.bundleRole,
          ...importedMeasurementContext(line.invoer),
          ...bundleProductMetadata,
          indicativePriceType: hasIndicativePrice ? line.indicatievePrijsSoort : undefined,
          indicativePriceUnit: hasIndicativePrice ? line.indicatievePrijsEenheid : undefined,
          // Matrix- (raambekleding) en dienstregels hebben bewust geen catalogusproduct nodig.
          requiresManualProductReview: !prefilledProductId && !isTrustedProductlessLine,
          requiresManualPriceReview: true,
          requiresManualVatReview: !hasIndicativePrice
        },
        aangemaaktOp: now,
        gewijzigdOp: now
      });

      await ctx.db.patch(line._id, {
        quotePreparationStatus: "converted",
        geconverteerdeOfferteId: quote._id,
        geconverteerdeOfferteregelId: quoteLineId,
        gewijzigdOp: now
      });

      insertedLineIds.push(quoteLineId);
      touchedMeasurementIds.add(measurement._id);
    }

    for (const measurementId of touchedMeasurementIds) {
      // De import ís de verwerking naar offerte: zet de inmeting door naar
      // 'converted_to_quote' zodat de buitendienst-kaart niet rood 'achterstallig'
      // blijft staan en niemand het handmatige status-dropdownnetje hoeft te onthouden.
      const measurement = await ctx.db.get(measurementId);
      await ctx.db.patch(measurementId, {
        ...(measurement && measurement.status !== "converted_to_quote"
          ? { status: "converted_to_quote" as const }
          : {}),
        gewijzigdOp: now
      });
    }

    await recalculateQuote(ctx, tenant._id, quote._id);

    return insertedLineIds;
  }
});
