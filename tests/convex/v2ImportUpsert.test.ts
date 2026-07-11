import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const adminExternalId = "dev-admin-1";
const adminActor = {
  externalUserId: adminExternalId,
  authzToken: `dev.actor.henke-wonen.${adminExternalId}`
};

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

async function seed(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen",
      naam: "Henke Wonen",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId,
      externalUserId: adminExternalId,
      email: "admin@henke.nl",
      role: "admin",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    supplier: "TestLev",
    main_category: "Vloeren",
    sub_category: "PVC",
    product_type: "Dryback",
    product_name: "Testplank eiken",
    sku: "TL-001",
    sales_price: 39.95,
    sales_vat_mode: "exclusive" as const,
    vat_rate: 21,
    price_unit: "per m2",
    unit: "m2",
    ...overrides
  };
}

async function importRows(t: ReturnType<typeof convexTest>, rows: unknown[]) {
  return await t.mutation(api.catalog.v2_import.importChunk, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    rows: rows as never
  });
}

/**
 * De V2-import is een upsert op leverancier+sku: her-imports houden
 * productId's stabiel (offertes/bestellingen verwijzen ernaar) en vervangen
 * alleen de prijsrijen; verdwenen sku's worden gearchiveerd, niet gewist.
 */
test("her-import van dezelfde sku werkt het product bij i.p.v. een duplicaat te maken", async () => {
  const t = convexTest(schema, modules);
  await seed(t);

  const first = await importRows(t, [row()]);
  expect(first).toMatchObject({ inserted: 1, updated: 0 });

  const idBefore = await t.run(async (ctx) => (await ctx.db.query("products").collect())[0]._id);

  const second = await importRows(t, [
    row({
      product_name: "Testplank eiken naturel",
      description: "Arbeidloze testregel",
      sales_price: 42.5
    })
  ]);
  expect(second).toMatchObject({ inserted: 0, updated: 1 });

  await t.run(async (ctx) => {
    const products = await ctx.db.query("products").collect();
    expect(products).toHaveLength(1);
    expect(products[0]._id).toBe(idBefore); // stabiel productId
    expect(products[0].naam).toBe("Testplank eiken naturel");
    expect(products[0].omschrijving).toBe("Arbeidloze testregel");

    const prices = await ctx.db.query("productPrices").collect();
    expect(prices).toHaveLength(1); // oude prijsrij vervangen, niet gestapeld
    expect(prices[0].bedrag).toBe(42.5);
  });
});

test("verdwenen sku's worden gearchiveerd; aangeraakte producten blijven actief", async () => {
  const t = convexTest(schema, modules);
  await seed(t);

  await importRows(t, [row(), row({ sku: "TL-002", product_name: "Testplank walnoot" })]);

  // Volgende run: TL-002 staat niet meer op de prijslijst.
  await new Promise((resolve) => setTimeout(resolve, 10));
  const runStart = Date.now();
  await importRows(t, [row({ sales_price: 44.95 })]);

  const result = await t.mutation(api.catalog.v2_import.archiveVanishedProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    supplierName: "TestLev",
    runStartMs: runStart
  });
  expect(result).toMatchObject({ supplierFound: true, archived: 1, isDone: true });

  await t.run(async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const bySku = new Map(products.map((product) => [product.sku, product]));
    expect(bySku.get("TL-001")?.status).toBe("active");
    expect(bySku.get("TL-002")?.status).toBe("archived"); // koppeling blijft, picker toont hem niet meer
  });
});
