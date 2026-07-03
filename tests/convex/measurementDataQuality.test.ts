import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");
const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

function stubAuth() {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
}

async function base(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen", naam: "Henke Wonen", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId, externalUserId, email: "a@henke.nl", role: "admin", aangemaaktOp: now, gewijzigdOp: now
    });
    const customerId = await ctx.db.insert("customers", {
      tenantId, type: "private", weergaveNaam: "Testklant", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId, klantId: customerId, titel: "Testproject", status: "measurement_planned", aangemaaktOp: now, gewijzigdOp: now
    });
    const measurementId = await ctx.db.insert("measurements", {
      tenantId, projectId, klantId: customerId, status: "measured", aangemaaktOp: now, gewijzigdOp: now
    });
    // Ruimte-model A: elke inmeet-ruimte hoort verplicht bij een dossier-ruimte.
    const projectRoomId = await ctx.db.insert("projectRooms", {
      tenantId, projectId, naam: "Woonkamer", sortOrder: 1, aangemaaktOp: now, gewijzigdOp: now
    });
    return { tenantId, customerId, projectId, measurementId, projectRoomId };
  });
}

/** Vloerregel (per m², recht patroon, 3% snijverlies) zoals de afleidings-engine 'm maakt. */
function vloerRegel(tenantId: Id<"tenants">, inmetingId: Id<"measurements">, ruimteId: Id<"measurementRooms">, areaM2: number) {
  const now = Date.now();
  const wasteM2 = Math.round(areaM2 * 0.03 * 100) / 100;
  const totalM2 = Math.round((areaM2 + wasteM2) * 100) / 100;
  const aantal = Math.ceil(totalM2 * 100) / 100;
  return {
    tenantId, inmetingId, ruimteId,
    productGroep: "flooring" as const, berekeningType: "area" as const,
    invoer: { areaM2, wastePercent: 3, patternType: "straight" },
    resultaat: { areaM2, wasteM2, totalM2, quoteQuantityM2: aantal, isIndicative: true },
    snijverliesPct: 3, aantal, eenheid: "m2",
    offerteRegelType: "product" as const, quotePreparationStatus: "ready_for_quote" as const,
    aangemaaktOp: now, gewijzigdOp: now
  };
}

test("maatcorrectie van een ruimte herrekent de automatische meetregels", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const now = Date.now();
  const { roomId, autoLineId, manualLineId } = await t.run(async (ctx) => {
    const roomId = await ctx.db.insert("measurementRooms", {
      tenantId: ids.tenantId, inmetingId: ids.measurementId, projectRuimteId: ids.projectRoomId, naam: "Woonkamer",
      breedteM: 4, lengteM: 5, oppervlakteM2: 20, omtrekM: 18, sortOrder: 1,
      aangemaaktOp: now, gewijzigdOp: now
    });
    const autoLineId = await ctx.db.insert("measurementLines", vloerRegel(ids.tenantId, ids.measurementId, roomId, 20));
    const manualLineId = await ctx.db.insert("measurementLines", {
      ...vloerRegel(ids.tenantId, ids.measurementId, roomId, 20),
      handmatigAangepast: true, aantal: 19 // bewust handmatig gecorrigeerd
    });
    return { roomId, autoLineId, manualLineId };
  });

  // Winkel of buitendienst corrigeert de lengte: 5 m → 6 m (oppervlakte 24 m²).
  await t.mutation(api.projecten.measurements.updateMeasurementRoom, {
    tenantId: ids.tenantId, actor, ruimteId: roomId, naam: "Woonkamer",
    breedteM: 4, lengteM: 6, oppervlakteM2: 24, omtrekM: 20
  });

  const { autoLine, manualLine } = await t.run(async (ctx) => ({
    autoLine: await ctx.db.get(autoLineId as Id<"measurementLines">),
    manualLine: await ctx.db.get(manualLineId as Id<"measurementLines">)
  }));
  // 24 m² + 3% = 24.72 m² — de nieuwe maat stroomt door naar de meetregel.
  expect(autoLine?.aantal).toBeCloseTo(24.72, 2);
  expect((autoLine?.invoer as { areaM2?: number }).areaM2).toBe(24);
  // Handmatig gecorrigeerde regel blijft ongemoeid.
  expect(manualLine?.aantal).toBe(19);
});

test("ruimte toevoegen met bestaande naam vult de maten in (geen stille weggooi)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const now = Date.now();
  // De winkel had 'Woonkamer' alvast zonder maten voorbereid.
  const bestaandeRoomId = await t.run(async (ctx) =>
    ctx.db.insert("measurementRooms", {
      tenantId: ids.tenantId, inmetingId: ids.measurementId, projectRuimteId: ids.projectRoomId, naam: "Woonkamer",
      sortOrder: 1, aangemaaktOp: now, gewijzigdOp: now
    })
  );

  // Wim voert op locatie 'Woonkamer' in mét maten.
  const teruggegevenId = await t.mutation(api.projecten.measurements.addMeasurementRoom, {
    tenantId: ids.tenantId, actor, inmetingId: ids.measurementId, naam: "woonkamer",
    breedteM: 4, lengteM: 5, oppervlakteM2: 20, omtrekM: 18
  });

  expect(String(teruggegevenId)).toBe(String(bestaandeRoomId));
  const room = await t.run(async (ctx) => ctx.db.get(bestaandeRoomId as Id<"measurementRooms">));
  expect(room?.breedteM).toBe(4);
  expect(room?.lengteM).toBe(5);
  expect(room?.oppervlakteM2).toBe(20);
});

test("inmetingsstatus 'Verwerkt naar offerte' is niet handmatig te zetten of te verlaten", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);

  await expect(
    t.mutation(api.projecten.measurements.updateMeasurement, {
      tenantId: ids.tenantId, actor, inmetingId: ids.measurementId, status: "converted_to_quote"
    })
  ).rejects.toThrow(/automatisch beheerd/i);

  await t.run(async (ctx) =>
    ctx.db.patch(ids.measurementId as Id<"measurements">, { status: "converted_to_quote" })
  );
  await expect(
    t.mutation(api.projecten.measurements.updateMeasurement, {
      tenantId: ids.tenantId, actor, inmetingId: ids.measurementId, status: "draft"
    })
  ).rejects.toThrow(/automatisch beheerd/i);

  // Gewone overgangen blijven werken.
  await t.run(async (ctx) =>
    ctx.db.patch(ids.measurementId as Id<"measurements">, { status: "measured" })
  );
  await t.mutation(api.projecten.measurements.updateMeasurement, {
    tenantId: ids.tenantId, actor, inmetingId: ids.measurementId, status: "reviewed"
  });
  const measurement = await t.run(async (ctx) => ctx.db.get(ids.measurementId as Id<"measurements">));
  expect(measurement?.status).toBe("reviewed");
});

test("listReadyForQuoteByProject telt de nog niet klaargezette concept-regels mee", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const now = Date.now();
  await t.run(async (ctx) => {
    const roomId = await ctx.db.insert("measurementRooms", {
      tenantId: ids.tenantId, inmetingId: ids.measurementId, projectRuimteId: ids.projectRoomId, naam: "Woonkamer",
      breedteM: 4, lengteM: 5, oppervlakteM2: 20, omtrekM: 18, sortOrder: 1,
      aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("measurementLines", vloerRegel(ids.tenantId, ids.measurementId, roomId, 20));
    await ctx.db.insert("measurementLines", {
      ...vloerRegel(ids.tenantId, ids.measurementId, roomId, 20),
      quotePreparationStatus: "draft" as const
    });
  });

  const result = await t.query(api.projecten.measurements.listReadyForQuoteByProject, {
    tenantId: ids.tenantId, projectId: ids.projectId, actor
  });
  expect(result.readyLines).toHaveLength(1);
  expect(result.draftLineCount).toBe(1);
});
