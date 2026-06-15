import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import {
  findOrCreateProjectRoom,
  syncProjectRoomFromMeasurement
} from "../../convex/projecten/measurements";

// convex-test laadt de functie-modules; tests staan buiten convex/, dus expliciet de glob.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

async function seedProject(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen",
      naam: "Henke Wonen",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const klantId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Test Klant",
      status: "lead",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId,
      klantId,
      titel: "Test dossier",
      status: "lead",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return { tenantId, projectId };
  });
}

test("auto-promotie maakt één dossier-ruimte met m→cm-conversie", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, projectId } = await seedProject(t);

  const roomId = await t.run((ctx) =>
    findOrCreateProjectRoom(ctx, tenantId, projectId, {
      naam: "Woonkamer",
      breedteM: 4.2,
      lengteM: 3.8,
      oppervlakteM2: 15.96,
      omtrekM: 16
    })
  );

  const room = await t.run((ctx) => ctx.db.get(roomId));
  expect(room?.naam).toBe("Woonkamer");
  expect(room?.breedteCm).toBe(420); // 4,2 m → 420 cm
  expect(room?.lengteCm).toBe(380);
  expect(room?.oppervlakteM2).toBe(15.96); // m² blijft m²
  expect(room?.omtrekMeter).toBe(16); // omtrek blijft meters

  const count = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("projectRooms")
        .withIndex("by_project", (q) => q.eq("tenantId", tenantId).eq("projectId", projectId))
        .collect()
    ).length
  );
  expect(count).toBe(1);
});

test("auto-promotie hergebruikt een bestaande ruimte op genormaliseerde naam (geen dubbel)", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, projectId } = await seedProject(t);

  const first = await t.run((ctx) =>
    findOrCreateProjectRoom(ctx, tenantId, projectId, { naam: "Woonkamer" })
  );
  // Andere hoofdletters + spaties → zelfde ruimte, geen tweede rij.
  const second = await t.run((ctx) =>
    findOrCreateProjectRoom(ctx, tenantId, projectId, { naam: "  WOONKAMER " })
  );
  const third = await t.run((ctx) =>
    findOrCreateProjectRoom(ctx, tenantId, projectId, { naam: "Slaapkamer" })
  );

  expect(second).toBe(first);
  expect(third).not.toBe(first);

  const count = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("projectRooms")
        .withIndex("by_project", (q) => q.eq("tenantId", tenantId).eq("projectId", projectId))
        .collect()
    ).length
  );
  expect(count).toBe(2); // Woonkamer + Slaapkamer
});

test("sync schrijft inmeet-identiteit + gemeten maten terug naar de dossier-ruimte (m→cm)", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, projectId } = await seedProject(t);

  const now = Date.now();
  const projectRuimteId = await t.run((ctx) =>
    ctx.db.insert("projectRooms", {
      tenantId,
      projectId,
      naam: "Kamer",
      verdieping: "Begane grond",
      breedteCm: 300,
      oppervlakteM2: 9,
      sortOrder: 1,
      aangemaaktOp: now,
      gewijzigdOp: now
    })
  );

  // Inmeting meet andere maten + corrigeert de naam; verdieping/lengte niet meegemeten.
  await t.run((ctx) =>
    syncProjectRoomFromMeasurement(ctx, tenantId, projectRuimteId, {
      naam: "Woonkamer",
      breedteM: 4.2,
      oppervlakteM2: 16
    })
  );

  const room = await t.run((ctx) => ctx.db.get(projectRuimteId));
  expect(room?.naam).toBe("Woonkamer"); // identiteit gesynct
  expect(room?.breedteCm).toBe(420); // gemeten maat overschrijft (4,2 m → 420 cm)
  expect(room?.oppervlakteM2).toBe(16);
  expect(room?.verdieping).toBe("Begane grond"); // niet meegemeten → niet gewist
  expect(room?.lengteCm).toBeUndefined();
});
