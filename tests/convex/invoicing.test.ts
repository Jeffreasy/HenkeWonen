import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { calculateLineTotals, nextInvoiceNumber } from "../../convex/portalUtils";

// convex-test laadt de functie-modules; tests staan buiten convex/, dus expliciet de glob.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

test("nextInvoiceNumber genereert een gatloze jaarreeks per tenant", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();

  const tenantId = await t.run(async (ctx) => {
    return await ctx.db.insert("tenants", {
      slug: "henke-wonen",
      naam: "Henke Wonen",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  const first = await t.run((ctx) => nextInvoiceNumber(ctx, tenantId));
  const second = await t.run((ctx) => nextInvoiceNumber(ctx, tenantId));
  const third = await t.run((ctx) => nextInvoiceNumber(ctx, tenantId));

  const year = new Date(now).getFullYear();
  expect(first).toBe(`FAC-${year}-001`);
  expect(second).toBe(`FAC-${year}-002`);
  expect(third).toBe(`FAC-${year}-003`);
});

test("calculateLineTotals: korting mag negatief; NaN/btw-grens worden geweigerd", () => {
  // Kortingsregel gebruikt legitiem een negatieve unitPriceExVat — moet toegestaan zijn.
  expect(calculateLineTotals("discount", 1, -50, 21).lineTotalExVat).toBe(-50);
  // Text-regel telt altijd op nul.
  expect(calculateLineTotals("text", 99, 99, 21).lineTotalExVat).toBe(0);
  // Niet-eindige bedragen en een btw buiten 0-100 worden geweigerd (batch-5-guard).
  expect(() => calculateLineTotals("product", Number.NaN, 10, 21)).toThrow();
  expect(() => calculateLineTotals("product", 1, Number.POSITIVE_INFINITY, 21)).toThrow();
  expect(() => calculateLineTotals("product", 1, 10, 150)).toThrow();
  expect(() => calculateLineTotals("product", 1, 10, -1)).toThrow();
});

test("createInvoiceFromQuote is idempotent: één factuur per offerte met gatloos nummer", async () => {
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
      status: "quote_accepted",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return await ctx.db.insert("quotes", {
      tenantId,
      projectId,
      klantId: customerId,
      offertenummer: "OFF-2026-1",
      titel: "Testofferte",
      status: "accepted",
      subtotaalExBtw: 100,
      btwTotaal: 21,
      totaalInclBtw: 121,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };
  const args = { tenantSlug: "henke-wonen", actor, quoteId, vervaldatum: now + 14 * 24 * 60 * 60 * 1000 };

  const first = await t.mutation(api.facturen.core.createInvoiceFromQuote, args);
  const second = await t.mutation(api.facturen.core.createInvoiceFromQuote, args);

  expect(first.alreadyExists).toBe(false);
  expect(second.alreadyExists).toBe(true);
  expect(second.invoiceNumber).toBe(first.invoiceNumber);

  const invoiceCount = await t.run(async (ctx) => (await ctx.db.query("invoices").collect()).length);
  expect(invoiceCount).toBe(1);

  // De vervaldatum-guard geldt alleen voor een nieuwe factuur: het idempotente
  // "bestaat al"-pad gebruikt existing.vervaldatum en mag dus niet stranden.
  const repeatWithBadDate = await t.mutation(api.facturen.core.createInvoiceFromQuote, {
    ...args,
    vervaldatum: Number.NaN
  });
  expect(repeatWithBadDate.alreadyExists).toBe(true);
});

test("createInvoiceFromQuote weigert een ongeldige vervaldatum voor een nieuwe factuur", async () => {
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
      status: "quote_accepted",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return await ctx.db.insert("quotes", {
      tenantId,
      projectId,
      klantId: customerId,
      offertenummer: "OFF-2026-2",
      titel: "Testofferte",
      status: "accepted",
      subtotaalExBtw: 100,
      btwTotaal: 21,
      totaalInclBtw: 121,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

  for (const vervaldatum of [Number.NaN, -1]) {
    await expect(
      t.mutation(api.facturen.core.createInvoiceFromQuote, {
        tenantSlug: "henke-wonen",
        actor,
        quoteId,
        vervaldatum
      })
    ).rejects.toThrow(/[Vv]ervaldatum/u);
  }

  const invoiceCount = await t.run(async (ctx) => (await ctx.db.query("invoices").collect()).length);
  expect(invoiceCount).toBe(0);
});

test("createInvoice weigert €0-facturen en een ongeldige vervaldatum", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");

  const t = convexTest(schema, modules);
  const now = Date.now();
  const externalUserId = "dev-user-1";

  const { tenantId, customerId, projectId } = await t.run(async (ctx) => {
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
      status: "quote_accepted",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return { tenantId, customerId, projectId };
  });

  const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };
  const base = {
    tenantId,
    actor,
    projectId,
    klantId: customerId,
    vervaldatum: now + 14 * 24 * 60 * 60 * 1000
  };

  // €0-factuur (alle bedragen nul zijn onderling consistent, maar altijd een invoerfout).
  await expect(
    t.mutation(api.facturen.core.createInvoice, {
      ...base,
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0
    })
  ).rejects.toThrow(/€0/u);

  // Negatieve bedragen zijn geen geldige factuur (creditering loopt niet via deze mutatie).
  await expect(
    t.mutation(api.facturen.core.createInvoice, {
      ...base,
      subtotaalExBtw: -100,
      btwTotaal: -21,
      totaalInclBtw: -121
    })
  ).rejects.toThrow(/niet-negatieve/u);

  // NaN- of negatieve vervaldatum zou een factuur zonder bruikbare vervaldag opleveren.
  for (const vervaldatum of [Number.NaN, -1]) {
    await expect(
      t.mutation(api.facturen.core.createInvoice, {
        ...base,
        vervaldatum,
        subtotaalExBtw: 100,
        btwTotaal: 21,
        totaalInclBtw: 121
      })
    ).rejects.toThrow(/[Vv]ervaldatum/u);
  }

  // Geldige factuur blijft gewoon werken.
  const created = await t.mutation(api.facturen.core.createInvoice, {
    ...base,
    subtotaalExBtw: 100,
    btwTotaal: 21,
    totaalInclBtw: 121
  });
  expect(created.invoiceNumber).toMatch(/^FAC-/u);
});
