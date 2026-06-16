import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

// convex-test laadt de functie-modules; tests staan buiten convex/, dus expliciet de glob.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

async function setupDraftQuote(t: ReturnType<typeof convexTest>) {
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
}

test("updateQuoteStatus blokkeert 'sent' bij een ongeprijsde (€0) prijsdragende regel", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");

  const t = convexTest(schema, modules);
  const quoteId = await setupDraftQuote(t);

  await t.mutation(api.portal.addQuoteLine, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId,
    regelType: "product",
    titel: "Verwijderd product",
    aantal: 5,
    eenheid: "m2",
    eenheidsprijsExBtw: 0,
    btwTarief: 21,
    sortOrder: 1
  });

  await expect(
    t.mutation(api.portal.updateQuoteStatus, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId,
      status: "sent"
    })
  ).rejects.toThrow(/zonder prijs/i);
});

test("updateQuoteStatus staat 'sent' toe als alle prijsdragende regels geprijsd zijn", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");

  const t = convexTest(schema, modules);
  const quoteId = await setupDraftQuote(t);

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

  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId,
    status: "sent"
  });

  const quote = await t.run(async (ctx) => ctx.db.get(quoteId));
  expect(quote?.status).toBe("sent");
});
