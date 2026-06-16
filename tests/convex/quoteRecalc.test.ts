import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

// convex-test laadt de functie-modules; tests staan buiten convex/, dus expliciet de glob.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

// Regressie voor de bug waarbij recalculateQuote niet-bestaande regelvelden las
// (line.lineTotalExVat i.p.v. line.regelTotaalExBtw) → opgeslagen offertetotalen
// werden NaN en lekten naar facturen. Deze test rijdt het échte addQuoteLine-pad.
test("addQuoteLine herberekent de opgeslagen offertetotalen tot eindige bedragen (geen NaN)", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");

  const t = convexTest(schema, modules);
  const now = Date.now();
  const externalUserId = "dev-user-1";

  const quoteId = await t.run(async (ctx) => {
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
    const customerId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Testklant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId,
      klantId: customerId,
      titel: "Testproject",
      status: "quote_draft",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return await ctx.db.insert("quotes", {
      tenantId,
      projectId,
      klantId: customerId,
      offertenummer: "OFF-2026-1",
      titel: "Testofferte",
      status: "draft",
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

  await t.mutation(api.portal.addQuoteLine, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId,
    regelType: "product",
    titel: "Floorlife PVC dryback",
    aantal: 10,
    eenheid: "m2",
    eenheidsprijsExBtw: 50,
    btwTarief: 21,
    sortOrder: 1
  });

  const quote = await t.run(async (ctx) => ctx.db.get(quoteId));

  expect(Number.isFinite(quote?.subtotaalExBtw)).toBe(true);
  expect(Number.isFinite(quote?.btwTotaal)).toBe(true);
  expect(Number.isFinite(quote?.totaalInclBtw)).toBe(true);
  // 10 × €50 = €500 excl., 21% btw = €105, totaal €605 incl.
  expect(quote?.subtotaalExBtw).toBe(500);
  expect(quote?.btwTotaal).toBe(105);
  expect(quote?.totaalInclBtw).toBe(605);
});
