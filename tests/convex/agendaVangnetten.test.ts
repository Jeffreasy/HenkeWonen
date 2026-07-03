import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");
const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

function stubAuth() {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
}

/** Eerstvolgende inmeetdag (di/wo/do) in de toekomst, verankerd rond het middaguur. */
function volgendeInmeetdag(): number {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (![2, 3, 4].includes(d.getDay())); // getDay: di=2, wo=3, do=4
  return d.getTime();
}

/** Maandag 00:00 van de week waarin `ms` valt (spiegel van startVanWeekMs). */
function startVanWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
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
    const wimId = await ctx.db.insert("users", {
      tenantId, externalUserId: "wim", email: "wim@henke.nl", naam: "Wim",
      role: "user", toonInAgenda: true, aangemaaktOp: now, gewijzigdOp: now
    });
    const simoneId = await ctx.db.insert("users", {
      tenantId, externalUserId: "simone", email: "simone@henke.nl", naam: "Simone",
      role: "editor", toonInAgenda: false, aangemaaktOp: now, gewijzigdOp: now
    });
    const customerId = await ctx.db.insert("customers", {
      tenantId, type: "private", weergaveNaam: "Testklant", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId, klantId: customerId, titel: "Testproject", status: "measurement_planned", aangemaaktOp: now, gewijzigdOp: now
    });
    return { tenantId, wimId, simoneId, customerId, projectId };
  });
}

test("bezoek van een uitgevinkte monteur valt in de teamagenda onder 'niet toegewezen'", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const now = Date.now();
  const inmeetdag = volgendeInmeetdag();
  await t.run(async (ctx) =>
    ctx.db.insert("measurements", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      status: "draft", inmeetdatum: inmeetdag,
      gemetenDoor: "Simone", gemetenDoorUserId: ids.simoneId,
      aangemaaktOp: now, gewijzigdOp: now
    })
  );

  const week = await t.query(api.portal.agendaWeek, {
    tenantSlug: "henke-wonen", actor, weekStart: startVanWeek(inmeetdag)
  });

  // Simone is uitgevinkt: geen eigen kolom, maar het bezoek mag niet verdwijnen.
  expect(week.monteurs.some((m: { monteur: { naam: string } }) => m.monteur.naam === "Simone")).toBe(false);
  expect(week.nietToegewezen).toHaveLength(1);
  expect(week.nietToegewezen[0].klantNaam).toBe("Testklant");
});

test("monteur uitvinken wordt geweigerd zolang er toekomstige inmeetbezoeken gepland staan", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const now = Date.now();
  await t.run(async (ctx) =>
    ctx.db.insert("measurements", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      status: "draft", inmeetdatum: volgendeInmeetdag(),
      gemetenDoor: "Wim", gemetenDoorUserId: ids.wimId,
      aangemaaktOp: now, gewijzigdOp: now
    })
  );

  await expect(
    t.mutation(api.portal.setAgendaZichtbaarheid, {
      tenantSlug: "henke-wonen", actor, userId: ids.wimId, toonInAgenda: false
    })
  ).rejects.toThrow(/herplan/i);

  // Zonder toekomstige bezoeken mag het wél.
  await t.run(async (ctx) => {
    const metingen = await ctx.db.query("measurements").collect();
    for (const m of metingen) {
      await ctx.db.patch(m._id, { inmeetdatum: undefined });
    }
  });
  const resultaat = await t.mutation(api.portal.setAgendaZichtbaarheid, {
    tenantSlug: "henke-wonen", actor, userId: ids.wimId, toonInAgenda: false
  });
  expect(resultaat.toonInAgenda).toBe(false);
});

test("ziek/verlof melden geeft de botsende inmeetbezoeken terug (en legt de afwezigheid vast)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const now = Date.now();
  const inmeetdag = volgendeInmeetdag();
  await t.run(async (ctx) =>
    ctx.db.insert("measurements", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      status: "draft", inmeetdatum: inmeetdag,
      gemetenDoor: "Wim", gemetenDoorUserId: ids.wimId,
      aangemaaktOp: now, gewijzigdOp: now
    })
  );

  // Hele week ziek rond de inmeetdag (afwezigheid op middernacht verankerd).
  const dagStart = new Date(inmeetdag);
  dagStart.setHours(0, 0, 0, 0);
  const resultaat = await t.mutation(api.portal.addAfwezigheid, {
    tenantSlug: "henke-wonen", actor, userId: ids.wimId, type: "ziek",
    vanafDatum: dagStart.getTime() - 2 * 24 * 60 * 60 * 1000,
    totDatum: dagStart.getTime() + 2 * 24 * 60 * 60 * 1000,
    heleDag: true
  });

  expect(resultaat.conflicten).toHaveLength(1);
  expect(resultaat.conflicten[0].klantNaam).toBe("Testklant");
  expect(resultaat.conflicten[0].inmeetdatum).toBe(inmeetdag);

  const afwezigheden = await t.run(async (ctx) => ctx.db.query("monteurAfwezigheid").collect());
  expect(afwezigheden).toHaveLength(1); // ziekmelding zelf is gewoon vastgelegd

  // Buiten de periode: geen conflicten.
  const los = await t.mutation(api.portal.addAfwezigheid, {
    tenantSlug: "henke-wonen", actor, userId: ids.wimId, type: "verlof",
    vanafDatum: dagStart.getTime() + 30 * 24 * 60 * 60 * 1000,
    totDatum: dagStart.getTime() + 31 * 24 * 60 * 60 * 1000,
    heleDag: true
  });
  expect(los.conflicten).toHaveLength(0);
});
