import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutationActorValidator, readActorValidator, requireMutationRole, requireQueryRole } from "../authz";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(" ", "-")
    .replaceAll("/", "-")
    .replaceAll("_", "-")
    .replaceAll(".", "")
    .replaceAll(",", "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function stringValue(value: unknown, fallback: string): string {
  return optionalString(value) ?? fallback;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function collectByTenant(ctx: any, tableName: any, tenantId: any) {
  return await ctx.db
    .query(tableName)
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .collect();
}

async function takeByTenant(ctx: any, tableName: any, tenantId: any, batchSize: number) {
  return await ctx.db
    .query(tableName)
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .take(batchSize);
}

async function ensureCategory(ctx: any, tenantId: any, name: string) {
  const now = Date.now();
  const slug = slugify(name);
  const existing = await ctx.db
    .query("categories")
    .withIndex("by_slug", (q: any) => q.eq("tenantId", tenantId).eq("slug", slug))
    .first();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("categories", {
    tenantId,
    naam: name,
    slug,
    sortOrder: 999,
    status: "active" as const,
    aangemaaktOp: now,
    gewijzigdOp: now
  });
}

async function ensureSupplier(ctx: any, tenantId: any, name: string) {
  const now = Date.now();
  const existing = await ctx.db
    .query("suppliers")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("naam"), name))
    .first();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("suppliers", {
    tenantId,
    naam: name,
    prijslijstStatus: "received" as const,
    aangemaaktOp: now,
    gewijzigdOp: now
  });
}

async function ensureBrand(ctx: any, tenantId: any, supplierId: any, categoryId: any, name?: string) {
  if (!name) {
    return undefined;
  }

  const now = Date.now();
  const existing = await ctx.db
    .query("brands")
    .withIndex("by_supplier", (q: any) =>
      q.eq("tenantId", tenantId).eq("leverancierId", supplierId)
    )
    .filter((q: any) => q.eq(q.field("naam"), name))
    .first();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("brands", {
    tenantId,
    leverancierId: supplierId,
    categorieId: categoryId,
    naam: name,
    status: "active" as const,
    aangemaaktOp: now,
    gewijzigdOp: now
  });
}

async function ensureCollection(
  ctx: any,
  tenantId: any,
  supplierId: any,
  brandId: any,
  categoryId: any,
  name?: string
) {
  if (!name) {
    return undefined;
  }

  const now = Date.now();
  const existing = await ctx.db
    .query("productCollections")
    .withIndex("by_supplier", (q: any) =>
      q.eq("tenantId", tenantId).eq("leverancierId", supplierId)
    )
    .filter((q: any) => q.eq(q.field("naam"), name))
    .first();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("productCollections", {
    tenantId,
    leverancierId: supplierId,
    merkId: brandId,
    categorieId: categoryId,
    naam: name,
    status: "active" as const,
    aangemaaktOp: now,
    gewijzigdOp: now
  });
}

async function ensurePriceList(ctx: any, tenantId: any, supplierId: any, row: any) {
  const now = Date.now();
  const sourceFileName = stringValue(row.sourceFileName, "Onbekend bestand");
  const sourceSheetName = optionalString(row.sourceSheetName);
  const sourcePath = optionalString(row.sourcePath);
  const fileHash = optionalString(row.fileHash);
  const existing = await ctx.db
    .query("priceLists")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) =>
      q.and(
        q.eq(q.field("bronBestandsnaam"), sourceFileName),
        q.eq(q.field("bronBladNaam"), sourceSheetName),
        fileHash ? q.eq(q.field("bestandHash"), fileHash) : q.eq(q.field("bronPad"), sourcePath)
      )
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "imported" as const,
      bronPad: sourcePath,
      bestandHash: fileHash,
      year: numberValue(row.year),
      geldigVanaf: numberValue(row.validFrom),
      gewijzigdOp: now
    });

    return existing._id;
  }

  return await ctx.db.insert("priceLists", {
    tenantId,
    leverancierId: supplierId,
    naam: `${sourceFileName}${sourceSheetName ? ` - ${sourceSheetName}` : ""}`,
    bronBestandsnaam: sourceFileName,
    bronBladNaam: sourceSheetName,
    year: numberValue(row.year),
    geldigVanaf: numberValue(row.validFrom),
    status: "imported" as const,
    bronPad: sourcePath,
    bestandHash: fileHash,
    aangemaaktOp: now,
    gewijzigdOp: now
  });
}

async function findExistingProduct(ctx: any, tenantId: any, supplierId: any, row: any) {
  const importKey = optionalString(row.importKey);
  if (importKey) {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_import_key", (q: any) => q.eq("tenantId", tenantId).eq("importSleutel", importKey))
      .first();

    if (existing) {
      return existing;
    }
  }

  const articleNumber = optionalString(row.articleNumber);
  if (articleNumber) {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_article_number", (q: any) =>
        q.eq("tenantId", tenantId).eq("leverancierId", supplierId).eq("artikelnummer", articleNumber)
      )
      .first();

    if (existing) {
      return existing;
    }
  }

  const supplierCode = optionalString(row.supplierCode);
  if (supplierCode) {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_supplier_code", (q: any) =>
        q.eq("tenantId", tenantId).eq("leverancierId", supplierId).eq("leverancierCode", supplierCode)
      )
      .first();

    if (existing) {
      return existing;
    }
  }

  return null;
}

function priceHasUnknownVatMode(price: any): boolean {
  return stringValue(price?.vatMode, "unknown") === "unknown";
}

function rowHasUnknownVatMode(row: any): boolean {
  return Array.isArray(row?.prices) && row.prices.some((price: any) => priceHasUnknownVatMode(price));
}

function hasIdentity(row: any): boolean {
  return Boolean(
    optionalString(row.articleNumber) ||
      optionalString(row.supplierCode) ||
      optionalString(row.commercialCode) ||
      optionalString(row.ean) ||
      optionalString(row.importKey)
  );
}

function hasNaturalProductCode(row: any): boolean {
  return Boolean(
    optionalString(row.articleNumber) ||
      optionalString(row.supplierCode) ||
      optionalString(row.ean)
  );
}

function fallbackImportKey(tenantId: any, supplierName: string, row: any): string {
  const sourceFileName = optionalString(row.sourceFileName);
  const sourceSheetName = optionalString(row.sourceSheetName);
  const rowHash =
    optionalString(row.rowHash) ??
    optionalString(row.importRowHash) ??
    optionalString(row.sourceRowHash);

  if (sourceFileName && sourceSheetName && rowHash) {
    return [
      "fallback-row",
      String(tenantId),
      supplierName,
      sourceFileName,
      sourceSheetName,
      rowHash
    ].join(":");
  }

  return [
    "fallback-product",
    supplierName,
    optionalString(row.collectionName) ?? "",
    stringValue(row.productName, "Onbekend product"),
    optionalString(row.colorName) ?? "",
    numberValue(row.widthMm)?.toString() ?? "",
    stringValue(row.unit, "piece")
  ].join(":");
}

async function importNormalizedCatalogRow(ctx: any, tenantId: any, row: any, now: number) {
  const productName = optionalString(row.productName);

  if (!productName) {
    return {
      skippedRow: true,
      skippedProducts: 1,
      skippedPrices: Array.isArray(row.prices) ? row.prices.length : 0,
      importedPriceIds: []
    };
  }

  const supplierName = stringValue(row.supplierName, "Onbekend");
  const importKey = optionalString(row.importKey) ?? fallbackImportKey(tenantId, supplierName, row);
  const rowWithImportKey = {
    ...row,
    importKey
  };
  const categoryId = await ensureCategory(ctx, tenantId, stringValue(row.categoryName, "Overig"));
  const supplierId = await ensureSupplier(ctx, tenantId, supplierName);
  const brandId = await ensureBrand(
    ctx,
    tenantId,
    supplierId,
    categoryId,
    optionalString(rowWithImportKey.brandName)
  );
  const collectionId = await ensureCollection(
    ctx,
    tenantId,
    supplierId,
    brandId,
    categoryId,
    optionalString(rowWithImportKey.collectionName)
  );
  const priceListId = await ensurePriceList(ctx, tenantId, supplierId, rowWithImportKey);
  const existing = await findExistingProduct(ctx, tenantId, supplierId, rowWithImportKey);
  // Sleutels = NL schema-velden; waarden lezen nog het Engelse preview/normalized-
  // contract (rowWithImportKey.*), dat bewust EN blijft. De geneste commercialNames
  // krijgen hun binnenste sleutels hier (de bridge) van EN naar NL.
  const commercialNames = Array.isArray(rowWithImportKey.commercialNames)
    ? rowWithImportKey.commercialNames.map((cn: any) => ({
        merknaam: cn.brandName ?? cn.merknaam,
        collectieNaam: cn.collectionName ?? cn.collectieNaam,
        kleurnaam: cn.colorName ?? cn.kleurnaam,
        weergaveNaam: cn.displayName ?? cn.weergaveNaam
      }))
    : undefined;

  const productPatch = {
    categorieId: categoryId,
    leverancierId: supplierId,
    merkId: brandId,
    collectieId: collectionId,
    importSleutel: importKey,
    artikelnummer: optionalString(rowWithImportKey.articleNumber),
    ean: optionalString(rowWithImportKey.ean),
    sku: optionalString(rowWithImportKey.sku),
    leverancierCode: optionalString(rowWithImportKey.supplierCode),
    commercieleCode: optionalString(rowWithImportKey.commercialCode),
    leverancierProductGroep: optionalString(rowWithImportKey.supplierProductGroup),
    naam: productName,
    kleurnaam: optionalString(rowWithImportKey.colorName),
    omschrijving: optionalString(rowWithImportKey.description),
    productAard: stringValue(rowWithImportKey.productType, "standard"),
    productSoort: optionalString(rowWithImportKey.productKind),
    commercialNames,
    eenheid: stringValue(rowWithImportKey.unit, "piece"),
    breedteMm: numberValue(rowWithImportKey.widthMm),
    lengteMm: numberValue(rowWithImportKey.lengthMm),
    dikteMm: numberValue(rowWithImportKey.thicknessMm),
    slijtlaagMm: numberValue(rowWithImportKey.wearLayerMm),
    pakinhoudM2: numberValue(rowWithImportKey.packageContentM2),
    stuksPerPak: numberValue(rowWithImportKey.piecesPerPackage),
    pakkenPerPallet: numberValue(rowWithImportKey.packagesPerPallet),
    verkoopEenheid: optionalString(rowWithImportKey.salesUnit),
    inkoopEenheid: optionalString(rowWithImportKey.purchaseUnit),
    bestelEenheid: optionalString(rowWithImportKey.orderUnit),
    minimumBestelAantal: numberValue(rowWithImportKey.minimumOrderQuantity),
    bestelVeelvoud: numberValue(rowWithImportKey.orderMultiple),
    palletAantal: numberValue(rowWithImportKey.palletQuantity),
    vrachtwagenAantal: numberValue(rowWithImportKey.trailerQuantity),
    bundelGrootte: numberValue(rowWithImportKey.bundleSize),
    attributen: rowWithImportKey.attributes ?? undefined,
    status: "active" as const,
    gewijzigdOp: now
  };

  const productId = existing
    ? existing._id
    : await ctx.db.insert("products", {
        tenantId,
        ...productPatch,
        aangemaaktOp: now
      });

  if (existing) {
    await ctx.db.patch(productId, productPatch);
  }

  const importedPriceIds = [];
  let insertedPrices = 0;
  let updatedPrices = 0;
  let skippedPrices = 0;
  let zeroPriceRows = 0;
  let unknownVatModeRows = 0;
  const sourceKeys: string[] = [];
  const prices = Array.isArray(rowWithImportKey.prices) ? rowWithImportKey.prices : [];

  for (const price of prices) {
    const amount = numberValue(price.amount);
    const sourceKey = optionalString(price.sourceKey);

    if (amount === undefined || !sourceKey || amount <= 0) {
      skippedPrices += 1;
      if (amount !== undefined && amount <= 0) {
        zeroPriceRows += 1;
      }
      continue;
    }

    if (priceHasUnknownVatMode(price)) {
      unknownVatModeRows += 1;
    }

    sourceKeys.push(sourceKey);
    // Dedup ALLEEN binnen hetzelfde product: sourceKey is niet product-uniek
    // (collisies over meerdere producten komen in de data voor — zie validation.ts
    // duplicateSourceKeys). Een blinde .first() + patch zou een bestaande prijs naar
    // een ánder product kunnen verhangen. Match daarom expliciet op productId.
    const sourceKeyMatches = await ctx.db
      .query("productPrices")
      .withIndex("by_source_key", (q: any) =>
        q.eq("tenantId", tenantId).eq("bronSleutel", sourceKey)
      )
      .collect();
    const existingPrice =
      sourceKeyMatches.find((row: any) => row.productId === productId) ?? null;

    // Sleutels = NL schema-velden; waarden lezen nog het Engelse preview/normalized-
    // contract (price.*/rowWithImportKey.*), dat bewust EN blijft.
    const pricePatch = {
      productId,
      prijslijstId: priceListId,
      bronSleutel: sourceKey,
      prijsSoort: stringValue(price.priceType, "manual"),
      prijsEenheid: stringValue(price.priceUnit, "custom"),
      bedrag: amount,
      btwTarief: numberValue(price.vatRate) ?? 21,
      btwModus: stringValue(price.vatMode, "unknown"),
      currency: stringValue(price.currency, "EUR"),
      geldigVanaf: numberValue(price.validFrom),
      geldigTot: numberValue(price.validUntil),
      bronBestandsnaam: optionalString(rowWithImportKey.sourceFileName),
      bronBladNaam: optionalString(rowWithImportKey.sourceSheetName),
      bronKolomNaam: optionalString(price.sourceColumnName),
      bronKolomIndex: numberValue(price.sourceColumnIndex),
      bronRijNummer: numberValue(rowWithImportKey.sourceRowNumber),
      bronWaarde: optionalString(price.sourceValue),
      gewijzigdOp: now
    };

    if (existingPrice) {
      await ctx.db.patch(existingPrice._id, pricePatch);
      importedPriceIds.push(existingPrice._id);
      updatedPrices += 1;
    } else {
      const priceId = await ctx.db.insert("productPrices", {
        tenantId,
        ...pricePatch,
        aangemaaktOp: now
      });
      importedPriceIds.push(priceId);
      insertedPrices += 1;
    }
  }

  return {
    skippedRow: false,
    productId,
    importedPriceIds,
    insertedProducts: existing ? 0 : 1,
    updatedProducts: existing ? 1 : 0,
    insertedPrices,
    updatedPrices,
    skippedPrices,
    zeroPriceRows,
    unknownVatModeRows,
    duplicateProductMatches: existing ? 1 : 0,
    productsWithoutSupplierCode: hasNaturalProductCode(rowWithImportKey) ? 0 : 1,
    sourceKeys
  };
}

export const importRows = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    rows: v.array(v.any())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const tenantId = tenant._id;
    const now = Date.now();
    let insertedProducts = 0;
    let updatedProducts = 0;
    let insertedPrices = 0;
    let updatedPrices = 0;
    let skippedRows = 0;

    for (const row of args.rows) {
      const result = await importNormalizedCatalogRow(ctx, tenantId, row, now);

      if (result.skippedRow) {
        skippedRows += 1;
        continue;
      }

      insertedProducts += result.insertedProducts ?? 0;
      updatedProducts += result.updatedProducts ?? 0;
      insertedPrices += result.insertedPrices ?? 0;
      updatedPrices += result.updatedPrices ?? 0;
    }

    return {
      receivedRows: args.rows.length,
      skippedRows,
      insertedProducts,
      updatedProducts,
      insertedPrices,
      updatedPrices
    };
  }
});

function normalizePreviewRow(row: any) {
  return Object.prototype.hasOwnProperty.call(row ?? {}, "normalized") ? row.normalized : row;
}

function previewRowKind(row: any) {
  return stringValue(row?.rowKind, "product");
}

function rowWarnings(row: any): string[] {
  return Array.isArray(row?.warnings) ? row.warnings.filter((warning: any) => typeof warning === "string") : [];
}

function rowErrors(row: any): string[] {
  return Array.isArray(row?.errors) ? row.errors.filter((error: any) => typeof error === "string") : [];
}

function priceSourceKeys(row: any): string[] {
  const normalized = normalizePreviewRow(row);
  if (!Array.isArray(normalized?.prices)) {
    return [];
  }

  return normalized.prices
    .map((price: any) => optionalString(price.sourceKey))
    .filter(Boolean) as string[];
}

function rowHasZeroPrice(row: any) {
  const normalized = normalizePreviewRow(row);
  return Array.isArray(normalized?.prices)
    ? normalized.prices.some((price: any) => {
        const amount = numberValue(price.amount);
        return amount !== undefined && amount <= 0;
      })
    : false;
}

function summarizePreviewRows(rows: any[]) {
  let totalRows = 0;
  let productRows = 0;
  let validRows = 0;
  let warningRows = 0;
  let errorRows = 0;
  let ignoredRows = 0;
  let zeroPriceRows = 0;
  let unknownVatModeRows = 0;
  let productsWithoutSupplierCode = 0;
  let duplicateSourceKeys = 0;
  const seenSourceKeys = new Set<string>();

  for (const row of rows) {
    totalRows += 1;
    const kind = previewRowKind(row);
    const normalized = normalizePreviewRow(row);
    const warnings = rowWarnings(row);
    const errors = rowErrors(row);

    if (kind === "product") {
      productRows += 1;
    }

    if (kind === "ignored" || row.status === "ignored") {
      ignoredRows += 1;
    } else if (errors.length > 0 || kind === "error") {
      errorRows += 1;
    } else if (warnings.length > 0 || kind === "warning" || rowHasUnknownVatMode(normalized)) {
      warningRows += 1;
    } else {
      validRows += 1;
    }

    if (rowHasZeroPrice(row)) {
      zeroPriceRows += 1;
    }

    if (rowHasUnknownVatMode(normalized)) {
      unknownVatModeRows += 1;
    }

    if (kind === "product" && !optionalString(normalized?.supplierCode)) {
      productsWithoutSupplierCode += 1;
    }

    if (kind === "product" && row.status !== "ignored" && row.status !== "error" && errors.length === 0) {
      for (const sourceKey of priceSourceKeys(row)) {
        if (seenSourceKeys.has(sourceKey)) {
          duplicateSourceKeys += 1;
        } else {
          seenSourceKeys.add(sourceKey);
        }
      }
    }
  }

  return {
    totalRows,
    productRows,
    validRows,
    warningRows,
    errorRows,
    ignoredRows,
    zeroPriceRows,
    unknownVatModeRows,
    productsWithoutSupplierCode,
    duplicateSourceKeys
  };
}

function buildRowStatus(row: any) {
  const normalized = normalizePreviewRow(row);
  const kind = previewRowKind(row);
  const warnings = rowWarnings(row);
  const errors = rowErrors(row);

  if (kind === "ignored" || row.status === "ignored") {
    return "ignored" as const;
  }

  if (kind === "empty" || kind === "header" || kind === "section") {
    return "ignored" as const;
  }

  if (errors.length > 0 || kind === "error") {
    return "error" as const;
  }

  if (warnings.length > 0 || kind === "warning" || rowHasUnknownVatMode(normalized)) {
    return "warning" as const;
  }

  return "valid" as const;
}

function buildRowWarnings(row: any) {
  const normalized = normalizePreviewRow(row);
  const warnings = rowWarnings(row);

  if (rowHasUnknownVatMode(normalized)) {
    warnings.push("Btw-modus onbekend: definitieve import vereist override of expliciete mapping.");
  }

  if (rowHasZeroPrice(row)) {
    warnings.push("Prijsregel met amount <= 0 wordt overgeslagen.");
  }

  if (previewRowKind(row) === "product" && !hasIdentity(normalized)) {
    warnings.push("Product gebruikt fallback-identiteit omdat articleNumber/EAN/supplierCode ontbreekt.");
  }

  return [...new Set(warnings)];
}

export const createPreviewBatch = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    bestandsnaam: v.string(),
    bestandsType: v.string(),
    bronBestandsnaam: v.optional(v.string()),
    bronPad: v.optional(v.string()),
    bestandHash: v.optional(v.string()),
    leverancierNaam: v.optional(v.string()),
    importProfielId: v.optional(v.string()),
    staBtwModusOnbekendToe: v.optional(v.boolean()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["admin"]
    );
    const tenantId = tenant._id;
    const supplierId = args.leverancierNaam
      ? await ensureSupplier(ctx, tenantId, args.leverancierNaam)
      : undefined;
    const now = Date.now();

    return await ctx.db.insert("productImportBatches", {
      tenantId,
      leverancierId: supplierId,
      importProfielId: args.importProfielId as any,
      bestandsnaam: args.bestandsnaam,
      bestandsType: args.bestandsType,
      bronBestandsnaam: args.bronBestandsnaam ?? args.bestandsnaam,
      bronPad: args.bronPad,
      bestandHash: args.bestandHash,
      status: "uploaded" as const,
      totaalRijen: 0,
      voorbeeldRijen: 0,
      productRijen: 0,
      geldigeRijen: 0,
      waarschuwingRijen: 0,
      foutRijen: 0,
      genegeerdeRijen: 0,
      geimporteerdeProducten: 0,
      bijgewerkteProducten: 0,
      overgeslagenProducten: 0,
      geimporteerdePrijzen: 0,
      overgeslagenPrijzen: 0,
      dubbeleProductMatches: 0,
      nulPrijsRijen: 0,
      onbekendeBtwModusRijen: 0,
      productenZonderLeverancierCode: 0,
      weesPrijsRegels: 0,
      dubbeleBronSleutels: 0,
      staBtwModusOnbekendToe: args.staBtwModusOnbekendToe ?? false,
      reconciliatie: {},
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const appendPreviewRows = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    batchId: v.string(),
    rows: v.array(v.any())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const tenantId = tenant._id;
    const batch: Doc<"productImportBatches"> | null = await ctx.db.get(
      args.batchId as Id<"productImportBatches">
    );

    if (!batch || batch.tenantId !== tenantId) {
      throw new ConvexError("Import niet gevonden.");
    }

    const now = Date.now();
    const summary = summarizePreviewRows(args.rows);

    for (const row of args.rows) {
      const normalized = normalizePreviewRow(row);
      const status = buildRowStatus(row);
      const kind = previewRowKind(row);
      const sourceKeys = priceSourceKeys(row);

      await ctx.db.insert("productImportRows", {
        tenantId,
        batchId: batch._id,
        bronBestandsnaam: optionalString(row.sourceFileName) ?? optionalString(normalized?.sourceFileName) ?? batch.bronBestandsnaam ?? batch.bestandsnaam,
        bronBladNaam: optionalString(row.sourceSheetName) ?? optionalString(normalized?.sourceSheetName),
        rijNummer: numberValue(row.rowNumber) ?? numberValue(normalized?.sourceRowNumber) ?? 0,
        rijHash: optionalString(row.rowHash) ?? optionalString(normalized?.importKey),
        importSleutel: optionalString(normalized?.importKey),
        bronSleutel: sourceKeys[0],
        ruweData: row.raw ?? row,
        genormaliseerd: normalized,
        status,
        rijSoort: (["header", "section", "product", "empty", "warning", "error", "ignored"].includes(kind)
          ? kind
          : "product") as any,
        sectieLabel: optionalString(row.sectionLabel) ?? optionalString(normalized?.sectionLabel),
        waarschuwingen: buildRowWarnings(row),
        fouten: rowErrors(row),
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    const totalRows = (batch.totaalRijen ?? 0) + summary.totalRows;
    const warningRows = (batch.waarschuwingRijen ?? 0) + summary.warningRows;
    const errorRows = (batch.foutRijen ?? 0) + summary.errorRows;
    const status =
      errorRows > 0 || warningRows > 0 || summary.unknownVatModeRows > 0
        ? "needs_mapping"
        : "ready_to_import";

    await ctx.db.patch(batch._id, {
      status,
      totaalRijen: totalRows,
      voorbeeldRijen: totalRows,
      productRijen: (batch.productRijen ?? 0) + summary.productRows,
      geldigeRijen: (batch.geldigeRijen ?? 0) + summary.validRows,
      waarschuwingRijen: warningRows,
      foutRijen: errorRows,
      genegeerdeRijen: (batch.genegeerdeRijen ?? 0) + summary.ignoredRows,
      nulPrijsRijen: (batch.nulPrijsRijen ?? 0) + summary.zeroPriceRows,
      onbekendeBtwModusRijen: (batch.onbekendeBtwModusRijen ?? 0) + summary.unknownVatModeRows,
      productenZonderLeverancierCode:
        (batch.productenZonderLeverancierCode ?? 0) + summary.productsWithoutSupplierCode,
      dubbeleBronSleutels: (batch.dubbeleBronSleutels ?? 0) + summary.duplicateSourceKeys,
      reconciliatie: {
        ...(batch.reconciliatie ?? {}),
        previewUpdatedAt: now,
        totalRows,
        previewRows: totalRows,
        productRows: (batch.productRijen ?? 0) + summary.productRows,
        warningRows,
        errorRows,
        zeroPriceRows: (batch.nulPrijsRijen ?? 0) + summary.zeroPriceRows,
        unknownVatModeRows: (batch.onbekendeBtwModusRijen ?? 0) + summary.unknownVatModeRows,
        duplicateSourceKeys: (batch.dubbeleBronSleutels ?? 0) + summary.duplicateSourceKeys
      },
      gewijzigdOp: now
    });

    return {
      insertedRows: args.rows.length,
      summary
    };
  }
});

export const savePreviewMapping = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    batchId: v.string(),
    mapping: v.any(),
    staBtwModusOnbekendToe: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const tenantId = tenant._id;
    const batch: Doc<"productImportBatches"> | null = await ctx.db.get(
      args.batchId as Id<"productImportBatches">
    );

    if (!batch || batch.tenantId !== tenantId) {
      throw new ConvexError("Import niet gevonden.");
    }

    const hasUnknownVatMode = (batch.onbekendeBtwModusRijen ?? 0) > 0;
    const allowUnknownVatMode = args.staBtwModusOnbekendToe ?? false;

    await ctx.db.patch(batch._id, {
      mapping: args.mapping,
      staBtwModusOnbekendToe: allowUnknownVatMode,
      status: hasUnknownVatMode && !allowUnknownVatMode ? "needs_mapping" : "ready_to_import",
      gewijzigdOp: Date.now()
    });

    return batch._id;
  }
});

export const failPreviewBatch = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    batchId: v.string(),
    foutmelding: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const tenantId = tenant._id;
    const batch: Doc<"productImportBatches"> | null = await ctx.db.get(
      args.batchId as Id<"productImportBatches">
    );

    if (!batch || batch.tenantId !== tenantId) {
      throw new ConvexError("Import niet gevonden.");
    }

    const now = Date.now();
    await ctx.db.patch(batch._id, {
      status: "failed" as const,
      misluktOp: now,
      foutmelding: args.foutmelding,
      reconciliatie: {
        ...(batch.reconciliatie ?? {}),
        failedAt: now,
        errorMessage: args.foutmelding
      },
      gewijzigdOp: now
    });

    return batch._id;
  }
});

export const commitPreviewBatchChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    batchId: v.string(),
    staBtwModusOnbekendToe: v.optional(v.boolean()),
    importedByExternalUserId: v.optional(v.string()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["admin"]
    );
    const tenantId = tenant._id;
    const batch: Doc<"productImportBatches"> | null = await ctx.db.get(
      args.batchId as Id<"productImportBatches">
    );

    if (!batch || batch.tenantId !== tenantId) {
      throw new ConvexError("Import niet gevonden.");
    }

    const allowUnknownVatMode = args.staBtwModusOnbekendToe ?? batch.staBtwModusOnbekendToe ?? false;
    if ((batch.onbekendeBtwModusRijen ?? 0) > 0 && !allowUnknownVatMode) {
      throw new ConvexError(
        "Btw-mapping ontbreekt: unknown vatMode is alleen toegestaan met bewuste override."
      );
    }

    if ((batch.foutRijen ?? 0) > 0) {
      throw new ConvexError("Import bevat foutregels. Los errors op voordat je definitief importeert.");
    }

    if ((batch.dubbeleBronSleutels ?? 0) > 0) {
      throw new ConvexError("Er zijn dubbele bronsleutels (sourceKeys) in het bestand gevonden. Corrigeer de kolom-mapping voordat je definitief importeert.");
    }

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    let rows = await ctx.db
      .query("productImportRows")
      .withIndex("by_status", (q: any) =>
        q.eq("tenantId", tenantId).eq("batchId", batch._id).eq("status", "valid")
      )
      .take(limit);

    if (rows.length === 0) {
      rows = await ctx.db
        .query("productImportRows")
        .withIndex("by_status", (q: any) =>
          q.eq("tenantId", tenantId).eq("batchId", batch._id).eq("status", "warning")
        )
        .take(limit);
    }

    if (rows.length === 0) {
      const now = Date.now();
      await ctx.db.patch(batch._id, {
        status: "imported" as const,
        geimporteerdOp: now,
        vastgelegdOp: now,
        importedByExternalUserId: externalUserId,
        reconciliatie: {
          ...(batch.reconciliatie ?? {}),
          importedAt: now,
          committedAt: now,
          totalRows: batch.totaalRijen,
          previewRows: batch.voorbeeldRijen ?? batch.totaalRijen,
          productRows: batch.productRijen ?? 0,
          importedProducts: batch.geimporteerdeProducten ?? 0,
          updatedProducts: batch.bijgewerkteProducten ?? 0,
          skippedProducts: batch.overgeslagenProducten ?? 0,
          importedPrices: batch.geimporteerdePrijzen ?? 0,
          skippedPrices: batch.overgeslagenPrijzen ?? 0,
          warningRows: batch.waarschuwingRijen,
          errorRows: batch.foutRijen,
          duplicateProductMatches: batch.dubbeleProductMatches ?? 0,
          zeroPriceRows: batch.nulPrijsRijen ?? 0,
          unknownVatModeRows: batch.onbekendeBtwModusRijen ?? 0,
          productsWithoutSupplierCode: batch.productenZonderLeverancierCode ?? 0,
          orphanPriceRules: batch.weesPrijsRegels ?? 0,
          duplicateSourceKeys: batch.dubbeleBronSleutels ?? 0
        },
        gewijzigdOp: now
      });

      return {
        done: true,
        processedRows: 0
      };
    }

    const now = Date.now();
    const totals = {
      importedProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      importedPrices: 0,
      skippedPrices: 0,
      duplicateProductMatches: 0,
      zeroPriceRows: 0,
      unknownVatModeRows: 0
    };

    await ctx.db.patch(batch._id, {
      status: "importing" as const,
      staBtwModusOnbekendToe: allowUnknownVatMode,
      gewijzigdOp: now
    });

    try {
      for (const row of rows) {
        if (row.rijSoort !== "product" || !row.genormaliseerd) {
          await ctx.db.patch(row._id, {
            status: "ignored" as const,
            gewijzigdOp: now
          });
          totals.skippedProducts += 1;
          continue;
        }

        const result = await importNormalizedCatalogRow(ctx, tenantId, row.genormaliseerd, now);

        if (result.skippedRow) {
          await ctx.db.patch(row._id, {
            status: "ignored" as const,
            waarschuwingen: [...row.waarschuwingen, "Productregel overgeslagen tijdens definitieve import."],
            gewijzigdOp: now
          });
          totals.skippedProducts += 1;
          totals.skippedPrices += result.skippedPrices ?? 0;
          continue;
        }

        await ctx.db.patch(row._id, {
          status: "imported" as const,
          geimporteerdProductId: result.productId,
          geimporteerdePrijsIds: result.importedPriceIds,
          geimporteerdOp: now,
          gewijzigdOp: now
        });

        totals.importedProducts += result.insertedProducts ?? 0;
        totals.updatedProducts += result.updatedProducts ?? 0;
        totals.importedPrices += (result.insertedPrices ?? 0) + (result.updatedPrices ?? 0);
        totals.skippedPrices += result.skippedPrices ?? 0;
        totals.duplicateProductMatches += result.duplicateProductMatches ?? 0;
        totals.zeroPriceRows += result.zeroPriceRows ?? 0;
        totals.unknownVatModeRows += result.unknownVatModeRows ?? 0;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Onbekende importfout";
      await ctx.db.patch(batch._id, {
        status: "failed" as const,
        misluktOp: now,
        foutmelding: message,
        reconciliatie: {
          ...(batch.reconciliatie ?? {}),
          failedAt: now,
          errorMessage: message
        },
        gewijzigdOp: now
      });

      return {
        done: true,
        failed: true,
        processedRows: 0,
        errorMessage: message
      };
    }

    await ctx.db.patch(batch._id, {
      geimporteerdeProducten: (batch.geimporteerdeProducten ?? 0) + totals.importedProducts,
      bijgewerkteProducten: (batch.bijgewerkteProducten ?? 0) + totals.updatedProducts,
      overgeslagenProducten: (batch.overgeslagenProducten ?? 0) + totals.skippedProducts,
      geimporteerdePrijzen: (batch.geimporteerdePrijzen ?? 0) + totals.importedPrices,
      overgeslagenPrijzen: (batch.overgeslagenPrijzen ?? 0) + totals.skippedPrices,
      dubbeleProductMatches:
        (batch.dubbeleProductMatches ?? 0) + totals.duplicateProductMatches,
      nulPrijsRijen: batch.nulPrijsRijen ?? 0,
      onbekendeBtwModusRijen: batch.onbekendeBtwModusRijen ?? 0,
      reconciliatie: {
        ...(batch.reconciliatie ?? {}),
        lastImportChunkAt: now
      },
      gewijzigdOp: now
    });

    return {
      done: false,
      processedRows: rows.length,
      totals
    };
  }
});

export const getCatalogImportStats = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    summaryOnly: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);

    if (args.summaryOnly) {
      const latestImportedBatch = await ctx.db
        .query("productImportBatches")
        .withIndex("by_status", (q: any) => q.eq("tenantId", tenant._id).eq("status", "imported"))
        .order("desc")
        .first();
      const [priceLists, brands, productCollections] = await Promise.all([
        collectByTenant(ctx, "priceLists", tenant._id),
        collectByTenant(ctx, "brands", tenant._id),
        collectByTenant(ctx, "productCollections", tenant._id)
      ]);

      return {
        tenantSlug: tenant.slug,
        exists: true,
        exact: false,
        source: "summary_only",
        products: null,
        activeProducts: null,
        productPrices: null,
        priceLists: priceLists.length,
        brands: brands.length,
        productCollections: productCollections.length,
        categories: {},
        suppliers: {},
        latestImportedBatch: latestImportedBatch
          ? {
              id: String(latestImportedBatch._id),
              importedAt: latestImportedBatch.geimporteerdOp ?? latestImportedBatch.vastgelegdOp,
              productRows: latestImportedBatch.productRijen,
              importedProducts: latestImportedBatch.geimporteerdeProducten,
              updatedProducts: latestImportedBatch.bijgewerkteProducten,
              importedPrices: latestImportedBatch.geimporteerdePrijzen
            }
          : null
      };
    }

    // Defense-in-depth: de exacte modus leest alle producten + prijzen; op grote catalogi
    // overschrijdt dat de Convex-leeslimiet (~16k docs/query), met de PRIJZEN-tabel als
    // dominante factor (bv. ~74k prijzen vs ~25k producten op prod). We lezen producten +
    // prijzen GEBONDEN (één keer, via take) en weigeren met een duidelijke fout als één van
    // beide de limiet overschrijdt — geen dubbel-lezen, geen cryptische crash. Alle live
    // callers gebruiken summaryOnly; dit beschermt alleen een directe aanroep op een grote tenant.
    const EXACT_STATS_LIMIT = 7000;
    const [products, productPrices] = await Promise.all([
      takeByTenant(ctx, "products", tenant._id, EXACT_STATS_LIMIT + 1),
      takeByTenant(ctx, "productPrices", tenant._id, EXACT_STATS_LIMIT + 1)
    ]);
    if (products.length > EXACT_STATS_LIMIT || productPrices.length > EXACT_STATS_LIMIT) {
      throw new ConvexError(
        `Catalogus te groot voor exacte statistiek (limiet ${EXACT_STATS_LIMIT} producten/prijzen). ` +
          "Roep getCatalogImportStats aan met summaryOnly: true."
      );
    }

    const [priceLists, brands, productCollections, categories, suppliers] = await Promise.all([
      collectByTenant(ctx, "priceLists", tenant._id),
      collectByTenant(ctx, "brands", tenant._id),
      collectByTenant(ctx, "productCollections", tenant._id),
      collectByTenant(ctx, "categories", tenant._id),
      collectByTenant(ctx, "suppliers", tenant._id)
    ]);

    const categoryById = new Map(categories.map((category: any) => [String(category._id), category.naam]));
    const supplierById = new Map(suppliers.map((supplier: any) => [String(supplier._id), supplier.naam]));
    const categoryCounts: Record<string, number> = {};
    const supplierCounts: Record<string, number> = {};

    for (const product of products) {
      if (product.status !== "active") {
        continue;
      }

      const categoryName = String(categoryById.get(String(product.categorieId)) ?? "Onbekend");
      const supplierName = product.leverancierId
        ? String(supplierById.get(String(product.leverancierId)) ?? "Onbekend")
        : "Onbekend";

      categoryCounts[categoryName] = (categoryCounts[categoryName] ?? 0) + 1;
      supplierCounts[supplierName] = (supplierCounts[supplierName] ?? 0) + 1;
    }

    return {
      tenantSlug: tenant.slug,
      exists: true,
      exact: true,
      source: "catalog_documents",
      products: products.length,
      activeProducts: products.filter((product: any) => product.status === "active").length,
      productPrices: productPrices.length,
      priceLists: priceLists.length,
      brands: brands.length,
      productCollections: productCollections.length,
      categories: categoryCounts,
      suppliers: supplierCounts
    };
  }
});

/**
 * Verwijdert producten (en hun prijzen) voor een specifieke categorie in batches.
 * Veilig te herhalen — retourneert done:true als er niets meer te verwijderen is.
 */
export const deleteProductsByCategoryChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    categorySlug: v.string(),
    confirm: v.literal("DELETE_PRODUCTS_BY_CATEGORY"),
    batchSize: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const tenantId = tenant._id;
    const batchSize = Math.min(Math.max(args.batchSize ?? 200, 25), 500);

    // Zoek de categorie op slug
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q: any) => q.eq("tenantId", tenantId).eq("slug", args.categorySlug))
      .first();

    if (!category) {
      return { done: true, categorySlug: args.categorySlug, deleted: 0, note: "Categorie niet gevonden." };
    }

    // Haal een batch producten op voor deze categorie
    const products = await ctx.db
      .query("products")
      .withIndex("by_category", (q: any) => q.eq("tenantId", tenantId).eq("categorieId", category._id))
      .take(batchSize);

    if (products.length === 0) {
      return { done: true, categorySlug: args.categorySlug, deleted: 0 };
    }

    let deletedPrices = 0;
    let deletedProducts = 0;

    for (const product of products) {
      // Verwijder alle prijzen van dit product
      const prices = await ctx.db
        .query("productPrices")
        .withIndex("by_product", (q: any) => q.eq("tenantId", tenantId).eq("productId", product._id))
        .collect();

      for (const price of prices) {
        await ctx.db.delete(price._id);
        deletedPrices += 1;
      }

      await ctx.db.delete(product._id);
      deletedProducts += 1;
    }

    return {
      done: false,
      categorySlug: args.categorySlug,
      deletedProducts,
      deletedPrices,
    };
  }
});

/**
 * Verwijdert producten (en hun prijzen) voor een specifieke leveranciersnaam in batches.
 * Gebruikt voor migraties waarbij de leverancier wordt geherstructureerd (bijv. Roots → Unilin Flooring).
 * Veilig te herhalen — retourneert done:true als er niets meer te verwijderen is.
 */
export const deleteProductsBySupplierChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    leverancierNaam: v.string(),
    confirm: v.literal("DELETE_PRODUCTS_BY_SUPPLIER"),
    batchSize: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const tenantId = tenant._id;
    const batchSize = Math.min(Math.max(args.batchSize ?? 200, 25), 500);

    const supplier = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .filter((q: any) => q.eq(q.field("naam"), args.leverancierNaam))
      .first();

    if (!supplier) {
      return { done: true, supplierName: args.leverancierNaam, deletedProducts: 0, deletedPrices: 0, note: "Leverancier niet gevonden." };
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .filter((q: any) => q.eq(q.field("leverancierId"), supplier._id))
      .take(batchSize);

    if (products.length === 0) {
      return { done: true, supplierName: args.leverancierNaam, deletedProducts: 0, deletedPrices: 0 };
    }

    let deletedPrices = 0;
    let deletedProducts = 0;

    for (const product of products) {
      const prices = await ctx.db
        .query("productPrices")
        .withIndex("by_product", (q: any) => q.eq("tenantId", tenantId).eq("productId", product._id))
        .collect();

      for (const price of prices) {
        await ctx.db.delete(price._id);
        deletedPrices += 1;
      }

      await ctx.db.delete(product._id);
      deletedProducts += 1;
    }

    return {
      done: false,
      supplierName: args.leverancierNaam,
      deletedProducts,
      deletedPrices,
      remaining: "meer te verwijderen"
    };
  }
});

export const resetCatalogChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    confirm: v.literal("RESET_IMPORTED_CATALOG"),
    batchSize: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const tenantId = tenant._id;
    const batchSize = Math.min(Math.max(args.batchSize ?? 250, 25), 500);
    const resetOrder = [
      "productPrices",
      "products",
      "priceLists",
      "productCollections",
      "brands"
    ];

    for (const tableName of resetOrder) {
      const docs = await takeByTenant(ctx, tableName, tenantId, batchSize);

      if (docs.length === 0) {
        continue;
      }

      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }

      return {
        done: false,
        tableName,
        deleted: docs.length
      };
    }

    return {
      done: true,
      tableName: "",
      deleted: 0
    };
  }
});
