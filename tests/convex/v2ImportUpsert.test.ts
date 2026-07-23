import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { resolveStairMaterialMetadata } from "../../src/lib/quotes/stairMaterialCatalog";

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

  // De zichtbare leveranciersnaam mag na de eerste import door een beheerder
  // worden aangepast; de bronidentiteit blijft gekoppeld via importSleutel.
  await t.run(async (ctx) => {
    const supplier = (await ctx.db.query("suppliers").collect())[0];
    await ctx.db.patch(supplier._id, { naam: "Testleverancier (weergavenaam)" });
  });

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

  const fixed = await t.mutation(api.catalog.v2_import.fixSupplierBatches, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    counts: [{ supplier: "TestLev", productCount: 1, priceCount: 1 }]
  });
  expect(fixed).toEqual({ fixed: 1 });

  await t.run(async (ctx) => {
    const suppliers = await ctx.db.query("suppliers").collect();
    expect(suppliers).toHaveLength(1);
    expect(suppliers[0].naam).toBe("Testleverancier (weergavenaam)");
    expect(suppliers[0].importSleutel).toBe("v2:testlev");

    const products = await ctx.db.query("products").collect();
    const bySku = new Map(products.map((product) => [product.sku, product]));
    expect(bySku.get("TL-001")?.status).toBe("active");
    expect(bySku.get("TL-002")?.status).toBe("archived"); // koppeling blijft, picker toont hem niet meer
    expect(await ctx.db.query("productImportBatches").collect()).toHaveLength(1);
  });
});

test("PVC-trapmaterialen krijgen bestel- en componentmetadata uit hun stabiele SKU", async () => {
  const t = convexTest(schema, modules);
  await seed(t);

  await importRows(t, [
    row({
      supplier: "Floorlife",
      main_category: "Trappen",
      sub_category: "Traprenovatie",
      product_type: "Overzettreden",
      product_name: "Traptreden set pvc testkleur - Set 4 tredes",
      sku: "5635380011",
      purchase_price_excl: 8.07,
      sales_price: 27.45,
      price_unit: "per trede (pak = 4 trede)",
      unit: "step"
    })
  ]);

  await t.run(async (ctx) => {
    const product = (await ctx.db.query("products").collect())[0];
    expect(product.eenheid).toBe("step");
    expect(product.verkoopEenheid).toBe("step");
    expect(product.inkoopEenheid).toBe("step");
    expect(product.bestelEenheid).toBe("pack");
    expect(product.stuksPerPak).toBe(4);
    expect(product.attributen?.stairMaterialMetadata).toEqual({
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "standard_tread",
      isPrimary: true,
      piecesPerPack: 4,
      orderUnit: "pack"
    });
  });
});

test("PVC-trapdiensten krijgen stabiele SKU-metadata zonder productnaam-matching", async () => {
  const t = convexTest(schema, modules);
  await seed(t);

  const serviceRow = (sku: string, productName: string) =>
    row({
      supplier: "Henke Wonen Diensten",
      main_category: "Werkzaamheden",
      sub_category: "Traprenovatie (arbeid)",
      product_type: "Dienst",
      product_name: productName,
      sku,
      sales_price: 100,
      price_unit: "Vast",
      unit: "piece"
    });

  await importRows(t, [
    serviceRow("HW-DIENST-014", "Naam is bewust niet bepalend A"),
    serviceRow("HW-DIENST-015", "Naam is bewust niet bepalend B"),
    serviceRow("HW-DIENST-016", "Naam is bewust niet bepalend C"),
    serviceRow("HW-DIENST-006", "Naam is bewust niet bepalend D")
  ]);

  await t.run(async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const bySku = new Map(products.map((product) => [product.sku, product]));
    const expected = new Map<string, Record<string, unknown>>([
      [
        "HW-DIENST-014",
        {
          family: "stair_renovation",
          covering: "pvc",
          shape: "half_turn",
          role: "base_labor",
          sectionKey: "traprenovatie"
        }
      ],
      [
        "HW-DIENST-015",
        {
          family: "stair_renovation",
          covering: "pvc",
          shape: "quarter_turn",
          role: "base_labor",
          sectionKey: "traprenovatie"
        }
      ],
      [
        "HW-DIENST-016",
        {
          family: "stair_renovation",
          covering: "pvc",
          shape: "straight",
          role: "base_labor",
          sectionKey: "traprenovatie"
        }
      ],
      [
        "HW-DIENST-006",
        {
          family: "stair_renovation",
          covering: "pvc",
          role: "surcharge",
          sectionKey: "traprenovatie"
        }
      ]
    ]);

    for (const [sku, metadata] of expected) {
      const product = bySku.get(sku);
      expect(product?.productAard).toBe("service");
      expect(product?.attributen?.serviceMetadata).toEqual(metadata);
      const category = product ? await ctx.db.get(product.categorieId) : null;
      expect(category?.productGroep).toBe("stairs");
    }
  });
});

test("V2-import accepteert volledige bronmetadata voor een nieuwe dienst-SKU", async () => {
  const t = convexTest(schema, modules);
  await seed(t);

  await importRows(t, [
    row({
      supplier: "Henke Wonen Diensten",
      main_category: "Werkzaamheden",
      sub_category: "Traprenovatie (arbeid)",
      product_type: "Dienst",
      product_name: "Nieuwe trapdienst",
      sku: "HW-DIENST-NIEUW",
      unit: "piece",
      service_metadata: {
        family: "stair_renovation",
        covering: "pvc",
        shape: "straight",
        role: "base_labor",
        section_key: "traprenovatie"
      }
    })
  ]);

  await t.run(async (ctx) => {
    const product = (await ctx.db.query("products").collect())[0];
    expect(product.attributen?.serviceMetadata).toEqual({
      family: "stair_renovation",
      covering: "pvc",
      shape: "straight",
      role: "base_labor",
      sectionKey: "traprenovatie"
    });
  });
});

test("PVC-lengteprofiel fallback bewaart lengte, pakinhoud en eenheden consistent", async () => {
  const t = convexTest(schema, modules);
  await seed(t);

  await importRows(t, [
    row({
      supplier: "Floorlife",
      main_category: "Trappen",
      sub_category: "Traprenovatie",
      product_type: "Trapneusprofiel",
      product_name: "Trapneusprofiel 3 meter",
      sku: "5607145111",
      unit: "m1",
      price_unit: "per meter"
    })
  ]);

  await t.run(async (ctx) => {
    const product = (await ctx.db.query("products").collect())[0];
    const metadata = {
      family: "stair_renovation" as const,
      covering: "pvc" as const,
      componentRole: "profile_length" as const,
      isPrimary: false,
      piecesPerPack: 1,
      lengthMPerUnit: 3,
      orderUnit: "pack" as const
    };

    expect(product.eenheid).toBe("m1");
    expect(product.verkoopEenheid).toBe("m1");
    expect(product.inkoopEenheid).toBe("m1");
    expect(product.bestelEenheid).toBe("pack");
    expect(product.bestelVeelvoud).toBe(1);
    expect(product.stuksPerPak).toBe(1);
    expect(product.attributen?.stairMaterialMetadata).toEqual(metadata);
    expect(
      resolveStairMaterialMetadata({ sku: product.sku, attributen: product.attributen })
    ).toEqual(metadata);
  });
});

test("PVC-trapmetadata normaliseert camelCase en snake_case zonder eenheidsdrift", async () => {
  const t = convexTest(schema, modules);
  await seed(t);

  const explicitRow = (
    sku: string,
    unit: "step" | "m1",
    stairMaterialMetadata: Record<string, unknown>
  ) =>
    row({
      supplier: "Floorlife",
      main_category: "Trappen",
      sub_category: "Traprenovatie",
      product_type: "Testcomponent",
      product_name: `Expliciet trapcomponent ${sku}`,
      sku,
      unit,
      stair_material_metadata: stairMaterialMetadata
    });

  await importRows(t, [
    explicitRow("CAMEL-TREAD", "step", {
      family: " stair_renovation ",
      covering: " pvc ",
      componentRole: "standard_tread",
      isPrimary: true,
      piecesPerPack: 5,
      orderUnit: "pack"
    }),
    explicitRow("SNAKE-TREAD", "step", {
      family: "stair_renovation",
      covering: "pvc",
      component_role: "standard_tread",
      is_primary: true,
      pieces_per_pack: 6,
      order_unit: "pack"
    }),
    explicitRow("CAMEL-LENGTH", "m1", {
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "profile_length",
      isPrimary: false,
      piecesPerPack: 1,
      orderUnit: "pack",
      lengthMPerUnit: 2.4
    }),
    explicitRow("SNAKE-LENGTH", "m1", {
      family: "stair_renovation",
      covering: "pvc",
      component_role: "profile_length",
      is_primary: false,
      pieces_per_pack: 1,
      order_unit: "pack",
      length_m_per_unit: 2.75
    })
  ]);

  await t.run(async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const bySku = new Map(products.map((product) => [product.sku, product]));
    const expected = new Map([
      [
        "CAMEL-TREAD",
        {
          salesUnit: "step",
          piecesPerPack: 5,
          metadata: {
            family: "stair_renovation",
            covering: "pvc",
            componentRole: "standard_tread",
            isPrimary: true,
            piecesPerPack: 5,
            orderUnit: "pack"
          }
        }
      ],
      [
        "SNAKE-TREAD",
        {
          salesUnit: "step",
          piecesPerPack: 6,
          metadata: {
            family: "stair_renovation",
            covering: "pvc",
            componentRole: "standard_tread",
            isPrimary: true,
            piecesPerPack: 6,
            orderUnit: "pack"
          }
        }
      ],
      [
        "CAMEL-LENGTH",
        {
          salesUnit: "m1",
          piecesPerPack: 1,
          metadata: {
            family: "stair_renovation",
            covering: "pvc",
            componentRole: "profile_length",
            isPrimary: false,
            piecesPerPack: 1,
            lengthMPerUnit: 2.4,
            orderUnit: "pack"
          }
        }
      ],
      [
        "SNAKE-LENGTH",
        {
          salesUnit: "m1",
          piecesPerPack: 1,
          metadata: {
            family: "stair_renovation",
            covering: "pvc",
            componentRole: "profile_length",
            isPrimary: false,
            piecesPerPack: 1,
            lengthMPerUnit: 2.75,
            orderUnit: "pack"
          }
        }
      ]
    ]);

    for (const [sku, contract] of expected) {
      const product = bySku.get(sku);
      expect(product).toBeDefined();
      expect(product?.eenheid).toBe(contract.salesUnit);
      expect(product?.verkoopEenheid).toBe(contract.salesUnit);
      expect(product?.inkoopEenheid).toBe(contract.salesUnit);
      expect(product?.bestelEenheid).toBe("pack");
      expect(product?.bestelVeelvoud).toBe(1);
      expect(product?.stuksPerPak).toBe(contract.piecesPerPack);
      expect(product?.attributen?.stairMaterialMetadata).toEqual(contract.metadata);
      expect(resolveStairMaterialMetadata({ sku, attributen: product?.attributen })).toEqual(
        contract.metadata
      );
    }
  });
});
