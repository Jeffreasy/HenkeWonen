import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  resolveStairMaterialMetadata,
  type StairMaterialMetadata
} from "../src/lib/quotes/stairMaterialCatalog";
import {
  calculatePvcStairComponentQuantity,
  PVC_STAIR_SERVICE_CONFIG,
  validatePvcStairRecipeInput
} from "../src/lib/quotes/pvcStairCalculator";
import { normalizedProductSku, resolveStairServiceMetadata } from "./stairServiceProducts";

export const STAIR_BUNDLE_TYPE = "stair_renovation" as const;
export const STAIR_SECTION_KEY = "traprenovatie" as const;

export type StairBundleLineLike = {
  ruimteId?: string;
  aantal?: number;
  eenheid: string;
  productGroep: string;
  invoer: unknown;
  offerteRegelType: string;
  productId?: Id<"products">;
  quotePreparationStatus?: string;
  bundleId?: string;
  bundleType?: string;
  bundleRole?: string;
  sectionKey?: string;
};

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function inputObject(line: StairBundleLineLike): Record<string, unknown> {
  return line.invoer && typeof line.invoer === "object" && !Array.isArray(line.invoer)
    ? (line.invoer as Record<string, unknown>)
    : {};
}

const TECHNICAL_CONTEXT_KEYS = [
  "recipeKey",
  "recipeVersion",
  "covering",
  "stairShape",
  "stairConstruction",
  "treadCount",
  "riserCount",
  "doubleTreadCount",
  "stripLengthM",
  "materialCompatibilityConfirmed"
] as const;

function technicalContext(line: StairBundleLineLike): Record<string, unknown> {
  const input = inputObject(line);
  return Object.fromEntries(TECHNICAL_CONTEXT_KEYS.map((key) => [key, input[key]]));
}

function hasSameTechnicalContext(
  left: Record<string, unknown>,
  right: Record<string, unknown>
): boolean {
  return TECHNICAL_CONTEXT_KEYS.every((key) => Object.is(left[key], right[key]));
}

function validationMessage(errors: Array<{ message?: string }>): string {
  return errors
    .map((error) => error.message)
    .filter(Boolean)
    .join(" ");
}

function normalizedUnit(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function assertProductSalesUnit(
  line: StairBundleLineLike,
  product: Doc<"products">,
  lineKind: "materiaal" | "dienst"
): void {
  const expectedUnit = normalizedUnit(product.verkoopEenheid) ?? normalizedUnit(product.eenheid);
  const actualUnit = normalizedUnit(line.eenheid);

  if (!expectedUnit || actualUnit !== expectedUnit) {
    throw new ConvexError(
      `De eenheid van een trapbundel${lineKind} moet exact overeenkomen met de verkoopeenheid van het catalogusproduct (${expectedUnit ?? "onbekend"}).`
    );
  }
}

export function hasAnyBundleField(line: Partial<StairBundleLineLike>): boolean {
  return (
    line.bundleId !== undefined ||
    line.bundleType !== undefined ||
    line.bundleRole !== undefined ||
    line.sectionKey !== undefined
  );
}

export function assertCompleteBundleFields(line: Partial<StairBundleLineLike>): void {
  if (!hasAnyBundleField(line)) {
    return;
  }

  const bundleId = nonEmptyString(line.bundleId);
  if (!bundleId || bundleId.length > 180) {
    throw new ConvexError("Een trapbundel vereist een geldige, niet-lege bundel-id.");
  }
  if (
    line.bundleType !== STAIR_BUNDLE_TYPE ||
    !line.bundleRole ||
    line.sectionKey !== STAIR_SECTION_KEY
  ) {
    throw new ConvexError(
      "Een trapbundel vereist type, rol en sectie 'traprenovatie' op iedere regel."
    );
  }
}

export function isConvertedOrLinked(
  line: Pick<
    Doc<"measurementLines">,
    "quotePreparationStatus" | "geconverteerdeOfferteId" | "geconverteerdeOfferteregelId"
  >
): boolean {
  return Boolean(
    line.quotePreparationStatus === "converted" ||
    line.geconverteerdeOfferteId ||
    line.geconverteerdeOfferteregelId
  );
}

export async function getMeasurementBundleLines(
  ctx: any,
  tenantId: Id<"tenants">,
  inmetingId: Id<"measurements">,
  bundleId: string
): Promise<Doc<"measurementLines">[]> {
  const normalizedBundleId = bundleId.trim();
  return (
    await ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q: any) =>
        q.eq("tenantId", tenantId).eq("inmetingId", inmetingId)
      )
      .collect()
  ).filter((line: Doc<"measurementLines">) => line.bundleId?.trim() === normalizedBundleId);
}

async function isStairProductCategory(
  ctx: any,
  tenantId: Id<"tenants">,
  categoryId?: Id<"categories">
): Promise<boolean> {
  let currentId = categoryId;
  const visited = new Set<string>();

  while (currentId && !visited.has(String(currentId)) && visited.size < 12) {
    visited.add(String(currentId));
    const category = await ctx.db.get(currentId);
    if (!category || category.tenantId !== tenantId) return false;
    const normalizedName = category.naam.trim().toLowerCase();
    const normalizedSlug = category.slug.trim().toLowerCase();
    if (
      category.productGroep === "stairs" ||
      normalizedName.includes("traprenovatie") ||
      normalizedSlug.includes("traprenovatie")
    ) {
      return true;
    }
    currentId = category.bovenliggendeCategorieId;
  }

  return false;
}

type StairBundleValidationSource = "catalog" | "snapshot";

function productSalesUnit(product: Pick<Doc<"products">, "verkoopEenheid" | "eenheid">) {
  return normalizedUnit(product.verkoopEenheid) ?? normalizedUnit(product.eenheid);
}

function materialMetadataFromSnapshot(
  input: Record<string, unknown>
): StairMaterialMetadata | undefined {
  const metadata = resolveStairMaterialMetadata(
    {},
    {
      family: input.stairMaterialFamily,
      covering: input.stairMaterialCovering,
      componentRole: input.stairMaterialComponentRole,
      isPrimary: input.stairMaterialIsPrimary,
      piecesPerPack: input.stairMaterialPiecesPerPack,
      orderUnit: input.stairMaterialOrderUnit,
      lengthMPerUnit: input.stairMaterialLengthMPerUnit
    }
  );
  if (
    !metadata ||
    typeof input.stairMaterialIsPrimary !== "boolean" ||
    (input.stairMaterialPiecesPerPack !== undefined &&
      (!Number.isInteger(input.stairMaterialPiecesPerPack) ||
        (input.stairMaterialPiecesPerPack as number) <= 0)) ||
    (input.stairMaterialLengthMPerUnit !== undefined &&
      (typeof input.stairMaterialLengthMPerUnit !== "number" ||
        !Number.isFinite(input.stairMaterialLengthMPerUnit) ||
        input.stairMaterialLengthMPerUnit <= 0))
  ) {
    return undefined;
  }
  return metadata;
}

function materialMetadataSnapshot(metadata: StairMaterialMetadata) {
  return {
    stairMaterialFamily: metadata.family,
    stairMaterialCovering: metadata.covering,
    stairMaterialComponentRole: metadata.componentRole,
    stairMaterialIsPrimary: metadata.isPrimary,
    ...(metadata.piecesPerPack !== undefined
      ? { stairMaterialPiecesPerPack: metadata.piecesPerPack }
      : {}),
    ...(metadata.orderUnit !== undefined ? { stairMaterialOrderUnit: metadata.orderUnit } : {}),
    ...(metadata.lengthMPerUnit !== undefined
      ? { stairMaterialLengthMPerUnit: metadata.lengthMPerUnit }
      : {})
  };
}

/**
 * Legt de catalogusfeiten vast waarmee de meetbundel is gevalideerd. Latere
 * offerte-statuscontroles gebruiken dit snapshot en zijn daardoor niet afhankelijk
 * van een product dat na verzending is gearchiveerd of aangepast.
 */
export async function stairBundleProductMetadataSnapshot(
  ctx: any,
  tenantId: Id<"tenants">,
  line: StairBundleLineLike
): Promise<Record<string, string | number | boolean>> {
  if (!line.productId) {
    throw new ConvexError("Iedere regel van een trapbundel vereist een catalogusproduct.");
  }
  const product = await ctx.db.get(line.productId);
  if (!product || product.tenantId !== tenantId) {
    throw new ConvexError("Product van trapbundel niet gevonden.");
  }
  const salesUnit = productSalesUnit(product);
  if (!salesUnit) {
    throw new ConvexError("Het trapbundelproduct mist een verkoopeenheid.");
  }

  if (line.bundleRole === "material") {
    const materialMetadata = resolveStairMaterialMetadata(product);
    if (!materialMetadata) {
      throw new ConvexError("Een materiaalrol vereist een herkend PVC-trapmateriaal.");
    }
    return {
      stairCatalogSalesUnit: salesUnit,
      ...materialMetadataSnapshot(materialMetadata)
    };
  }

  const sku = normalizedProductSku(product);
  const metadata = resolveStairServiceMetadata(product);
  if (!sku || !metadata) {
    throw new ConvexError("De trapdienst mist geldige catalogusmetadata.");
  }
  return {
    stairCatalogSalesUnit: salesUnit,
    stairServiceSku: sku,
    stairServiceFamily: metadata.family,
    ...(metadata.covering ? { stairServiceCovering: metadata.covering } : {}),
    ...(metadata.shape ? { stairServiceShape: metadata.shape } : {}),
    stairServiceRole: metadata.role,
    stairServiceSectionKey: metadata.sectionKey
  };
}

export async function assertValidStairRenovationBundle(
  ctx: any,
  tenantId: Id<"tenants">,
  lines: StairBundleLineLike[],
  source: StairBundleValidationSource = "catalog"
): Promise<void> {
  if (lines.length === 0) {
    throw new ConvexError("Een trapbundel bevat geen regels.");
  }

  for (const line of lines) {
    assertCompleteBundleFields(line);
  }

  const bundleIds = new Set(lines.map((line) => line.bundleId!.trim()));
  if (bundleIds.size !== 1) {
    throw new ConvexError("Alle regels van een trapbundel moeten dezelfde bundel-id hebben.");
  }

  const roomIds = new Set(lines.map((line) => (line.ruimteId ? String(line.ruimteId) : "")));
  if (roomIds.size !== 1 || roomIds.has("")) {
    throw new ConvexError("Een trapbundel moet volledig bij een meetruimte horen.");
  }

  const firstContext = technicalContext(lines[0]);
  const validatedRecipe = validatePvcStairRecipeInput(firstContext);
  if (!validatedRecipe.ok) {
    throw new ConvexError(
      `De trapbundel bevat ongeldige technische PVC-trapinvoer. ${validationMessage(validatedRecipe.errors)}`
    );
  }
  const recipe = validatedRecipe.value;

  for (const line of lines) {
    const context = technicalContext(line);
    if (!hasSameTechnicalContext(context, firstContext)) {
      throw new ConvexError(
        "Alle regels van een trapbundel moeten exact dezelfde volledige technische trapcontext bevatten."
      );
    }
    if (line.productGroep !== "stairs") {
      throw new ConvexError("Een trapbundel kan alleen traprenovatieregels bevatten.");
    }
  }

  const roles = {
    material: lines.filter((line) => line.bundleRole === "material"),
    labor: lines.filter((line) => line.bundleRole === "labor"),
    surcharge: lines.filter((line) => line.bundleRole === "surcharge")
  };
  if (roles.material.length < 1 || roles.labor.length !== 1) {
    throw new ConvexError(
      "Een trapbundel vereist minimaal een materiaalregel en exact een arbeidsregel."
    );
  }
  const expectedSurchargeCount = recipe.stairConstruction === "open" ? 1 : 0;
  if (roles.surcharge.length !== expectedSurchargeCount) {
    throw new ConvexError(
      recipe.stairConstruction === "open"
        ? "Een open trapbundel vereist exact een open-traptoeslag."
        : "Een gesloten trapbundel mag geen open-traptoeslag bevatten."
    );
  }
  if (roles.material.length + roles.labor.length + roles.surcharge.length !== lines.length) {
    throw new ConvexError("De trapbundel bevat een onbekende bundelrol.");
  }

  const activeServiceProducts =
    source === "catalog"
      ? ((await ctx.db
          .query("products")
          .withIndex("by_product_kind_status", (q: any) =>
            q.eq("tenantId", tenantId).eq("productAard", "service").eq("status", "active")
          )
          .collect()) as Doc<"products">[])
      : [];
  const activeServicesBySku = new Map<string, Doc<"products">[]>();
  for (const serviceProduct of activeServiceProducts) {
    const sku = normalizedProductSku(serviceProduct);
    if (!sku) continue;
    activeServicesBySku.set(sku, [...(activeServicesBySku.get(sku) ?? []), serviceProduct]);
  }

  const productsById = new Map<string, Doc<"products">>();
  const materialProductIds = new Set<string>();
  let primaryMaterialCount = 0;
  for (const line of lines) {
    if (!line.productId) {
      throw new ConvexError("Iedere regel van een trapbundel vereist een catalogusproduct.");
    }
    if (typeof line.aantal !== "number" || !Number.isFinite(line.aantal) || line.aantal <= 0) {
      throw new ConvexError("Iedere trapbundelregel vereist een positieve, eindige hoeveelheid.");
    }
    const input = inputObject(line);
    let product: Doc<"products"> | undefined;
    if (source === "catalog") {
      const productKey = String(line.productId);
      product = productsById.get(productKey);
      if (!product) {
        const storedProduct = await ctx.db.get(line.productId);
        if (!storedProduct || storedProduct.tenantId !== tenantId) {
          throw new ConvexError("Product van trapbundel niet gevonden.");
        }
        if (storedProduct.status !== "active") {
          throw new ConvexError("Ieder catalogusproduct van een trapbundel moet actief zijn.");
        }
        product = storedProduct;
        productsById.set(productKey, storedProduct);
      }
    }

    if (line.bundleRole === "material") {
      const materialProductId = String(line.productId);
      if (materialProductIds.has(materialProductId)) {
        throw new ConvexError("Ieder materiaalproduct mag maar een keer in een trapbundel staan.");
      }
      materialProductIds.add(materialProductId);
      if (line.offerteRegelType !== "product" && line.offerteRegelType !== "material") {
        throw new ConvexError("Een materiaalrol vereist een bestelbaar product.");
      }
      let materialMetadata: StairMaterialMetadata | undefined;
      if (source === "catalog") {
        if (!product || product.productAard === "service") {
          throw new ConvexError("Een materiaalrol vereist een bestelbaar product.");
        }
        if (!(await isStairProductCategory(ctx, tenantId, product.categorieId))) {
          throw new ConvexError(
            "Een materiaalrol vereist een product uit de categorie Traprenovatie."
          );
        }
        materialMetadata = resolveStairMaterialMetadata(product);
        assertProductSalesUnit(line, product, "materiaal");
      } else {
        materialMetadata = materialMetadataFromSnapshot(input);
        if (
          !materialMetadata ||
          normalizedUnit(String(input.stairCatalogSalesUnit ?? "")) !== normalizedUnit(line.eenheid)
        ) {
          throw new ConvexError(
            "De verkoopeenheid van de geimporteerde materiaalregel komt niet overeen met het catalogusmetadata-snapshot."
          );
        }
      }
      if (!materialMetadata) {
        throw new ConvexError("Een materiaalrol vereist een herkend PVC-trapmateriaal.");
      }

      if (
        materialMetadata.componentRole === "double_tread" &&
        recipe.materialCompatibilityConfirmed !== true
      ) {
        throw new ConvexError(
          "Een dubbele PVC-traptrede vereist expliciete bevestiging van collectie- en kleurcompatibiliteit."
        );
      }
      const quantityResult = calculatePvcStairComponentQuantity(recipe, materialMetadata);
      if (!quantityResult.ok) {
        throw new ConvexError(
          `De materiaalhoeveelheid kan niet uit het PVC-traprecept worden berekend. ${validationMessage(quantityResult.errors)}`
        );
      }
      if (quantityResult.value.salesUnit !== "m1" && !Number.isInteger(line.aantal)) {
        throw new ConvexError(
          "Discrete PVC-trapmaterialen vereisen een positieve, gehele hoeveelheid."
        );
      }
      const expectedQuantity = quantityResult.value.salesQuantity;
      if (normalizedUnit(line.eenheid) !== quantityResult.value.salesUnit) {
        throw new ConvexError(
          `De verkoopeenheid van dit PVC-trapmateriaal moet ${quantityResult.value.salesUnit} zijn.`
        );
      }
      if (
        input.calculatedQuantity !== expectedQuantity ||
        (input.quantityMode !== "calculated" && input.quantityMode !== "manual_override")
      ) {
        throw new ConvexError(
          "De vastgelegde berekende materiaalhoeveelheid is verouderd of de hoeveelheidsmodus is ongeldig."
        );
      }
      if (input.quantityMode === "calculated" && line.aantal !== expectedQuantity) {
        throw new ConvexError(
          `De materiaalhoeveelheid moet exact overeenkomen met de berekende hoeveelheid (${expectedQuantity}).`
        );
      }
      if (input.quantityMode === "manual_override") {
        const overrideReason = nonEmptyString(input.quantityOverrideReason);
        if (!overrideReason || overrideReason.length < 3) {
          throw new ConvexError(
            "Een handmatige materiaalhoeveelheid vereist een vastgelegde reden van minimaal 3 tekens."
          );
        }
      }
      if (materialMetadata.isPrimary) {
        primaryMaterialCount += 1;
      }
      continue;
    }

    if (line.aantal !== 1) {
      throw new ConvexError("Arbeid en toeslagen van een trapbundel vereisen hoeveelheid 1.");
    }
    const expectedService =
      line.bundleRole === "labor"
        ? PVC_STAIR_SERVICE_CONFIG.baseByShape[recipe.stairShape]
        : PVC_STAIR_SERVICE_CONFIG.openSurcharge;
    const expectedSku = expectedService.sku;
    let normalizedSku: string | undefined;
    const expectedServiceShape =
      "shape" in expectedService.metadata ? expectedService.metadata.shape : undefined;

    let metadata:
      | {
          family?: string;
          covering?: string;
          shape?: string;
          role?: string;
          sectionKey?: string;
        }
      | undefined;

    if (source === "catalog") {
      if (!product || product.productAard !== "service") {
        throw new ConvexError("Arbeid en toeslagen vereisen een dienstproduct.");
      }
      normalizedSku = normalizedProductSku(product);
      metadata = resolveStairServiceMetadata(product);
      assertProductSalesUnit(line, product, "dienst");

      const matchingActiveServices = activeServicesBySku.get(expectedSku) ?? [];
      if (
        matchingActiveServices.length !== 1 ||
        String(matchingActiveServices[0]._id) !== String(product._id)
      ) {
        throw new ConvexError(
          matchingActiveServices.length > 1
            ? `Er staan meerdere actieve dienstproducten met SKU ${expectedSku}. Archiveer de duplicaten.`
            : `De vereiste actieve dienst ${expectedSku} is niet eenduidig beschikbaar.`
        );
      }
    } else {
      normalizedSku = nonEmptyString(input.stairServiceSku)?.toUpperCase();
      metadata = {
        family: nonEmptyString(input.stairServiceFamily),
        covering: nonEmptyString(input.stairServiceCovering),
        shape: nonEmptyString(input.stairServiceShape),
        role: nonEmptyString(input.stairServiceRole),
        sectionKey: nonEmptyString(input.stairServiceSectionKey)
      };
      if (
        normalizedUnit(String(input.stairCatalogSalesUnit ?? "")) !== normalizedUnit(line.eenheid)
      ) {
        throw new ConvexError(
          "De geimporteerde dienstregel mist een geldig catalogusmetadata-snapshot."
        );
      }
    }

    if (line.bundleRole === "labor") {
      if (line.offerteRegelType !== "labor") {
        throw new ConvexError("De arbeidsrol van een trapbundel vereist regeltype arbeid.");
      }
      if (normalizedSku !== expectedSku) {
        throw new ConvexError(`Deze trapvorm vereist dienst ${expectedSku}.`);
      }
      if (
        metadata?.family !== expectedService.metadata.family ||
        metadata.covering !== expectedService.metadata.covering ||
        metadata.shape !== expectedServiceShape ||
        metadata.role !== expectedService.metadata.role ||
        metadata.sectionKey !== expectedService.metadata.sectionKey
      ) {
        throw new ConvexError(
          `Dienst ${expectedSku} mist passende traprenovatie-metadata voor deze trapvorm.`
        );
      }
    } else {
      if (line.offerteRegelType !== "service" || normalizedSku !== expectedSku) {
        throw new ConvexError(`De open-traptoeslag vereist dienst ${expectedSku}.`);
      }
      if (
        metadata?.family !== expectedService.metadata.family ||
        metadata.covering !== expectedService.metadata.covering ||
        metadata.shape !== expectedServiceShape ||
        metadata.role !== expectedService.metadata.role ||
        metadata.sectionKey !== expectedService.metadata.sectionKey
      ) {
        throw new ConvexError(
          `Dienst ${expectedSku} mist passende metadata voor de open-traptoeslag.`
        );
      }
    }
  }

  if (primaryMaterialCount !== 1) {
    throw new ConvexError("Een trapbundel vereist exact een primair PVC-trapmateriaal.");
  }

  const statuses = new Set(
    lines
      .map((line) => line.quotePreparationStatus)
      .filter((status): status is string => status !== undefined)
  );
  if (statuses.size > 1) {
    throw new ConvexError("Alle regels van een trapbundel moeten dezelfde offertestatus hebben.");
  }
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Valideert alle geimporteerde trapbundels zoals ze daadwerkelijk in een offerte staan. */
export async function assertValidQuoteStairBundles(
  ctx: any,
  tenantId: Id<"tenants">,
  lines: Doc<"quoteLines">[],
  source: StairBundleValidationSource = "snapshot"
): Promise<void> {
  const groups = new Map<string, StairBundleLineLike[]>();

  for (const line of lines) {
    const metadata = metadataObject(line.metadata);
    const bundleFields = {
      bundleId: typeof metadata.bundleId === "string" ? metadata.bundleId : undefined,
      bundleType: typeof metadata.bundleType === "string" ? metadata.bundleType : undefined,
      bundleRole: typeof metadata.bundleRole === "string" ? metadata.bundleRole : undefined,
      sectionKey: typeof metadata.sectionKey === "string" ? metadata.sectionKey : undefined
    };
    if (!hasAnyBundleField(bundleFields)) continue;

    assertCompleteBundleFields(bundleFields);
    const measurementId = nonEmptyString(metadata.measurementId);
    const measurementRoomId = nonEmptyString(metadata.measurementRoomId);
    const productGroup = nonEmptyString(metadata.productGroup);
    const snapshotProductId = nonEmptyString(metadata.productId);
    if (!snapshotProductId || !line.productId || snapshotProductId !== String(line.productId)) {
      throw new ConvexError(
        "Een geimporteerde trapbundel moet aan het oorspronkelijk gevalideerde product gekoppeld blijven."
      );
    }
    if (!measurementId || !measurementRoomId || !productGroup) {
      throw new ConvexError("Een geimporteerde trapbundel mist de oorspronkelijke meetkoppeling.");
    }

    const key = `${measurementId}:${bundleFields.bundleId!.trim()}`;
    const adaptedLine: StairBundleLineLike = {
      ruimteId: measurementRoomId,
      aantal: line.aantal,
      productGroep: productGroup,
      invoer: metadata,
      eenheid: line.eenheid,
      offerteRegelType: line.regelType,
      productId: line.productId,
      bundleId: bundleFields.bundleId,
      bundleType: bundleFields.bundleType,
      bundleRole: bundleFields.bundleRole,
      sectionKey: bundleFields.sectionKey
    };
    groups.set(key, [...(groups.get(key) ?? []), adaptedLine]);
  }

  for (const bundleLines of groups.values()) {
    await assertValidStairRenovationBundle(ctx, tenantId, bundleLines, source);
  }
}
