import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

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

    return { tenantId, inmetingId, productId, woonkamerId, keukenId, foreignRoomId };
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
  indicatieveEenheidsprijsExBtw: 15.95
});

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
