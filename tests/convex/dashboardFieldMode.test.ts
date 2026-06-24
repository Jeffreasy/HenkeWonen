import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

function actorFor(externalUserId: string) {
  return { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };
}

/** Tenant + general-user + field-user + één openstaande factuur (€1000 open). */
async function setup(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen", naam: "Henke Wonen", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId, externalUserId: "dev-winkel", email: "winkel@henke.nl", role: "admin",
      workspaceMode: "general", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId, externalUserId: "dev-veld", email: "veld@henke.nl", role: "editor",
      workspaceMode: "field", aangemaaktOp: now, gewijzigdOp: now
    });
    const customerId = await ctx.db.insert("customers", {
      tenantId, type: "private", weergaveNaam: "Testklant", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId, klantId: customerId, titel: "Testproject", status: "in_progress", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("invoices", {
      tenantId, projectId, klantId: customerId, factuurnummer: "FAC-2026-001", status: "sent",
      factuurdatum: now, vervaldatum: now + 14 * 86400000,
      subtotaalExBtw: 826.45, btwTotaal: 173.55, totaalInclBtw: 1000, betaaldBedrag: 0,
      aangemaaktOp: now, gewijzigdOp: now
    });
  });
}

test("winkel (general) ziet het openstaande factuurbedrag op het dashboard", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
  const t = convexTest(schema, modules);
  await setup(t);

  const result = await t.query(api.portal.dashboard, {
    tenantSlug: "henke-wonen", actor: actorFor("dev-winkel")
  });
  expect(result.invoiceStats.openAmount).toBe(1000);
});

test("buitendienst (field) ziet GEEN factuurbedrag op het dashboard (genormaliseerd op 0)", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
  const t = convexTest(schema, modules);
  await setup(t);

  const result = await t.query(api.portal.dashboard, {
    tenantSlug: "henke-wonen", actor: actorFor("dev-veld")
  });
  expect(result.invoiceStats.openAmount).toBe(0);
  expect(result.invoiceStats.overdueCount).toBe(0);
});
