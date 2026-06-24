import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");
const externalUserId = "dev-admin";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

function stubAuth() {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
}

async function setup(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen", naam: "Henke Wonen", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const adminId = await ctx.db.insert("users", {
      tenantId, externalUserId, email: "admin@h.nl", role: "admin", naam: "Admin", aangemaaktOp: now, gewijzigdOp: now
    });
    const wimId = await ctx.db.insert("users", {
      tenantId, externalUserId: "dev-wim", email: "wim@h.nl", role: "editor", naam: "Wim", aangemaaktOp: now, gewijzigdOp: now
    });
    const simoneId = await ctx.db.insert("users", {
      tenantId, externalUserId: "dev-simone", email: "simone@h.nl", role: "editor", naam: "Simone", aangemaaktOp: now, gewijzigdOp: now
    });
    return { tenantId, adminId, wimId, simoneId };
  });
}

test("agendaWeek toont alle niet-viewers zolang niemand is aangevinkt (fallback)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  await setup(t);
  const res = await t.query(api.portal.agendaWeek, { tenantSlug: "henke-wonen", actor, weekStart: Date.now() });
  expect(res.monteurs).toHaveLength(3); // admin + wim + simone
});

test("agendaWeek toont alléén de aangevinkte gebruikers (whitelist) — admin valt eruit", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await setup(t);

  await t.mutation(api.portal.setAgendaZichtbaarheid, {
    tenantSlug: "henke-wonen", actor, userId: ids.wimId, toonInAgenda: true
  });
  await t.mutation(api.portal.setAgendaZichtbaarheid, {
    tenantSlug: "henke-wonen", actor, userId: ids.simoneId, toonInAgenda: true
  });

  const res = await t.query(api.portal.agendaWeek, { tenantSlug: "henke-wonen", actor, weekStart: Date.now() });
  const namen = res.monteurs.map((m: { monteur: { naam: string } }) => m.monteur.naam).sort();
  expect(namen).toEqual(["Simone", "Wim"]);
});

test("uitvinken zet de gebruiker terug; zonder aangevinkte valt de agenda terug op alle niet-viewers", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await setup(t);
  await t.mutation(api.portal.setAgendaZichtbaarheid, {
    tenantSlug: "henke-wonen", actor, userId: ids.wimId, toonInAgenda: true
  });
  // Weer uitvinken -> niemand aangevinkt -> fallback toont alle 3 niet-viewers.
  await t.mutation(api.portal.setAgendaZichtbaarheid, {
    tenantSlug: "henke-wonen", actor, userId: ids.wimId, toonInAgenda: false
  });
  const res = await t.query(api.portal.agendaWeek, { tenantSlug: "henke-wonen", actor, weekStart: Date.now() });
  expect(res.monteurs).toHaveLength(3);
});
