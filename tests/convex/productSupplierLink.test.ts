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
    const categorieId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Vloeren",
      slug: "vloeren",
      sortOrder: 0,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const supplierId = await ctx.db.insert("suppliers", {
      tenantId,
      naam: "Leverancier A",
      prijslijstStatus: "received",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    // Product zonder leverancier — dit is precies het geval dat bij bestellen
    // onder "Leverancier onbekend" belandt (de audit-bevinding).
    const productId = await ctx.db.insert("products", {
      tenantId,
      categorieId,
      leverancierId: undefined,
      naam: "Los product",
      productAard: "standard",
      eenheid: "m2",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    return { tenantId, categorieId, supplierId, productId };
  });
}

test("updateProductForPortal koppelt een product aan een leverancier (leverancierId gezet)", async () => {
  const t = convexTest(schema, modules);
  const { supplierId, productId } = await seed(t);

  await t.mutation(api.catalog.core.updateProductForPortal, {
    tenantSlug: "henke-wonen",
    actor,
    productId: String(productId),
    naam: "Los product",
    leverancierId: String(supplierId),
    status: "active"
  });

  const product = await t.run(async (ctx) => ctx.db.get(productId));
  expect(String(product!.leverancierId)).toBe(String(supplierId));
});

test("een lege leverancierId ontkoppelt het product weer", async () => {
  const t = convexTest(schema, modules);
  const { supplierId, productId } = await seed(t);
  await t.run(async (ctx) => ctx.db.patch(productId, { leverancierId: supplierId }));

  await t.mutation(api.catalog.core.updateProductForPortal, {
    tenantSlug: "henke-wonen",
    actor,
    productId: String(productId),
    naam: "Los product",
    leverancierId: "",
    status: "active"
  });

  const product = await t.run(async (ctx) => ctx.db.get(productId));
  expect(product!.leverancierId).toBeUndefined();
});

test("een leverancier van een andere tenant wordt geweigerd (tenant-isolatie)", async () => {
  const t = convexTest(schema, modules);
  const { productId } = await seed(t);

  const foreignSupplierId = await t.run(async (ctx) => {
    const now = Date.now();
    const otherTenantId = await ctx.db.insert("tenants", {
      slug: "andere-winkel",
      naam: "Andere Winkel",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return await ctx.db.insert("suppliers", {
      tenantId: otherTenantId,
      naam: "Vreemde leverancier",
      prijslijstStatus: "received",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  await expect(
    t.mutation(api.catalog.core.updateProductForPortal, {
      tenantSlug: "henke-wonen",
      actor,
      productId: String(productId),
      naam: "Los product",
      leverancierId: String(foreignSupplierId),
      status: "active"
    })
  ).rejects.toThrow(/Leverancier niet gevonden/);
});

test("weglaten van leverancierId laat de bestaande koppeling ongemoeid", async () => {
  const t = convexTest(schema, modules);
  const { supplierId, productId } = await seed(t);
  await t.run(async (ctx) => ctx.db.patch(productId, { leverancierId: supplierId }));

  // Alleen de naam wijzigen, GEEN leverancierId meesturen (zoals de status-actie doet).
  await t.mutation(api.catalog.core.updateProductForPortal, {
    tenantSlug: "henke-wonen",
    actor,
    productId: String(productId),
    naam: "Nieuwe naam",
    status: "active"
  });

  const product = await t.run(async (ctx) => ctx.db.get(productId));
  expect(String(product!.leverancierId)).toBe(String(supplierId));
  expect(product!.naam).toBe("Nieuwe naam");
});

test("na koppelen groepeert de inkoop het product onder de leverancier i.p.v. 'onbekend'", async () => {
  const t = convexTest(schema, modules);
  const { supplierId, productId } = await seed(t);

  // Koppel de leverancier via de mutation (de nieuwe portal-actie).
  await t.mutation(api.catalog.core.updateProductForPortal, {
    tenantSlug: "henke-wonen",
    actor,
    productId: String(productId),
    naam: "Los product",
    leverancierId: String(supplierId),
    status: "active"
  });

  // Bouw een geaccepteerde offerte met een regel voor dit product en genereer bestellingen.
  const now = Date.now();
  const projectId = await t.run(async (ctx) => {
    const tenant = (await ctx.db.query("tenants").collect())[0];
    const klantId = await ctx.db.insert("customers", {
      tenantId: tenant._id,
      type: "private",
      weergaveNaam: "Testklant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId: tenant._id,
      klantId,
      titel: "Testproject",
      status: "quote_accepted",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const quoteId = await ctx.db.insert("quotes", {
      tenantId: tenant._id,
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
    await ctx.db.insert("quoteLines", {
      tenantId: tenant._id,
      quoteId,
      productId,
      regelType: "product",
      titel: "Los product",
      aantal: 2,
      eenheid: "m2",
      eenheidsprijsExBtw: 50,
      btwTarief: 21,
      regelTotaalExBtw: 100,
      regelBtwTotaal: 0,
      regelTotaalInclBtw: 0,
      sortOrder: 1,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return projectId;
  });

  await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });

  const orders = await t.query(api.portal.listSupplierOrders, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });

  // Precies één bestelling, gekoppeld aan de leverancier — niet "Leverancier onbekend".
  expect(orders).toHaveLength(1);
  expect(orders[0].leverancierNaam).toBe("Leverancier A");
  expect(orders[0].leverancierId).toBe(String(supplierId));
});
