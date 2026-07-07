import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const adminExternalId = "dev-admin-1";
const viewerExternalId = "dev-viewer-1";
const adminActor = {
  externalUserId: adminExternalId,
  authzToken: `dev.actor.henke-wonen.${adminExternalId}`
};
const viewerActor = {
  externalUserId: viewerExternalId,
  authzToken: `dev.actor.henke-wonen.${viewerExternalId}`
};

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
      externalUserId: adminExternalId,
      email: "admin@henke.nl",
      role: "admin",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId,
      externalUserId: viewerExternalId,
      email: "viewer@henke.nl",
      role: "viewer",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const pvcCat = await ctx.db.insert("categories", {
      tenantId,
      naam: "PVC Vloeren",
      slug: "pvc-vloeren",
      productGroep: "flooring",
      sortOrder: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const tapijtCat = await ctx.db.insert("categories", {
      tenantId,
      naam: "Tapijt",
      slug: "tapijt",
      productGroep: "flooring",
      sortOrder: 2,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("categories", {
      tenantId,
      naam: "Oude groep",
      slug: "oude-groep",
      sortOrder: 3,
      status: "inactive",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    // Actief, maar zonder producten → hoort niet in het menu.
    await ctx.db.insert("categories", {
      tenantId,
      naam: "Lege categorie",
      slug: "lege-categorie",
      productGroep: "wallpaper",
      sortOrder: 4,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    async function product(naam: string, categorieId: typeof pvcCat) {
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

    await product("Ambiant PVC", pvcCat);
    await product("Berber tapijt", tapijtCat);

    return { tenantId, pvcCat, tapijtCat };
  });
}

test("searchPickerProducts met categorieId filtert strak op één categorie binnen dezelfde meetgroep", async () => {
  const t = convexTest(schema, modules);
  const { pvcCat } = await seed(t);

  const result = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    categorieId: pvcCat,
    limit: 30
  })) as { items: Array<{ naam: string; category: string }> };

  const names = result.items.map((item) => item.naam);
  // PVC Vloeren en Tapijt zitten allebei in meetgroep "flooring"; categorieId knijpt dieper.
  expect(names).toContain("Ambiant PVC");
  expect(names).not.toContain("Berber tapijt");
});

test("searchPickerProducts negeert een categorieId van een andere tenant (valt terug op alles)", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  // Geldige categories-id, maar van een ándere tenant → mag henke-wonen niet filteren.
  const foreignCatId = await t.run(async (ctx) => {
    const now = Date.now();
    const otherTenant = await ctx.db.insert("tenants", {
      slug: "andere-winkel",
      naam: "Andere Winkel",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return await ctx.db.insert("categories", {
      tenantId: otherTenant,
      naam: "Vreemde categorie",
      slug: "vreemd",
      sortOrder: 0,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  const result = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    categorieId: foreignCatId,
    limit: 30
  })) as { items: Array<{ naam: string }> };

  const names = result.items.map((item) => item.naam);
  // Vreemde id genegeerd → geen filter, dus beide producten komen terug.
  expect(names).toContain("Ambiant PVC");
  expect(names).toContain("Berber tapijt");
});

test("pickerCategories geeft actieve categorieën met productgroep terug, ook voor een viewer", async () => {
  const t = convexTest(schema, modules);
  await seed(t);

  const cats = (await t.query(api.catalog.pickerSearch.pickerCategories, {
    tenantSlug: "henke-wonen",
    actor: viewerActor
  })) as Array<{ name: string; productGroep: string | null; sortOrder: number }>;

  const names = cats.map((category) => category.name);
  expect(names).toContain("PVC Vloeren");
  expect(names).toContain("Tapijt");
  expect(names).not.toContain("Oude groep"); // inactief → weggefilterd
  expect(names).not.toContain("Lege categorie"); // actief maar zonder producten → weggefilterd
  expect(cats.find((category) => category.name === "PVC Vloeren")?.productGroep).toBe("flooring");
  // Alleen de categorieën mét producten, op beheer-sortering.
  expect(cats.map((category) => category.name)).toEqual(["PVC Vloeren", "Tapijt"]);
});

async function seedManyPvc(t: ReturnType<typeof convexTest>, tenantId: string, pvcCat: string, count: number) {
  await t.run(async (ctx) => {
    const now = Date.now();
    for (let i = 1; i <= count; i += 1) {
      const naam = `PVC ${String(i).padStart(3, "0")}`;
      const id = await ctx.db.insert("products", {
        tenantId: tenantId as never,
        categorieId: pvcCat as never,
        naam,
        productAard: "standard",
        eenheid: "m2",
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      await ctx.db.insert("productPrices", {
        tenantId: tenantId as never,
        productId: id,
        prijsSoort: "retail",
        prijsEenheid: "m2",
        bedrag: 20,
        btwTarief: 21,
        btwModus: "exclusive",
        currency: "EUR",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }
  });
}

type PickerPage = { items: Array<{ naam: string }>; isDone: boolean; nextCursor: string | null };

test("searchPickerProducts pagineert cursor-gewijs door een volle categorie en dekt álles zonder duplicaten", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, pvcCat } = await seed(t);
  await seedManyPvc(t, String(tenantId), String(pvcCat), 12); // + "Ambiant PVC" uit seed = 13 actief

  const seen = new Set<string>();
  let totalReturned = 0;
  let pages = 0;
  let cursor: string | null = null;

  for (let guard = 0; guard < 8; guard += 1) {
    const result = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
      tenantSlug: "henke-wonen",
      actor: adminActor,
      categorieId: pvcCat,
      limit: 10,
      cursor
    })) as PickerPage;

    pages += 1;
    for (const item of result.items) {
      seen.add(item.naam);
      totalReturned += 1;
    }
    if (result.isDone) {
      break;
    }
    cursor = result.nextCursor;
  }

  expect(seen.size).toBe(13); // alle PVC-producten bereikt
  expect(totalReturned).toBe(13); // geen product dubbel over pagina's
  expect(pages).toBeGreaterThanOrEqual(2); // meer dan één pagina (min-limit is 10)
  // Alfabetisch (index-)volgorde: "Ambiant PVC" (A) vóór "PVC 001" (P).
  const first = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    categorieId: pvcCat,
    cursor: null
  })) as PickerPage;
  expect(first.items[0].naam).toBe("Ambiant PVC");
});

test("searchPickerProducts pagineert ook 'Alles' (geen filter) over categorieën heen", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, pvcCat } = await seed(t);
  await seedManyPvc(t, String(tenantId), String(pvcCat), 12); // 13 PVC + 1 Tapijt = 14 actief

  const seen = new Set<string>();
  let cursor: string | null = null;

  for (let guard = 0; guard < 8; guard += 1) {
    const result = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
      tenantSlug: "henke-wonen",
      actor: adminActor,
      limit: 10,
      cursor
    })) as PickerPage;
    for (const item of result.items) {
      seen.add(item.naam);
    }
    if (result.isDone) {
      break;
    }
    cursor = result.nextCursor;
  }

  expect(seen.size).toBe(14); // 13 PVC + Berber tapijt, over de categoriegrens heen
  expect(seen.has("Berber tapijt")).toBe(true);
});
