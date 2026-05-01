import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

async function getTenantId(ctx: any, tenantSlug: string) {
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q: any) => q.eq("slug", tenantSlug))
    .first();

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }

  return tenant._id;
}

async function getTenant(ctx: any, tenantSlug: string) {
  return await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q: any) => q.eq("slug", tenantSlug))
    .first();
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
    name,
    slug,
    sortOrder: 999,
    status: "active" as const,
    createdAt: now,
    updatedAt: now
  });
}

async function ensureSupplier(ctx: any, tenantId: any, name: string) {
  const now = Date.now();
  const existing = await ctx.db
    .query("suppliers")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("name"), name))
    .first();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("suppliers", {
    tenantId,
    name,
    productListStatus: "received" as const,
    createdAt: now,
    updatedAt: now
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
      q.eq("tenantId", tenantId).eq("supplierId", supplierId)
    )
    .filter((q: any) => q.eq(q.field("name"), name))
    .first();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("brands", {
    tenantId,
    supplierId,
    categoryId,
    name,
    status: "active" as const,
    createdAt: now,
    updatedAt: now
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
      q.eq("tenantId", tenantId).eq("supplierId", supplierId)
    )
    .filter((q: any) => q.eq(q.field("name"), name))
    .first();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("productCollections", {
    tenantId,
    supplierId,
    brandId,
    categoryId,
    name,
    status: "active" as const,
    createdAt: now,
    updatedAt: now
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
        q.eq(q.field("sourceFileName"), sourceFileName),
        q.eq(q.field("sourceSheetName"), sourceSheetName),
        fileHash ? q.eq(q.field("fileHash"), fileHash) : q.eq(q.field("sourcePath"), sourcePath)
      )
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "imported" as const,
      sourcePath,
      fileHash,
      year: numberValue(row.year),
      validFrom: numberValue(row.validFrom),
      updatedAt: now
    });

    return existing._id;
  }

  return await ctx.db.insert("priceLists", {
    tenantId,
    supplierId,
    name: `${sourceFileName}${sourceSheetName ? ` - ${sourceSheetName}` : ""}`,
    sourceFileName,
    sourceSheetName,
    year: numberValue(row.year),
    validFrom: numberValue(row.validFrom),
    status: "imported" as const,
    sourcePath,
    fileHash,
    createdAt: now,
    updatedAt: now
  });
}

async function findExistingProduct(ctx: any, tenantId: any, supplierId: any, row: any) {
  const importKey = optionalString(row.importKey);
  if (importKey) {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_import_key", (q: any) => q.eq("tenantId", tenantId).eq("importKey", importKey))
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
        q.eq("tenantId", tenantId).eq("supplierId", supplierId).eq("articleNumber", articleNumber)
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
        q.eq("tenantId", tenantId).eq("supplierId", supplierId).eq("supplierCode", supplierCode)
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
  const productPatch: any = {
    categoryId,
    supplierId,
    brandId,
    collectionId,
    importKey,
    articleNumber: optionalString(rowWithImportKey.articleNumber),
    ean: optionalString(rowWithImportKey.ean),
    sku: optionalString(rowWithImportKey.sku),
    supplierCode: optionalString(rowWithImportKey.supplierCode),
    commercialCode: optionalString(rowWithImportKey.commercialCode),
    supplierProductGroup: optionalString(rowWithImportKey.supplierProductGroup),
    name: productName,
    colorName: optionalString(rowWithImportKey.colorName),
    description: optionalString(rowWithImportKey.description),
    productType: stringValue(rowWithImportKey.productType, "standard"),
    productKind: optionalString(rowWithImportKey.productKind),
    commercialNames: Array.isArray(rowWithImportKey.commercialNames)
      ? rowWithImportKey.commercialNames
      : undefined,
    unit: stringValue(rowWithImportKey.unit, "piece"),
    widthMm: numberValue(rowWithImportKey.widthMm),
    lengthMm: numberValue(rowWithImportKey.lengthMm),
    thicknessMm: numberValue(rowWithImportKey.thicknessMm),
    wearLayerMm: numberValue(rowWithImportKey.wearLayerMm),
    packageContentM2: numberValue(rowWithImportKey.packageContentM2),
    piecesPerPackage: numberValue(rowWithImportKey.piecesPerPackage),
    packagesPerPallet: numberValue(rowWithImportKey.packagesPerPallet),
    salesUnit: optionalString(rowWithImportKey.salesUnit),
    purchaseUnit: optionalString(rowWithImportKey.purchaseUnit),
    orderUnit: optionalString(rowWithImportKey.orderUnit),
    minimumOrderQuantity: numberValue(rowWithImportKey.minimumOrderQuantity),
    orderMultiple: numberValue(rowWithImportKey.orderMultiple),
    palletQuantity: numberValue(rowWithImportKey.palletQuantity),
    trailerQuantity: numberValue(rowWithImportKey.trailerQuantity),
    bundleSize: numberValue(rowWithImportKey.bundleSize),
    attributes: rowWithImportKey.attributes ?? undefined,
    status: "active" as const,
    updatedAt: now
  };

  const productId = existing
    ? existing._id
    : await ctx.db.insert("products", {
        tenantId,
        ...productPatch,
        createdAt: now
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
    const existingPrice = await ctx.db
      .query("productPrices")
      .withIndex("by_source_key", (q: any) =>
        q.eq("tenantId", tenantId).eq("sourceKey", sourceKey)
      )
      .first();

    const pricePatch: any = {
      productId,
      priceListId,
      sourceKey,
      priceType: stringValue(price.priceType, "manual"),
      priceUnit: stringValue(price.priceUnit, "custom"),
      amount,
      vatRate: numberValue(price.vatRate) ?? 21,
      vatMode: stringValue(price.vatMode, "unknown"),
      currency: stringValue(price.currency, "EUR"),
      validFrom: numberValue(price.validFrom),
      validUntil: numberValue(price.validUntil),
      sourceFileName: optionalString(rowWithImportKey.sourceFileName),
      sourceSheetName: optionalString(rowWithImportKey.sourceSheetName),
      sourceColumnName: optionalString(price.sourceColumnName),
      sourceColumnIndex: numberValue(price.sourceColumnIndex),
      sourceRowNumber: numberValue(rowWithImportKey.sourceRowNumber),
      sourceValue: optionalString(price.sourceValue),
      updatedAt: now
    };

    if (existingPrice) {
      await ctx.db.patch(existingPrice._id, pricePatch);
      importedPriceIds.push(existingPrice._id);
      updatedPrices += 1;
    } else {
      const priceId = await ctx.db.insert("productPrices", {
        tenantId,
        ...pricePatch,
        createdAt: now
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
    rows: v.array(v.any())
  },
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx, args.tenantSlug);
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

    for (const sourceKey of priceSourceKeys(row)) {
      if (seenSourceKeys.has(sourceKey)) {
        duplicateSourceKeys += 1;
      } else {
        seenSourceKeys.add(sourceKey);
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
    fileName: v.string(),
    fileType: v.string(),
    sourceFileName: v.optional(v.string()),
    sourcePath: v.optional(v.string()),
    fileHash: v.optional(v.string()),
    supplierName: v.optional(v.string()),
    importProfileId: v.optional(v.string()),
    allowUnknownVatMode: v.optional(v.boolean()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx, args.tenantSlug);
    const supplierId = args.supplierName
      ? await ensureSupplier(ctx, tenantId, args.supplierName)
      : undefined;
    const now = Date.now();

    return await ctx.db.insert("productImportBatches", {
      tenantId,
      supplierId,
      importProfileId: args.importProfileId as any,
      fileName: args.fileName,
      fileType: args.fileType,
      sourceFileName: args.sourceFileName ?? args.fileName,
      sourcePath: args.sourcePath,
      fileHash: args.fileHash,
      status: "uploaded" as const,
      totalRows: 0,
      previewRows: 0,
      productRows: 0,
      validRows: 0,
      warningRows: 0,
      errorRows: 0,
      ignoredRows: 0,
      importedProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      importedPrices: 0,
      skippedPrices: 0,
      duplicateProductMatches: 0,
      zeroPriceRows: 0,
      unknownVatModeRows: 0,
      productsWithoutSupplierCode: 0,
      orphanPriceRules: 0,
      duplicateSourceKeys: 0,
      allowUnknownVatMode: args.allowUnknownVatMode ?? false,
      reconciliation: {},
      createdByExternalUserId: args.createdByExternalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const appendPreviewRows = mutation({
  args: {
    tenantSlug: v.string(),
    batchId: v.string(),
    rows: v.array(v.any())
  },
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx, args.tenantSlug);
    const batch: any = await ctx.db.get(args.batchId as any);

    if (!batch || batch.tenantId !== tenantId) {
      throw new Error("Import batch not found");
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
        sourceFileName: optionalString(row.sourceFileName) ?? optionalString(normalized?.sourceFileName) ?? batch.sourceFileName ?? batch.fileName,
        sourceSheetName: optionalString(row.sourceSheetName) ?? optionalString(normalized?.sourceSheetName),
        rowNumber: numberValue(row.rowNumber) ?? numberValue(normalized?.sourceRowNumber) ?? 0,
        rowHash: optionalString(row.rowHash) ?? optionalString(normalized?.importKey),
        importKey: optionalString(normalized?.importKey),
        sourceKey: sourceKeys[0],
        raw: row.raw ?? row,
        normalized,
        status,
        rowKind: (["header", "section", "product", "empty", "warning", "error", "ignored"].includes(kind)
          ? kind
          : "product") as any,
        sectionLabel: optionalString(row.sectionLabel) ?? optionalString(normalized?.sectionLabel),
        warnings: buildRowWarnings(row),
        errors: rowErrors(row),
        createdAt: now,
        updatedAt: now
      });
    }

    const totalRows = (batch.totalRows ?? 0) + summary.totalRows;
    const warningRows = (batch.warningRows ?? 0) + summary.warningRows;
    const errorRows = (batch.errorRows ?? 0) + summary.errorRows;
    const status =
      errorRows > 0 || warningRows > 0 || summary.unknownVatModeRows > 0
        ? "needs_mapping"
        : "ready_to_import";

    await ctx.db.patch(batch._id, {
      status,
      totalRows,
      previewRows: totalRows,
      productRows: (batch.productRows ?? 0) + summary.productRows,
      validRows: (batch.validRows ?? 0) + summary.validRows,
      warningRows,
      errorRows,
      ignoredRows: (batch.ignoredRows ?? 0) + summary.ignoredRows,
      zeroPriceRows: (batch.zeroPriceRows ?? 0) + summary.zeroPriceRows,
      unknownVatModeRows: (batch.unknownVatModeRows ?? 0) + summary.unknownVatModeRows,
      productsWithoutSupplierCode:
        (batch.productsWithoutSupplierCode ?? 0) + summary.productsWithoutSupplierCode,
      duplicateSourceKeys: (batch.duplicateSourceKeys ?? 0) + summary.duplicateSourceKeys,
      reconciliation: {
        ...(batch.reconciliation ?? {}),
        previewUpdatedAt: now,
        totalRows,
        previewRows: totalRows,
        productRows: (batch.productRows ?? 0) + summary.productRows,
        warningRows,
        errorRows,
        zeroPriceRows: (batch.zeroPriceRows ?? 0) + summary.zeroPriceRows,
        unknownVatModeRows: (batch.unknownVatModeRows ?? 0) + summary.unknownVatModeRows,
        duplicateSourceKeys: (batch.duplicateSourceKeys ?? 0) + summary.duplicateSourceKeys
      },
      updatedAt: now
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
    batchId: v.string(),
    mapping: v.any(),
    allowUnknownVatMode: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx, args.tenantSlug);
    const batch: any = await ctx.db.get(args.batchId as any);

    if (!batch || batch.tenantId !== tenantId) {
      throw new Error("Import batch not found");
    }

    const hasUnknownVatMode = (batch.unknownVatModeRows ?? 0) > 0;
    const allowUnknownVatMode = args.allowUnknownVatMode ?? false;

    await ctx.db.patch(batch._id, {
      mapping: args.mapping,
      allowUnknownVatMode,
      status: hasUnknownVatMode && !allowUnknownVatMode ? "needs_mapping" : "ready_to_import",
      updatedAt: Date.now()
    });

    return batch._id;
  }
});

export const failPreviewBatch = mutation({
  args: {
    tenantSlug: v.string(),
    batchId: v.string(),
    errorMessage: v.string()
  },
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx, args.tenantSlug);
    const batch: any = await ctx.db.get(args.batchId as any);

    if (!batch || batch.tenantId !== tenantId) {
      throw new Error("Import batch not found");
    }

    const now = Date.now();
    await ctx.db.patch(batch._id, {
      status: "failed" as const,
      failedAt: now,
      errorMessage: args.errorMessage,
      reconciliation: {
        ...(batch.reconciliation ?? {}),
        failedAt: now,
        errorMessage: args.errorMessage
      },
      updatedAt: now
    });

    return batch._id;
  }
});

export const commitPreviewBatchChunk = mutation({
  args: {
    tenantSlug: v.string(),
    batchId: v.string(),
    allowUnknownVatMode: v.optional(v.boolean()),
    importedByExternalUserId: v.optional(v.string()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx, args.tenantSlug);
    const batch: any = await ctx.db.get(args.batchId as any);

    if (!batch || batch.tenantId !== tenantId) {
      throw new Error("Import batch not found");
    }

    const allowUnknownVatMode = args.allowUnknownVatMode ?? batch.allowUnknownVatMode ?? false;
    if ((batch.unknownVatModeRows ?? 0) > 0 && !allowUnknownVatMode) {
      throw new Error(
        "Btw-mapping ontbreekt: unknown vatMode is alleen toegestaan met bewuste override."
      );
    }

    if ((batch.errorRows ?? 0) > 0) {
      throw new Error("Import bevat foutregels. Los errors op voordat je definitief importeert.");
    }

    if ((batch.duplicateSourceKeys ?? 0) > 0) {
      throw new Error("Duplicate sourceKeys detected; fix mapping before final import.");
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
        importedAt: now,
        committedAt: now,
        importedByExternalUserId: args.importedByExternalUserId,
        reconciliation: {
          ...(batch.reconciliation ?? {}),
          importedAt: now,
          committedAt: now,
          totalRows: batch.totalRows,
          previewRows: batch.previewRows ?? batch.totalRows,
          productRows: batch.productRows ?? 0,
          importedProducts: batch.importedProducts ?? 0,
          updatedProducts: batch.updatedProducts ?? 0,
          skippedProducts: batch.skippedProducts ?? 0,
          importedPrices: batch.importedPrices ?? 0,
          skippedPrices: batch.skippedPrices ?? 0,
          warningRows: batch.warningRows,
          errorRows: batch.errorRows,
          duplicateProductMatches: batch.duplicateProductMatches ?? 0,
          zeroPriceRows: batch.zeroPriceRows ?? 0,
          unknownVatModeRows: batch.unknownVatModeRows ?? 0,
          productsWithoutSupplierCode: batch.productsWithoutSupplierCode ?? 0,
          orphanPriceRules: batch.orphanPriceRules ?? 0,
          duplicateSourceKeys: batch.duplicateSourceKeys ?? 0
        },
        updatedAt: now
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
      allowUnknownVatMode,
      updatedAt: now
    });

    try {
      for (const row of rows) {
        if (row.rowKind !== "product" || !row.normalized) {
          await ctx.db.patch(row._id, {
            status: "ignored" as const,
            updatedAt: now
          });
          totals.skippedProducts += 1;
          continue;
        }

        const result = await importNormalizedCatalogRow(ctx, tenantId, row.normalized, now);

        if (result.skippedRow) {
          await ctx.db.patch(row._id, {
            status: "ignored" as const,
            warnings: [...row.warnings, "Productregel overgeslagen tijdens definitieve import."],
            updatedAt: now
          });
          totals.skippedProducts += 1;
          totals.skippedPrices += result.skippedPrices ?? 0;
          continue;
        }

        await ctx.db.patch(row._id, {
          status: "imported" as const,
          importedProductId: result.productId,
          importedPriceIds: result.importedPriceIds,
          importedAt: now,
          updatedAt: now
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
        failedAt: now,
        errorMessage: message,
        reconciliation: {
          ...(batch.reconciliation ?? {}),
          failedAt: now,
          errorMessage: message
        },
        updatedAt: now
      });

      return {
        done: true,
        failed: true,
        processedRows: 0,
        errorMessage: message
      };
    }

    await ctx.db.patch(batch._id, {
      importedProducts: (batch.importedProducts ?? 0) + totals.importedProducts,
      updatedProducts: (batch.updatedProducts ?? 0) + totals.updatedProducts,
      skippedProducts: (batch.skippedProducts ?? 0) + totals.skippedProducts,
      importedPrices: (batch.importedPrices ?? 0) + totals.importedPrices,
      skippedPrices: (batch.skippedPrices ?? 0) + totals.skippedPrices,
      duplicateProductMatches:
        (batch.duplicateProductMatches ?? 0) + totals.duplicateProductMatches,
      zeroPriceRows: batch.zeroPriceRows ?? 0,
      unknownVatModeRows: batch.unknownVatModeRows ?? 0,
      reconciliation: {
        ...(batch.reconciliation ?? {}),
        lastImportChunkAt: now
      },
      updatedAt: now
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
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await getTenant(ctx, args.tenantSlug);

    if (!tenant) {
      return {
        tenantSlug: args.tenantSlug,
        exists: false,
        products: 0,
        activeProducts: 0,
        productPrices: 0,
        priceLists: 0,
        brands: 0,
        productCollections: 0,
        categories: {},
        suppliers: {}
      };
    }

    const [products, productPrices, priceLists, brands, productCollections, categories, suppliers] =
      await Promise.all([
        collectByTenant(ctx, "products", tenant._id),
        collectByTenant(ctx, "productPrices", tenant._id),
        collectByTenant(ctx, "priceLists", tenant._id),
        collectByTenant(ctx, "brands", tenant._id),
        collectByTenant(ctx, "productCollections", tenant._id),
        collectByTenant(ctx, "categories", tenant._id),
        collectByTenant(ctx, "suppliers", tenant._id)
      ]);

    const categoryById = new Map(categories.map((category: any) => [String(category._id), category.name]));
    const supplierById = new Map(suppliers.map((supplier: any) => [String(supplier._id), supplier.name]));
    const categoryCounts: Record<string, number> = {};
    const supplierCounts: Record<string, number> = {};

    for (const product of products) {
      if (product.status !== "active") {
        continue;
      }

      const categoryName = String(categoryById.get(String(product.categoryId)) ?? "Onbekend");
      const supplierName = product.supplierId
        ? String(supplierById.get(String(product.supplierId)) ?? "Onbekend")
        : "Onbekend";

      categoryCounts[categoryName] = (categoryCounts[categoryName] ?? 0) + 1;
      supplierCounts[supplierName] = (supplierCounts[supplierName] ?? 0) + 1;
    }

    return {
      tenantSlug: tenant.slug,
      exists: true,
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

export const resetCatalogChunk = mutation({
  args: {
    tenantSlug: v.string(),
    confirm: v.literal("RESET_IMPORTED_CATALOG"),
    batchSize: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx, args.tenantSlug);
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
