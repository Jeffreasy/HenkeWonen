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

/** Tenant + admin-user + klant + project. */
async function base(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen", naam: "Henke Wonen", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId, externalUserId, email: "admin@henke.nl", role: "admin", aangemaaktOp: now, gewijzigdOp: now
    });
    const customerId = await ctx.db.insert("customers", {
      tenantId, type: "private", weergaveNaam: "Testklant", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId, klantId: customerId, titel: "Testproject", status: "quote_draft", aangemaaktOp: now, gewijzigdOp: now
    });
    return { tenantId, customerId, projectId };
  });
}

async function draftQuote(
  t: ReturnType<typeof convexTest>,
  ids: { tenantId: Id<"tenants">; customerId: Id<"customers">; projectId: Id<"projects"> },
  nummer: string
) {
  const now = Date.now();
  return await t.run(async (ctx) =>
    ctx.db.insert("quotes", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      offertenummer: nummer, titel: "Offerte " + nummer, status: "draft",
      subtotaalExBtw: 0, btwTotaal: 0, totaalInclBtw: 0, aangemaaktOp: now, gewijzigdOp: now
    })
  );
}

/** Een geïmporteerde (converted) inmeetregel, gekoppeld aan een offerte. */
async function convertedLine(
  t: ReturnType<typeof convexTest>,
  ids: { tenantId: Id<"tenants">; customerId: Id<"customers">; projectId: Id<"projects"> },
  quoteId: Id<"quotes">
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const inmetingId = await ctx.db.insert("measurements", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      status: "converted_to_quote", aangemaaktOp: now, gewijzigdOp: now
    });
    return await ctx.db.insert("measurementLines", {
      tenantId: ids.tenantId, inmetingId, productGroep: "flooring", berekeningType: "area",
      invoer: {}, resultaat: {}, aantal: 12, eenheid: "m2", offerteRegelType: "product",
      quotePreparationStatus: "converted", geconverteerdeOfferteId: quoteId,
      aangemaaktOp: now, gewijzigdOp: now
    });
  });
}

test("afgewezen offerte bevrijdt de geïmporteerde inmeetregels (terug naar ready_for_quote)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const quoteId = await draftQuote(t, ids, "OFF-2026-1");
  const lineId = await convertedLine(t, ids, quoteId);

  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen", actor, quoteId, status: "rejected"
  });

  const ml = await t.run(async (ctx) => ctx.db.get(lineId));
  expect(ml?.quotePreparationStatus).toBe("ready_for_quote");
  expect(ml?.geconverteerdeOfferteId).toBeUndefined();
  expect(ml?.geconverteerdeOfferteregelId).toBeUndefined();
});

test("geannuleerde offerte bevrijdt de geïmporteerde inmeetregels", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const quoteId = await draftQuote(t, ids, "OFF-2026-2");
  const lineId = await convertedLine(t, ids, quoteId);

  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen", actor, quoteId, status: "cancelled"
  });

  const ml = await t.run(async (ctx) => ctx.db.get(lineId));
  expect(ml?.quotePreparationStatus).toBe("ready_for_quote");
  expect(ml?.geconverteerdeOfferteId).toBeUndefined();
});

test("akkoord van offerte A bevrijdt de inmeetregels van de auto-geannuleerde offerte B", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);

  // Offerte B: concept met een geïmporteerde inmeetregel.
  const quoteB = await draftQuote(t, ids, "OFF-2026-B");
  const lineB = await convertedLine(t, ids, quoteB);

  // Offerte A: geprijsde regel zodat 'accepted' door de prijsreview-gate komt.
  const quoteA = await draftQuote(t, ids, "OFF-2026-A");
  await t.mutation(api.portal.addQuoteLine, {
    tenantSlug: "henke-wonen", actor, quoteId: quoteA, regelType: "product",
    titel: "PVC dryback", aantal: 10, eenheid: "m2", eenheidsprijsExBtw: 50, btwTarief: 21, sortOrder: 1
  });

  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen", actor, quoteId: quoteA, status: "accepted"
  });

  // B is auto-geannuleerd én z'n inmeetregel is weer beschikbaar.
  const qB = await t.run(async (ctx) => ctx.db.get(quoteB));
  expect(qB?.status).toBe("cancelled");
  const ml = await t.run(async (ctx) => ctx.db.get(lineB));
  expect(ml?.quotePreparationStatus).toBe("ready_for_quote");
  expect(ml?.geconverteerdeOfferteId).toBeUndefined();
});
