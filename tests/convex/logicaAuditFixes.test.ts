import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { computeProjectNextStep } from "../../convex/projecten/nextStep";
import { fieldBucket } from "../../convex/projecten/fieldService";

// convex-test laadt de functie-modules; tests staan buiten convex/, dus expliciet de glob.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

function stubAuth() {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
}

async function base(t: ReturnType<typeof convexTest>, projectStatus = "quote_draft") {
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
      email: "a@henke.nl",
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
      status: projectStatus as Doc<"projects">["status"],
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return { tenantId, customerId, projectId };
  });
}

async function insertQuote(
  t: ReturnType<typeof convexTest>,
  ids: { tenantId: Id<"tenants">; customerId: Id<"customers">; projectId: Id<"projects"> },
  status: Doc<"quotes">["status"],
  offertenummer: string
) {
  const now = Date.now();
  return await t.run(async (ctx) =>
    ctx.db.insert("quotes", {
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      klantId: ids.customerId,
      offertenummer,
      titel: "Offerte",
      status,
      subtotaalExBtw: 826.45,
      btwTotaal: 173.55,
      totaalInclBtw: 1000,
      aangemaaktOp: now,
      gewijzigdOp: now
    })
  );
}

// ---------------------------------------------------------------------------
// F7 — offerte-poort checkt het netto-totaal (korting > subtotaal = negatief)
// ---------------------------------------------------------------------------
describe("F7: negatief offertetotaal", () => {
  test("een korting groter dan het subtotaal blokkeert 'sent' (geen negatieve offerte)", async () => {
    stubAuth();
    const t = convexTest(schema, modules);
    const ids = await base(t);
    const quoteId = await insertQuote(t, ids, "draft", "OFF-2026-1");

    await t.mutation(api.portal.addQuoteLine, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(quoteId),
      regelType: "product",
      titel: "Floorlife PVC dryback",
      aantal: 1,
      eenheid: "m2",
      eenheidsprijsExBtw: 100,
      btwTarief: 21,
      sortOrder: 1
    });
    await t.mutation(api.portal.addQuoteLine, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(quoteId),
      regelType: "discount",
      titel: "Korting",
      aantal: 1,
      eenheid: "stuk",
      eenheidsprijsExBtw: -500,
      btwTarief: 21,
      sortOrder: 2
    });

    await expect(
      t.mutation(api.portal.updateQuoteStatus, {
        tenantSlug: "henke-wonen",
        actor,
        quoteId: String(quoteId),
        status: "sent"
      })
    ).rejects.toThrow(/negatief|€\s*0/i);
  });

  test("een positief netto-totaal mag wél verstuurd worden", async () => {
    stubAuth();
    const t = convexTest(schema, modules);
    const ids = await base(t);
    const quoteId = await insertQuote(t, ids, "draft", "OFF-2026-2");

    await t.mutation(api.portal.addQuoteLine, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(quoteId),
      regelType: "product",
      titel: "Floorlife PVC dryback",
      aantal: 1,
      eenheid: "m2",
      eenheidsprijsExBtw: 100,
      btwTarief: 21,
      sortOrder: 1
    });
    await t.mutation(api.portal.addQuoteLine, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(quoteId),
      regelType: "discount",
      titel: "Korting",
      aantal: 1,
      eenheid: "stuk",
      eenheidsprijsExBtw: -40,
      btwTarief: 21,
      sortOrder: 2
    });

    await t.mutation(api.portal.updateQuoteStatus, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(quoteId),
      status: "sent"
    });
    const quote = await t.run(async (ctx) => ctx.db.get(quoteId));
    expect(quote?.status).toBe("sent");
  });
});

// ---------------------------------------------------------------------------
// F4 — updateQuoteStatus: geen herleving van terminale offertes + één leidende accepted
// ---------------------------------------------------------------------------
describe("F4: offerte-statusovergangen", () => {
  test("een afgewezen offerte kan niet herleven naar 'accepted'", async () => {
    stubAuth();
    const t = convexTest(schema, modules);
    const ids = await base(t, "quote_rejected");
    const quoteId = await insertQuote(t, ids, "rejected", "OFF-2026-3");

    await expect(
      t.mutation(api.portal.updateQuoteStatus, {
        tenantSlug: "henke-wonen",
        actor,
        quoteId: String(quoteId),
        status: "accepted"
      })
    ).rejects.toThrow(/herleven|afgewezen|geannuleerd|verlopen/i);
  });

  test("een geannuleerde offerte mag wél terug naar concept (om te herzien)", async () => {
    stubAuth();
    const t = convexTest(schema, modules);
    const ids = await base(t, "cancelled");
    const quoteId = await insertQuote(t, ids, "cancelled", "OFF-2026-4");

    await t.mutation(api.portal.updateQuoteStatus, {
      tenantSlug: "henke-wonen",
      actor,
      quoteId: String(quoteId),
      status: "draft"
    });
    const quote = await t.run(async (ctx) => ctx.db.get(quoteId));
    expect(quote?.status).toBe("draft");
  });

  test("een tweede offerte op akkoord zetten faalt als er al één geaccepteerd is", async () => {
    stubAuth();
    const t = convexTest(schema, modules);
    const ids = await base(t, "quote_accepted");
    // Offerte A staat al op akkoord; B is een tweede offerte op hetzelfde dossier.
    await insertQuote(t, ids, "accepted", "OFF-2026-5A");
    const quoteB = await insertQuote(t, ids, "draft", "OFF-2026-5B");

    await expect(
      t.mutation(api.portal.updateQuoteStatus, {
        tenantSlug: "henke-wonen",
        actor,
        quoteId: String(quoteB),
        status: "accepted"
      })
    ).rejects.toThrow(/al een geaccepteerde offerte/i);
  });
});

// ---------------------------------------------------------------------------
// F5 — markInvoicePaid accumuleert deelbetalingen + bevriest een betaalde factuur
// ---------------------------------------------------------------------------
describe("F5: deelbetalingen", () => {
  async function insertInvoice(
    t: ReturnType<typeof convexTest>,
    ids: { tenantId: Id<"tenants">; customerId: Id<"customers">; projectId: Id<"projects"> }
  ) {
    const now = Date.now();
    return await t.run(async (ctx) =>
      ctx.db.insert("invoices", {
        tenantId: ids.tenantId,
        projectId: ids.projectId,
        klantId: ids.customerId,
        factuurnummer: "FAC-2026-010",
        status: "sent",
        factuurdatum: now,
        vervaldatum: now + 14 * 86400000,
        subtotaalExBtw: 826.45,
        btwTotaal: 173.55,
        totaalInclBtw: 1000,
        betaaldBedrag: 0,
        aangemaaktOp: now,
        gewijzigdOp: now
      })
    );
  }

  test("twee deelbetalingen tellen op (300 + 400 = 700), niet overschrijven", async () => {
    stubAuth();
    const t = convexTest(schema, modules);
    const ids = await base(t, "invoiced");
    const invoiceId = await insertInvoice(t, ids);

    await t.mutation(api.portal.markInvoicePaid, {
      tenantSlug: "henke-wonen",
      actor,
      invoiceId: String(invoiceId),
      betaaldBedrag: 300
    });
    await t.mutation(api.portal.markInvoicePaid, {
      tenantSlug: "henke-wonen",
      actor,
      invoiceId: String(invoiceId),
      betaaldBedrag: 400
    });

    const inv = await t.run(async (ctx) => ctx.db.get(invoiceId as Id<"invoices">));
    expect(inv?.betaaldBedrag).toBe(700);
    expect(inv?.status).toBe("partially_paid");
  });

  test("een volledig betaalde factuur kan niet opnieuw worden geboekt", async () => {
    stubAuth();
    const t = convexTest(schema, modules);
    const ids = await base(t, "invoiced");
    const invoiceId = await insertInvoice(t, ids);

    await t.mutation(api.portal.markInvoicePaid, {
      tenantSlug: "henke-wonen",
      actor,
      invoiceId: String(invoiceId),
      betaaldBedrag: 1000
    });

    await expect(
      t.mutation(api.portal.markInvoicePaid, {
        tenantSlug: "henke-wonen",
        actor,
        invoiceId: String(invoiceId),
        betaaldBedrag: 50
      })
    ).rejects.toThrow(/al volledig betaald/i);
  });
});

// ---------------------------------------------------------------------------
// F9 — 'invoiced' zonder factuur: bookkeeper-guard + banner degradeert i.p.v. dode knop
// ---------------------------------------------------------------------------
describe("F9: invoiced zonder factuur", () => {
  test("'Export boekhouder' faalt als er nog geen factuur is", async () => {
    stubAuth();
    const t = convexTest(schema, modules);
    const ids = await base(t, "invoiced");

    await expect(
      t.mutation(api.portal.processProjectAction, {
        tenantSlug: "henke-wonen",
        actor,
        projectId: String(ids.projectId),
        action: "bookkeeper_export_sent"
      })
    ).rejects.toThrow(/eerst een factuur/i);
  });

  test("computeProjectNextStep degradeert 'invoiced' zonder factuur naar een werkende handler", () => {
    const zonderFactuur = computeProjectNextStep({
      status: "invoiced",
      projectId: "p1",
      latestQuoteId: "q1",
      invoiceId: null
    });
    expect(zonderFactuur.kind).toBe("create_invoice");
    expect(zonderFactuur.href).toBeNull();

    const metFactuur = computeProjectNextStep({
      status: "invoiced",
      projectId: "p1",
      latestQuoteId: "q1",
      invoiceId: "inv1"
    });
    expect(metFactuur.kind).toBe("open_invoice");
    expect(metFactuur.href).toBe("/portal/facturen/inv1");
  });
});

// ---------------------------------------------------------------------------
// F2 — fieldBucket respecteert directeVerkoop (buitendienst toont 'Offerte', niet 'Inmeten')
// ---------------------------------------------------------------------------
describe("F2: directe verkoop in de buitendienst", () => {
  const now = Date.now();

  test("een directe-verkoop-lead valt in bucket 'quote', niet 'measure'", () => {
    const lead = { status: "lead", directeVerkoop: true } as unknown as Doc<"projects">;
    expect(fieldBucket(lead, undefined, undefined, now, [])).toBe("quote");
  });

  test("een gewone lead blijft in bucket 'measure'", () => {
    const lead = { status: "lead" } as unknown as Doc<"projects">;
    expect(fieldBucket(lead, undefined, undefined, now, [])).toBe("measure");
  });
});
