import { query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { readActorValidator, requireQueryRole } from "../authz";

// De audit leest alle producten + prijzen in één query voor duplicaat-/gat-detectie.
// Op grote catalogi (prod ~25k producten / ~74k prijzen) overschrijdt dat de Convex-leeslimiet.
// We lezen GEBONDEN (via take) en weigeren met een duidelijke fout i.p.v. een cryptische crash;
// dezelfde aanpak als getCatalogImportStats. Een volledige audit op die schaal vraagt een
// chunked herontwerp (aparte taak) — dit voorkomt in elk geval de read-limit-crash.
const AUDIT_SCAN_LIMIT = 7000;

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
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);

    const [products, prices, priceLists, suppliers, categories, profiles, batches] =
      await Promise.all([
        ctx.db
          .query("products")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
          .take(AUDIT_SCAN_LIMIT + 1),
        ctx.db
          .query("productPrices")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
          .take(AUDIT_SCAN_LIMIT + 1),
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

    if (products.length > AUDIT_SCAN_LIMIT || prices.length > AUDIT_SCAN_LIMIT) {
      throw new ConvexError(
        `Catalogus te groot voor een volledige productie-audit in één query ` +
          `(limiet ${AUDIT_SCAN_LIMIT} producten/prijzen). Audit een kleinere selectie of ` +
          `gebruik getCatalogImportStats met summaryOnly voor tellingen.`
      );
    }

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
      const supplier = product.leverancierId ? supplierById.get(idString(product.leverancierId)) : undefined;
      const category = categoryById.get(idString(product.categorieId));
      const productSample = {
        id: idString(product._id),
        name: product.naam,
        supplier: supplier?.naam ?? "Onbekend",
        category: category?.naam ?? "Onbekend",
        articleNumber: product.artikelnummer,
        supplierCode: product.leverancierCode,
        ean: product.ean,
        importKey: product.importSleutel,
        sourceFileName: product.attributen?.sourceFileName,
        sourceSheetName: product.attributen?.sourceSheetName
      };

      incById(productsBySupplier, product.leverancierId ?? "missing", supplier?.naam ?? "Onbekend");
      incById(productsByCategory, product.categorieId, category?.naam ?? "Onbekend");
      inc(productsByKind, product.productSoort ?? "missing", "missing");

      if (!priceCountByProduct[idString(product._id)]) {
        sample(productsWithoutPrices, productSample);
      }

      if (!hasText(product.artikelnummer) && !hasText(product.leverancierCode) && !hasText(product.ean)) {
        sample(productsWithoutAllCodes, productSample, 100);
      }

      if (!product.leverancierId) {
        sample(productsWithoutSupplier, productSample);
      }

      if (!product.categorieId) {
        sample(productsWithoutCategory, productSample);
      }

      if (!hasText(product.naam)) {
        sample(productsWithoutName, productSample);
      }

      if (typeof product.artikelnummer !== "undefined" && typeof product.artikelnummer !== "string") {
        sample(numericArticleNumbers, productSample);
      }

      if (
        /e\+\d+$/i.test(String(product.artikelnummer ?? "")) ||
        /e\+\d+$/i.test(String(product.ean ?? "")) ||
        /e\+\d+$/i.test(String(product.leverancierCode ?? ""))
      ) {
        sample(scientificCodeSamples, productSample);
      }

      if (hasText(product.importSleutel)) {
        const key = String(product.importSleutel);
        duplicateImportKeyGroups[key] = duplicateImportKeyGroups[key] ?? [];
        duplicateImportKeyGroups[key].push(productSample);
      }

      if (hasText(product.artikelnummer) && product.leverancierId) {
        const key = `${idString(product.leverancierId)}|${product.artikelnummer}`;
        duplicateArticleGroups[key] = duplicateArticleGroups[key] ?? [];
        duplicateArticleGroups[key].push(productSample);
      }

      if (hasText(product.ean) && product.leverancierId) {
        const key = `${idString(product.leverancierId)}|${product.ean}`;
        duplicateEanGroups[key] = duplicateEanGroups[key] ?? [];
        duplicateEanGroups[key].push(productSample);
      }

      if (hasText(product.leverancierCode) && product.leverancierId) {
        const key = `${idString(product.leverancierId)}|${product.leverancierCode}`;
        duplicateSupplierCodeGroups[key] = duplicateSupplierCodeGroups[key] ?? [];
        duplicateSupplierCodeGroups[key].push(productSample);
      }

      for (const match of sectionProductMatches) {
        if (String(product.naam).trim().toLowerCase() === match.sectionLabel.toLowerCase()) {
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
      const supplier = product?.leverancierId ? supplierById.get(idString(product.leverancierId)) : undefined;
      const priceList = price.prijslijstId ? priceListById.get(idString(price.prijslijstId)) : undefined;
      const sourceFileName = text(price.bronBestandsnaam, priceList?.bronBestandsnaam ?? "Onbekend bestand");
      const priceSample = {
        id: idString(price._id),
        productId: idString(price.productId),
        productName: product?.naam,
        supplier: supplier?.naam ?? "Onbekend",
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

      inc(pricesBySourceFileName, sourceFileName);
      incById(pricesBySupplier, product?.leverancierId ?? "missing", supplier?.naam ?? "Onbekend");
      inc(pricesByType, price.prijsSoort);
      inc(pricesByVatMode, price.btwModus);
      inc(pricesByUnit, price.prijsEenheid);

      const priceListId = idString(price.prijslijstId);
      if (!pricesByPriceListId[priceListId]) {
        pricesByPriceListId[priceListId] = {
          id: priceListId,
          name: text(priceList?.naam, "Onbekende prijslijst"),
          sourceFileName,
          sourceSheetName: text(priceList?.bronBladNaam, ""),
          count: 0
        };
      }
      pricesByPriceListId[priceListId].count += 1;

      if (!product) {
        sample(orphanPrices, priceSample);
      }

      if (price.bedrag <= 0) {
        sample(amountLteZeroPrices, priceSample);
      }

      if (price.btwModus === "unknown") {
        sample(unknownVatPrices, priceSample, 10);
      }

      if (!hasText(price.prijsEenheid)) {
        sample(missingUnitPrices, priceSample);
      }

      if (!hasText(price.prijsSoort)) {
        sample(missingPriceTypePrices, priceSample);
      }

      const duplicatePriceKey = [
        idString(price.productId),
        idString(price.prijslijstId),
        price.prijsSoort,
        price.prijsEenheid,
        price.bedrag,
        price.bronKolomIndex ?? ""
      ].join("|");
      duplicatePriceRuleGroups[duplicatePriceKey] = duplicatePriceRuleGroups[duplicatePriceKey] ?? [];
      duplicatePriceRuleGroups[duplicatePriceKey].push(priceSample);

      if (price.bronSleutel) {
        const sourceKey = String(price.bronSleutel);
        duplicatePriceSourceKeyGroups[sourceKey] = duplicatePriceSourceKeyGroups[sourceKey] ?? [];
        duplicatePriceSourceKeyGroups[sourceKey].push(priceSample);
      }

      if (
        sourceFileName === "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx" &&
        price.prijsSoort === "commission"
      ) {
        coProCommissionPriceKeys.add(
          `${idString(price.productId)}|${idString(price.prijslijstId)}|${price.bedrag}|${price.bronKolomIndex}`
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
      batchTotals.totalRows += batch.totaalRijen ?? 0;
      batchTotals.previewRows += batch.voorbeeldRijen ?? batch.totaalRijen ?? 0;
      batchTotals.productRows += batch.productRijen ?? 0;
      batchTotals.importedProducts += batch.geimporteerdeProducten ?? 0;
      batchTotals.updatedProducts += batch.bijgewerkteProducten ?? 0;
      batchTotals.skippedProducts += batch.overgeslagenProducten ?? 0;
      batchTotals.importedPrices += batch.geimporteerdePrijzen ?? 0;
      batchTotals.skippedPrices += batch.overgeslagenPrijzen ?? 0;
      batchTotals.warningRows += batch.waarschuwingRijen ?? 0;
      batchTotals.errorRows += batch.foutRijen ?? 0;
      batchTotals.ignoredRows += batch.genegeerdeRijen ?? 0;
      batchTotals.zeroPriceRows += batch.nulPrijsRijen ?? 0;
      batchTotals.unknownVatModeRows += batch.onbekendeBtwModusRijen ?? 0;
      batchTotals.duplicateProductMatches += batch.dubbeleProductMatches ?? 0;
      batchTotals.productsWithoutSupplierCode += batch.productenZonderLeverancierCode ?? 0;
      batchTotals.orphanPriceRules += batch.weesPrijsRegels ?? 0;
      batchTotals.duplicateSourceKeys += batch.dubbeleBronSleutels ?? 0;
    }

    const headlamSupplier = suppliers.find((supplier) => supplier.naam === "Headlam");
    const headlamProducts = activeProducts.filter(
      (product) => idString(product.leverancierId) === idString(headlamSupplier?._id)
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
        (product) => product.attributen && Object.prototype.hasOwnProperty.call(product.attributen, key)
      ).length;
    }

    const interfloorSupplier = suppliers.find((supplier) => supplier.naam === "Interfloor");
    const interfloorProducts = activeProducts.filter(
      (product) => idString(product.leverancierId) === idString(interfloorSupplier?._id)
    );

    const sourceFileProducts: Record<string, Record<string, boolean>> = {};
    for (const price of prices) {
      const sourceFileName = text(price.bronBestandsnaam, "Onbekend bestand");
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
            (product) => !hasText(product.artikelnummer) && !hasText(product.leverancierCode) && !hasText(product.ean)
          ).length,
          samples: productsWithoutAllCodes
        },
        withoutName: {
          count: activeProducts.filter((product) => !hasText(product.naam)).length,
          samples: productsWithoutName
        },
        withoutSupplierId: {
          count: activeProducts.filter((product) => !product.leverancierId).length,
          samples: productsWithoutSupplier
        },
        withoutCategoryId: {
          count: activeProducts.filter((product) => !product.categorieId).length,
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
          count: prices.filter((price) => price.bedrag <= 0).length,
          samples: amountLteZeroPrices
        },
        withoutProduct: {
          count: prices.filter((price) => !productById.has(idString(price.productId))).length,
          samples: orphanPrices
        },
        vatModeUnknown: {
          count: prices.filter((price) => price.btwModus === "unknown").length,
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
          .sort((left, right) => right.aangemaaktOp - left.aangemaaktOp)
          .slice(0, 25)
          .map((batch) => ({
            id: idString(batch._id),
            fileName: batch.bestandsnaam,
            sourceFileName: batch.bronBestandsnaam,
            status: batch.status,
            totalRows: batch.totaalRijen,
            previewRows: batch.voorbeeldRijen ?? batch.totaalRijen,
            productRows: batch.productRijen ?? 0,
            importedProducts: batch.geimporteerdeProducten ?? 0,
            updatedProducts: batch.bijgewerkteProducten ?? 0,
            importedPrices: batch.geimporteerdePrijzen ?? 0,
            skippedPrices: batch.overgeslagenPrijzen ?? 0,
            warningRows: batch.waarschuwingRijen ?? 0,
            errorRows: batch.foutRijen ?? 0,
            ignoredRows: batch.genegeerdeRijen ?? 0,
            duplicateProductMatches: batch.dubbeleProductMatches ?? 0,
            zeroPriceRows: batch.nulPrijsRijen ?? 0,
            unknownVatModeRows: batch.onbekendeBtwModusRijen ?? 0,
            duplicateSourceKeys: batch.dubbeleBronSleutels ?? 0,
            allowUnknownVatMode: batch.staBtwModusOnbekendToe ?? false,
            createdAt: batch.aangemaaktOp,
            importedAt: batch.geimporteerdOp,
            committedAt: batch.vastgelegdOp,
            failedAt: batch.misluktOp,
            errorMessage: batch.foutmelding
          }))
      },
      profiles: {
        total: profiles.length,
        active: profiles.filter((profile) => profile.status === "active").length,
        inactive: profiles.filter((profile) => profile.status !== "active").length,
        entries: profiles
          .slice()
          .sort((left, right) => left.naam.localeCompare(right.naam, "nl"))
          .map((profile) => ({
            id: idString(profile._id),
            name: profile.naam,
            supplierName: profile.leverancierNaam,
            supplierId: idString(profile.leverancierId),
            categoryId: idString(profile.categorieId),
            categoryName: categoryById.get(idString(profile.categorieId))?.naam,
            filePattern: profile.bestandPatroon,
            sheetPattern: profile.bladPatroon,
            expectedFileExtension: profile.verwachteBestandsextensie,
            supportsXlsx: profile.ondersteuntXlsx,
            supportsXls: profile.ondersteuntXls,
            headerRowStrategy: profile.koprijStrategie,
            sectionRowStrategy: profile.sectierijStrategie,
            productKeyStrategy: profile.productSleutelStrategie,
            priceColumnMappings: profile.prijskolomMappings,
            vatModeByPriceColumn: profile.btwModusPerPrijskolom,
            unitByPriceColumn: profile.eenheidPerPrijskolom,
            priceTypeByPriceColumn: profile.prijsSoortPerPrijskolom,
            duplicateStrategy: profile.dubbelenStrategie,
            zeroPriceStrategy: profile.nulPrijsStrategie,
            status: profile.status
          }))
      },
      specialCaseChecks: {
        headlam: {
          activeProducts: headlamProducts.length,
          uniqueSupplierCodes: new Set(headlamProducts.map((product) => product.leverancierCode).filter(Boolean)).size,
          priceRules:
            pricesBySourceFileName[
              "Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx"
            ] ?? 0,
          productKinds: headlamProducts.reduce<Record<string, number>>((map, product) => {
            inc(map, product.productSoort ?? "missing", "missing");
            return map;
          }, {}),
          attributeCoverage: headlamAttributes
        },
        interfloor: {
          activeProducts: interfloorProducts.length,
          articleNumbersStartingWithDot: interfloorProducts.filter((product) =>
            String(product.artikelnummer ?? "").startsWith(".")
          ).length,
          dotArticleSamples: interfloorProducts
            .filter((product) => String(product.artikelnummer ?? "").startsWith("."))
            .slice(0, 10)
            .map((product) => ({
              id: idString(product._id),
              name: product.naam,
              articleNumber: product.artikelnummer
            })),
          priceRules: pricesBySourceFileName["henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls"] ?? 0,
          units: prices.reduce<Record<string, number>>((map, price) => {
            if (price.bronBestandsnaam === "henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls") {
              inc(map, price.prijsEenheid);
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
              price.bronBestandsnaam === "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx" &&
              price.prijsSoort === "commission"
          ).length,
          distinctCommissionColumnKeys: coProCommissionPriceKeys.size,
          vatModes: prices.reduce<Record<string, number>>((map, price) => {
            if (price.bronBestandsnaam === "Co-pro prijslijst lijm kit en egaline 2025-04.xlsx") {
              inc(map, price.btwModus);
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
