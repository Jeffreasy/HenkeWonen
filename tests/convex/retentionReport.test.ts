import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { internal } from "../../convex/_generated/api";
import { computeRetentionReport } from "../../convex/beheer/retention";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const JAAR_MS = 365 * 24 * 60 * 60 * 1000;
// Vast referentiemoment zodat de telling reproduceerbaar is.
const NOW = 1_900_000_000_000;

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

/**
 * Seedt een omgeving met een mix van oude/nieuwe data die precies één kandidaat per
 * retentie-categorie oplevert (voor een bewaargrens van 7 jaar t.o.v. NOW).
 */
async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen",
      naam: "Henke Wonen",
      status: "active",
      aangemaaktOp: NOW,
      gewijzigdOp: NOW
    });

    async function klant(fields: Record<string, unknown>) {
      return await ctx.db.insert("customers", {
        tenantId,
        type: "private",
        weergaveNaam: "Klant",
        status: "active",
        aangemaaktOp: NOW,
        gewijzigdOp: NOW,
        ...fields
      });
    }

    // A: geanonimiseerd, oude factuur (8 jaar) → volledig opschoonbaar + oude factuur.
    const klantA = await klant({ geanonimiseerdOp: NOW - 8 * JAAR_MS, status: "archived" });
    // B: geanonimiseerd, recente factuur (1 jaar) → wel geanonimiseerd, niet opschoonbaar.
    const klantB = await klant({ geanonimiseerdOp: NOW - JAAR_MS, status: "archived" });
    // C: actief, geen facturen, recent → geen kandidaat.
    await klant({ status: "active", gewijzigdOp: NOW });
    // D: gearchiveerd, geen facturen, 8 jaar niet aangeraakt → inactief-opschoonkandidaat.
    await klant({ status: "archived", gewijzigdOp: NOW - 8 * JAAR_MS });

    async function project(fields: Record<string, unknown>) {
      return await ctx.db.insert("projects", {
        tenantId,
        klantId: klantA,
        titel: "Project",
        status: "lead",
        aangemaaktOp: NOW,
        gewijzigdOp: NOW,
        ...fields
      });
    }

    // Afgesloten project ouder dan de grens.
    await project({ status: "closed", afgeslotenOp: NOW - 8 * JAAR_MS });
    // Lopend project → geen kandidaat.
    await project({ status: "lead" });

    async function factuur(klantId: any, factuurdatum: number, nummer: string) {
      const projectId = await ctx.db.insert("projects", {
        tenantId,
        klantId,
        titel: "Factuurproject",
        status: "paid",
        aangemaaktOp: NOW,
        gewijzigdOp: NOW
      });
      await ctx.db.insert("invoices", {
        tenantId,
        projectId,
        klantId,
        factuurnummer: nummer,
        status: "paid",
        factuurdatum,
        vervaldatum: factuurdatum,
        subtotaalExBtw: 100,
        btwTotaal: 21,
        totaalInclBtw: 121,
        betaaldBedrag: 121,
        aangemaaktOp: NOW,
        gewijzigdOp: NOW
      });
    }

    await factuur(klantA, NOW - 8 * JAAR_MS, "FAC-OLD");
    await factuur(klantB, NOW - JAAR_MS, "FAC-NEW");

    return { tenantId };
  });
}

test("computeRetentionReport telt de opschoonkandidaten correct", async () => {
  const t = convexTest(schema, modules);
  const { tenantId } = await seed(t);

  const report = await t.run(async (ctx) => {
    const tenant = await ctx.db.get(tenantId);
    return await computeRetentionReport(ctx, tenant!, {
      referentieDatum: NOW,
      bewaartermijnJaren: 7
    });
  });

  expect(report.facturen).toEqual({ totaal: 2, ouderDanGrens: 1 });
  expect(report.klanten.totaal).toBe(4);
  expect(report.klanten.geanonimiseerd).toBe(2);
  expect(report.klanten.geanonimiseerdVolledigOpschoonbaar).toBe(1);
  expect(report.klanten.inactiefZonderFacturenOuderDanGrens).toBe(1);
  // 2 "losse" projecten (closed + lead) + 2 factuurprojecten = 4; 1 afgesloten > grens.
  expect(report.projecten.totaal).toBe(4);
  expect(report.projecten.afgeslotenOuderDanGrens).toBe(1);
});

test("retentionReport (internalQuery) draait per tenant met instelbare termijn", async () => {
  const t = convexTest(schema, modules);
  await seed(t);

  // Met een korte termijn (1 jaar) passeert óók de recente factuur de grens niet meer:
  // de grens ligt op NOW - 1 jaar, dus de 1-jaar-oude factuur valt er net op/over.
  const report = await t.query(internal.beheer.retention.retentionReport, {
    tenantSlug: "henke-wonen",
    bewaartermijnJaren: 7,
    nowMs: NOW
  });

  expect(report.tenant).toBe("henke-wonen");
  expect(report.bewaartermijnJaren).toBe(7);
  expect(report.bewaargrensMs).toBe(NOW - 7 * JAAR_MS);
  expect(report.facturen.ouderDanGrens).toBe(1);
});
