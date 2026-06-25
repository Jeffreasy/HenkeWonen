import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

async function seed(t: ReturnType<typeof convexTest>) {
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
    const klantId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Testklant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId,
      klantId,
      titel: "Testproject",
      status: "quote_accepted",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const categorieId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Vloeren",
      slug: "vloeren",
      sortOrder: 0,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const supplierA = await ctx.db.insert("suppliers", {
      tenantId,
      naam: "Leverancier A",
      prijslijstStatus: "received",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const supplierB = await ctx.db.insert("suppliers", {
      tenantId,
      naam: "Leverancier B",
      prijslijstStatus: "received",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    async function product(naam: string, leverancierId: any, artikelnummer?: string) {
      return await ctx.db.insert("products", {
        tenantId,
        categorieId,
        leverancierId,
        artikelnummer,
        naam,
        productAard: "standard",
        eenheid: "m2",
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    const prodA1 = await product("PVC A1", supplierA, "A-001");
    const prodA2 = await product("PVC A2", supplierA, "A-002");
    const prodB1 = await product("Plint B1", supplierB, "B-001");
    const prodNoSup = await product("Los product", undefined);

    // Inkoopprijzen: prodA1 net_purchase 20 + purchase 25 → net_purchase wint; prodA2 alleen purchase 30;
    // prodB1 net_purchase 5; prodNoSup geen prijs.
    async function price(productId: any, prijsSoort: string, bedrag: number) {
      await ctx.db.insert("productPrices", {
        tenantId,
        productId,
        prijsSoort: prijsSoort as any,
        prijsEenheid: "m2",
        bedrag,
        btwTarief: 21,
        btwModus: "exclusive",
        currency: "EUR",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }
    await price(prodA1, "purchase", 25);
    await price(prodA1, "net_purchase", 20);
    await price(prodA2, "purchase", 30);
    await price(prodB1, "net_purchase", 5);

    const quoteId = await ctx.db.insert("quotes", {
      tenantId,
      projectId,
      klantId,
      offertenummer: "OFF-1",
      titel: "Testofferte",
      status: "accepted",
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    async function qline(productId: any, regelType: string, titel: string, aantal: number, sortOrder: number) {
      await ctx.db.insert("quoteLines", {
        tenantId,
        quoteId,
        productId,
        regelType: regelType as any,
        titel,
        aantal,
        eenheid: "m2",
        eenheidsprijsExBtw: 50,
        btwTarief: 21,
        regelTotaalExBtw: aantal * 50,
        regelBtwTotaal: 0,
        regelTotaalInclBtw: 0,
        sortOrder,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }
    await qline(prodA1, "product", "PVC A1", 10, 1);
    await qline(prodA2, "product", "PVC A2", 4, 2);
    await qline(prodB1, "product", "Plint B1", 8, 3);
    await qline(prodNoSup, "product", "Los product", 2, 4);
    await qline(undefined, "service", "Leggen", 10, 5); // niet-product → overgeslagen

    return { tenantId, projectId, supplierA, supplierB };
  });
}

test("generateSupplierOrdersFromQuote groepeert per leverancier en kiest net_purchase", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);

  const result = await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });

  // Leverancier A (2 regels), Leverancier B (1), Onbekend (1) = 3 orders.
  expect(result.created).toBe(3);

  const orders = await t.query(api.portal.listSupplierOrders, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });
  expect(orders).toHaveLength(3);

  const a = orders.find((o) => o.leverancierNaam === "Leverancier A");
  expect(a?.regelAantal).toBe(2);
  // A1: net_purchase 20 * 10 = 200; A2: purchase 30 * 4 = 120 → 320.
  expect(a?.totaalInkoopExBtw).toBe(320);

  const onbekend = orders.find((o) => !o.leverancierId);
  expect(onbekend?.regelAantal).toBe(1);
  expect(onbekend?.totaalInkoopExBtw).toBe(0); // geen inkoopprijs
});

test("generate geeft waarschuwingen voor niet-product, geen leverancier en geen inkoopprijs", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);

  const result = await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });

  const joined = result.warnings.join(" ");
  expect(joined).toMatch(/niet-product-regel/);
  expect(joined).toMatch(/zonder leverancier/);
  expect(joined).toMatch(/zonder inkoopprijs/);
});

test("regenereren vervangt bestaande drafts (idempotent)", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);

  await t.mutation(api.portal.generateSupplierOrdersFromQuote, { tenantSlug: "henke-wonen", actor, projectId });
  const second = await t.mutation(api.portal.generateSupplierOrdersFromQuote, { tenantSlug: "henke-wonen", actor, projectId });

  expect(second.created).toBe(3);
  const orders = await t.query(api.portal.listSupplierOrders, { tenantSlug: "henke-wonen", actor, projectId });
  expect(orders).toHaveLength(3); // geen dubbele
});

test("een reeds geplaatste (ordered) bestelling blijft bij regenereren behouden", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);

  const orders = (await t.mutation(api.portal.generateSupplierOrdersFromQuote, { tenantSlug: "henke-wonen", actor, projectId }), await t.query(api.portal.listSupplierOrders, { tenantSlug: "henke-wonen", actor, projectId }));
  const a = orders.find((o) => o.leverancierNaam === "Leverancier A")!;

  await t.mutation(api.portal.updateSupplierOrderStatus, { tenantSlug: "henke-wonen", actor, bestellingId: a.id, status: "ordered" });

  const regen = await t.mutation(api.portal.generateSupplierOrdersFromQuote, { tenantSlug: "henke-wonen", actor, projectId });
  expect(regen.skipped).toBeGreaterThanOrEqual(1);

  const after = await t.query(api.portal.listSupplierOrders, { tenantSlug: "henke-wonen", actor, projectId });
  const aAfter = after.find((o) => o.id === a.id);
  expect(aAfter?.status).toBe("ordered"); // niet vervangen
});

test("generate zonder geaccepteerde offerte gooit een fout", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);
  // Zet de offerte op draft.
  await t.run(async (ctx) => {
    const quotes = await ctx.db.query("quotes").collect();
    for (const q of quotes) await ctx.db.patch(q._id, { status: "draft" });
  });

  await expect(
    t.mutation(api.portal.generateSupplierOrdersFromQuote, { tenantSlug: "henke-wonen", actor, projectId })
  ).rejects.toThrow();
});
