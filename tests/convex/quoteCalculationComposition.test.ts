import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const tenantSlug = "henke-wonen";
const adminExternalUserId = "dev-quote-calc-admin";
const actorFor = (externalUserId: string, actorTenantSlug = tenantSlug) => ({
  externalUserId,
  authzToken: `dev.actor.${actorTenantSlug}.${externalUserId}`
});
const adminActor = actorFor(adminExternalUserId);

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

async function seedQuoteCalculation(t: ReturnType<typeof convexTest>) {
  const now = Date.now();

  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: tenantSlug,
      naam: "Henke Wonen",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const otherTenantId = await ctx.db.insert("tenants", {
      slug: "andere-tenant",
      naam: "Andere tenant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const roles = [
      [adminExternalUserId, "admin"],
      ["dev-quote-calc-user", "user"],
      ["dev-quote-calc-editor", "editor"],
      ["dev-quote-calc-viewer", "viewer"]
    ] as const;
    for (const [externalUserId, role] of roles) {
      await ctx.db.insert("users", {
        tenantId,
        externalUserId,
        email: `${externalUserId}@example.nl`,
        role,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }
    await ctx.db.insert("users", {
      tenantId: otherTenantId,
      externalUserId: "dev-other-admin",
      email: "admin@andere-tenant.nl",
      role: "admin",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const klantId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Calculatieklant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const andereKlantId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Andere klant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId,
      klantId,
      titel: "Offertecalculatie",
      status: "quote_draft",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const quoteId = await ctx.db.insert("quotes", {
      tenantId,
      projectId,
      klantId,
      offertenummer: "OFF-CALC-1",
      titel: "Offerte met rekenhulp",
      status: "draft",
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const linkedProjectRoomId = await ctx.db.insert("projectRooms", {
      tenantId,
      projectId,
      naam: "Woonkamer",
      breedteCm: 400,
      lengteCm: 500,
      oppervlakteM2: 20,
      omtrekMeter: 18,
      sortOrder: 1,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const foreignProjectId = await ctx.db.insert("projects", {
      tenantId,
      klantId,
      titel: "Ander project",
      status: "quote_draft",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const foreignQuoteId = await ctx.db.insert("quotes", {
      tenantId,
      projectId: foreignProjectId,
      klantId,
      offertenummer: "OFF-CALC-2",
      titel: "Andere offerte",
      status: "draft",
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const foreignProjectRoomId = await ctx.db.insert("projectRooms", {
      tenantId,
      projectId: foreignProjectId,
      naam: "Vreemde ruimte",
      sortOrder: 1,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const categoryId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Vloeren",
      slug: "vloeren",
      productGroep: "flooring",
      sortOrder: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const stairCategoryId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Traprenovatie",
      slug: "traprenovatie",
      productGroep: "stairs",
      sortOrder: 2,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const floorProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: categoryId,
      naam: "PVC vloer Natural Oak",
      sku: "PVC-FLOOR-1",
      productAard: "standard",
      eenheid: "m2",
      verkoopEenheid: "m2",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const stairMaterialProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: stairCategoryId,
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
    const stairServiceProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: stairCategoryId,
      naam: "PVC trap halve draai",
      sku: "HW-DIENST-014",
      productAard: "service",
      eenheid: "stairs",
      verkoopEenheid: "stairs",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    return {
      tenantId,
      otherTenantId,
      klantId,
      andereKlantId,
      projectId,
      quoteId,
      linkedProjectRoomId,
      foreignProjectId,
      foreignQuoteId,
      foreignProjectRoomId,
      floorProductId,
      stairMaterialProductId,
      stairServiceProductId
    };
  });
}

async function ensureContext(
  t: ReturnType<typeof convexTest>,
  quoteId: string,
  projectRuimteId?: any,
  actor = adminActor
) {
  return await t.mutation(api.offertes.core.ensureQuoteCalculationContext, {
    tenantSlug,
    actor,
    quoteId,
    projectRuimteId
  });
}

const floorRule = (roomId: any, productId: any) => ({
  ruimteId: roomId,
  productGroep: "flooring" as const,
  berekeningType: "area" as const,
  invoer: { areaM2: 20, wastePercent: 5 },
  resultaat: { quoteQuantityM2: 12.5 },
  snijverliesPct: 5,
  aantal: 12.5,
  eenheid: "m2",
  notities: "Direct uit de offerte berekend.",
  offerteRegelType: "product" as const,
  productId,
  productNaam: "PVC vloer Natural Oak",
  indicatieveEenheidsprijsExBtw: 40,
  indicatiefBtwTarief: 21,
  indicatievePrijsEenheid: "m2",
  indicatievePrijsSoort: "product"
});

const pvcTechnicalContext = {
  recipeKey: "pvc_stair" as const,
  recipeVersion: 1 as const,
  covering: "pvc" as const,
  stairShape: "half_turn" as const,
  stairConstruction: "closed" as const,
  treadCount: 13,
  riserCount: 13,
  doubleTreadCount: 0,
  stripLengthM: 0.9
};

function pvcBundleRules(
  roomId: any,
  materialProductId: any,
  serviceProductId: any,
  materialQuantity = 13
) {
  const bundleId = "offerte-pvc-trap-1";
  return [
    {
      ruimteId: roomId,
      productGroep: "stairs" as const,
      berekeningType: "stairs" as const,
      invoer: {
        ...pvcTechnicalContext,
        quantityMode: "calculated",
        calculatedQuantity: 13
      },
      resultaat: { quoteQuantity: materialQuantity },
      aantal: materialQuantity,
      eenheid: "step",
      offerteRegelType: "product" as const,
      bundleId,
      bundleType: "stair_renovation" as const,
      bundleRole: "material" as const,
      sectionKey: "traprenovatie",
      productId: materialProductId,
      productNaam: "PVC traptrede Natural Oak",
      indicatieveEenheidsprijsExBtw: 49,
      indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "step",
      indicatievePrijsSoort: "product"
    },
    {
      ruimteId: roomId,
      productGroep: "stairs" as const,
      berekeningType: "stairs" as const,
      invoer: pvcTechnicalContext,
      resultaat: { quoteQuantity: 1 },
      aantal: 1,
      eenheid: "stairs",
      offerteRegelType: "labor" as const,
      bundleId,
      bundleType: "stair_renovation" as const,
      bundleRole: "labor" as const,
      sectionKey: "traprenovatie",
      productId: serviceProductId,
      productNaam: "PVC trap halve draai",
      indicatieveEenheidsprijsExBtw: 1795,
      indicatiefBtwTarief: 21,
      indicatievePrijsEenheid: "stairs",
      indicatievePrijsSoort: "service_rule"
    }
  ];
}

test("context is idempotent, planning-neutral and congruent with the newest project measurement", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteCalculation(t);
  const before = await t.run(async (ctx) => {
    const oldDraftId = await ctx.db.insert("measurements", {
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      klantId: ids.klantId,
      status: "draft",
      aangemaaktOp: 1,
      gewijzigdOp: 1
    });
    const newestReviewedId = await ctx.db.insert("measurements", {
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      klantId: ids.klantId,
      status: "reviewed",
      aangemaaktOp: 2,
      gewijzigdOp: 2
    });
    return {
      oldDraftId,
      newestReviewedId,
      project: await ctx.db.get(ids.projectId),
      workflowEvents: await ctx.db
        .query("projectWorkflowEvents")
        .withIndex("by_project", (q) =>
          q.eq("tenantId", ids.tenantId).eq("projectId", ids.projectId)
        )
        .collect()
    };
  });

  const first = await ensureContext(t, String(ids.quoteId));
  expect(first.createdMeasurement).toBe(true);
  expect(first.createdMeasurementRoom).toBe(true);
  expect(first.measurementId).not.toBe(before.oldDraftId);
  expect(first.measurementId).not.toBe(before.newestReviewedId);

  const operationalWorkspace = await t.query(api.projecten.measurements.getForProject, {
    tenantId: ids.tenantId,
    projectId: ids.projectId,
    actor: adminActor
  });
  expect(operationalWorkspace.measurement?._id).toBe(before.newestReviewedId);
  expect(operationalWorkspace.measurement?.status).toBe("reviewed");

  const quoteWorkspace = await t.query(api.projecten.measurements.getForProject, {
    tenantId: ids.tenantId,
    projectId: ids.projectId,
    actor: adminActor,
    quoteCalculationQuoteId: ids.quoteId
  });
  expect(quoteWorkspace.measurement?._id).toBe(first.measurementId);
  expect(quoteWorkspace.measurement?.contextQuoteId).toBe(ids.quoteId);
  expect(quoteWorkspace.rooms.map((room) => room._id)).toContain(first.measurementRoomId);

  const second = await ensureContext(t, String(ids.quoteId));
  expect(second).toEqual({
    ...first,
    createdMeasurement: false,
    createdMeasurementRoom: false
  });

  const after = await t.run(async (ctx) => ({
    project: await ctx.db.get(ids.projectId),
    workflowEvents: await ctx.db
      .query("projectWorkflowEvents")
      .withIndex("by_project", (q) => q.eq("tenantId", ids.tenantId).eq("projectId", ids.projectId))
      .collect(),
    projectRooms: await ctx.db
      .query("projectRooms")
      .withIndex("by_project", (q) => q.eq("tenantId", ids.tenantId).eq("projectId", ids.projectId))
      .collect()
  }));
  expect(after.project?.status).toBe(before.project?.status);
  expect(after.project?.inmeetdatum).toBe(before.project?.inmeetdatum);
  expect(after.workflowEvents).toEqual(before.workflowEvents);
  expect(first.projectRoomId).toBe(ids.linkedProjectRoomId);
  expect(after.projectRooms.map((room) => room.naam)).toEqual(["Woonkamer"]);
  expect(after.projectRooms.some((room) => room.naam === "Offertecalculatie")).toBe(false);
});

test("a project without real rooms gets an empty quote context without fake rooms", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteCalculation(t);
  await t.run((ctx) => ctx.db.delete(ids.linkedProjectRoomId));

  const first = await ensureContext(t, String(ids.quoteId));
  expect(first.createdMeasurement).toBe(true);
  expect(first.createdMeasurementRoom).toBe(false);
  expect(first.measurementRoomId).toBeUndefined();
  expect(first.projectRoomId).toBeUndefined();

  const workspace = await t.query(api.projecten.measurements.getForProject, {
    tenantId: ids.tenantId,
    projectId: ids.projectId,
    actor: adminActor,
    quoteCalculationQuoteId: ids.quoteId
  });
  expect(workspace.measurement?._id).toBe(first.measurementId);
  expect(workspace.rooms).toEqual([]);

  const second = await ensureContext(t, String(ids.quoteId));
  expect(second.measurementId).toBe(first.measurementId);
  expect(second.createdMeasurement).toBe(false);
  expect(second.createdMeasurementRoom).toBe(false);

  const projectRooms = await t.run((ctx) =>
    ctx.db
      .query("projectRooms")
      .withIndex("by_project", (q) => q.eq("tenantId", ids.tenantId).eq("projectId", ids.projectId))
      .collect()
  );
  expect(projectRooms).toEqual([]);
});
test("context can bind an explicit project room and allows user, editor and admin but not viewer", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteCalculation(t);

  await expect(
    ensureContext(
      t,
      String(ids.quoteId),
      ids.linkedProjectRoomId,
      actorFor("dev-quote-calc-viewer")
    )
  ).rejects.toThrow(/geen rechten/i);

  const userContext = await ensureContext(
    t,
    String(ids.quoteId),
    ids.linkedProjectRoomId,
    actorFor("dev-quote-calc-user")
  );
  await expect(
    t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
      tenantSlug,
      actor: actorFor("dev-quote-calc-viewer"),
      quoteId: String(ids.quoteId),
      measurementId: userContext.measurementId,
      startSortOrder: 1,
      regels: []
    })
  ).rejects.toThrow(/geen rechten/i);
  const editorContext = await ensureContext(
    t,
    String(ids.quoteId),
    ids.linkedProjectRoomId,
    actorFor("dev-quote-calc-editor")
  );
  const adminContext = await ensureContext(
    t,
    String(ids.quoteId),
    ids.linkedProjectRoomId,
    adminActor
  );

  expect(editorContext.projectRoomId).toBe(ids.linkedProjectRoomId);
  expect(adminContext.measurementRoomId).toBe(userContext.measurementRoomId);
  const room = await t.run((ctx) => ctx.db.get(userContext.measurementRoomId!));
  expect(room).toMatchObject({
    naam: "Woonkamer",
    breedteM: 4,
    lengteM: 5,
    projectRuimteId: ids.linkedProjectRoomId
  });
});

test("ordinary calculation creates converted measurement and quote lines atomically with snapshots and safe sort order", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteCalculation(t);
  const context = await ensureContext(t, String(ids.quoteId));

  await t.run((ctx) =>
    ctx.db.insert("quoteLines", {
      tenantId: ids.tenantId,
      quoteId: ids.quoteId,
      regelType: "text",
      titel: "Bestaande kop",
      aantal: 0,
      eenheid: "piece",
      eenheidsprijsExBtw: 0,
      btwTarief: 0,
      regelTotaalExBtw: 0,
      regelBtwTotaal: 0,
      regelTotaalInclBtw: 0,
      sortOrder: 7,
      aangemaaktOp: Date.now(),
      gewijzigdOp: Date.now()
    })
  );

  const result = await t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
    tenantSlug,
    actor: actorFor("dev-quote-calc-user"),
    quoteId: String(ids.quoteId),
    measurementId: context.measurementId,
    startSortOrder: 1,
    regels: [floorRule(context.measurementRoomId, ids.floorProductId)]
  });
  expect(result.count).toBe(1);

  const saved = await t.run(async (ctx) => ({
    measurement: await ctx.db.get(context.measurementId),
    measurementLine: await ctx.db.get(result.measurementLineIds[0]),
    quoteLine: await ctx.db.get(result.quoteLineIds[0]),
    quote: await ctx.db.get(ids.quoteId)
  }));
  expect(saved.measurement?.status).toBe("draft");
  expect(saved.measurementLine).toMatchObject({
    quotePreparationStatus: "converted",
    geconverteerdeOfferteId: ids.quoteId,
    geconverteerdeOfferteregelId: result.quoteLineIds[0],
    aantal: 12.5,
    eenheid: "m2"
  });
  expect(saved.quoteLine).toMatchObject({
    projectRuimteId: context.projectRoomId,
    productId: ids.floorProductId,
    titel: "PVC vloer Natural Oak - Woonkamer",
    eenheidsprijsExBtw: 40,
    btwTarief: 21,
    regelTotaalExBtw: 500,
    regelBtwTotaal: 105,
    regelTotaalInclBtw: 605,
    sortOrder: 8,
    metadata: {
      source: "measurement",
      measurementId: context.measurementId,
      measurementLineId: result.measurementLineIds[0],
      measurementRoomId: context.measurementRoomId,
      productGroup: "flooring",
      calculationType: "area",
      wastePercent: 5,
      isIndicative: true,
      productId: ids.floorProductId,
      productName: "PVC vloer Natural Oak",
      indicativePriceType: "product",
      indicativePriceUnit: "m2",
      requiresManualProductReview: false,
      requiresManualPriceReview: true,
      requiresManualVatReview: false
    }
  });
  expect(saved.quote).toMatchObject({
    subtotaalExBtw: 500,
    btwTotaal: 105,
    totaalInclBtw: 605
  });
});

test("a complete PVC stair calculator bundle is composed with immutable recipe and catalog snapshots", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteCalculation(t);
  const context = await ensureContext(t, String(ids.quoteId));

  const result = await t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
    tenantSlug,
    actor: adminActor,
    quoteId: String(ids.quoteId),
    measurementId: context.measurementId,
    startSortOrder: 3,
    regels: pvcBundleRules(
      context.measurementRoomId,
      ids.stairMaterialProductId,
      ids.stairServiceProductId
    )
  });
  expect(result.count).toBe(2);

  const saved = await t.run(async (ctx) => ({
    measurementLines: await Promise.all(result.measurementLineIds.map((id) => ctx.db.get(id))),
    quoteLines: await Promise.all(result.quoteLineIds.map((id) => ctx.db.get(id))),
    quote: await ctx.db.get(ids.quoteId)
  }));
  expect(saved.measurementLines.every((line) => line?.quotePreparationStatus === "converted")).toBe(
    true
  );
  expect(saved.quoteLines.map((line) => line?.metadata?.bundleRole)).toEqual(["material", "labor"]);
  expect(saved.quoteLines[0]?.metadata).toMatchObject({
    recipeKey: "pvc_stair",
    recipeVersion: 1,
    covering: "pvc",
    stairShape: "half_turn",
    stairConstruction: "closed",
    treadCount: 13,
    calculatedQuantity: 13,
    quantityMode: "calculated",
    stairMaterialFamily: "stair_renovation",
    stairMaterialCovering: "pvc",
    stairMaterialComponentRole: "standard_tread",
    stairMaterialIsPrimary: true,
    stairMaterialPiecesPerPack: 4,
    stairMaterialOrderUnit: "pack"
  });
  expect(saved.quoteLines[1]?.metadata).toMatchObject({
    stairServiceSku: "HW-DIENST-014",
    stairServiceFamily: "stair_renovation",
    stairServiceCovering: "pvc",
    stairServiceShape: "half_turn",
    stairServiceRole: "base_labor"
  });
  expect(saved.quote).toMatchObject({
    subtotaalExBtw: 2432,
    btwTotaal: 510.72,
    totaalInclBtw: 2942.72
  });
});

test("deleting one composed PVC line removes the whole context bundle and allows recomposition", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteCalculation(t);
  const context = await ensureContext(t, String(ids.quoteId));
  const regels = pvcBundleRules(
    context.measurementRoomId,
    ids.stairMaterialProductId,
    ids.stairServiceProductId
  );

  const first = await t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
    tenantSlug,
    actor: adminActor,
    quoteId: String(ids.quoteId),
    measurementId: context.measurementId,
    startSortOrder: 1,
    regels
  });
  await t.mutation(api.offertes.core.deleteQuoteLine, {
    tenantSlug,
    actor: adminActor,
    lineId: String(first.quoteLineIds[0])
  });

  const afterDelete = await t.run(async (ctx) => ({
    measurementLines: await ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", ids.tenantId).eq("inmetingId", context.measurementId)
      )
      .collect(),
    quoteLines: await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) => q.eq("tenantId", ids.tenantId).eq("quoteId", ids.quoteId))
      .collect(),
    quote: await ctx.db.get(ids.quoteId)
  }));
  expect(afterDelete.measurementLines).toHaveLength(0);
  expect(afterDelete.quoteLines).toHaveLength(0);
  expect(afterDelete.quote?.totaalInclBtw).toBe(0);

  const recomposed = await t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
    tenantSlug,
    actor: adminActor,
    quoteId: String(ids.quoteId),
    measurementId: context.measurementId,
    startSortOrder: 1,
    regels
  });
  expect(recomposed.count).toBe(2);
  expect(recomposed.measurementLineIds).not.toEqual(first.measurementLineIds);
});
test("an incomplete or stale PVC bundle rolls back every measurement and quote insert", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteCalculation(t);
  const context = await ensureContext(t, String(ids.quoteId));
  const [materialOnly] = pvcBundleRules(
    context.measurementRoomId,
    ids.stairMaterialProductId,
    ids.stairServiceProductId
  );

  await expect(
    t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
      tenantSlug,
      actor: adminActor,
      quoteId: String(ids.quoteId),
      measurementId: context.measurementId,
      startSortOrder: 1,
      regels: [materialOnly]
    })
  ).rejects.toThrow(/arbeidsregel/i);

  const afterIncomplete = await t.run(async (ctx) => ({
    measurementLines: await ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", ids.tenantId).eq("inmetingId", context.measurementId)
      )
      .collect(),
    quoteLines: await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) => q.eq("tenantId", ids.tenantId).eq("quoteId", ids.quoteId))
      .collect()
  }));
  expect(afterIncomplete.measurementLines).toHaveLength(0);
  expect(afterIncomplete.quoteLines).toHaveLength(0);

  await expect(
    t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
      tenantSlug,
      actor: adminActor,
      quoteId: String(ids.quoteId),
      measurementId: context.measurementId,
      startSortOrder: 1,
      regels: pvcBundleRules(
        context.measurementRoomId,
        ids.stairMaterialProductId,
        ids.stairServiceProductId,
        12
      )
    })
  ).rejects.toThrow(/berekende hoeveelheid/i);

  const afterStale = await t.run(async (ctx) => ({
    measurementLines: await ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", ids.tenantId).eq("inmetingId", context.measurementId)
      )
      .collect(),
    quote: await ctx.db.get(ids.quoteId)
  }));
  expect(afterStale.measurementLines).toHaveLength(0);
  expect(afterStale.quote).toMatchObject({
    subtotaalExBtw: 0,
    btwTotaal: 0,
    totaalInclBtw: 0
  });
});

test("invalid units, prices, VAT and timestamps roll back without partial lines", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteCalculation(t);
  const context = await ensureContext(t, String(ids.quoteId));
  const valid = floorRule(context.measurementRoomId, ids.floorProductId);
  const invalidRules = [
    { ...valid, eenheid: "   " },
    { ...valid, indicatieveEenheidsprijsExBtw: -1 },
    { ...valid, indicatieveEenheidsprijsExBtw: Number.NaN },
    { ...valid, indicatieveEenheidsprijsExBtw: Number.POSITIVE_INFINITY },
    { ...valid, indicatiefBtwTarief: -1 },
    { ...valid, indicatiefBtwTarief: 101 },
    { ...valid, indicatiefBtwTarief: Number.POSITIVE_INFINITY },
    { ...valid, indicatiefVastgelegdOp: -1 },
    { ...valid, indicatiefVastgelegdOp: Number.POSITIVE_INFINITY }
  ];

  for (const regel of invalidRules) {
    await expect(
      t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
        tenantSlug,
        actor: adminActor,
        quoteId: String(ids.quoteId),
        measurementId: context.measurementId,
        startSortOrder: 1,
        regels: [regel]
      })
    ).rejects.toThrow();
  }

  const saved = await t.run(async (ctx) => ({
    measurementLines: await ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", ids.tenantId).eq("inmetingId", context.measurementId)
      )
      .collect(),
    quoteLines: await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) => q.eq("tenantId", ids.tenantId).eq("quoteId", ids.quoteId))
      .collect()
  }));
  expect(saved.measurementLines).toHaveLength(0);
  expect(saved.quoteLines).toHaveLength(0);
});
test("project, room, tenant and customer isolation rejects mismatched calculation contexts", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteCalculation(t);
  const main = await ensureContext(t, String(ids.quoteId));
  const foreign = await ensureContext(t, String(ids.foreignQuoteId), ids.foreignProjectRoomId);

  const sameProjectQuoteId = await t.run((ctx) =>
    ctx.db.insert("quotes", {
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      klantId: ids.klantId,
      offertenummer: "OFF-CALC-SIBLING",
      titel: "Tweede offerte op hetzelfde project",
      status: "draft",
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      aangemaaktOp: Date.now(),
      gewijzigdOp: Date.now()
    })
  );
  const sibling = await ensureContext(t, String(sameProjectQuoteId));
  expect(sibling.measurementId).not.toBe(main.measurementId);
  await expect(
    t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
      tenantSlug,
      actor: adminActor,
      quoteId: String(sameProjectQuoteId),
      measurementId: main.measurementId,
      startSortOrder: 1,
      regels: [floorRule(main.measurementRoomId, ids.floorProductId)]
    })
  ).rejects.toThrow(/inmeting niet gevonden/i);
  await expect(
    t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
      tenantSlug,
      actor: adminActor,
      quoteId: String(ids.quoteId),
      measurementId: main.measurementId,
      startSortOrder: 1,
      regels: [floorRule(foreign.measurementRoomId, ids.floorProductId)]
    })
  ).rejects.toThrow(/meetruimte niet gevonden/i);

  await expect(
    t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
      tenantSlug,
      actor: adminActor,
      quoteId: String(ids.quoteId),
      measurementId: foreign.measurementId,
      startSortOrder: 1,
      regels: [floorRule(foreign.measurementRoomId, ids.floorProductId)]
    })
  ).rejects.toThrow(/inmeting niet gevonden/i);

  await expect(
    t.mutation(api.offertes.core.ensureQuoteCalculationContext, {
      tenantSlug: "andere-tenant",
      actor: actorFor("dev-other-admin", "andere-tenant"),
      quoteId: String(ids.quoteId)
    })
  ).rejects.toThrow(/offerte niet gevonden/i);

  await expect(ensureContext(t, String(ids.quoteId), ids.foreignProjectRoomId)).rejects.toThrow(
    /ruimte niet gevonden/i
  );

  await t.run((ctx) => ctx.db.patch(ids.quoteId, { klantId: ids.andereKlantId }));
  await expect(ensureContext(t, String(ids.quoteId))).rejects.toThrow(/project.*niet geldig/i);

  const mainLines = await t.run((ctx) =>
    ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", ids.tenantId).eq("inmetingId", main.measurementId)
      )
      .collect()
  );
  expect(mainLines).toHaveLength(0);
});

test("non-draft quotes and non-draft measurements cannot be changed through calculation tools", async () => {
  const t = convexTest(schema, modules);
  const ids = await seedQuoteCalculation(t);
  const context = await ensureContext(t, String(ids.quoteId));

  await t.run((ctx) => ctx.db.patch(ids.quoteId, { status: "sent" }));
  await expect(ensureContext(t, String(ids.quoteId))).rejects.toThrow(/conceptoffertes/i);
  await expect(
    t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
      tenantSlug,
      actor: adminActor,
      quoteId: String(ids.quoteId),
      measurementId: context.measurementId,
      startSortOrder: 1,
      regels: [floorRule(context.measurementRoomId, ids.floorProductId)]
    })
  ).rejects.toThrow(/conceptoffertes/i);

  await t.run(async (ctx) => {
    await ctx.db.patch(ids.quoteId, { status: "draft" });
    await ctx.db.patch(context.measurementId, { status: "reviewed" });
  });
  await expect(
    t.mutation(api.offertes.core.composeMeasurementLinesIntoQuote, {
      tenantSlug,
      actor: adminActor,
      quoteId: String(ids.quoteId),
      measurementId: context.measurementId,
      startSortOrder: 1,
      regels: [floorRule(context.measurementRoomId, ids.floorProductId)]
    })
  ).rejects.toThrow(/concept-inmeting/i);
});
