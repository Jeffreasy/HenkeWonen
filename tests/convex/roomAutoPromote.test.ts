import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../convex/schema";
import { findOrCreateProjectRoom } from "../../convex/projecten/measurements";

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
