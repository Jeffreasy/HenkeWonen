import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import {
  calculatePvcStairComponentQuantity,
  validatePvcStairRecipeInput
} from "../../src/lib/quotes/pvcStairCalculator";

// convex-test laadt de functie-modules; tests staan buiten convex/, dus expliciet de glob.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

async function seedMeasurement(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
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
      weergaveNaam: "Testklant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId,
      klantId,
      titel: "Testproject",
      status: "lead",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const categorieId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Tapijt",
      slug: "tapijt",
      sortOrder: 0,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const stairCategorieId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Traprenovatie",
      slug: "traprenovatie",
      productGroep: "stairs",
      sortOrder: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const productId = await ctx.db.insert("products", {
      tenantId,
      categorieId,
      naam: "Tapijt X",
      productAard: "standard",
      eenheid: "m2",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const stairMaterialProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: stairCategorieId,
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
    const stairSecondPrimaryProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: stairCategorieId,
      naam: "PVC traptrede Smoky Oak",
      sku: "563716-SMOKY-OAK",
      productAard: "standard",
      eenheid: "step",
      verkoopEenheid: "step",
      bestelEenheid: "pack",
      stuksPerPak: 4,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const stairAccessoryProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: stairCategorieId,
      naam: "PVC trap tool",
      sku: "486700-TOOL",
      productAard: "standard",
      eenheid: "pack",
      verkoopEenheid: "pack",
      bestelEenheid: "pack",
      stuksPerPak: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const stairDoubleTreadProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: stairCategorieId,
      naam: "PVC dubbele traptrede Natural Oak",
      sku: "564652-NATURAL-OAK",
      productAard: "standard",
      eenheid: "pack",
      verkoopEenheid: "pack",
      bestelEenheid: "pack",
      stuksPerPak: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const stairProfileLengthProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: stairCategorieId,
      naam: "PVC trap profiel 3 meter",
      sku: "560714-PROFILE-3M",
      productAard: "standard",
      eenheid: "m1",
      verkoopEenheid: "m1",
      bestelEenheid: "pack",
      stuksPerPak: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const wrongCategoryPrimaryProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId,
      naam: "SKU-collisie buiten trapcategorie",
      sku: "563538-COLLISION",
      productAard: "standard",
      eenheid: "step",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const serviceProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: stairCategorieId,
      naam: "PVC trap halve draai",
      sku: "HW-DIENST-014",
      productAard: "service",
      eenheid: "piece",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const metadataGuidedServiceProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: stairCategorieId,
      naam: "PVC trapdienst op metadata",
      sku: "CUSTOM-STAIR-SERVICE",
      productAard: "service",
      attributen: {
        serviceMetadata: {
          family: "stair_renovation",
          covering: "pvc",
          shape: "half_turn",
          role: "base_labor",
          sectionKey: "traprenovatie"
        }
      },
      eenheid: "piece",
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
      eenheid: "piece",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const inmetingId = await ctx.db.insert("measurements", {
      tenantId,
      projectId,
      klantId,
      status: "draft",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const makeRoom = async (naam: string, inmeting = inmetingId) => {
      const projectRuimteId = await ctx.db.insert("projectRooms", {
        tenantId,
        projectId,
        naam,
        sortOrder: 0,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      return ctx.db.insert("measurementRooms", {
        tenantId,
        inmetingId: inmeting,
        projectRuimteId,
        naam,
        oppervlakteM2: 20,
        omtrekM: 18,
        sortOrder: 0,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    };
    const woonkamerId = await makeRoom("Woonkamer");
    const keukenId = await makeRoom("Keuken");

    // Tweede inmeting met eigen ruimte — die ruimte mag NIET in de eerste inmeting belanden.
    const otherInmetingId = await ctx.db.insert("measurements", {
      tenantId,
      projectId,
      klantId,
      status: "draft",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const foreignRoomId = await makeRoom("Vreemde ruimte", otherInmetingId);

    return {
      tenantId,
      inmetingId,
      productId,
      serviceProductId,
      woonkamerId,
      metadataGuidedServiceProductId,
      standaloneServiceProductId,
      stairMaterialProductId,
      stairSecondPrimaryProductId,
      stairAccessoryProductId,
      keukenId,
      foreignRoomId,
      wrongCategoryPrimaryProductId,
      stairDoubleTreadProductId,
      stairProfileLengthProductId
    };
  });
}

const floorLine = (ruimteId: any, productId: any) => ({
  ruimteId,
  productGroep: "flooring" as const,
  berekeningType: "area" as const,
  invoer: { areaM2: 20, wastePercent: 3 },
  resultaat: { quoteQuantityM2: 20.6 },
  snijverliesPct: 3,
  aantal: 20.6,
  eenheid: "m2",
  offerteRegelType: "product" as const,
  productId,
  productNaam: "Tapijt X",
  indicatieveEenheidsprijsExBtw: 35.9
});

// Raambekleding-matrix: productloze regel met een eigen richtprijs-snapshot ("matrix").
const matrixLine = (ruimteId: any) => ({
  ruimteId,
  productGroep: "curtains" as const,
  berekeningType: "matrix" as const,
  invoer: {
    source: "raambekleding-matrix",
    productToolSleutel: "raambekleding",
    bronBlad: "50 mm",
    prijsgroep: "PRIJSGROEP 0",
    breedteCm: 120,
    hoogteCm: 150,
    matchedWidthCm: 120,
    matchedHeightCm: 160,
    quantity: 2
  },
  resultaat: {
    unitPriceExVat: 324,
    matchedWidthCm: 120,
    matchedHeightCm: 160,
    quantity: 2,
    outOfRange: false,
    isIndicative: true
  },
  aantal: 2,
  eenheid: "piece",
  offerteRegelType: "product" as const,
  productNaam: "Raambekleding 50 mm – PRIJSGROEP 0 – 120×160 cm",
  indicatieveEenheidsprijsExBtw: 324,
  indicatiefBtwTarief: 21,
  indicatievePrijsEenheid: "piece",
  indicatievePrijsSoort: "matrix"
});

const serviceLine = (ruimteId: any) => ({
  ruimteId,
  productGroep: "other" as const,
  berekeningType: "area" as const,
  invoer: { areaM2: 20 },
  resultaat: { quoteQuantityM2: 20 },
  aantal: 20,
  eenheid: "m2",
  offerteRegelType: "service" as const,
  productNaam: "Legkosten",
  indicatieveEenheidsprijsExBtw: 15.95,
  indicatiefBtwTarief: 21,
  indicatievePrijsEenheid: "m2",
  indicatievePrijsSoort: "service_rule"
});
const pvcStairContext = {
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

function stairBundleLines(
  seeded: Awaited<ReturnType<typeof seedMeasurement>>,
  bundleId: string,
  options: {
    technical?: Record<string, unknown>;
    materialQuantity?: number;
    calculatedQuantity?: number;
    quantityMode?: "calculated" | "manual_override";
    quantityOverrideReason?: string;
    serviceQuantity?: number;
  } = {}
) {
  const technical = { ...pvcStairContext, ...options.technical };
  const materialQuantity = options.materialQuantity ?? 13;
  return [
    {
      ruimteId: seeded.woonkamerId,
      productGroep: "stairs" as const,
      berekeningType: "stairs" as const,
      invoer: {
        ...technical,
        quantityMode: options.quantityMode ?? ("calculated" as const),
        calculatedQuantity: options.calculatedQuantity ?? 13,
        ...(options.quantityOverrideReason
          ? { quantityOverrideReason: options.quantityOverrideReason }
          : {})
      },
      resultaat: { quoteQuantity: materialQuantity },
      aantal: materialQuantity,
      eenheid: "step",
      offerteRegelType: "product" as const,
      productId: seeded.stairMaterialProductId,
      bundleId,
      bundleType: "stair_renovation" as const,
      bundleRole: "material" as const,
      sectionKey: "traprenovatie"
    },
    {
      ruimteId: seeded.woonkamerId,
      productGroep: "stairs" as const,
      berekeningType: "stairs" as const,
      invoer: technical,
      resultaat: { quoteQuantity: options.serviceQuantity ?? 1 },
      aantal: options.serviceQuantity ?? 1,
      eenheid: "piece",
      offerteRegelType: "labor" as const,
      productId: seeded.serviceProductId,
      bundleId,
      bundleType: "stair_renovation" as const,
      bundleRole: "labor" as const,
      sectionKey: "traprenovatie"
    }
  ];
}

test("bulk voegt één product op meerdere ruimtes + een dienst toe", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);

  const result = await t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
    tenantId: seeded.tenantId,
    actor,
    inmetingId: seeded.inmetingId,
    regels: [
      floorLine(seeded.woonkamerId, seeded.productId),
      floorLine(seeded.keukenId, seeded.productId),
      serviceLine(seeded.woonkamerId)
    ]
  });

  expect(result.count).toBe(3);
  expect(result.lineIds).toHaveLength(3);

  const lines = await t.run(async (ctx) =>
    ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", seeded.tenantId).eq("inmetingId", seeded.inmetingId)
      )
      .collect()
  );
  expect(lines).toHaveLength(3);

  const woonkamerLines = lines.filter((l) => l.ruimteId === seeded.woonkamerId);
  expect(woonkamerLines).toHaveLength(2); // vloer + dienst
  const productLine = lines.find((l) => l.productId === seeded.productId);
  expect(productLine?.aantal).toBe(20.6);
  expect(productLine?.productNaam).toBe("Tapijt X");
  const dienst = lines.find((l) => l.offerteRegelType === "service");
  expect(dienst?.aantal).toBe(20);
  expect(dienst?.indicatieveEenheidsprijsExBtw).toBe(15.95); // snapshot bewaard zonder product
  expect(dienst?.productId).toBeUndefined();
  expect(dienst?.productNaam).toBe("Legkosten");
  expect(dienst?.indicatievePrijsSoort).toBe("service_rule");
});

test("bulk bewaart een productloze raambekleding-matrix-regel met richtprijs-snapshot", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);

  const result = await t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
    tenantId: seeded.tenantId,
    actor,
    inmetingId: seeded.inmetingId,
    regels: [matrixLine(seeded.woonkamerId)]
  });
  expect(result.count).toBe(1);

  const lines = await t.run(async (ctx) =>
    ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", seeded.tenantId).eq("inmetingId", seeded.inmetingId)
      )
      .collect()
  );
  expect(lines).toHaveLength(1);

  const line = lines[0];
  expect(line.productId).toBeUndefined(); // productloos: geen catalogusproduct
  expect(line.berekeningType).toBe("matrix");
  expect(line.eenheid).toBe("piece");
  expect(line.aantal).toBe(2);
  // Snapshot bewaard ook zonder product (keepSnapshot via indicatieveEenheidsprijsExBtw).
  expect(line.indicatievePrijsSoort).toBe("matrix");
  expect(line.indicatieveEenheidsprijsExBtw).toBe(324);
  expect(line.indicatievePrijsEenheid).toBe("piece");
  expect(line.productNaam).toBe("Raambekleding 50 mm – PRIJSGROEP 0 – 120×160 cm");
});

test("bulk weigert een ruimte die bij een andere inmeting hoort", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: [floorLine(seeded.foreignRoomId, seeded.productId)]
    })
  ).rejects.toThrow(/meetruimte niet gevonden/i);
});

test("bulk weigert een ongeldige hoeveelheid", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: [{ ...serviceLine(seeded.woonkamerId), aantal: -1 }]
    })
  ).rejects.toThrow(/niet-negatief/i);
});

test("regel-update: zelfde (nu inactieve) productId mag; een ANDER inactief product wordt geweigerd", async () => {
  // Data-veiligheid voor herrekenen na Fase B-soft-delete: een bestaande regel met een inmiddels
  // gedeactiveerd product moet bewerkbaar blijven (zelfde productId → geen herrevalidatie), maar
  // er mag geen NIEUW inactief product op gezet worden.
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);

  const added = await t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
    tenantId: seeded.tenantId,
    actor,
    inmetingId: seeded.inmetingId,
    regels: [floorLine(seeded.woonkamerId, seeded.productId)]
  });
  const lineId = added.lineIds[0];

  // Deactiveer het gekozen product + maak een tweede, ook inactief, product.
  const otherProductId = await t.run(async (ctx) => {
    const product = await ctx.db.get(seeded.productId);
    await ctx.db.patch(seeded.productId, { status: "inactive" });
    const now = Date.now();
    return ctx.db.insert("products", {
      tenantId: seeded.tenantId,
      categorieId: product!.categorieId,
      naam: "Ander inactief product",
      productAard: "standard",
      eenheid: "m2",
      status: "inactive",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  const base = {
    tenantId: seeded.tenantId,
    actor,
    lineId,
    ruimteId: seeded.woonkamerId,
    productGroep: "flooring" as const,
    berekeningType: "area" as const,
    invoer: { areaM2: 25 },
    resultaat: { quoteQuantityM2: 25.75 },
    snijverliesPct: 3,
    aantal: 25.75,
    eenheid: "m2",
    offerteRegelType: "product" as const
  };

  // Zelfde productId (nu inactief) → toegestaan, geen herrevalidatie.
  await t.mutation(api.projecten.measurements.updateMeasurementLine, {
    ...base,
    productId: seeded.productId
  });
  const updated = await t.run((ctx) => ctx.db.get(lineId));
  expect(updated?.aantal).toBe(25.75);

  // Een ander, inactief product → geweigerd.
  await expect(
    t.mutation(api.projecten.measurements.updateMeasurementLine, {
      ...base,
      productId: otherProductId
    })
  ).rejects.toThrow(/niet \(meer\) actief/i);
});

test("trapbundel bewaart materiaal en V2-dienst als aparte gekoppelde regels bij bulk en update", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);
  const bundleId = "stair-renovation-test-1";

  const result = await t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
    tenantId: seeded.tenantId,
    actor,
    inmetingId: seeded.inmetingId,
    regels: [
      {
        ...floorLine(seeded.woonkamerId, seeded.stairMaterialProductId),
        productGroep: "stairs" as const,
        berekeningType: "stairs" as const,
        invoer: {
          ...pvcStairContext,
          quantityMode: "calculated",
          calculatedQuantity: 13
        },
        resultaat: { quoteQuantity: 13 },
        aantal: 13,
        eenheid: "step",
        bundleId,
        bundleType: "stair_renovation" as const,
        bundleRole: "material" as const,
        sectionKey: "traprenovatie"
      },
      {
        ruimteId: seeded.woonkamerId,
        productGroep: "stairs" as const,
        berekeningType: "stairs" as const,
        invoer: pvcStairContext,
        resultaat: { quoteQuantity: 1 },
        aantal: 1,
        eenheid: "piece",
        offerteRegelType: "labor" as const,
        productId: seeded.serviceProductId,
        productNaam: "PVC trap halve draai",
        indicatieveEenheidsprijsExBtw: 1795,
        indicatiefBtwTarief: 21,
        indicatievePrijsEenheid: "piece",
        indicatievePrijsSoort: "service_rule",
        bundleId,
        bundleType: "stair_renovation" as const,
        bundleRole: "labor" as const,
        sectionKey: "traprenovatie"
      }
    ]
  });

  expect(result.count).toBe(2);
  const [material, labor] = await t.run(async (ctx) =>
    Promise.all(result.lineIds.map((lineId) => ctx.db.get(lineId)))
  );
  expect(material).toMatchObject({
    productId: seeded.stairMaterialProductId,
    offerteRegelType: "product",
    bundleId,
    bundleType: "stair_renovation",
    bundleRole: "material",
    sectionKey: "traprenovatie"
  });
  expect(labor).toMatchObject({
    productId: seeded.serviceProductId,
    productNaam: "PVC trap halve draai",
    indicatieveEenheidsprijsExBtw: 1795,
    indicatievePrijsEenheid: "piece",
    indicatievePrijsSoort: "service_rule",
    offerteRegelType: "labor",
    bundleId,
    bundleType: "stair_renovation",
    bundleRole: "labor",
    sectionKey: "traprenovatie"
  });

  await t.mutation(api.projecten.measurements.updateMeasurementLineStatus, {
    tenantId: seeded.tenantId,
    actor,
    lineId: result.lineIds[1],
    quotePreparationStatus: "ready_for_quote"
  });
  const statuses = await t.run(async (ctx) =>
    Promise.all(
      result.lineIds.map(async (lineId) => (await ctx.db.get(lineId))?.quotePreparationStatus)
    )
  );

  const materialUpdate = (aantal: number, eenheid: string) =>
    t.mutation(api.projecten.measurements.updateMeasurementLine, {
      tenantId: seeded.tenantId,
      actor,
      lineId: result.lineIds[0],
      ruimteId: seeded.woonkamerId,
      productGroep: "stairs" as const,
      berekeningType: "stairs" as const,
      invoer: {
        ...pvcStairContext,
        quantityMode: "calculated",
        calculatedQuantity: 13
      },
      resultaat: { quoteQuantity: aantal },
      aantal,
      eenheid,
      offerteRegelType: "product" as const
    });

  await expect(materialUpdate(1.5, "step")).rejects.toThrow(/gehele hoeveelheid/i);
  await expect(materialUpdate(13, "pack")).rejects.toThrow(/verkoopeenheid/i);
  await expect(materialUpdate(13, "step")).resolves.toBe(result.lineIds[0]);

  const unchangedMaterial = await t.run((ctx) => ctx.db.get(result.lineIds[0]));
  expect(unchangedMaterial).toMatchObject({ aantal: 13, eenheid: "step" });
  expect(statuses).toEqual(["ready_for_quote", "ready_for_quote"]);

  await t.mutation(api.projecten.measurements.updateMeasurementLine, {
    tenantId: seeded.tenantId,
    actor,
    lineId: result.lineIds[1],
    ruimteId: seeded.woonkamerId,
    productGroep: "stairs",
    berekeningType: "stairs",
    invoer: {
      ...pvcStairContext,
      checked: true
    },
    resultaat: { quoteQuantity: 1 },
    aantal: 1,
    eenheid: "piece",
    notities: "Nagemeten",
    offerteRegelType: "labor"
  });

  const updatedLabor = await t.run((ctx) => ctx.db.get(result.lineIds[1]));
  expect(updatedLabor).toMatchObject({
    productId: seeded.serviceProductId,
    productNaam: "PVC trap halve draai",
    indicatieveEenheidsprijsExBtw: 1795,
    indicatievePrijsSoort: "service_rule",
    bundleId,
    bundleType: "stair_renovation",
    bundleRole: "labor",
    sectionKey: "traprenovatie"
  });

  await expect(
    t.mutation(api.projecten.measurements.updateMeasurementLine, {
      tenantId: seeded.tenantId,
      actor,
      lineId: result.lineIds[1],
      ruimteId: seeded.woonkamerId,
      productGroep: "stairs",
      berekeningType: "stairs",
      invoer: pvcStairContext,
      resultaat: { quoteQuantity: 1 },
      aantal: 1,
      eenheid: "piece",
      offerteRegelType: "labor",
      bundleRole: "surcharge"
    })
  ).rejects.toThrow(/lidmaatschap en rol/i);

  await t.mutation(api.projecten.measurements.deleteMeasurementLine, {
    tenantId: seeded.tenantId,
    actor,
    lineId: result.lineIds[0]
  });
  expect(
    await t.run(async (ctx) => Promise.all(result.lineIds.map((lineId) => ctx.db.get(lineId))))
  ).toEqual([null, null]);
});

test("PVC-traprecept weigert ongeldige technische aantallen server-side", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);
  const invalidInputs = [
    { treadCount: 0 },
    { riserCount: 2.5 },
    { doubleTreadCount: -1 },
    { stripLengthM: -0.1 }
  ];

  for (const [index, technical] of invalidInputs.entries()) {
    await expect(
      t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
        tenantId: seeded.tenantId,
        actor,
        inmetingId: seeded.inmetingId,
        regels: stairBundleLines(seeded, `invalid-technical-${index}`, { technical })
      })
    ).rejects.toThrow(/ongeldige technische PVC-trapinvoer/i);
  }
});

test("PVC-traprecept weigert een verouderde berekende materiaalhoeveelheid", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: stairBundleLines(seeded, "stale-calculated-quantity", {
        calculatedQuantity: 12
      })
    })
  ).rejects.toThrow(/berekende materiaalhoeveelheid is verouderd/i);
});

test("PVC-traprecept bewaart een geldige, gemotiveerde handmatige hoeveelheid", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: stairBundleLines(seeded, "unmotivated-override", {
        quantityMode: "manual_override",
        materialQuantity: 12
      })
    })
  ).rejects.toThrow(/vereist een vastgelegde reden/i);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: stairBundleLines(seeded, "too-short-override-reason", {
        quantityMode: "manual_override",
        materialQuantity: 12,
        quantityOverrideReason: " a "
      })
    })
  ).rejects.toThrow(/minimaal 3 tekens/i);

  const result = await t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
    tenantId: seeded.tenantId,
    actor,
    inmetingId: seeded.inmetingId,
    regels: stairBundleLines(seeded, "motivated-override", {
      quantityMode: "manual_override",
      materialQuantity: 12,
      calculatedQuantity: 13,
      quantityOverrideReason: "Bestaande onderste trede blijft behouden."
    })
  });
  expect(result.count).toBe(2);
  const material = await t.run((ctx) => ctx.db.get(result.lineIds[0]));
  expect(material).toMatchObject({
    aantal: 12,
    invoer: {
      quantityMode: "manual_override",
      calculatedQuantity: 13,
      quantityOverrideReason: "Bestaande onderste trede blijft behouden."
    }
  });
});

test("PVC-traprecept eist voor iedere dienstregel exact hoeveelheid 1", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: stairBundleLines(seeded, "invalid-service-quantity", {
        serviceQuantity: 2
      })
    })
  ).rejects.toThrow(/diensten.*hoeveelheid 1|arbeid en toeslagen.*hoeveelheid 1/i);
});

test("dubbele PVC-traptrede vereist expliciete materiaalcompatibiliteit", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);
  const regels = (bundleId: string, confirmed?: true) => {
    const technical = {
      doubleTreadCount: 2,
      ...(confirmed ? { materialCompatibilityConfirmed: true } : {})
    };
    const [primary, labor] = stairBundleLines(seeded, bundleId, { technical });
    const context = { ...pvcStairContext, ...technical };
    return [
      primary,
      {
        ruimteId: seeded.woonkamerId,
        productGroep: "stairs" as const,
        berekeningType: "stairs" as const,
        invoer: {
          ...context,
          quantityMode: "calculated" as const,
          calculatedQuantity: 2
        },
        resultaat: { quoteQuantity: 2 },
        aantal: 2,
        eenheid: "pack",
        offerteRegelType: "product" as const,
        productId: seeded.stairDoubleTreadProductId,
        bundleId,
        bundleType: "stair_renovation" as const,
        bundleRole: "material" as const,
        sectionKey: "traprenovatie"
      },
      labor
    ];
  };

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: regels("double-tread-without-confirmation")
    })
  ).rejects.toThrow(/expliciete bevestiging.*compatibiliteit/i);

  const accepted = await t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
    tenantId: seeded.tenantId,
    actor,
    inmetingId: seeded.inmetingId,
    regels: regels("double-tread-with-confirmation", true)
  });
  expect(accepted.count).toBe(3);
});

test("trapbundel vereist unieke materiaalproducten en exact een primair hoofdproduct", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);
  const withExtraMaterial = (bundleId: string, productId: typeof seeded.stairMaterialProductId) => {
    const [primary, labor] = stairBundleLines(seeded, bundleId);
    return [
      primary,
      {
        ...primary,
        productId
      },
      labor
    ];
  };

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: withExtraMaterial("duplicate-material-product", seeded.stairMaterialProductId)
    })
  ).rejects.toThrow(/materiaalproduct mag maar een keer/i);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: withExtraMaterial("multiple-primary-materials", seeded.stairSecondPrimaryProductId)
    })
  ).rejects.toThrow(/exact een primair PVC-trapmateriaal/i);
});

test("lengteprofiel bewaart 6.1 m1 als verkoophoeveelheid en 3 pakken als bestelcontext", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);
  const technical = { ...pvcStairContext, stripLengthM: 6.1 };
  const validatedRecipe = validatePvcStairRecipeInput(technical);
  expect(validatedRecipe.ok).toBe(true);
  if (!validatedRecipe.ok) throw new Error("Geldig testrecept werd afgewezen.");

  const profileCalculation = calculatePvcStairComponentQuantity(validatedRecipe.value, {
    family: "stair_renovation",
    covering: "pvc",
    componentRole: "profile_length",
    isPrimary: false,
    piecesPerPack: 1,
    orderUnit: "pack",
    lengthMPerUnit: 3
  });
  expect(profileCalculation).toMatchObject({
    ok: true,
    value: {
      componentRole: "profile_length",
      salesQuantity: 6.1,
      salesUnit: "m1",
      expectedOrderQuantity: 3,
      orderUnit: "pack"
    }
  });
  if (!profileCalculation.ok) throw new Error("Lengteprofiel kon niet worden berekend.");

  const regels = (
    bundleId: string,
    options: {
      amount: number;
      calculatedQuantity: number;
      quantityMode?: "calculated" | "manual_override";
    }
  ) => {
    const [primary, labor] = stairBundleLines(seeded, bundleId, {
      technical: { stripLengthM: 6.1 }
    });
    return [
      primary,
      {
        ruimteId: seeded.woonkamerId,
        productGroep: "stairs" as const,
        berekeningType: "stairs" as const,
        invoer: {
          ...technical,
          quantityMode: options.quantityMode ?? ("calculated" as const),
          calculatedQuantity: options.calculatedQuantity,
          ...(options.quantityMode === "manual_override"
            ? { quantityOverrideReason: "Extra lengte op locatie nodig." }
            : {})
        },
        resultaat: {
          quoteQuantity: options.amount,
          componentCalculation: profileCalculation.value
        },
        aantal: options.amount,
        eenheid: "m1",
        offerteRegelType: "product" as const,
        productId: seeded.stairProfileLengthProductId,
        bundleId,
        bundleType: "stair_renovation" as const,
        bundleRole: "material" as const,
        sectionKey: "traprenovatie"
      },
      labor
    ];
  };

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: regels("profile-uses-order-quantity", { amount: 3, calculatedQuantity: 3 })
    })
  ).rejects.toThrow(/berekende materiaalhoeveelheid is verouderd/i);

  const calculated = await t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
    tenantId: seeded.tenantId,
    actor,
    inmetingId: seeded.inmetingId,
    regels: regels("profile-calculated-m1", { amount: 6.1, calculatedQuantity: 6.1 })
  });
  expect(calculated.count).toBe(3);

  const overridden = await t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
    tenantId: seeded.tenantId,
    actor,
    inmetingId: seeded.inmetingId,
    regels: regels("profile-manual-decimal-m1", {
      amount: 6.25,
      calculatedQuantity: 6.1,
      quantityMode: "manual_override"
    })
  });
  expect(overridden.count).toBe(3);
});

test("losse meetregels weigeren geleide trapdiensten via SKU en metadata", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);
  const base = {
    tenantId: seeded.tenantId,
    actor,
    inmetingId: seeded.inmetingId,
    ruimteId: seeded.woonkamerId,
    productGroep: "stairs" as const,
    berekeningType: "stairs" as const,
    invoer: { stairShape: "half_turn" },
    resultaat: { quoteQuantity: 1 },
    aantal: 1,
    eenheid: "piece",
    productNaam: "PVC trap halve draai",
    indicatieveEenheidsprijsExBtw: 1795,
    indicatiefBtwTarief: 21,
    indicatievePrijsEenheid: "piece",
    indicatievePrijsSoort: "service_rule"
  };

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLine, {
      ...base,
      offerteRegelType: "service",
      productId: seeded.serviceProductId,
      bundleId: "stair-renovation-single",
      bundleType: "stair_renovation",
      bundleRole: "labor",
      sectionKey: "traprenovatie"
    })
  ).rejects.toThrow(/volledige set.*bulkactie/i);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLine, {
      ...base,
      offerteRegelType: "service",
      productId: seeded.serviceProductId
    })
  ).rejects.toThrow(/volledige trapbundel/i);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLine, {
      ...base,
      offerteRegelType: "labor",
      productId: seeded.metadataGuidedServiceProductId
    })
  ).rejects.toThrow(/volledige trapbundel/i);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: [
        {
          ruimteId: seeded.woonkamerId,
          productGroep: "stairs",
          berekeningType: "stairs",
          invoer: { stairShape: "half_turn" },
          resultaat: { quoteQuantity: 1 },
          aantal: 1,
          eenheid: "piece",
          offerteRegelType: "service",
          productId: seeded.serviceProductId
        }
      ]
    })
  ).rejects.toThrow(/volledige trapbundel/i);

  const lineId = await t.mutation(api.projecten.measurements.addMeasurementLine, {
    ...base,
    offerteRegelType: "service",
    productId: seeded.standaloneServiceProductId
  });
  const stored = await t.run((ctx) => ctx.db.get(lineId));
  expect(stored).toMatchObject({
    productId: seeded.standaloneServiceProductId,
    indicatieveEenheidsprijsExBtw: 1795
  });

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLine, {
      ...base,
      offerteRegelType: "product",
      productId: seeded.serviceProductId
    })
  ).rejects.toThrow(/dienstproduct.*productregel/i);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLine, {
      ...base,
      offerteRegelType: "service",
      productId: seeded.productId
    })
  ).rejects.toThrow(/vereist een dienstproduct/i);
});

test("trapbundel vereist een echte trapcategorie en een primair PVC-trapmateriaal", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedMeasurement(t);
  const context = pvcStairContext;
  const regels = (productId: any, bundleId: string) => {
    const isAccessory = productId === seeded.stairAccessoryProductId;
    const materialQuantity = isAccessory ? 1 : 13;
    return [
      {
        ruimteId: seeded.woonkamerId,
        productGroep: "stairs" as const,
        berekeningType: "stairs" as const,
        invoer: {
          ...context,
          quantityMode: "calculated" as const,
          calculatedQuantity: materialQuantity
        },
        resultaat: { quoteQuantity: materialQuantity },
        aantal: materialQuantity,
        eenheid: isAccessory ? "pack" : "step",
        offerteRegelType: "product" as const,
        productId,
        bundleId,
        bundleType: "stair_renovation" as const,
        bundleRole: "material" as const,
        sectionKey: "traprenovatie"
      },
      {
        ruimteId: seeded.woonkamerId,
        productGroep: "stairs" as const,
        berekeningType: "stairs" as const,
        invoer: context,
        resultaat: { quoteQuantity: 1 },
        aantal: 1,
        eenheid: "piece",
        offerteRegelType: "labor" as const,
        productId: seeded.serviceProductId,
        bundleId,
        bundleType: "stair_renovation" as const,
        bundleRole: "labor" as const,
        sectionKey: "traprenovatie"
      }
    ];
  };

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: regels(seeded.wrongCategoryPrimaryProductId, "wrong-category-bundle")
    })
  ).rejects.toThrow(/categorie Traprenovatie/i);

  await expect(
    t.mutation(api.projecten.measurements.addMeasurementLinesBulk, {
      tenantId: seeded.tenantId,
      actor,
      inmetingId: seeded.inmetingId,
      regels: regels(seeded.stairAccessoryProductId, "accessory-only-bundle")
    })
  ).rejects.toThrow(/primair PVC-trapmateriaal/i);

  const stored = await t.run((ctx) =>
    ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", seeded.tenantId).eq("inmetingId", seeded.inmetingId)
      )
      .collect()
  );
  expect(stored).toHaveLength(0);
});
