import { query } from "./_generated/server";
import { v } from "convex/values";

function idString(value: unknown): string {
  return String(value ?? "");
}

function label(value: unknown, fallback = "Onbekend"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function hasValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function increment(map: Record<string, number>, key: unknown, fallback = "Onbekend") {
  const mapKey = label(key, fallback);
  map[mapKey] = (map[mapKey] ?? 0) + 1;
}

function incrementById(
  map: Record<string, { id: string; name: string; count: number }>,
  id: unknown,
  name: unknown
) {
  const key = idString(id) || "missing";
  if (!map[key]) {
    map[key] = {
      id: key,
      name: label(name),
      count: 0
    };
  }

  map[key].count += 1;
}

function pushSample<T>(samples: T[], sample: T, maxSamples = 25) {
  if (samples.length < maxSamples) {
    samples.push(sample);
  }
}

export const validateCatalog = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      return {
        tenantSlug: args.tenantSlug,
        exists: false
      };
    }

    const [products, prices, priceLists, suppliers, categories, batches] = await Promise.all([
      ctx.db
        .query("products")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("productPrices")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("priceLists")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("categories")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("productImportBatches")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect()
    ]);

    const supplierById = new Map(suppliers.map((supplier) => [idString(supplier._id), supplier]));
    const categoryById = new Map(categories.map((category) => [idString(category._id), category]));
    const priceListById = new Map(priceLists.map((priceList) => [idString(priceList._id), priceList]));
    const productById = new Map(products.map((product) => [idString(product._id), product]));
    const activeProducts = products.filter((product) => product.status === "active");

    const productsBySupplier: Record<string, { id: string; name: string; count: number }> = {};
    const productsByCategory: Record<string, { id: string; name: string; count: number }> = {};
    const productsByKind: Record<string, number> = {};
    const missingAnyKey: any[] = [];
    const missingAllKeys: any[] = [];
    const articleGroups: Record<string, any[]> = {};
    const supplierCodeGroups: Record<string, any[]> = {};
    const eanGroups: Record<string, any[]> = {};
    const productShapeSamples = new Map<string, any>();

    for (const product of activeProducts) {
      const supplier = product.supplierId ? supplierById.get(idString(product.supplierId)) : undefined;
      const category = categoryById.get(idString(product.categoryId));

      incrementById(productsBySupplier, product.supplierId ?? "missing", supplier?.name ?? "Onbekend");
      incrementById(productsByCategory, product.categoryId, category?.name ?? "Onbekend");
      increment(productsByKind, product.productKind ?? "missing", "missing");

      const sample = {
        id: idString(product._id),
        name: product.name,
        supplier: supplier?.name ?? "Onbekend",
        category: category?.name ?? "Onbekend",
        articleNumber: product.articleNumber,
        supplierCode: product.supplierCode,
        ean: product.ean
      };

      productShapeSamples.set(idString(product._id), sample);

      const hasArticle = hasValue(product.articleNumber);
      const hasSupplierCode = hasValue(product.supplierCode);
      const hasEan = hasValue(product.ean);

      if (!hasArticle || !hasSupplierCode || !hasEan) {
        pushSample(missingAnyKey, sample);
      }

      if (!hasArticle && !hasSupplierCode && !hasEan) {
        pushSample(missingAllKeys, sample);
      }

      if (hasArticle && product.supplierId) {
        const key = `${idString(product.supplierId)}|${product.articleNumber}`;
        articleGroups[key] = articleGroups[key] ?? [];
        articleGroups[key].push(sample);
      }

      if (hasSupplierCode && product.supplierId) {
        const key = `${idString(product.supplierId)}|${product.supplierCode}`;
        supplierCodeGroups[key] = supplierCodeGroups[key] ?? [];
        supplierCodeGroups[key].push(sample);
      }

      if (hasEan && product.supplierId) {
        const key = `${idString(product.supplierId)}|${product.ean}`;
        eanGroups[key] = eanGroups[key] ?? [];
        eanGroups[key].push(sample);
      }
    }

    const priceCountByProduct: Record<string, number> = {};
    const pricesBySourceFileName: Record<string, number> = {};
    const pricesByPriceListId: Record<string, { id: string; name: string; sourceFileName: string; sourceSheetName: string; count: number }> = {};
    const pricesByType: Record<string, number> = {};
    const pricesByVatMode: Record<string, number> = {};
    const pricesByUnit: Record<string, number> = {};
    const sourceFileStats: Record<string, { products: Record<string, boolean>; prices: number; priceLists: Record<string, boolean> }> = {};
    const orphanPrices: any[] = [];
    const nonPositivePrices: any[] = [];
    const unknownVatPrices: any[] = [];
    const duplicateSourceKeys: Record<string, any[]> = {};
    const sourceKeys: Record<string, any[]> = {};
    const coProCommissionRows: any[] = [];

    for (const price of prices) {
      const productId = idString(price.productId);
      const priceListId = idString(price.priceListId);
      const priceList = priceListById.get(priceListId);
      const sourceFileName = label(price.sourceFileName, priceList?.sourceFileName ?? "Onbekend bestand");

      priceCountByProduct[productId] = (priceCountByProduct[productId] ?? 0) + 1;
      increment(pricesBySourceFileName, sourceFileName);
      increment(pricesByType, price.priceType);
      increment(pricesByVatMode, price.vatMode);
      increment(pricesByUnit, price.priceUnit);

      if (!pricesByPriceListId[priceListId]) {
        pricesByPriceListId[priceListId] = {
          id: priceListId,
          name: label(priceList?.name, "Onbekende prijslijst"),
          sourceFileName,
          sourceSheetName: label(priceList?.sourceSheetName, ""),
          count: 0
        };
      }

      pricesByPriceListId[priceListId].count += 1;

      if (!sourceFileStats[sourceFileName]) {
        sourceFileStats[sourceFileName] = {
          products: {},
          prices: 0,
          priceLists: {}
        };
      }

      sourceFileStats[sourceFileName].prices += 1;
      sourceFileStats[sourceFileName].products[productId] = true;
      if (priceListId) {
        sourceFileStats[sourceFileName].priceLists[priceListId] = true;
      }

      const priceSample = {
        id: idString(price._id),
        productId,
        productName: productById.get(productId)?.name,
        sourceFileName,
        sourceSheetName: price.sourceSheetName,
        sourceColumnName: price.sourceColumnName,
        sourceColumnIndex: price.sourceColumnIndex,
        sourceRowNumber: price.sourceRowNumber,
        priceType: price.priceType,
        priceUnit: price.priceUnit,
        vatMode: price.vatMode,
        amount: price.amount,
        sourceKey: price.sourceKey
      };

      if (!productById.has(productId)) {
        pushSample(orphanPrices, priceSample);
      }

      if (price.amount <= 0) {
        pushSample(nonPositivePrices, priceSample);
      }

      if (price.vatMode === "unknown") {
        pushSample(unknownVatPrices, priceSample, 10);
      }

      if (price.sourceKey) {
        const key = String(price.sourceKey);
        sourceKeys[key] = sourceKeys[key] ?? [];
        sourceKeys[key].push(priceSample);
      }

      if (
        sourceFileName === "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx" &&
        price.priceType === "commission"
      ) {
        pushSample(coProCommissionRows, priceSample, 20);
      }
    }

    for (const [key, values] of Object.entries(sourceKeys)) {
      if (values.length > 1) {
        duplicateSourceKeys[key] = values.slice(0, 5);
      }
    }

    const productsWithoutPrices: any[] = [];
    for (const product of activeProducts) {
      if (!priceCountByProduct[idString(product._id)]) {
        pushSample(productsWithoutPrices, productShapeSamples.get(idString(product._id)));
      }
    }

    function duplicateSummary(groups: Record<string, any[]>) {
      const duplicateGroups = Object.entries(groups).filter(([, values]) => values.length > 1);
      return {
        groupCount: duplicateGroups.length,
        productCount: duplicateGroups.reduce((sum, [, values]) => sum + values.length, 0),
        duplicateProductCount: duplicateGroups.reduce((sum, [, values]) => sum + values.length - 1, 0),
        samples: duplicateGroups.slice(0, 20).map(([key, values]) => ({
          key,
          count: values.length,
          products: values.slice(0, 5)
        }))
      };
    }

    const sourceFiles = Object.entries(sourceFileStats)
      .map(([sourceFileName, stats]) => ({
        sourceFileName,
        importedProducts: Object.keys(stats.products).length,
        importedPrices: stats.prices,
        priceLists: Object.keys(stats.priceLists).length
      }))
      .sort((left, right) => right.importedPrices - left.importedPrices);

    const headlamSupplier = suppliers.find((supplier) => supplier.name === "Headlam");
    const headlamProducts = activeProducts.filter(
      (product) => idString(product.supplierId) === idString(headlamSupplier?._id)
    );
    const interfloorSupplier = suppliers.find((supplier) => supplier.name === "Interfloor");
    const interfloorProducts = activeProducts.filter(
      (product) => idString(product.supplierId) === idString(interfloorSupplier?._id)
    );
    const pvcSourceA = "Prijslijst PVC 11-2025 click dryback apart.xlsx";
    const pvcSourceB = "PVC 11-2025 click dryback apart floorlife.xlsx";
    const pvcProductIdsA = new Set(
      prices
        .filter((price) => price.sourceFileName === pvcSourceA)
        .map((price) => idString(price.productId))
    );
    const pvcProductIdsB = new Set(
      prices
        .filter((price) => price.sourceFileName === pvcSourceB)
        .map((price) => idString(price.productId))
    );
    const pvcOverlap = [...pvcProductIdsA].filter((productId) => pvcProductIdsB.has(productId));
    const sectionLabels = ["Tegel decoren", "Bouclé", "Traprenovatie PVC Floorlife"];
    const sectionRowMatches = sectionLabels.map((sectionLabel) => {
      const normalized = sectionLabel.toLowerCase();
      const matches = activeProducts
        .filter((product) => String(product.name).trim().toLowerCase() === normalized)
        .slice(0, 10)
        .map((product) => productShapeSamples.get(idString(product._id)));
      return {
        sectionLabel,
        matches
      };
    });

    const batchRows = [];
    for (const batch of batches) {
      const rows = await ctx.db
        .query("productImportRows")
        .withIndex("by_batch", (q) => q.eq("tenantId", tenant._id).eq("batchId", batch._id))
        .collect();

      const rowStatuses: Record<string, number> = {};
      const rowKinds: Record<string, number> = {};

      for (const row of rows) {
        increment(rowStatuses, row.status);
        increment(rowKinds, row.rowKind);
      }

      batchRows.push({
        id: idString(batch._id),
        fileName: batch.fileName,
        status: batch.status,
        totalRows: batch.totalRows,
        validRows: batch.validRows,
        warningRows: batch.warningRows,
        errorRows: batch.errorRows,
        rowStatuses,
        rowKinds
      });
    }

    return {
      tenantSlug: tenant.slug,
      exists: true,
      products: {
        totalActive: activeProducts.length,
        bySupplierId: Object.values(productsBySupplier).sort((left, right) => right.count - left.count),
        byCategoryId: Object.values(productsByCategory).sort((left, right) => right.count - left.count),
        byProductKind: productsByKind,
        missingAnyArticleSupplierCodeOrEan: {
          count: activeProducts.filter(
            (product) => !hasValue(product.articleNumber) || !hasValue(product.supplierCode) || !hasValue(product.ean)
          ).length,
          samples: missingAnyKey
        },
        missingAllArticleSupplierCodeAndEan: {
          count: activeProducts.filter(
            (product) => !hasValue(product.articleNumber) && !hasValue(product.supplierCode) && !hasValue(product.ean)
          ).length,
          samples: missingAllKeys
        }
      },
      prices: {
        total: prices.length,
        bySourceFileName: pricesBySourceFileName,
        byPriceListId: Object.values(pricesByPriceListId).sort((left, right) => right.count - left.count),
        byPriceType: pricesByType,
        byVatMode: pricesByVatMode,
        byUnit: pricesByUnit
      },
      issues: {
        activeProductsWithoutPriceRules: {
          count: activeProducts.filter((product) => !priceCountByProduct[idString(product._id)]).length,
          samples: productsWithoutPrices
        },
        priceRulesWithoutExistingProduct: {
          count: prices.filter((price) => !productById.has(idString(price.productId))).length,
          samples: orphanPrices
        },
        duplicateActiveProductsBySupplierArticleNumber: duplicateSummary(articleGroups),
        duplicateActiveProductsBySupplierSupplierCode: duplicateSummary(supplierCodeGroups),
        duplicateActiveProductsBySupplierEan: duplicateSummary(eanGroups),
        priceRulesWithAmountLteZero: {
          count: prices.filter((price) => price.amount <= 0).length,
          samples: nonPositivePrices
        },
        priceRulesWithVatModeUnknown: {
          count: prices.filter((price) => price.vatMode === "unknown").length,
          samples: unknownVatPrices
        },
        activeProductsWithEmptyArticleNumberAndEanAndSupplierCode: {
          count: activeProducts.filter(
            (product) => !hasValue(product.articleNumber) && !hasValue(product.supplierCode) && !hasValue(product.ean)
          ).length,
          samples: missingAllKeys
        },
        duplicatePriceSourceKeys: {
          groupCount: Object.keys(duplicateSourceKeys).length,
          samples: Object.entries(duplicateSourceKeys).slice(0, 10).map(([key, values]) => ({
            key,
            prices: values
          }))
        }
      },
      importBatches: {
        count: batches.length,
        totalRows: batches.reduce((sum, batch) => sum + batch.totalRows, 0),
        validRows: batches.reduce((sum, batch) => sum + batch.validRows, 0),
        warningRows: batches.reduce((sum, batch) => sum + batch.warningRows, 0),
        errorRows: batches.reduce((sum, batch) => sum + batch.errorRows, 0),
        batches: batchRows
      },
      bySourceFileName: sourceFiles,
      specificChecks: {
        headlam: {
          activeProducts: headlamProducts.length,
          uniqueSupplierCodes: new Set(headlamProducts.map((product) => product.supplierCode).filter(Boolean)).size,
          sourcePrices: pricesBySourceFileName["Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx"] ?? 0
        },
        interfloor: {
          activeProducts: interfloorProducts.length,
          uniqueArticleNumbers: new Set(interfloorProducts.map((product) => product.articleNumber).filter(Boolean)).size,
          sourcePrices: pricesBySourceFileName["henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls"] ?? 0
        },
        overlappingPvcFiles: {
          sourceA: pvcSourceA,
          sourceAProducts: pvcProductIdsA.size,
          sourceAPrices: pricesBySourceFileName[pvcSourceA] ?? 0,
          sourceB: pvcSourceB,
          sourceBProducts: pvcProductIdsB.size,
          sourceBPrices: pricesBySourceFileName[pvcSourceB] ?? 0,
          overlappingProducts: pvcOverlap.length
        },
        coProLijmKitEgaline: {
          sourceFileName: "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx",
          prices: pricesBySourceFileName["Co-pro prijslijst lijm kit en egaline 2025-04.xlsx"] ?? 0,
          commissionPrices: prices.filter(
            (price) =>
              price.sourceFileName === "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx" &&
              price.priceType === "commission"
          ).length,
          commissionSamples: coProCommissionRows
        },
        sectionRowsImportedAsProducts: sectionRowMatches
      }
    };
  }
});
