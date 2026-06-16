import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

// convex-test laadt de functie-modules; tests staan buiten convex/, dus expliciet de glob.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

test("recalculateQuoteTotalsChunk detecteert en herstelt offertes met onjuiste opgeslagen totalen", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");

  const t = convexTest(schema, modules);
  const now = Date.now();

  // Simuleer de corruptie: opgeslagen totalen op 0 terwijl de regels €500/€105/€605
  // optellen (regel-totalen zijn altijd correct geweest; alleen het aggregaat dreef).
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
      status: "quote_sent",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const quoteId = await ctx.db.insert("quotes", {
      tenantId,
      projectId,
      klantId: customerId,
      offertenummer: "OFF-2026-1",
      titel: "Testofferte",
      status: "sent",
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("quoteLines", {
      tenantId,
      quoteId,
      regelType: "product",
      titel: "Floorlife PVC dryback",
      aantal: 10,
      eenheid: "m2",
      eenheidsprijsExBtw: 50,
      btwTarief: 21,
      regelTotaalExBtw: 500,
      regelBtwTotaal: 105,
      regelTotaalInclBtw: 605,
      sortOrder: 1,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return quoteId;
  });

  // Dry-run: detecteert, patcht niet.
  const dry = await t.mutation(api.offertes.maintenance.recalculateQuoteTotalsChunk, {
    tenantSlug: "henke-wonen",
    actor,
    confirm: "REPAIR_QUOTE_TOTALS",
    dryRun: true
  });
  expect(dry.mismatched).toBe(1);
  expect(dry.patched).toBe(0);
  const afterDry = await t.run(async (ctx) => ctx.db.get(quoteId));
  expect(afterDry?.totaalInclBtw).toBe(0);

  // Apply: herstelt de totalen.
  const applied = await t.mutation(api.offertes.maintenance.recalculateQuoteTotalsChunk, {
    tenantSlug: "henke-wonen",
    actor,
    confirm: "REPAIR_QUOTE_TOTALS",
    dryRun: false
  });
  expect(applied.patched).toBe(1);

  const repaired = await t.run(async (ctx) => ctx.db.get(quoteId));
  expect(repaired?.subtotaalExBtw).toBe(500);
  expect(repaired?.btwTotaal).toBe(105);
  expect(repaired?.totaalInclBtw).toBe(605);

  // Tweede dry-run vindt niets meer.
  const reDry = await t.mutation(api.offertes.maintenance.recalculateQuoteTotalsChunk, {
    tenantSlug: "henke-wonen",
    actor,
    confirm: "REPAIR_QUOTE_TOTALS",
    dryRun: true
  });
  expect(reDry.mismatched).toBe(0);
});
