import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

async function seedTenant(t: ReturnType<typeof convexTest>) {
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
    return { tenantId };
  });
}

test("upsertCategory schrijft en listCategories geeft de meetgroep (productGroep) terug", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t);

  await t.mutation(api.portal.upsertCategory, {
    tenantSlug: "henke-wonen",
    actor,
    naam: "Plinten",
    slug: "plinten",
    productGroep: "plinths",
    sortOrder: 10,
    status: "active"
  });

  const categories = await t.query(api.portal.listCategories, {
    tenantSlug: "henke-wonen",
    actor
  });
  const plinten = categories.find((c) => c.name === "Plinten");
  expect(plinten?.productGroep).toBe("plinths");
});

test("een statuswijziging (mét productGroep meegestuurd) behoudt de koppeling", async () => {
  const t = convexTest(schema, modules);
  await seedTenant(t);

  const categorieId = String(
    await t.mutation(api.portal.upsertCategory, {
      tenantSlug: "henke-wonen",
      actor,
      naam: "Gordijnen",
      slug: "gordijnen",
      productGroep: "curtains",
      sortOrder: 10,
      status: "active"
    })
  );

  // Archiveren zoals de UI dat doet: alle velden opnieuw meesturen, incl. productGroep.
  await t.mutation(api.portal.upsertCategory, {
    tenantSlug: "henke-wonen",
    actor,
    categorieId,
    naam: "Gordijnen",
    slug: "gordijnen",
    productGroep: "curtains",
    sortOrder: 10,
    status: "inactive"
  });

  const categories = await t.query(api.portal.listCategories, { tenantSlug: "henke-wonen", actor });
  const gordijnen = categories.find((c) => c.name === "Gordijnen");
  expect(gordijnen?.status).toBe("inactive");
  expect(gordijnen?.productGroep).toBe("curtains"); // niet gewist door de statuswijziging
});

test("backfillCategoryProductGroups vult ontbrekende groepen op naam en is idempotent", async () => {
  const t = convexTest(schema, modules);
  const { tenantId } = await seedTenant(t);
  const now = Date.now();

  await t.run(async (ctx) => {
    for (const naam of ["Plinten", "Gordijnen", "Zelfbedachte groep"]) {
      await ctx.db.insert("categories", {
        tenantId,
        naam,
        slug: naam.toLowerCase().replace(/\s+/g, "-"),
        sortOrder: 0,
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }
  });

  const first = await t.mutation(internal.beheer.categories.backfillCategoryProductGroups, {
    tenantSlug: "henke-wonen"
  });
  expect(first.updated).toBe(2); // Plinten + Gordijnen
  expect(first.unmatched).toContain("Zelfbedachte groep");

  const categories = await t.query(api.portal.listCategories, { tenantSlug: "henke-wonen", actor });
  expect(categories.find((c) => c.name === "Plinten")?.productGroep).toBe("plinths");
  expect(categories.find((c) => c.name === "Gordijnen")?.productGroep).toBe("curtains");
  expect(categories.find((c) => c.name === "Zelfbedachte groep")?.productGroep).toBeUndefined();

  // Idempotent: tweede run wijzigt niets meer.
  const second = await t.mutation(internal.beheer.categories.backfillCategoryProductGroups, {
    tenantSlug: "henke-wonen"
  });
  expect(second.updated).toBe(0);
});

test("searchPickerProducts filtert data-driven op de meetgroep van de categorie", async () => {
  const t = convexTest(schema, modules);
  const { tenantId } = await seedTenant(t);
  const now = Date.now();

  await t.run(async (ctx) => {
    const plinthCat = await ctx.db.insert("categories", {
      tenantId,
      naam: "Plinten",
      slug: "plinten",
      productGroep: "plinths",
      sortOrder: 0,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const floorCat = await ctx.db.insert("categories", {
      tenantId,
      naam: "PVC Vloeren",
      slug: "pvc-vloeren",
      productGroep: "flooring",
      sortOrder: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    async function product(naam: string, categorieId: any) {
      const id = await ctx.db.insert("products", {
        tenantId,
        categorieId,
        naam,
        productAard: "standard",
        eenheid: "m2",
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      await ctx.db.insert("productPrices", {
        tenantId,
        productId: id,
        prijsSoort: "retail",
        prijsEenheid: "m2",
        bedrag: 25,
        btwTarief: 21,
        btwModus: "exclusive",
        currency: "EUR",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      return id;
    }

    await product("Mooie plint", plinthCat);
    await product("PVC vloer", floorCat);
  });

  const result = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor,
    productGroep: "plinths",
    limit: 30
  })) as { items: Array<{ naam: string; category: string }> };

  const names = result.items.map((item) => item.naam);
  expect(names).toContain("Mooie plint");
  expect(names).not.toContain("PVC vloer");
});
