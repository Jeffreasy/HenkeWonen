import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

// convex-test laadt de functie-modules; tests staan buiten convex/, dus expliciet de glob.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

type Status = "draft" | "active" | "inactive" | "archived";

async function seedCatalog(t: ReturnType<typeof convexTest>) {
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

    const makeCategory = (naam: string, slug: string) =>
      ctx.db.insert("categories", {
        tenantId,
        naam,
        slug,
        sortOrder: 0,
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });

    const lijmId = await makeCategory("Lijm", "lijm");
    const tapijtId = await makeCategory("Tapijt", "tapijt");

    const makeProduct = (categorieId: typeof lijmId, naam: string, status: Status) =>
      ctx.db.insert("products", {
        tenantId,
        categorieId,
        naam,
        productAard: "standard",
        eenheid: "m2",
        status,
        aangemaaktOp: now,
        gewijzigdOp: now
      });

    const lijmActive = await makeProduct(lijmId, "Lijm A", "active");
    const lijmDraft = await makeProduct(lijmId, "Lijm B", "draft");
    const lijmInactive = await makeProduct(lijmId, "Lijm C", "inactive");
    const tapijtActive = await makeProduct(tapijtId, "Tapijt X", "active");

    return { tenantId, lijmActive, lijmDraft, lijmInactive, tapijtActive };
  });
}

const statusOf = (t: ReturnType<typeof convexTest>, id: any) =>
  t.run(async (ctx) => (await ctx.db.get(id))?.status);

test("dry-run telt niet-inactieve producten zonder iets te wijzigen", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedCatalog(t);

  const result = await t.mutation(api.catalog.maintenance.deactivateProductsByCategoryChunk, {
    tenantSlug: "henke-wonen",
    actor,
    confirm: "DEACTIVATE_PRODUCTS_BY_CATEGORY",
    categorySlug: "lijm",
    dryRun: true
  });

  expect(result.categoryFound).toBe(true);
  expect(result.matched).toBe(2); // active + draft, niet de al-inactieve
  expect(result.changed).toBe(0);
  expect(result.isDone).toBe(true);

  // Niets gewijzigd.
  expect(await statusOf(t, seeded.lijmActive)).toBe("active");
  expect(await statusOf(t, seeded.lijmDraft)).toBe("draft");
});

test("apply zet alleen de doelcategorie op inactive; andere categorie blijft intact", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedCatalog(t);

  const applied = await t.mutation(api.catalog.maintenance.deactivateProductsByCategoryChunk, {
    tenantSlug: "henke-wonen",
    actor,
    confirm: "DEACTIVATE_PRODUCTS_BY_CATEGORY",
    categorySlug: "lijm",
    dryRun: false
  });

  expect(applied.matched).toBe(2);
  expect(applied.changed).toBe(2);

  expect(await statusOf(t, seeded.lijmActive)).toBe("inactive");
  expect(await statusOf(t, seeded.lijmDraft)).toBe("inactive");
  expect(await statusOf(t, seeded.lijmInactive)).toBe("inactive"); // bleef inactive
  expect(await statusOf(t, seeded.tapijtActive)).toBe("active"); // controle: onaangeroerd

  // Idempotent: tweede run vindt niets meer.
  const reRun = await t.mutation(api.catalog.maintenance.deactivateProductsByCategoryChunk, {
    tenantSlug: "henke-wonen",
    actor,
    confirm: "DEACTIVATE_PRODUCTS_BY_CATEGORY",
    categorySlug: "lijm",
    dryRun: false
  });
  expect(reRun.matched).toBe(0);
  expect(reRun.changed).toBe(0);
});

test("reactivate draait de soft-delete terug: inactieve producten weer active", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedCatalog(t);

  // Eerst deactiveren...
  await t.mutation(api.catalog.maintenance.deactivateProductsByCategoryChunk, {
    tenantSlug: "henke-wonen",
    actor,
    confirm: "DEACTIVATE_PRODUCTS_BY_CATEGORY",
    categorySlug: "lijm",
    dryRun: false
  });

  // ...dan terugdraaien.
  const reverted = await t.mutation(api.catalog.maintenance.deactivateProductsByCategoryChunk, {
    tenantSlug: "henke-wonen",
    actor,
    confirm: "DEACTIVATE_PRODUCTS_BY_CATEGORY",
    categorySlug: "lijm",
    reactivate: true,
    dryRun: false
  });

  expect(reverted.matched).toBe(3); // alle 3 inactieve lijm-producten
  expect(reverted.changed).toBe(3);
  expect(await statusOf(t, seeded.lijmActive)).toBe("active");
  expect(await statusOf(t, seeded.lijmDraft)).toBe("active");
  expect(await statusOf(t, seeded.lijmInactive)).toBe("active");
  expect(await statusOf(t, seeded.tapijtActive)).toBe("active"); // controle: onaangeroerd
});

test("reactivate promoot ALLE inactieve producten (ook pre-existing) → active; draft blijft draft", async () => {
  // Documenteert de bewuste asymmetrie: reactivate is geen exacte inverse van deactivate.
  // Het zet ALLES wat inactief is op active — ook een product dat al vóór onze actie inactief
  // was. Een draft-product (status !== "inactive") wordt NIET geraakt.
  const t = convexTest(schema, modules);
  const seeded = await seedCatalog(t);

  // Zonder voorafgaande deactivate; alleen lijmInactive is inactief.
  const result = await t.mutation(api.catalog.maintenance.deactivateProductsByCategoryChunk, {
    tenantSlug: "henke-wonen",
    actor,
    confirm: "DEACTIVATE_PRODUCTS_BY_CATEGORY",
    categorySlug: "lijm",
    reactivate: true,
    dryRun: false
  });

  expect(result.changed).toBe(1); // alleen het pre-existing inactieve product
  expect(await statusOf(t, seeded.lijmInactive)).toBe("active"); // pre-existing inactief → active
  expect(await statusOf(t, seeded.lijmActive)).toBe("active"); // was al active, onveranderd
  expect(await statusOf(t, seeded.lijmDraft)).toBe("draft"); // reactivate raakt draft niet
});

test("onbekende categorie-slug levert categoryFound=false en isDone=true", async () => {
  const t = convexTest(schema, modules);
  await seedCatalog(t);

  const result = await t.mutation(api.catalog.maintenance.deactivateProductsByCategoryChunk, {
    tenantSlug: "henke-wonen",
    actor,
    confirm: "DEACTIVATE_PRODUCTS_BY_CATEGORY",
    categorySlug: "douchepanelen",
    dryRun: false
  });

  expect(result.categoryFound).toBe(false);
  expect(result.matched).toBe(0);
  expect(result.isDone).toBe(true);
});
