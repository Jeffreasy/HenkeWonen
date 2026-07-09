import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const adminUserId = "dev-admin-1";
const adminActor = { externalUserId: adminUserId, authzToken: `dev.actor.henke-wonen.${adminUserId}` };

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

async function seedSupplierWithPrices(t: ReturnType<typeof convexTest>) {
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
      externalUserId: adminUserId,
      email: "admin@henke.nl",
      role: "admin",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const leverancierId = await ctx.db.insert("suppliers", {
      tenantId,
      naam: "Testleverancier",
      prijslijstStatus: "received",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const categorieId = await ctx.db.insert("categories", {
      tenantId,
      naam: "PVC",
      slug: "pvc",
      sortOrder: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const productId = await ctx.db.insert("products", {
      tenantId,
      categorieId,
      leverancierId,
      naam: "Testvloer",
      sku: "TST-1",
      productAard: "standard",
      eenheid: "m2",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const advicePriceId = await ctx.db.insert("productPrices", {
      tenantId,
      productId,
      prijsSoort: "advice_retail",
      prijsEenheid: "m2",
      bedrag: 39.95,
      btwTarief: 21,
      btwModus: "exclusive",
      currency: "EUR",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const purchasePriceId = await ctx.db.insert("productPrices", {
      tenantId,
      productId,
      prijsSoort: "net_purchase",
      prijsEenheid: "m2",
      bedrag: 19.95,
      btwTarief: 21,
      btwModus: "exclusive",
      currency: "EUR",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    return { tenantId, leverancierId, productId, advicePriceId, purchasePriceId };
  });
}

test("setSupplierSalesVatMode zet adviesprijzen om en legt de keuze op de leverancier vast", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedSupplierWithPrices(t);

  // Default is dry-run: er mag niets wijzigen.
  const dry = await t.mutation(api.catalog.v2_import.setSupplierSalesVatMode, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    supplierName: "Testleverancier",
    mode: "inclusive"
  });
  expect(dry.supplierFound).toBe(true);
  expect(dry.wouldPatch).toBe(1);
  await t.run(async (ctx) => {
    expect((await ctx.db.get(seeded.advicePriceId))?.btwModus).toBe("exclusive");
    expect((await ctx.db.get(seeded.leverancierId))?.verkoopBtwModus).toBeUndefined();
  });

  // Echte run: adviesprijs om, inkoopprijs blijft exclusief, keuze op de leverancier.
  let cursor: string | undefined;
  let patched = 0;
  do {
    const result = await t.mutation(api.catalog.v2_import.setSupplierSalesVatMode, {
      tenantSlug: "henke-wonen",
      actor: adminActor,
      supplierName: "Testleverancier",
      mode: "inclusive",
      dryRun: false,
      cursor
    });
    patched += result.patched;
    cursor = result.isDone ? undefined : (result.continueCursor ?? undefined);
  } while (cursor);

  expect(patched).toBe(1);
  await t.run(async (ctx) => {
    expect((await ctx.db.get(seeded.advicePriceId))?.btwModus).toBe("inclusive");
    expect((await ctx.db.get(seeded.purchasePriceId))?.btwModus).toBe("exclusive");
    expect((await ctx.db.get(seeded.leverancierId))?.verkoopBtwModus).toBe("inclusive");
  });
});

test("importChunk volgt de portaal-instelling van de leverancier boven de aangeleverde btw-modus", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedSupplierWithPrices(t);

  await t.run(async (ctx) => {
    await ctx.db.patch(seeded.leverancierId, { verkoopBtwModus: "inclusive" });
  });

  // De pipeline levert "exclusive" aan (vat_config-default), maar de portaal-keuze wint.
  await t.mutation(api.catalog.v2_import.importChunk, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    rows: [
      {
        supplier: "Testleverancier",
        main_category: "Vloeren",
        sub_category: "PVC",
        product_type: "Dryback",
        product_name: "Herimport-vloer",
        sku: "TST-2",
        sales_price: 44.95,
        sales_vat_mode: "exclusive",
        vat_rate: 21,
        price_unit: "m2",
        unit: "m2"
      }
    ]
  });

  await t.run(async (ctx) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", seeded.tenantId))
      .filter((q: any) => q.eq(q.field("sku"), "TST-2"))
      .first();
    expect(product).not.toBeNull();
    const prices = await ctx.db
      .query("productPrices")
      .withIndex("by_product", (q: any) =>
        q.eq("tenantId", seeded.tenantId).eq("productId", product!._id)
      )
      .collect();
    const advice = prices.find((price) => price.prijsSoort === "advice_retail");
    expect(advice?.btwModus).toBe("inclusive");
  });
});

test("importChunk zonder leveranciersinstelling volgt de aangeleverde btw-modus", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedSupplierWithPrices(t);

  await t.mutation(api.catalog.v2_import.importChunk, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    rows: [
      {
        supplier: "Testleverancier",
        main_category: "Vloeren",
        sub_category: "PVC",
        product_type: "Dryback",
        product_name: "Default-vloer",
        sku: "TST-3",
        sales_price: 29.95,
        sales_vat_mode: "exclusive",
        vat_rate: 21,
        price_unit: "m2",
        unit: "m2"
      }
    ]
  });

  await t.run(async (ctx) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", seeded.tenantId))
      .filter((q: any) => q.eq(q.field("sku"), "TST-3"))
      .first();
    const prices = await ctx.db
      .query("productPrices")
      .withIndex("by_product", (q: any) =>
        q.eq("tenantId", seeded.tenantId).eq("productId", product!._id)
      )
      .collect();
    const advice = prices.find((price) => price.prijsSoort === "advice_retail");
    expect(advice?.btwModus).toBe("exclusive");
  });
});
