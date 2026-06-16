import { query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { readActorValidator, requireQueryRole } from "../authz";

// Zie productionAudit.ts: validatie leest alle producten + prijzen in één query; op grote
// catalogi overschrijdt dat de Convex-leeslimiet. We lezen gebonden en weigeren met een
// duidelijke fout i.p.v. een cryptische crash (volledige validatie op die schaal = aparte taak).
const VALIDATE_SCAN_LIMIT = 7000;

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
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);

    const [products, prices, priceLists, suppliers, categories, batches] = await Promise.all([
      ctx.db
        .query("products")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .take(VALIDATE_SCAN_LIMIT + 1),
      ctx.db
        .query("productPrices")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .take(VALIDATE_SCAN_LIMIT + 1),
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

    if (products.length > VALIDATE_SCAN_LIMIT || prices.length > VALIDATE_SCAN_LIMIT) {
      throw new ConvexError(
        `Catalogus te groot voor volledige validatie in één query ` +
          `(limiet ${VALIDATE_SCAN_LIMIT} producten/prijzen). Valideer een kleinere selectie.`
      );
    }

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
      const supplier = product.leverancierId ? supplierById.get(idString(product.leverancierId)) : undefined;
      const category = categoryById.get(idString(product.categorieId));

      incrementById(productsBySupplier, product.leverancierId ?? "missing", supplier?.naam ?? "Onbekend");
      incrementById(productsByCategory, product.categorieId, category?.naam ?? "Onbekend");
      increment(productsByKind, product.productSoort ?? "missing", "missing");

      const sample = {
        id: idString(product._id),
        name: product.naam,
        supplier: supplier?.naam ?? "Onbekend",
        category: category?.naam ?? "Onbekend",
        articleNumber: product.artikelnummer,
        supplierCode: product.leverancierCode,
        ean: product.ean
      };

      productShapeSamples.set(idString(product._id), sample);

      const hasArticle = hasValue(product.artikelnummer);
      const hasSupplierCode = hasValue(product.leverancierCode);
      const hasEan = hasValue(product.ean);

      if (!hasArticle || !hasSupplierCode || !hasEan) {
        pushSample(missingAnyKey, sample);
      }

      if (!hasArticle && !hasSupplierCode && !hasEan) {
        pushSample(missingAllKeys, sample);
      }

      if (hasArticle && product.leverancierId) {
        const key = `${idString(product.leverancierId)}|${product.artikelnummer}`;
        articleGroups[key] = articleGroups[key] ?? [];
        articleGroups[key].push(sample);
      }

      if (hasSupplierCode && product.leverancierId) {
        const key = `${idString(product.leverancierId)}|${product.leverancierCode}`;
        supplierCodeGroups[key] = supplierCodeGroups[key] ?? [];
        supplierCodeGroups[key].push(sample);
      }

      if (hasEan && product.leverancierId) {
        const key = `${idString(product.leverancierId)}|${product.ean}`;
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
      const priceListId = idString(price.prijslijstId);
      const priceList = priceListById.get(priceListId);
      const sourceFileName = label(price.bronBestandsnaam, priceList?.bronBestandsnaam ?? "Onbekend bestand");

      priceCountByProduct[productId] = (priceCountByProduct[productId] ?? 0) + 1;
      increment(pricesBySourceFileName, sourceFileName);
      increment(pricesByType, price.prijsSoort);
      increment(pricesByVatMode, price.btwModus);
      increment(pricesByUnit, price.prijsEenheid);

      if (!pricesByPriceListId[priceListId]) {
        pricesByPriceListId[priceListId] = {
          id: priceListId,
          name: label(priceList?.naam, "Onbekende prijslijst"),
          sourceFileName,
          sourceSheetName: label(priceList?.bronBladNaam, ""),
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
        productName: productById.get(productId)?.naam,
        sourceFileName,
        sourceSheetName: price.bronBladNaam,
        sourceColumnName: price.bronKolomNaam,
        sourceColumnIndex: price.bronKolomIndex,
        sourceRowNumber: price.bronRijNummer,
        priceType: price.prijsSoort,
        priceUnit: price.prijsEenheid,
        vatMode: price.btwModus,
        amount: price.bedrag,
        sourceKey: price.bronSleutel
      };

      if (!productById.has(productId)) {
        pushSample(orphanPrices, priceSample);
      }

      if (price.bedrag <= 0) {
        pushSample(nonPositivePrices, priceSample);
      }

      if (price.btwModus === "unknown") {
        pushSample(unknownVatPrices, priceSample, 10);
      }

      if (price.bronSleutel) {
        const key = String(price.bronSleutel);
        sourceKeys[key] = sourceKeys[key] ?? [];
        sourceKeys[key].push(priceSample);
      }

      if (
        sourceFileName === "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx" &&
        price.prijsSoort === "commission"
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

    const headlamSupplier = suppliers.find((supplier) => supplier.naam === "Headlam");
    const headlamProducts = activeProducts.filter(
      (product) => idString(product.leverancierId) === idString(headlamSupplier?._id)
    );
    const interfloorSupplier = suppliers.find((supplier) => supplier.naam === "Interfloor");
    const interfloorProducts = activeProducts.filter(
      (product) => idString(product.leverancierId) === idString(interfloorSupplier?._id)
    );
    const pvcSourceA = "Prijslijst PVC 11-2025 click dryback apart.xlsx";
    const pvcSourceB = "PVC 11-2025 click dryback apart floorlife.xlsx";
    const pvcProductIdsA = new Set(
      prices
        .filter((price) => price.bronBestandsnaam === pvcSourceA)
        .map((price) => idString(price.productId))
    );
    const pvcProductIdsB = new Set(
      prices
        .filter((price) => price.bronBestandsnaam === pvcSourceB)
        .map((price) => idString(price.productId))
    );
    const pvcOverlap = [...pvcProductIdsA].filter((productId) => pvcProductIdsB.has(productId));
    const sectionLabels = ["Tegel decoren", "Bouclé", "Traprenovatie PVC Floorlife"];
    const sectionRowMatches = sectionLabels.map((sectionLabel) => {
      const normalized = sectionLabel.toLowerCase();
      const matches = activeProducts
        .filter((product) => String(product.naam).trim().toLowerCase() === normalized)
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
        increment(rowKinds, row.rijSoort);
      }

      batchRows.push({
        id: idString(batch._id),
        fileName: batch.bestandsnaam,
        status: batch.status,
        totalRows: batch.totaalRijen,
        validRows: batch.geldigeRijen,
        warningRows: batch.waarschuwingRijen,
        errorRows: batch.foutRijen,
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
            (product) => !hasValue(product.artikelnummer) || !hasValue(product.leverancierCode) || !hasValue(product.ean)
          ).length,
          samples: missingAnyKey
        },
        missingAllArticleSupplierCodeAndEan: {
          count: activeProducts.filter(
            (product) => !hasValue(product.artikelnummer) && !hasValue(product.leverancierCode) && !hasValue(product.ean)
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
          count: prices.filter((price) => price.bedrag <= 0).length,
          samples: nonPositivePrices
        },
        priceRulesWithVatModeUnknown: {
          count: prices.filter((price) => price.btwModus === "unknown").length,
          samples: unknownVatPrices
        },
        activeProductsWithEmptyArticleNumberAndEanAndSupplierCode: {
          count: activeProducts.filter(
            (product) => !hasValue(product.artikelnummer) && !hasValue(product.leverancierCode) && !hasValue(product.ean)
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
        totalRows: batches.reduce((sum, batch) => sum + batch.totaalRijen, 0),
        validRows: batches.reduce((sum, batch) => sum + batch.geldigeRijen, 0),
        warningRows: batches.reduce((sum, batch) => sum + batch.waarschuwingRijen, 0),
        errorRows: batches.reduce((sum, batch) => sum + batch.foutRijen, 0),
        batches: batchRows
      },
      bySourceFileName: sourceFiles,
      specificChecks: {
        headlam: {
          activeProducts: headlamProducts.length,
          uniqueSupplierCodes: new Set(headlamProducts.map((product) => product.leverancierCode).filter(Boolean)).size,
          sourcePrices: pricesBySourceFileName["Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx"] ?? 0
        },
        interfloor: {
          activeProducts: interfloorProducts.length,
          uniqueArticleNumbers: new Set(interfloorProducts.map((product) => product.artikelnummer).filter(Boolean)).size,
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
              price.bronBestandsnaam === "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx" &&
              price.prijsSoort === "commission"
          ).length,
          commissionSamples: coProCommissionRows
        },
        sectionRowsImportedAsProducts: sectionRowMatches
      }
    };
  }
});
