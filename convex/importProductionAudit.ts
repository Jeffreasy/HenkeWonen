import { query } from "./_generated/server";
import { v } from "convex/values";

function idString(value: unknown): string {
  return String(value ?? "");
}

function text(value: unknown, fallback = "Onbekend"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function inc(map: Record<string, number>, key: unknown, fallback = "Onbekend") {
  const mapKey = text(key, fallback);
  map[mapKey] = (map[mapKey] ?? 0) + 1;
}

function incById(
  map: Record<string, { id: string; name: string; count: number }>,
  id: unknown,
  name: unknown
) {
  const key = idString(id) || "missing";
  if (!map[key]) {
    map[key] = {
      id: key,
      name: text(name),
      count: 0
    };
  }

  map[key].count += 1;
}

function sample<T>(items: T[], item: T, max = 25) {
  if (items.length < max) {
    items.push(item);
  }
}

function duplicateSummary(groups: Record<string, any[]>) {
  const duplicateGroups = Object.entries(groups).filter(([, values]) => values.length > 1);

  return {
    groupCount: duplicateGroups.length,
    duplicateRecordCount: duplicateGroups.reduce((sum, [, values]) => sum + values.length - 1, 0),
    samples: duplicateGroups.slice(0, 20).map(([key, values]) => ({
      key,
      count: values.length,
      records: values.slice(0, 5)
    }))
  };
}

export const run = query({
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

    const [products, prices, priceLists, suppliers, categories, profiles, batches] =
      await Promise.all([
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
          .query("importProfiles")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
          .collect(),
        ctx.db
          .query("productImportBatches")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
          .collect()
      ]);

    const activeProducts = products.filter((product) => product.status === "active");
    const productById = new Map(products.map((product) => [idString(product._id), product]));
    const supplierById = new Map(suppliers.map((supplier) => [idString(supplier._id), supplier]));
    const categoryById = new Map(categories.map((category) => [idString(category._id), category]));
    const priceListById = new Map(priceLists.map((priceList) => [idString(priceList._id), priceList]));

    const priceCountByProduct: Record<string, number> = {};
    for (const price of prices) {
      const productId = idString(price.productId);
      priceCountByProduct[productId] = (priceCountByProduct[productId] ?? 0) + 1;
    }

    const productsBySupplier: Record<string, { id: string; name: string; count: number }> = {};
    const productsByCategory: Record<string, { id: string; name: string; count: number }> = {};
    const productsByKind: Record<string, number> = {};
    const duplicateImportKeyGroups: Record<string, any[]> = {};
    const duplicateArticleGroups: Record<string, any[]> = {};
    const duplicateEanGroups: Record<string, any[]> = {};
    const duplicateSupplierCodeGroups: Record<string, any[]> = {};
    const productsWithoutPrices: any[] = [];
    const productsWithoutAllCodes: any[] = [];
    const productsWithoutSupplier: any[] = [];
    const productsWithoutCategory: any[] = [];
    const productsWithoutName: any[] = [];
    const numericArticleNumbers: any[] = [];
    const scientificCodeSamples: any[] = [];
    const sectionLabels = [
      "Tegel decoren",
      "Boucle",
      "Bouclé",
      "Decor gelijke plinten",
      "Traprenovatie PVC Floorlife",
      "Ambiant vinyl Beton"
    ];
    const sectionProductMatches = sectionLabels.map((sectionLabel) => ({
      sectionLabel,
      matches: [] as any[]
    }));

    for (const product of activeProducts) {
      const supplier = product.supplierId ? supplierById.get(idString(product.supplierId)) : undefined;
      const category = categoryById.get(idString(product.categoryId));
      const productSample = {
        id: idString(product._id),
        name: product.name,
        supplier: supplier?.name ?? "Onbekend",
        category: category?.name ?? "Onbekend",
        articleNumber: product.articleNumber,
        supplierCode: product.supplierCode,
        ean: product.ean,
        importKey: product.importKey,
        sourceFileName: product.attributes?.sourceFileName,
        sourceSheetName: product.attributes?.sourceSheetName
      };

      incById(productsBySupplier, product.supplierId ?? "missing", supplier?.name ?? "Onbekend");
      incById(productsByCategory, product.categoryId, category?.name ?? "Onbekend");
      inc(productsByKind, product.productKind ?? "missing", "missing");

      if (!priceCountByProduct[idString(product._id)]) {
        sample(productsWithoutPrices, productSample);
      }

      if (!hasText(product.articleNumber) && !hasText(product.supplierCode) && !hasText(product.ean)) {
        sample(productsWithoutAllCodes, productSample, 100);
      }

      if (!product.supplierId) {
        sample(productsWithoutSupplier, productSample);
      }

      if (!product.categoryId) {
        sample(productsWithoutCategory, productSample);
      }

      if (!hasText(product.name)) {
        sample(productsWithoutName, productSample);
      }

      if (typeof product.articleNumber !== "undefined" && typeof product.articleNumber !== "string") {
        sample(numericArticleNumbers, productSample);
      }

      if (
        /e\+\d+$/i.test(String(product.articleNumber ?? "")) ||
        /e\+\d+$/i.test(String(product.ean ?? "")) ||
        /e\+\d+$/i.test(String(product.supplierCode ?? ""))
      ) {
        sample(scientificCodeSamples, productSample);
      }

      if (hasText(product.importKey)) {
        const key = String(product.importKey);
        duplicateImportKeyGroups[key] = duplicateImportKeyGroups[key] ?? [];
        duplicateImportKeyGroups[key].push(productSample);
      }

      if (hasText(product.articleNumber) && product.supplierId) {
        const key = `${idString(product.supplierId)}|${product.articleNumber}`;
        duplicateArticleGroups[key] = duplicateArticleGroups[key] ?? [];
        duplicateArticleGroups[key].push(productSample);
      }

      if (hasText(product.ean) && product.supplierId) {
        const key = `${idString(product.supplierId)}|${product.ean}`;
        duplicateEanGroups[key] = duplicateEanGroups[key] ?? [];
        duplicateEanGroups[key].push(productSample);
      }

      if (hasText(product.supplierCode) && product.supplierId) {
        const key = `${idString(product.supplierId)}|${product.supplierCode}`;
        duplicateSupplierCodeGroups[key] = duplicateSupplierCodeGroups[key] ?? [];
        duplicateSupplierCodeGroups[key].push(productSample);
      }

      for (const match of sectionProductMatches) {
        if (String(product.name).trim().toLowerCase() === match.sectionLabel.toLowerCase()) {
          sample(match.matches, productSample);
        }
      }
    }

    const pricesBySourceFileName: Record<string, number> = {};
    const pricesByPriceListId: Record<
      string,
      { id: string; name: string; sourceFileName: string; sourceSheetName: string; count: number }
    > = {};
    const pricesBySupplier: Record<string, { id: string; name: string; count: number }> = {};
    const pricesByType: Record<string, number> = {};
    const pricesByVatMode: Record<string, number> = {};
    const pricesByUnit: Record<string, number> = {};
    const orphanPrices: any[] = [];
    const amountLteZeroPrices: any[] = [];
    const unknownVatPrices: any[] = [];
    const missingUnitPrices: any[] = [];
    const missingPriceTypePrices: any[] = [];
    const duplicatePriceRuleGroups: Record<string, any[]> = {};
    const duplicatePriceSourceKeyGroups: Record<string, any[]> = {};
    const coProCommissionPriceKeys = new Set<string>();

    for (const price of prices) {
      const product = productById.get(idString(price.productId));
      const supplier = product?.supplierId ? supplierById.get(idString(product.supplierId)) : undefined;
      const priceList = price.priceListId ? priceListById.get(idString(price.priceListId)) : undefined;
      const sourceFileName = text(price.sourceFileName, priceList?.sourceFileName ?? "Onbekend bestand");
      const priceSample = {
        id: idString(price._id),
        productId: idString(price.productId),
        productName: product?.name,
        supplier: supplier?.name ?? "Onbekend",
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

      inc(pricesBySourceFileName, sourceFileName);
      incById(pricesBySupplier, product?.supplierId ?? "missing", supplier?.name ?? "Onbekend");
      inc(pricesByType, price.priceType);
      inc(pricesByVatMode, price.vatMode);
      inc(pricesByUnit, price.priceUnit);

      const priceListId = idString(price.priceListId);
      if (!pricesByPriceListId[priceListId]) {
        pricesByPriceListId[priceListId] = {
          id: priceListId,
          name: text(priceList?.name, "Onbekende prijslijst"),
          sourceFileName,
          sourceSheetName: text(priceList?.sourceSheetName, ""),
          count: 0
        };
      }
      pricesByPriceListId[priceListId].count += 1;

      if (!product) {
        sample(orphanPrices, priceSample);
      }

      if (price.amount <= 0) {
        sample(amountLteZeroPrices, priceSample);
      }

      if (price.vatMode === "unknown") {
        sample(unknownVatPrices, priceSample, 10);
      }

      if (!hasText(price.priceUnit)) {
        sample(missingUnitPrices, priceSample);
      }

      if (!hasText(price.priceType)) {
        sample(missingPriceTypePrices, priceSample);
      }

      const duplicatePriceKey = [
        idString(price.productId),
        idString(price.priceListId),
        price.priceType,
        price.priceUnit,
        price.amount,
        price.sourceColumnIndex ?? ""
      ].join("|");
      duplicatePriceRuleGroups[duplicatePriceKey] = duplicatePriceRuleGroups[duplicatePriceKey] ?? [];
      duplicatePriceRuleGroups[duplicatePriceKey].push(priceSample);

      if (price.sourceKey) {
        const sourceKey = String(price.sourceKey);
        duplicatePriceSourceKeyGroups[sourceKey] = duplicatePriceSourceKeyGroups[sourceKey] ?? [];
        duplicatePriceSourceKeyGroups[sourceKey].push(priceSample);
      }

      if (
        sourceFileName === "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx" &&
        price.priceType === "commission"
      ) {
        coProCommissionPriceKeys.add(
          `${idString(price.productId)}|${idString(price.priceListId)}|${price.amount}|${price.sourceColumnIndex}`
        );
      }
    }

    const batchesByStatus: Record<string, number> = {};
    const batchTotals = {
      count: batches.length,
      totalRows: 0,
      previewRows: 0,
      productRows: 0,
      importedProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      importedPrices: 0,
      skippedPrices: 0,
      warningRows: 0,
      errorRows: 0,
      ignoredRows: 0,
      zeroPriceRows: 0,
      unknownVatModeRows: 0,
      duplicateProductMatches: 0,
      productsWithoutSupplierCode: 0,
      orphanPriceRules: 0,
      duplicateSourceKeys: 0
    };

    for (const batch of batches) {
      inc(batchesByStatus, batch.status);
      batchTotals.totalRows += batch.totalRows ?? 0;
      batchTotals.previewRows += batch.previewRows ?? batch.totalRows ?? 0;
      batchTotals.productRows += batch.productRows ?? 0;
      batchTotals.importedProducts += batch.importedProducts ?? 0;
      batchTotals.updatedProducts += batch.updatedProducts ?? 0;
      batchTotals.skippedProducts += batch.skippedProducts ?? 0;
      batchTotals.importedPrices += batch.importedPrices ?? 0;
      batchTotals.skippedPrices += batch.skippedPrices ?? 0;
      batchTotals.warningRows += batch.warningRows ?? 0;
      batchTotals.errorRows += batch.errorRows ?? 0;
      batchTotals.ignoredRows += batch.ignoredRows ?? 0;
      batchTotals.zeroPriceRows += batch.zeroPriceRows ?? 0;
      batchTotals.unknownVatModeRows += batch.unknownVatModeRows ?? 0;
      batchTotals.duplicateProductMatches += batch.duplicateProductMatches ?? 0;
      batchTotals.productsWithoutSupplierCode += batch.productsWithoutSupplierCode ?? 0;
      batchTotals.orphanPriceRules += batch.orphanPriceRules ?? 0;
      batchTotals.duplicateSourceKeys += batch.duplicateSourceKeys ?? 0;
    }

    const headlamSupplier = suppliers.find((supplier) => supplier.name === "Headlam");
    const headlamProducts = activeProducts.filter(
      (product) => idString(product.supplierId) === idString(headlamSupplier?._id)
    );
    const headlamAttributeKeys = [
      "width",
      "type",
      "kamerhoog",
      "lining",
      "patternLength",
      "weight",
      "romanBlinds",
      "patternWidth",
      "materialStyle",
      "washingSymbols",
      "composition",
      "suitableForPanelCurtains",
      "fullLengthCurtains",
      "martVisser"
    ];
    const headlamAttributes: Record<string, number> = {};
    for (const key of headlamAttributeKeys) {
      headlamAttributes[key] = headlamProducts.filter(
        (product) => product.attributes && Object.prototype.hasOwnProperty.call(product.attributes, key)
      ).length;
    }

    const interfloorSupplier = suppliers.find((supplier) => supplier.name === "Interfloor");
    const interfloorProducts = activeProducts.filter(
      (product) => idString(product.supplierId) === idString(interfloorSupplier?._id)
    );

    const sourceFileProducts: Record<string, Record<string, boolean>> = {};
    for (const price of prices) {
      const sourceFileName = text(price.sourceFileName, "Onbekend bestand");
      sourceFileProducts[sourceFileName] = sourceFileProducts[sourceFileName] ?? {};
      sourceFileProducts[sourceFileName][idString(price.productId)] = true;
    }

    return {
      tenantSlug: tenant.slug,
      exists: true,
      generatedAt: Date.now(),
      products: {
        totalActive: activeProducts.length,
        bySupplier: Object.values(productsBySupplier).sort((left, right) => right.count - left.count),
        byCategory: Object.values(productsByCategory).sort((left, right) => right.count - left.count),
        byProductKind: productsByKind,
        withoutPriceRules: {
          count: activeProducts.filter((product) => !priceCountByProduct[idString(product._id)]).length,
          samples: productsWithoutPrices
        },
        withoutArticleNumberEanSupplierCode: {
          count: activeProducts.filter(
            (product) => !hasText(product.articleNumber) && !hasText(product.supplierCode) && !hasText(product.ean)
          ).length,
          samples: productsWithoutAllCodes
        },
        withoutName: {
          count: activeProducts.filter((product) => !hasText(product.name)).length,
          samples: productsWithoutName
        },
        withoutSupplierId: {
          count: activeProducts.filter((product) => !product.supplierId).length,
          samples: productsWithoutSupplier
        },
        withoutCategoryId: {
          count: activeProducts.filter((product) => !product.categoryId).length,
          samples: productsWithoutCategory
        },
        numericArticleNumbers: {
          count: numericArticleNumbers.length,
          samples: numericArticleNumbers
        },
        scientificNotationCodes: {
          count: scientificCodeSamples.length,
          samples: scientificCodeSamples
        },
        duplicates: {
          importKey: duplicateSummary(duplicateImportKeyGroups),
          supplierArticleNumber: duplicateSummary(duplicateArticleGroups),
          supplierEan: duplicateSummary(duplicateEanGroups),
          supplierSupplierCode: duplicateSummary(duplicateSupplierCodeGroups)
        }
      },
      prices: {
        total: prices.length,
        bySourceFileName: pricesBySourceFileName,
        byPriceListId: Object.values(pricesByPriceListId).sort((left, right) => right.count - left.count),
        bySupplier: Object.values(pricesBySupplier).sort((left, right) => right.count - left.count),
        byPriceType: pricesByType,
        byVatMode: pricesByVatMode,
        byUnit: pricesByUnit,
        amountLteZero: {
          count: prices.filter((price) => price.amount <= 0).length,
          samples: amountLteZeroPrices
        },
        withoutProduct: {
          count: prices.filter((price) => !productById.has(idString(price.productId))).length,
          samples: orphanPrices
        },
        vatModeUnknown: {
          count: prices.filter((price) => price.vatMode === "unknown").length,
          samples: unknownVatPrices
        },
        missingUnit: {
          count: missingUnitPrices.length,
          samples: missingUnitPrices
        },
        missingPriceType: {
          count: missingPriceTypePrices.length,
          samples: missingPriceTypePrices
        },
        duplicateRules: duplicateSummary(duplicatePriceRuleGroups),
        duplicateSourceKeys: duplicateSummary(duplicatePriceSourceKeyGroups)
      },
      batches: {
        byStatus: batchesByStatus,
        totals: batchTotals,
        latest: batches
          .slice()
          .sort((left, right) => right.createdAt - left.createdAt)
          .slice(0, 25)
          .map((batch) => ({
            id: idString(batch._id),
            fileName: batch.fileName,
            sourceFileName: batch.sourceFileName,
            status: batch.status,
            totalRows: batch.totalRows,
            previewRows: batch.previewRows ?? batch.totalRows,
            productRows: batch.productRows ?? 0,
            importedProducts: batch.importedProducts ?? 0,
            updatedProducts: batch.updatedProducts ?? 0,
            importedPrices: batch.importedPrices ?? 0,
            skippedPrices: batch.skippedPrices ?? 0,
            warningRows: batch.warningRows ?? 0,
            errorRows: batch.errorRows ?? 0,
            ignoredRows: batch.ignoredRows ?? 0,
            duplicateProductMatches: batch.duplicateProductMatches ?? 0,
            zeroPriceRows: batch.zeroPriceRows ?? 0,
            unknownVatModeRows: batch.unknownVatModeRows ?? 0,
            duplicateSourceKeys: batch.duplicateSourceKeys ?? 0,
            allowUnknownVatMode: batch.allowUnknownVatMode ?? false,
            createdAt: batch.createdAt,
            importedAt: batch.importedAt,
            committedAt: batch.committedAt,
            failedAt: batch.failedAt,
            errorMessage: batch.errorMessage
          }))
      },
      profiles: {
        total: profiles.length,
        active: profiles.filter((profile) => profile.status === "active").length,
        inactive: profiles.filter((profile) => profile.status !== "active").length,
        entries: profiles
          .slice()
          .sort((left, right) => left.name.localeCompare(right.name, "nl"))
          .map((profile) => ({
            id: idString(profile._id),
            name: profile.name,
            supplierName: profile.supplierName,
            supplierId: idString(profile.supplierId),
            categoryId: idString(profile.categoryId),
            categoryName: categoryById.get(idString(profile.categoryId))?.name,
            filePattern: profile.filePattern,
            sheetPattern: profile.sheetPattern,
            expectedFileExtension: profile.expectedFileExtension,
            supportsXlsx: profile.supportsXlsx,
            supportsXls: profile.supportsXls,
            headerRowStrategy: profile.headerRowStrategy,
            sectionRowStrategy: profile.sectionRowStrategy,
            productKeyStrategy: profile.productKeyStrategy,
            priceColumnMappings: profile.priceColumnMappings,
            vatModeByPriceColumn: profile.vatModeByPriceColumn,
            unitByPriceColumn: profile.unitByPriceColumn,
            priceTypeByPriceColumn: profile.priceTypeByPriceColumn,
            duplicateStrategy: profile.duplicateStrategy,
            zeroPriceStrategy: profile.zeroPriceStrategy,
            status: profile.status
          }))
      },
      specialCaseChecks: {
        headlam: {
          activeProducts: headlamProducts.length,
          uniqueSupplierCodes: new Set(headlamProducts.map((product) => product.supplierCode).filter(Boolean)).size,
          priceRules:
            pricesBySourceFileName[
              "Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx"
            ] ?? 0,
          productKinds: headlamProducts.reduce<Record<string, number>>((map, product) => {
            inc(map, product.productKind ?? "missing", "missing");
            return map;
          }, {}),
          attributeCoverage: headlamAttributes
        },
        interfloor: {
          activeProducts: interfloorProducts.length,
          articleNumbersStartingWithDot: interfloorProducts.filter((product) =>
            String(product.articleNumber ?? "").startsWith(".")
          ).length,
          dotArticleSamples: interfloorProducts
            .filter((product) => String(product.articleNumber ?? "").startsWith("."))
            .slice(0, 10)
            .map((product) => ({
              id: idString(product._id),
              name: product.name,
              articleNumber: product.articleNumber
            })),
          priceRules: pricesBySourceFileName["henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls"] ?? 0,
          units: prices.reduce<Record<string, number>>((map, price) => {
            if (price.sourceFileName === "henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls") {
              inc(map, price.priceUnit);
            }
            return map;
          }, {})
        },
        coProEntreematten: {
          products:
            Object.keys(sourceFileProducts["Co-pro Entreematten 2025.xlsx"] ?? {}).length,
          priceRules: pricesBySourceFileName["Co-pro Entreematten 2025.xlsx"] ?? 0
        },
        coProLijmKitEgaline: {
          priceRules: pricesBySourceFileName["Co-pro prijslijst lijm kit en egaline 2025-04.xlsx"] ?? 0,
          commissionPriceRules: prices.filter(
            (price) =>
              price.sourceFileName === "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx" &&
              price.priceType === "commission"
          ).length,
          distinctCommissionColumnKeys: coProCommissionPriceKeys.size,
          vatModes: prices.reduce<Record<string, number>>((map, price) => {
            if (price.sourceFileName === "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx") {
              inc(map, price.vatMode);
            }
            return map;
          }, {})
        },
        pvcOverlaps: {
          floorlifeFileProducts:
            Object.keys(sourceFileProducts["PVC 11-2025 click dryback apart floorlife.xlsx"] ?? {}).length,
          pvcFileProducts:
            Object.keys(sourceFileProducts["Prijslijst PVC 11-2025 click dryback apart.xlsx"] ?? {}).length,
          floorlifeFilePrices: pricesBySourceFileName["PVC 11-2025 click dryback apart floorlife.xlsx"] ?? 0,
          pvcFilePrices: pricesBySourceFileName["Prijslijst PVC 11-2025 click dryback apart.xlsx"] ?? 0
        },
        sectionRowsImportedAsProducts: sectionProductMatches
      }
    };
  }
});
