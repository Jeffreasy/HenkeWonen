import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");
const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

async function seedQuoteContext(t: ReturnType<typeof convexTest>) {
  const now = Date.now();

  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen",
      naam: "Henke Wonen",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId,
      externalUserId,
      email: "admin@henke.nl",
      role: "admin",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const klantId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Trapklant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId,
      klantId,
      titel: "PVC traprenovatie",
      status: "quote_draft",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const quoteId = await ctx.db.insert("quotes", {
      tenantId,
      projectId,
      klantId,
      offertenummer: "OFF-TRAP-1",
      titel: "Offerte PVC trap",
      status: "draft",
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const categorieId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Traprenovatie",
      slug: "traprenovatie",
      sortOrder: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const materialProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId,
      naam: "PVC traptrede Natural Oak",
      sku: "563538-NATURAL-OAK",
      productAard: "standard",
      eenheid: "step",
      verkoopEenheid: "step",
      bestelEenheid: "pack",
      stuksPerPak: 4,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const serviceProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId,
      naam: "PVC trap halve draai",
      sku: "HW-DIENST-014",
      productAard: "service",
      eenheid: "stairs",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const standaloneServiceProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId,
      naam: "Tapijt leggen",
      sku: "HW-DIENST-999",
      productAard: "service",
      eenheid: "stairs",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const measurementId = await ctx.db.insert("measurements", {
      tenantId,
      projectId,
      klantId,
      status: "reviewed",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectRoomId = await ctx.db.insert("projectRooms", {
      tenantId,
      projectId,
      naam: "Hal",
      sortOrder: 1,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const measurementRoomId = await ctx.db.insert("measurementRooms", {
      tenantId,
      inmetingId: measurementId,
      projectRuimteId: projectRoomId,
      naam: "Hal",
      sortOrder: 1,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    return {
      tenantId,
      quoteId,
      measurementId,
      measurementRoomId,
      projectRoomId,
      materialProductId,
      serviceProductId,
      standaloneServiceProductId
    };
  });
}

async function insertStairBundle(
  t: ReturnType<typeof convexTest>,
  ids: Awaited<ReturnType<typeof seedQuoteContext>>,
  laborStatus: "draft" | "ready_for_quote" = "ready_for_quote"
) {
  const now = Date.now();
  const bundleId = `trapbundel-${now}`;
  const technicalContext = {
    recipeKey: "pvc_stair" as const,
    recipeVersion: 1 as const,
    covering: "pvc" as const,
    stairShape: "half_turn",
    stairConstruction: "closed",
    treadCount: 13,
    riserCount: 13,
    doubleTreadCount: 0,
    stripLengthM: 0.9
  };

  return t.run(async (ctx) => {
    const materialLineId = await ctx.db.insert("measurementLines", {
      tenantId: ids.tenantId,
      inmetingId: ids.measurementId,
      ruimteId: ids.measurementRoomId,
      productGroep: "stairs",
      berekeningType: "stairs",
      invoer: {
        ...technicalContext,
        quantityMode: "calculated",
        calculatedQuantity: 13
      },
      resultaat: { quoteQuantity: 13 },
      aantal: 13,
      eenheid: "step",
      offerteRegelType: "product",
      quotePreparationStatus: "ready_for_quote",
      bundleId,
      bundleType: "stair_renovation",
      bundleRole: "material",
      sectionKey: "traprenovatie",
      productId: ids.materialProductId,
      productNaam: "PVC traptrede Natural Oak",
      indicatieveEenheidsprijsExBtw: 49,
      indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "step",
      indicatievePrijsSoort: "product",
      indicatiefVastgelegdOp: now,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const laborLineId = await ctx.db.insert("measurementLines", {
      tenantId: ids.tenantId,
      inmetingId: ids.measurementId,
      ruimteId: ids.measurementRoomId,
      productGroep: "stairs",
      berekeningType: "stairs",
      invoer: technicalContext,
      resultaat: { quoteQuantity: 1 },
      aantal: 1,
      eenheid: "stairs",
      offerteRegelType: "labor",
      quotePreparationStatus: laborStatus,
      bundleId,
      bundleType: "stair_renovation",
      bundleRole: "labor",
      sectionKey: "traprenovatie",
      productId: ids.serviceProductId,
      productNaam: "PVC trap halve draai",
      indicatieveEenheidsprijsExBtw: 1795,
      indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "stairs",
      indicatievePrijsSoort: "service_rule",
      indicatiefVastgelegdOp: now,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    return { materialLineId, laborLineId, bundleId };
  });
}

const addLineArgs = (quoteId: string) => ({
  tenantSlug: "henke-wonen",
  actor,
  quoteId,
  titel: "Testregel",
  aantal: 1,
  eenheid: "piece",
  eenheidsprijsExBtw: 100,
  btwTarief: 21,
  sortOrder: 1
});

test("offerteregels koppelen bestelproducten en dienstproducten alleen aan passende regeltypes", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteContext(t);

  await expect(
    t.mutation(api.portal.addQuoteLine, {
      ...addLineArgs(String(ids.quoteId)),
      regelType: "service",
      productId: String(ids.serviceProductId)
    })
  ).rejects.toThrow(/volledige trapbundel/i);

  const serviceLineId = await t.mutation(api.portal.addQuoteLine, {
    ...addLineArgs(String(ids.quoteId)),
    regelType: "service",
    productId: String(ids.standaloneServiceProductId)
  });
  const materialLineId = await t.mutation(api.portal.addQuoteLine, {
    ...addLineArgs(String(ids.quoteId)),
    regelType: "material",
    productId: String(ids.materialProductId),
    sortOrder: 2
  });

  await expect(
    t.mutation(api.portal.addQuoteLine, {
      ...addLineArgs(String(ids.quoteId)),
      regelType: "product",
      productId: String(ids.serviceProductId),
      sortOrder: 3
    })
  ).rejects.toThrow(/dienstproduct.*productregel/i);
  await expect(
    t.mutation(api.portal.addQuoteLine, {
      ...addLineArgs(String(ids.quoteId)),
      regelType: "labor",
      productId: String(ids.materialProductId),
      sortOrder: 3
    })
  ).rejects.toThrow(/vereist een dienstproduct/i);

  const manualLineId = await t.mutation(api.portal.addQuoteLine, {
    ...addLineArgs(String(ids.quoteId)),
    regelType: "manual",
    productId: String(ids.serviceProductId),
    sortOrder: 3
  });
  const legacyServiceLineId = await t.mutation(api.portal.addQuoteLine, {
    ...addLineArgs(String(ids.quoteId)),
    regelType: "service",
    sortOrder: 4
  });
  const [serviceLine, materialLine, manualLine, legacyServiceLine] = await t.run(async (ctx) =>
    Promise.all([
      ctx.db.get(serviceLineId),
      ctx.db.get(materialLineId),
      ctx.db.get(manualLineId),
      ctx.db.get(legacyServiceLineId)
    ])
  );
  expect(serviceLine?.productId).toBe(ids.standaloneServiceProductId);
  expect(materialLine?.productId).toBe(ids.materialProductId);
  expect(manualLine?.productId).toBeUndefined();
  expect(legacyServiceLine?.productId).toBeUndefined();

  await t.run((ctx) => ctx.db.patch(ids.standaloneServiceProductId, { status: "inactive" }));
  await t.mutation(api.portal.updateQuoteLine, {
    tenantSlug: "henke-wonen",
    actor,
    lineId: String(serviceLineId),
    regelType: "service",
    productId: String(ids.standaloneServiceProductId),
    titel: "Bijgewerkte dienst",
    aantal: 1,
    eenheid: "stairs",
    eenheidsprijsExBtw: 1795,
    btwTarief: 21
  });
  await expect(
    t.mutation(api.portal.updateQuoteLine, {
      tenantSlug: "henke-wonen",
      actor,
      lineId: String(serviceLineId),
      regelType: "labor",
      productId: String(ids.standaloneServiceProductId),
      titel: "Bijgewerkte arbeid",
      aantal: 1,
      eenheid: "stairs",
      eenheidsprijsExBtw: 1795,
      btwTarief: 21
    })
  ).rejects.toThrow(/niet \(meer\) actief/i);

  await t.run((ctx) => ctx.db.patch(ids.standaloneServiceProductId, { status: "active" }));
  await t.mutation(api.portal.updateQuoteLine, {
    tenantSlug: "henke-wonen",
    actor,
    lineId: String(serviceLineId),
    regelType: "labor",
    productId: String(ids.standaloneServiceProductId),
    titel: "Bijgewerkte arbeid",
    aantal: 1,
    eenheid: "stairs",
    eenheidsprijsExBtw: 1795,
    btwTarief: 21
  });
  expect((await t.run((ctx) => ctx.db.get(serviceLineId)))?.productId).toBe(
    ids.standaloneServiceProductId
  );

  const legacyGuidedLineId = await t.run((ctx) =>
    ctx.db.insert("quoteLines", {
      tenantId: ids.tenantId,
      quoteId: ids.quoteId,
      productId: ids.serviceProductId,
      regelType: "service",
      titel: "Bestaande losse PVC-trapdienst",
      aantal: 1,
      eenheid: "stairs",
      eenheidsprijsExBtw: 100,
      btwTarief: 21,
      regelTotaalExBtw: 100,
      regelBtwTotaal: 21,
      regelTotaalInclBtw: 121,
      sortOrder: 5,
      aangemaaktOp: Date.now(),
      gewijzigdOp: Date.now()
    })
  );
  await expect(
    t.mutation(api.portal.updateQuoteLine, {
      tenantSlug: "henke-wonen",
      actor,
      lineId: String(legacyGuidedLineId),
      regelType: "service",
      productId: String(ids.serviceProductId),
      titel: "Nog steeds los",
      aantal: 1,
      eenheid: "stairs",
      eenheidsprijsExBtw: 100,
      btwTarief: 21
    })
  ).rejects.toThrow(/volledige trapbundel/i);

  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId: String(ids.quoteId),
    status: "sent"
  });
  expect((await t.run((ctx) => ctx.db.get(ids.quoteId)))?.status).toBe("sent");
});

test("een volledige trapbundel importeert materiaal en dienst met prijs- en groeperingsmetadata", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteContext(t);
  const bundle = await insertStairBundle(t, ids);

  const importedIds = await t.mutation(api.portal.importMeasurementLinesToQuote, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId: String(ids.quoteId),
    lineIds: [bundle.materialLineId, bundle.laborLineId],
    startSortOrder: 1
  });
  expect(importedIds).toHaveLength(2);

  const { lines, quote, measurementLines } = await t.run(async (ctx) => ({
    lines: (
      await ctx.db
        .query("quoteLines")
        .withIndex("by_quote", (q) => q.eq("tenantId", ids.tenantId).eq("quoteId", ids.quoteId))
        .collect()
    ).sort((left, right) => left.sortOrder - right.sortOrder),
    quote: await ctx.db.get(ids.quoteId),
    measurementLines: await Promise.all([
      ctx.db.get(bundle.materialLineId),
      ctx.db.get(bundle.laborLineId)
    ])
  }));

  expect(lines).toHaveLength(2);
  expect(lines[0]).toMatchObject({
    regelType: "product",
    productId: ids.materialProductId,
    eenheidsprijsExBtw: 49,
    btwTarief: 21
  });
  expect(lines[1]).toMatchObject({
    regelType: "labor",
    productId: ids.serviceProductId,
    eenheidsprijsExBtw: 1795,
    btwTarief: 21
  });
  for (const line of lines) {
    expect(line.metadata).toMatchObject({
      source: "measurement",
      sectionKey: "traprenovatie",
      bundleId: bundle.bundleId,
      bundleType: "stair_renovation",
      recipeKey: "pvc_stair",
      recipeVersion: 1,
      covering: "pvc",
      stairShape: "half_turn",
      stairConstruction: "closed",
      treadCount: 13,
      riserCount: 13,
      stripLengthM: 0.9,
      doubleTreadCount: 0,
      requiresManualProductReview: false,
      requiresManualPriceReview: true,
      requiresManualVatReview: false
    });
  }
  expect(lines.map((line) => line.metadata?.bundleRole)).toEqual(["material", "labor"]);
  expect(quote).toMatchObject({
    subtotaalExBtw: 2432,
    btwTotaal: 510.72,
    totaalInclBtw: 2942.72
  });
  expect(lines[0].metadata).toMatchObject({
    quantityMode: "calculated",
    calculatedQuantity: 13,
    stairCatalogSalesUnit: "step",
    stairMaterialFamily: "stair_renovation",
    stairMaterialCovering: "pvc",
    stairMaterialComponentRole: "standard_tread",
    stairMaterialIsPrimary: true,
    stairMaterialPiecesPerPack: 4,
    stairMaterialOrderUnit: "pack"
  });
  expect(lines[1].metadata).toMatchObject({
    stairCatalogSalesUnit: "stairs",
    stairServiceSku: "HW-DIENST-014",
    stairServiceFamily: "stair_renovation",
    stairServiceCovering: "pvc",
    stairServiceShape: "half_turn",
    stairServiceRole: "base_labor",
    stairServiceSectionKey: "traprenovatie"
  });
  expect(measurementLines.every((line) => line?.quotePreparationStatus === "converted")).toBe(true);

  await expect(
    t.mutation(api.projecten.measurements.updateMeasurementLineStatus, {
      tenantId: ids.tenantId,
      actor,
      lineId: bundle.laborLineId,
      quotePreparationStatus: "draft"
    })
  ).rejects.toThrow(/gekoppelde offerte/i);

  await expect(
    t.mutation(api.portal.updateQuoteLine, {
      tenantSlug: "henke-wonen",
      actor,
      lineId: String(lines[1]._id),
      projectRuimteId: String(ids.projectRoomId),
      productId: String(ids.serviceProductId),
      regelType: "service",
      titel: lines[1].titel,
      omschrijving: lines[1].omschrijving,
      aantal: lines[1].aantal,
      eenheid: lines[1].eenheid,
      eenheidsprijsExBtw: lines[1].eenheidsprijsExBtw,
      btwTarief: lines[1].btwTarief,
      metadata: lines[1].metadata
    })
  ).rejects.toThrow(/arbeidsrol.*arbeid/i);

  await t.run((ctx) => ctx.db.patch(lines[1]._id, { regelType: "service" }));
  await expect(
    t.mutation(api.portal.updateQuoteStatus, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(ids.quoteId),
      status: "sent"
    })
  ).rejects.toThrow(/arbeidsrol.*arbeid/i);
  await t.run((ctx) => ctx.db.patch(lines[1]._id, { regelType: "labor" }));

  await t.mutation(api.portal.deleteQuoteLine, {
    tenantSlug: "henke-wonen",
    actor,
    lineId: String(lines[0]._id)
  });

  const restored = await t.run(async (ctx) => ({
    quoteLines: await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) => q.eq("tenantId", ids.tenantId).eq("quoteId", ids.quoteId))
      .collect(),
    measurement: await ctx.db.get(ids.measurementId),
    measurementLines: await Promise.all([
      ctx.db.get(bundle.materialLineId),
      ctx.db.get(bundle.laborLineId)
    ])
  }));
  expect(restored.quoteLines).toHaveLength(0);
  expect(restored.measurement?.status).toBe("reviewed");
  expect(
    restored.measurementLines.map((measurementLine) => ({
      status: measurementLine?.quotePreparationStatus,
      quoteId: measurementLine?.geconverteerdeOfferteId,
      quoteLineId: measurementLine?.geconverteerdeOfferteregelId
    }))
  ).toEqual([
    { status: "ready_for_quote", quoteId: undefined, quoteLineId: undefined },
    { status: "ready_for_quote", quoteId: undefined, quoteLineId: undefined }
  ]);
});

test("verstuurde trapofferte blijft accepteerbaar na latere cataloguswijzigingen", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteContext(t);
  const bundle = await insertStairBundle(t, ids);

  await t.mutation(api.portal.importMeasurementLinesToQuote, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId: String(ids.quoteId),
    lineIds: [bundle.materialLineId, bundle.laborLineId],
    startSortOrder: 1
  });

  const importedLines = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("quoteLines")
        .withIndex("by_quote", (q) => q.eq("tenantId", ids.tenantId).eq("quoteId", ids.quoteId))
        .collect()
    ).sort((left, right) => left.sortOrder - right.sortOrder)
  );
  for (const line of importedLines) {
    await t.mutation(api.portal.updateQuoteLine, {
      tenantSlug: "henke-wonen",
      actor,
      lineId: String(line._id),
      projectRuimteId: String(ids.projectRoomId),
      productId: String(line.productId),
      regelType: line.regelType,
      titel: line.titel,
      omschrijving: line.omschrijving,
      aantal: line.aantal,
      eenheid: line.eenheid,
      eenheidsprijsExBtw: line.eenheidsprijsExBtw,
      btwTarief: line.btwTarief,
      metadata: line.metadata
    });
  }
  await t.run((ctx) => ctx.db.patch(ids.serviceProductId, { status: "inactive" }));
  await expect(
    t.mutation(api.portal.updateQuoteStatus, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(ids.quoteId),
      status: "sent"
    })
  ).rejects.toThrow(/catalogusproduct.*actief/i);
  await t.run((ctx) => ctx.db.patch(ids.serviceProductId, { status: "active" }));

  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId: String(ids.quoteId),
    status: "sent"
  });

  await t.run((ctx) =>
    ctx.db.patch(ids.serviceProductId, {
      status: "inactive",
      attributen: {
        serviceMetadata: {
          family: "gewijzigd",
          covering: "tapijt",
          role: "other",
          sectionKey: "other"
        }
      }
    })
  );

  await expect(
    t.mutation(api.portal.updateQuoteStatus, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(ids.quoteId),
      status: "accepted"
    })
  ).resolves.toBe(ids.quoteId);
  expect((await t.run((ctx) => ctx.db.get(ids.quoteId)))?.status).toBe("accepted");
});

test("een gedeeltelijke trapbundel wordt atomair geweigerd", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteContext(t);
  const bundle = await insertStairBundle(t, ids);

  await expect(
    t.mutation(api.portal.importMeasurementLinesToQuote, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(ids.quoteId),
      lineIds: [bundle.materialLineId],
      startSortOrder: 1
    })
  ).rejects.toThrow(/bundel.*volledig/i);

  const { quoteLines, measurementLines } = await t.run(async (ctx) => ({
    quoteLines: await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) => q.eq("tenantId", ids.tenantId).eq("quoteId", ids.quoteId))
      .collect(),
    measurementLines: await Promise.all([
      ctx.db.get(bundle.materialLineId),
      ctx.db.get(bundle.laborLineId)
    ])
  }));
  expect(quoteLines).toHaveLength(0);
  expect(measurementLines.map((line) => line?.quotePreparationStatus)).toEqual([
    "ready_for_quote",
    "ready_for_quote"
  ]);
});

test("een trapbundel wordt geweigerd zolang een gekoppelde regel niet klaar staat", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteContext(t);
  const bundle = await insertStairBundle(t, ids, "draft");

  await expect(
    t.mutation(api.portal.importMeasurementLinesToQuote, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(ids.quoteId),
      lineIds: [bundle.materialLineId, bundle.laborLineId],
      startSortOrder: 1
    })
  ).rejects.toThrow(/alle gekoppelde regels.*klaar voor offerte/i);

  const quoteLines = await t.run((ctx) =>
    ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) => q.eq("tenantId", ids.tenantId).eq("quoteId", ids.quoteId))
      .collect()
  );
  expect(quoteLines).toHaveLength(0);
});

test("een inactief gekoppeld dienstproduct wordt niet als productloze dienstprijs vertrouwd", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteContext(t);
  const measurementLineId = await t.run(async (ctx) => {
    const now = Date.now();
    const id = await ctx.db.insert("measurementLines", {
      tenantId: ids.tenantId,
      inmetingId: ids.measurementId,
      ruimteId: ids.measurementRoomId,
      productGroep: "stairs",
      berekeningType: "stairs",
      invoer: { stairShape: "half_turn" },
      resultaat: { quoteQuantity: 1 },
      aantal: 1,
      eenheid: "stairs",
      offerteRegelType: "labor",
      quotePreparationStatus: "ready_for_quote",
      productId: ids.standaloneServiceProductId,
      productNaam: "Losse dienst",
      indicatieveEenheidsprijsExBtw: 1795,
      indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "stairs",
      indicatievePrijsSoort: "service_rule",
      indicatiefVastgelegdOp: now,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.patch(ids.standaloneServiceProductId, { status: "inactive" });
    return id;
  });

  const [quoteLineId] = await t.mutation(api.portal.importMeasurementLinesToQuote, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId: String(ids.quoteId),
    lineIds: [measurementLineId],
    startSortOrder: 1
  });
  const quoteLine = await t.run((ctx) => ctx.db.get(quoteLineId));

  expect(quoteLine?.productId).toBeUndefined();
  expect(quoteLine).toMatchObject({
    eenheidsprijsExBtw: 0,
    btwTarief: 0,
    metadata: {
      requiresManualProductReview: true,
      requiresManualPriceReview: true,
      requiresManualVatReview: true
    }
  });
});

test("een ready meetregel met bestaande conversiereferentie kan niet opnieuw worden geimporteerd", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteContext(t);
  const measurementLineId = await t.run(async (ctx) => {
    const now = Date.now();
    return ctx.db.insert("measurementLines", {
      tenantId: ids.tenantId,
      inmetingId: ids.measurementId,
      ruimteId: ids.measurementRoomId,
      productGroep: "stairs",
      berekeningType: "stairs",
      invoer: { stairShape: "half_turn" },
      resultaat: { quoteQuantity: 1 },
      aantal: 1,
      eenheid: "stairs",
      offerteRegelType: "labor",
      quotePreparationStatus: "ready_for_quote",
      productId: ids.serviceProductId,
      productNaam: "PVC trap halve draai",
      indicatieveEenheidsprijsExBtw: 1795,
      indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "stairs",
      indicatievePrijsSoort: "service_rule",
      indicatiefVastgelegdOp: now,
      geconverteerdeOfferteId: ids.quoteId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  await expect(
    t.mutation(api.portal.importMeasurementLinesToQuote, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(ids.quoteId),
      lineIds: [measurementLineId],
      startSortOrder: 1
    })
  ).rejects.toThrow(/nog niet klaar/i);

  const quoteLines = await t.run((ctx) =>
    ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) => q.eq("tenantId", ids.tenantId).eq("quoteId", ids.quoteId))
      .collect()
  );
  expect(quoteLines).toHaveLength(0);
});

test("geimporteerde trapbundel laat de verkoopeenheid niet naar een besteleenheid wijzigen", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteContext(t);
  const bundle = await insertStairBundle(t, ids);

  await t.mutation(api.portal.importMeasurementLinesToQuote, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId: String(ids.quoteId),
    lineIds: [bundle.materialLineId, bundle.laborLineId],
    startSortOrder: 1
  });

  const materialLine = await t.run(async (ctx) => {
    const lines = await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) => q.eq("tenantId", ids.tenantId).eq("quoteId", ids.quoteId))
      .collect();
    return lines.find((line) => line.metadata?.bundleRole === "material")!;
  });
  const update = (eenheid: string) =>
    t.mutation(api.portal.updateQuoteLine, {
      tenantSlug: "henke-wonen",
      actor,
      lineId: String(materialLine._id),
      projectRuimteId: String(ids.projectRoomId),
      productId: String(ids.materialProductId),
      regelType: "product" as const,
      titel: materialLine.titel,
      omschrijving: materialLine.omschrijving,
      aantal: 13,
      eenheid,
      eenheidsprijsExBtw: materialLine.eenheidsprijsExBtw,
      btwTarief: materialLine.btwTarief,
      metadata: materialLine.metadata
    });

  // Het product wordt per trede verkocht maar per pak van vier besteld. De offerte
  // blijft daarom 13 treden tonen; de inkooplaag zet dat later om naar vier pakken.
  await expect(update("pack")).rejects.toThrow(/verkoopeenheid/i);
  await expect(update("m2")).rejects.toThrow(/verkoopeenheid/i);
  await expect(update("step")).resolves.toBe(materialLine._id);

  expect(await t.run(async (ctx) => (await ctx.db.get(materialLine._id))?.eenheid)).toBe("step");
});

test("trapbundel weigert meerdere actieve dienstproducten met dezelfde vaste SKU", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteContext(t);
  const bundle = await insertStairBundle(t, ids);

  await t.run(async (ctx) => {
    const source = await ctx.db.get(ids.serviceProductId);
    if (!source) throw new Error("Testdienst ontbreekt.");
    const now = Date.now();
    await ctx.db.insert("products", {
      tenantId: ids.tenantId,
      categorieId: source.categorieId,
      naam: "Dubbele PVC trap halve draai",
      sku: "HW-DIENST-014",
      productAard: "service",
      eenheid: "stairs",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  await expect(
    t.mutation(api.portal.importMeasurementLinesToQuote, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(ids.quoteId),
      lineIds: [bundle.materialLineId, bundle.laborLineId],
      startSortOrder: 1
    })
  ).rejects.toThrow(/meerdere actieve dienstproducten.*HW-DIENST-014/i);
});

test("trapbundel vereist structurele dienstmetadata die bij vorm en rol past", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteContext(t);
  const bundle = await insertStairBundle(t, ids);

  await t.run((ctx) =>
    ctx.db.patch(ids.serviceProductId, {
      attributen: {
        serviceMetadata: {
          family: "flooring",
          covering: "pvc",
          shape: "half_turn",
          role: "base_labor",
          sectionKey: "traprenovatie"
        }
      }
    })
  );

  await expect(
    t.mutation(api.portal.importMeasurementLinesToQuote, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(ids.quoteId),
      lineIds: [bundle.materialLineId, bundle.laborLineId],
      startSortOrder: 1
    })
  ).rejects.toThrow(/mist passende traprenovatie-metadata/i);
});
