import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");
const externalUserId = "dev-admin";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

function stubAuth() {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
}

/** Een vaste weekdag op het middaguur (de inmeetdatum is rond noon verankerd). getDay: 1=ma, 2=di. */
function weekdagNoon(targetGetDay: number) {
  const d = new Date(2026, 5, 1, 12, 0, 0); // 1 juni 2026, noon
  while (d.getDay() !== targetGetDay) d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}
const MAANDAG = weekdagNoon(1);
const DINSDAG = weekdagNoon(2);

async function setup(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen", naam: "H", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId, externalUserId, email: "admin@h.nl", role: "admin", aangemaaktOp: now, gewijzigdOp: now
    });
    const wimId = await ctx.db.insert("users", {
      tenantId, externalUserId: "dev-wim", email: "wim@h.nl", role: "editor", naam: "Wim", aangemaaktOp: now, gewijzigdOp: now
    });
    const customerId = await ctx.db.insert("customers", {
      tenantId, type: "private", weergaveNaam: "K", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const mk = async (titel: string) =>
      ctx.db.insert("projects", { tenantId, klantId: customerId, titel, status: "lead", aangemaaktOp: now, gewijzigdOp: now });
    return { tenantId, wimId, customerId, projectA: await mk("A"), projectB: await mk("B") };
  });
}

function plan(
  t: ReturnType<typeof convexTest>,
  args: {
    projectId: string;
    inmeetdatum?: number;
    gemetenDoorUserId?: Id<"users">;
    omvang?: "klein" | "volledig";
    force?: boolean;
  }
) {
  return t.mutation(api.portal.startOrPlanMeasurement, { tenantSlug: "henke-wonen", actor, ...args });
}

test("startOrPlanMeasurement weigert een niet-inmeetdag (maandag)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await setup(t);
  await expect(
    plan(t, { projectId: String(ids.projectA), inmeetdatum: MAANDAG, gemetenDoorUserId: ids.wimId, omvang: "klein" })
  ).rejects.toThrow(/dinsdag|woensdag|donderdag/i);
});

test("force=true omzeilt de inmeetdag-guard", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await setup(t);
  await plan(t, { projectId: String(ids.projectA), inmeetdatum: MAANDAG, gemetenDoorUserId: ids.wimId, omvang: "klein", force: true });
  const proj = await t.run(async (ctx) => ctx.db.get(ids.projectA));
  expect(proj?.status).toBe("measurement_planned");
});

test("startOrPlanMeasurement weigert een afwezige monteur (hele dag)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await setup(t);
  const now = Date.now();
  await t.run(async (ctx) =>
    ctx.db.insert("monteurAfwezigheid", {
      tenantId: ids.tenantId, userId: ids.wimId, type: "ziek",
      vanafDatum: DINSDAG - 3600000, totDatum: DINSDAG + 3600000, heleDag: true,
      aangemaaktOp: now, gewijzigdOp: now
    })
  );
  await expect(
    plan(t, { projectId: String(ids.projectA), inmeetdatum: DINSDAG, gemetenDoorUserId: ids.wimId, omvang: "klein" })
  ).rejects.toThrow(/afwezig/i);
});

test("startOrPlanMeasurement weigert overschrijding van de dagcapaciteit", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await setup(t);
  // Bezoek 1: volledige woning (2 units) op dinsdag voor Wim.
  await plan(t, { projectId: String(ids.projectA), inmeetdatum: DINSDAG, gemetenDoorUserId: ids.wimId, omvang: "volledig" });
  // Bezoek 2: klein (1 unit) zelfde monteur/dag -> 2+1=3 > 2 -> geweigerd.
  await expect(
    plan(t, { projectId: String(ids.projectB), inmeetdatum: DINSDAG, gemetenDoorUserId: ids.wimId, omvang: "klein" })
  ).rejects.toThrow(/vol/i);
});

test("inmeetBeschikbaarheid: ochtend-afwezigheid (buiten 16:30-17:30) blokkeert het venster NIET (heleDag-fix)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await setup(t);
  const now = Date.now();
  await t.run(async (ctx) =>
    ctx.db.insert("monteurAfwezigheid", {
      tenantId: ids.tenantId, userId: ids.wimId, type: "overig",
      vanafDatum: DINSDAG - 3600000, totDatum: DINSDAG + 3600000,
      heleDag: false, startMinuut: 9 * 60, eindMinuut: 12 * 60, // 09:00-12:00
      aangemaaktOp: now, gewijzigdOp: now
    })
  );
  const buiten = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen", actor, userId: ids.wimId, datum: DINSDAG
  });
  expect(buiten.afwezig).toBeNull();

  // Tijdvak dat het inmeetvenster wél overlapt (16:00-18:00) -> afwezig.
  await t.run(async (ctx) =>
    ctx.db.insert("monteurAfwezigheid", {
      tenantId: ids.tenantId, userId: ids.wimId, type: "blokkade",
      vanafDatum: DINSDAG - 3600000, totDatum: DINSDAG + 3600000,
      heleDag: false, startMinuut: 16 * 60, eindMinuut: 18 * 60,
      aangemaaktOp: now, gewijzigdOp: now
    })
  );
  const binnen = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen", actor, userId: ids.wimId, datum: DINSDAG
  });
  expect(binnen.afwezig).not.toBeNull();
});

test("een pure start (zonder datum/monteur) keurt een bestaande niet-inmeetdatum niet retroactief af", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await setup(t);
  // Project heeft al een inmeetdatum op een maandag (bv. legacy/handmatig).
  await t.run(async (ctx) => ctx.db.patch(ids.projectA, { inmeetdatum: MAANDAG }));
  // Een pure start zet geen datum/monteur en mag niet falen op de inmeetdag-guard.
  await plan(t, { projectId: String(ids.projectA) });
  const proj = await t.run(async (ctx) => ctx.db.get(ids.projectA));
  expect(proj?.status).toBe("measurement_planned");
});
