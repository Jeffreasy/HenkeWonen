import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const adminExternalId = "dev-admin-service-metadata";
const adminActor = {
  externalUserId: adminExternalId,
  authzToken: `dev.actor.henke-wonen.${adminExternalId}`
};

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

async function seedExistingServiceWithoutMetadata(t: ReturnType<typeof convexTest>) {
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
      externalUserId: adminExternalId,
      email: "admin@henke.nl",
      role: "admin",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const supplierId = await ctx.db.insert("suppliers", {
      tenantId,
      naam: "Henke Wonen Diensten",
      prijslijstStatus: "received",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const mainCategoryId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Werkzaamheden",
      slug: "werkzaamheden",
      sortOrder: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const subcategoryId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Traprenovatie (arbeid)",
      slug: "traprenovatie-arbeid",
      bovenliggendeCategorieId: mainCategoryId,
      sortOrder: 2,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const productId = await ctx.db.insert("products", {
      tenantId,
      categorieId: subcategoryId,
      leverancierId: supplierId,
      naam: "Deze naam bevat expres geen PVC of trapvorm",
      sku: "HW-DIENST-014",
      productAard: "service",
      eenheid: "piece",
      attributen: {
        product_type: "Dienst",
        price_unit_raw: "Vast"
      },
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("productPrices", {
      tenantId,
      productId,
      prijsSoort: "advice_retail",
      prijsEenheid: "piece",
      bedrag: 1795,
      btwTarief: 21,
      btwModus: "exclusive",
      currency: "EUR",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    return { tenantId, productId, supplierId, subcategoryId };
  });
}

test("servicecatalogus exposeert bestaande PVC-trapdienst via SKU-fallback en categoriehiërarchie", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedExistingServiceWithoutMetadata(t);

  const docs = await t.query(api.beheer.serviceCostRules.list, {
    tenantId: seeded.tenantId,
    actor: adminActor
  });

  expect(docs).toHaveLength(1);
  expect(docs[0]).toMatchObject({
    _id: String(seeded.productId),
    id: String(seeded.productId),
    productId: String(seeded.productId),
    sku: "HW-DIENST-014",
    category: "Werkzaamheden",
    subcategory: "Traprenovatie (arbeid)",
    prijsEenheid: "piece",
    priceUnit: "piece",
    productGroup: "stairs",
    serviceFamily: "stair_renovation",
    covering: "pvc",
    verkoopEenheid: "piece",
    eenheid: "piece",
    stairShape: "half_turn",
    serviceRole: "base_labor",
    sectionKey: "traprenovatie",
    serviceMetadata: {
      family: "stair_renovation",
      covering: "pvc",
      shape: "half_turn",
      role: "base_labor",
      sectionKey: "traprenovatie"
    },
    berekeningType: "fixed",
    prijsExBtw: 1795
  });

  const settingsRows = await t.query(api.beheer.serviceCostRules.listServiceRules, {
    tenantSlug: "henke-wonen",
    actor: adminActor
  });
  expect(settingsRows[0]).toMatchObject({
    id: String(seeded.productId),
    productId: String(seeded.productId),
    sku: "HW-DIENST-014",
    category: "Werkzaamheden",
    subcategory: "Traprenovatie (arbeid)",
    priceUnit: "piece",
    productGroup: "stairs",
    serviceFamily: "stair_renovation",
    covering: "pvc",
    stairShape: "half_turn",
    serviceRole: "base_labor",
    sectionKey: "traprenovatie"
  });
});

test("dienstcatalogus blijft na leveranciershernoeming beperkt tot actieve diensten", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedExistingServiceWithoutMetadata(t);
  const now = Date.now();

  const excludedProductIds = await t.run(async (ctx) => {
    await ctx.db.patch(seeded.supplierId, {
      naam: "Interne werkzaamheden - hernoemd",
      gewijzigdOp: now
    });
    const productId = await ctx.db.insert("products", {
      tenantId: seeded.tenantId,
      categorieId: seeded.subcategoryId,
      leverancierId: seeded.supplierId,
      naam: "Gewoon bestelbaar product bij dezelfde leverancier",
      sku: "GEEN-DIENST",
      productAard: "standard",
      eenheid: "piece",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("productPrices", {
      tenantId: seeded.tenantId,
      productId,
      prijsSoort: "advice_retail",
      prijsEenheid: "piece",
      bedrag: 25,
      btwTarief: 21,
      btwModus: "exclusive",
      currency: "EUR",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const inactiveServiceId = await ctx.db.insert("products", {
      tenantId: seeded.tenantId,
      categorieId: seeded.subcategoryId,
      leverancierId: seeded.supplierId,
      naam: "Inactieve dienst met geldige verkoopprijs",
      sku: "INACTIEVE-DIENST",
      productAard: "service",
      eenheid: "piece",
      status: "inactive",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("productPrices", {
      tenantId: seeded.tenantId,
      productId: inactiveServiceId,
      prijsSoort: "advice_retail",
      prijsEenheid: "piece",
      bedrag: 50,
      btwTarief: 21,
      btwModus: "exclusive",
      currency: "EUR",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return [productId, inactiveServiceId];
  });

  const docs = await t.query(api.beheer.serviceCostRules.list, {
    tenantId: seeded.tenantId,
    actor: adminActor
  });

  expect(docs.map((doc) => doc.productId)).toEqual([String(seeded.productId)]);
  const excludedProductIdStrings = excludedProductIds.map(String);
  expect(docs.some((doc) => excludedProductIdStrings.includes(doc.productId))).toBe(false);
  expect(docs.every((doc) => doc.status === "active")).toBe(true);

  const settingsRows = await t.query(api.beheer.serviceCostRules.listServiceRules, {
    tenantSlug: "henke-wonen",
    actor: adminActor
  });
  expect(settingsRows.map((doc) => doc.productId)).toEqual([String(seeded.productId)]);
});
