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

async function base(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen", naam: "Henke Wonen", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId, externalUserId, email: "a@henke.nl", role: "admin", aangemaaktOp: now, gewijzigdOp: now
    });
    const customerId = await ctx.db.insert("customers", {
      tenantId, type: "private", weergaveNaam: "Testklant", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId, klantId: customerId, titel: "Testproject", status: "invoiced", aangemaaktOp: now, gewijzigdOp: now
    });
    return { tenantId, customerId, projectId };
  });
}

test("markInvoicePaid capt overbetaling op het factuurtotaal (geen negatief openstaand)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const now = Date.now();
  const invoiceId = await t.run(async (ctx) =>
    ctx.db.insert("invoices", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      factuurnummer: "FAC-2026-001", status: "sent", factuurdatum: now, vervaldatum: now + 14 * 86400000,
      subtotaalExBtw: 826.45, btwTotaal: 173.55, totaalInclBtw: 1000, betaaldBedrag: 0,
      aangemaaktOp: now, gewijzigdOp: now
    })
  );

  await t.mutation(api.portal.markInvoicePaid, {
    tenantSlug: "henke-wonen", actor, invoiceId: String(invoiceId), betaaldBedrag: 1500
  });

  const inv = await t.run(async (ctx) => ctx.db.get(invoiceId as Id<"invoices">));
  expect(inv?.betaaldBedrag).toBe(1000); // gecapt op het totaal, niet 1500
  expect(inv?.status).toBe("paid");
});

test("updateQuoteStatus weigert een al-gefactureerde offerte terug naar concept", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const now = Date.now();
  const quoteId = await t.run(async (ctx) => {
    const qid = await ctx.db.insert("quotes", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      offertenummer: "OFF-2026-1", titel: "Offerte", status: "accepted",
      subtotaalExBtw: 826.45, btwTotaal: 173.55, totaalInclBtw: 1000, aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("invoices", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId, quoteId: qid,
      factuurnummer: "FAC-2026-002", status: "sent", factuurdatum: now, vervaldatum: now + 14 * 86400000,
      subtotaalExBtw: 826.45, btwTotaal: 173.55, totaalInclBtw: 1000, betaaldBedrag: 0,
      aangemaaktOp: now, gewijzigdOp: now
    });
    return qid;
  });

  await expect(
    t.mutation(api.portal.updateQuoteStatus, {
      tenantSlug: "henke-wonen", actor, quoteId: String(quoteId), status: "draft"
    })
  ).rejects.toThrow(/gefactureerd/i);
});
