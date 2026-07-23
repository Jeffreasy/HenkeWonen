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
    const serviceCat = await ctx.db.insert("categories", {
      tenantId,
      naam: "Traprenovatie (arbeid)",
      slug: "traprenovatie-arbeid",
      productGroep: "stairs",
      sortOrder: 3,
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

    const serviceProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId: serviceCat,
      sku: "HW-DIENST-014",
      naam: "PVC trap halve draai",
      productAard: "service",
      eenheid: "piece",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("productPrices", {
      tenantId,
      productId: serviceProductId,
      prijsSoort: "retail",
      prijsEenheid: "piece",
      bedrag: 1795,
      btwTarief: 21,
      btwModus: "exclusive",
      currency: "EUR",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

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

test("productpicker scheidt bestelbare producten en dienstproducten strikt", async () => {
  const t = convexTest(schema, modules);
  await seed(t);

  const orderable = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    limit: 30
  })) as { items: Array<{ naam: string; productAard?: string }> };
  expect(orderable.items.map((item) => item.naam)).not.toContain("PVC trap halve draai");

  const services = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    scope: "service",
    limit: 30
  })) as { items: Array<{ naam: string; productAard?: string }> };
  expect(services.items.map((item) => item.naam)).toEqual(["PVC trap halve draai"]);
  expect(services.items[0]?.productAard).toBe("service");

  const serviceCategories = (await t.query(api.catalog.pickerSearch.pickerCategories, {
    tenantSlug: "henke-wonen",
    actor: viewerActor,
    scope: "service"
  })) as Array<{ name: string }>;
  expect(serviceCategories.map((category) => category.name)).toEqual(["Traprenovatie (arbeid)"]);
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

test("searchPickerProducts vindt producten op losse zoektermen, ook als ze niet aaneengesloten in de naam staan", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, pvcCat } = await seed(t);
  // Echte V2-naam: de winkel zoekt zoals het op het werkblad staat ("Roots 55
  // Mattina"), maar in de naam staat "ROOTS 0,55 MATTINA" — de oude
  // hele-zin-substringmatch vond dan niets.
  await t.run(async (ctx) => {
    const now = Date.now();
    const id = await ctx.db.insert("products", {
      tenantId: tenantId as never,
      categorieId: pvcCat as never,
      naam: "MOD ROOTS 0,55 MATTINA 46580CD",
      artikelnummer: "RO46580MT49302",
      productAard: "standard",
      eenheid: "pack",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("productPrices", {
      tenantId: tenantId as never,
      productId: id,
      prijsSoort: "retail",
      prijsEenheid: "pack",
      bedrag: 228.22,
      btwTarief: 21,
      btwModus: "exclusive",
      currency: "EUR",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  async function search(term: string) {
    const result = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
      tenantSlug: "henke-wonen",
      actor: adminActor,
      search: term,
      limit: 30
    })) as { items: Array<{ naam: string }> };
    return result.items.map((item) => item.naam);
  }

  // Losse woorden in andere schrijfwijze/volgorde dan de catalogusnaam.
  expect(await search("Roots 55 Mattina")).toContain("MOD ROOTS 0,55 MATTINA 46580CD");
  expect(await search("mattina roots")).toContain("MOD ROOTS 0,55 MATTINA 46580CD");
  // Term die deels op het artikelnummer matcht, gecombineerd met de naam.
  expect(await search("roots RO46580")).toContain("MOD ROOTS 0,55 MATTINA 46580CD");
  // AND-semantiek: een term die nergens voorkomt, geeft géén treffer.
  expect(await search("roots ubg")).not.toContain("MOD ROOTS 0,55 MATTINA 46580CD");
});

async function seedManyPvc(
  t: ReturnType<typeof convexTest>,
  tenantId: string,
  pvcCat: string,
  count: number
) {
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

test("trap-SKU fallback wordt buiten de trapcategorie niet als PVC-trapmateriaal gemarkeerd", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, pvcCat } = await seed(t);
  const now = Date.now();

  await t.run(async (ctx) => {
    const productId = await ctx.db.insert("products", {
      tenantId,
      categorieId: pvcCat,
      naam: "Vloerproduct met toevallig vergelijkbare code",
      sku: "5635389999",
      productAard: "standard",
      eenheid: "m2",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("productPrices", {
      tenantId,
      productId,
      prijsSoort: "retail",
      prijsEenheid: "m2",
      bedrag: 25,
      btwTarief: 21,
      btwModus: "exclusive",
      currency: "EUR",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  const result = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    search: "toevallig vergelijkbare",
    limit: 30
  })) as {
    items: Array<{
      naam: string;
      attributen?: { stairMaterialMetadata?: unknown };
    }>;
  };

  const product = result.items.find(
    (item) => item.naam === "Vloerproduct met toevallig vergelijkbare code"
  );
  expect(product).toBeDefined();
  expect(product?.attributen?.stairMaterialMetadata).toBeUndefined();
});

test("trapmateriaalfilter laat uitsluitend structureel herkend PVC toe via alle zoekroutes", async () => {
  const t = convexTest(schema, modules);
  const { tenantId } = await seed(t);
  const now = Date.now();

  const stairCat = await t.run(async (ctx) => {
    const categoryId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Traprenovatie",
      slug: "traprenovatie-materialen",
      productGroep: "stairs",
      sortOrder: 4,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    async function material(
      naam: string,
      options: { sku?: string; attributen?: Record<string, unknown> } = {}
    ) {
      await ctx.db.insert("products", {
        tenantId,
        categorieId: categoryId,
        naam,
        sku: options.sku,
        attributen: options.attributen,
        productAard: "standard",
        eenheid: "pack",
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    for (let index = 1; index <= 12; index++) {
      await material(`AAA onbekend trapmateriaal ${String(index).padStart(2, "0")}`);
    }

    await material("Herkende PVC traptrede via SKU", { sku: "5635380011" });
    await material("Herkende PVC trapaccessoire via metadata", {
      sku: "GEEN-FALLBACK",
      attributen: {
        stairMaterialMetadata: {
          family: "stair_renovation",
          covering: "pvc",
          componentRole: "tool",
          isPrimary: false
        }
      }
    });
    await material("Onbekend trapmateriaal");
    await material("Tapijt trapmateriaal", {
      attributen: {
        stairMaterialMetadata: {
          family: "stair_renovation",
          covering: "tapijt",
          componentRole: "standard_tread",
          isPrimary: true
        }
      }
    });

    return categoryId;
  });

  const allStairMaterials = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    productGroep: "stairs",
    limit: 30
  })) as PickerPage;
  expect(allStairMaterials.items.map((item) => item.naam)).toEqual(
    expect.arrayContaining([
      "Herkende PVC traptrede via SKU",
      "Herkende PVC trapaccessoire via metadata",
      "Onbekend trapmateriaal",
      "Tapijt trapmateriaal"
    ])
  );

  const filter = { family: "stair_renovation" as const, covering: "pvc" as const };
  const expected = ["Herkende PVC traptrede via SKU", "Herkende PVC trapaccessoire via metadata"];

  const byProductGroup = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    productGroep: "stairs",
    stairMaterialFilter: filter,
    limit: 10
  })) as PickerPage;
  expect(byProductGroup.items.map((item) => item.naam)).toEqual(expect.arrayContaining(expected));
  expect(byProductGroup.items).toHaveLength(2);

  const byCategory = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    categorieId: stairCat,
    stairMaterialFilter: filter,
    limit: 10
  })) as PickerPage;
  expect(byCategory.items.map((item) => item.naam)).toEqual(expect.arrayContaining(expected));
  expect(byCategory.items).toHaveLength(2);

  const unknownSearch = (await t.query(api.catalog.pickerSearch.searchPickerProducts, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    productGroep: "stairs",
    search: "Onbekend trapmateriaal",
    stairMaterialFilter: filter,
    limit: 30
  })) as PickerPage;
  expect(unknownSearch.items).toEqual([]);
});
