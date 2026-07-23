import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { supplierOrderQuantity } from "../../convex/inkoop/core";
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
    const serviceProductId = await ctx.db.insert("products", {
      tenantId,
      categorieId,
      leverancierId: supplierA,
      sku: "HW-DIENST-014",
      naam: "PVC trap halve draai",
      productAard: "service",
      eenheid: "piece",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

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

    async function qline(
      productId: any,
      regelType: string,
      titel: string,
      aantal: number,
      sortOrder: number
    ) {
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
    await qline(serviceProductId, "product", "PVC trap halve draai", 1, 6);
    await qline(undefined, "service", "Leggen", 10, 5); // niet-product → overgeslagen

    return { tenantId, projectId, quoteId, supplierA, supplierB, prodA1, serviceProductId };
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

  await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });
  const second = await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });

  expect(second.created).toBe(3);
  const orders = await t.query(api.portal.listSupplierOrders, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });
  expect(orders).toHaveLength(3); // geen dubbele
});

test("een reeds geplaatste (ordered) bestelling blijft bij regenereren behouden", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);

  const orders =
    (await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
      tenantSlug: "henke-wonen",
      actor,
      projectId
    }),
    await t.query(api.portal.listSupplierOrders, { tenantSlug: "henke-wonen", actor, projectId }));
  const a = orders.find((o) => o.leverancierNaam === "Leverancier A")!;

  await t.mutation(api.portal.updateSupplierOrderStatus, {
    tenantSlug: "henke-wonen",
    actor,
    bestellingId: a.id,
    status: "ordered"
  });

  const regen = await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });
  expect(regen.skipped).toBeGreaterThanOrEqual(1);

  const after = await t.query(api.portal.listSupplierOrders, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });
  const aAfter = after.find((o) => o.id === a.id);
  expect(aAfter?.status).toBe("ordered"); // niet vervangen
});

test("supplierOrderDetail geeft order, regels, leverancier en project terug", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);
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
  const a = orders.find((o) => o.leverancierNaam === "Leverancier A")!;

  const detail = await t.query(api.portal.supplierOrderDetail, {
    tenantSlug: "henke-wonen",
    actor,
    bestellingId: a.id
  });

  expect(detail).not.toBeNull();
  expect(detail!.lines).toHaveLength(2);
  expect(detail!.leverancier?.naam).toBe("Leverancier A");
  expect(detail!.project?.titel).toBe("Testproject");
});

test("cancelSupplierOrder zet de order én de regels op cancelled", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);
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
  const a = orders.find((o) => o.leverancierNaam === "Leverancier A")!;

  await t.mutation(api.portal.cancelSupplierOrder, {
    tenantSlug: "henke-wonen",
    actor,
    bestellingId: a.id
  });

  const detail = await t.query(api.portal.supplierOrderDetail, {
    tenantSlug: "henke-wonen",
    actor,
    bestellingId: a.id
  });
  expect(detail!.order.status).toBe("cancelled");
  expect(detail!.lines.every((line) => line.status === "cancelled")).toBe(true);
});

test("cancelSupplierOrder laat reeds ontvangen regels ongemoeid", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);
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
  const a = orders.find((o) => o.leverancierNaam === "Leverancier A")!;

  // Zet één regel handmatig op 'received' (geen MVP-mutatie hiervoor; rechtstreeks in de db).
  await t.run(async (ctx) => {
    const all = await ctx.db.query("supplierOrderLines").collect();
    const own = all.filter((line: any) => String(line.bestellingId) === a.id);
    await ctx.db.patch(own[0]._id, { status: "received", gewijzigdOp: own[0].gewijzigdOp });
  });

  await t.mutation(api.portal.cancelSupplierOrder, {
    tenantSlug: "henke-wonen",
    actor,
    bestellingId: a.id
  });

  const detail = await t.query(api.portal.supplierOrderDetail, {
    tenantSlug: "henke-wonen",
    actor,
    bestellingId: a.id
  });
  expect(detail!.order.status).toBe("cancelled");
  expect(detail!.lines.some((line) => line.status === "received")).toBe(true);
  expect(detail!.lines.some((line) => line.status === "cancelled")).toBe(true);
});

test("annuleren van de geaccepteerde offerte annuleert de open bestellingen mee", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);
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
  const a = orders.find((o) => o.leverancierNaam === "Leverancier A")!;
  await t.mutation(api.portal.updateSupplierOrderStatus, {
    tenantSlug: "henke-wonen",
    actor,
    bestellingId: a.id,
    status: "ordered"
  });

  const quoteId = await t.run(async (ctx) => (await ctx.db.query("quotes").collect())[0]._id);
  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId: String(quoteId),
    status: "cancelled"
  });

  const after = await t.query(api.portal.listSupplierOrders, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });
  expect(after.every((o) => o.status === "cancelled")).toBe(true);

  const detail = await t.query(api.portal.supplierOrderDetail, {
    tenantSlug: "henke-wonen",
    actor,
    bestellingId: a.id
  });
  expect(detail!.lines.every((line) => line.status === "cancelled")).toBe(true);
});

test("offerte-annulering laat een reeds ontvangen bestelling staan", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);
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
  const a = orders.find((o) => o.leverancierNaam === "Leverancier A")!;
  await t.mutation(api.portal.updateSupplierOrderStatus, {
    tenantSlug: "henke-wonen",
    actor,
    bestellingId: a.id,
    status: "received"
  });

  const quoteId = await t.run(async (ctx) => (await ctx.db.query("quotes").collect())[0]._id);
  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId: String(quoteId),
    status: "cancelled"
  });

  const after = await t.query(api.portal.listSupplierOrders, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });
  expect(after.find((o) => o.id === a.id)?.status).toBe("received");
  expect(after.filter((o) => o.id !== a.id).every((o) => o.status === "cancelled")).toBe(true);

  // De regels van de ontvangen bestelling blijven eveneens onaangeroerd (niet mee-geannuleerd).
  const detail = await t.query(api.portal.supplierOrderDetail, {
    tenantSlug: "henke-wonen",
    actor,
    bestellingId: a.id
  });
  expect(detail!.lines.every((line) => line.status === "ordered")).toBe(true);
});

test("dossier-annulering (processProjectAction) annuleert alle open bestellingen van het project", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);
  await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });

  await t.mutation(api.portal.processProjectAction, {
    tenantSlug: "henke-wonen",
    actor,
    projectId,
    action: "cancelled"
  });

  const after = await t.query(api.portal.listSupplierOrders, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });
  // Zelfde groepering als de generate-test: Leverancier A + Leverancier B + 'onbekend'
  // (product zonder leverancier) = 3 orders.
  expect(after).toHaveLength(3);
  expect(after.every((o) => o.status === "cancelled")).toBe(true);
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
    t.mutation(api.portal.generateSupplierOrdersFromQuote, {
      tenantSlug: "henke-wonen",
      actor,
      projectId
    })
  ).rejects.toThrow();
});

test("een service-productId wordt ook op een foutief getypeerde productregel nooit besteld", async () => {
  const t = convexTest(schema, modules);
  const { projectId, serviceProductId } = await seed(t);

  const result = await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });
  const orderLines = await t.run((ctx) => ctx.db.query("supplierOrderLines").collect());

  expect(orderLines.some((line) => line.productId === serviceProductId)).toBe(false);
  expect(result.warnings.join(" ")).toMatch(/dienstproduct-regel/);
});

test("PVC-traptreden worden per volledig pak van vier besteld", () => {
  const result = supplierOrderQuantity(
    13,
    "step",
    {
      eenheid: "step",
      bestelEenheid: "pack",
      stuksPerPak: 4,
      minimumBestelAantal: undefined,
      bestelVeelvoud: 1
    },
    { bedrag: 8.07, prijsEenheid: "step" }
  );

  expect(result).toMatchObject({
    orderQuantity: 4,
    orderUnit: "pack",
    purchasePrice: 32.28
  });
  expect(result.note).toMatch(/4 pak.*13 benodigde.*3 reserve/i);
});

test("PVC-profielmeters worden via structurele SKU-metadata per volledige lengte besteld", () => {
  const result = supplierOrderQuantity(
    7.2,
    "m1",
    {
      sku: "5607145111",
      attributen: undefined,
      eenheid: "m1",
      bestelEenheid: "pack",
      stuksPerPak: 1,
      minimumBestelAantal: undefined,
      bestelVeelvoud: 1
    },
    { bedrag: 12.2, prijsEenheid: "m1" },
    { naam: "Traprenovatie", productGroep: "stairs" }
  );

  expect(result).toMatchObject({
    orderQuantity: 3,
    orderUnit: "pack",
    purchasePrice: 36.6
  });
  expect(result.note).toMatch(/3 pak.*3 m.*7\.2 benodigde m1.*1\.8 m reserve/i);
});

test("een overeenkomende profiel-SKU buiten de trapcategorie activeert geen fallback", () => {
  expect(
    supplierOrderQuantity(
      7.2,
      "m1",
      {
        sku: "5607145111",
        attributen: undefined,
        eenheid: "m1",
        bestelEenheid: "pack",
        stuksPerPak: 1,
        minimumBestelAantal: undefined,
        bestelVeelvoud: 1
      },
      { bedrag: 12.2, prijsEenheid: "m1" },
      { naam: "Plinten", productGroep: "flooring" }
    )
  ).toEqual({
    orderQuantity: 7.2,
    orderUnit: "m1",
    purchasePrice: 12.2,
    note: undefined
  });
});

test("opgeslagen profielmetadata ondersteunt meter- en package-eenheidsaliassen", () => {
  const result = supplierOrderQuantity(
    5.1,
    "meter",
    {
      sku: "CUSTOM-PVC-PROFILE",
      attributen: {
        stairMaterialMetadata: {
          family: "stair_renovation",
          covering: "pvc",
          componentRole: "profile_length",
          isPrimary: false,
          piecesPerPack: 1,
          lengthMPerUnit: 2.4,
          orderUnit: "pack"
        }
      },
      eenheid: "meter",
      bestelEenheid: "package",
      stuksPerPak: 1,
      minimumBestelAantal: 1,
      bestelVeelvoud: 1
    },
    { bedrag: 10, prijsEenheid: "meter" }
  );

  expect(result).toMatchObject({ orderQuantity: 3, orderUnit: "pack", purchasePrice: 24 });
  expect(result.note).toMatch(/3 pak.*2\.4 m.*5\.1 benodigde meter.*2\.1 m reserve/i);
});

test("een generiek m1-product wordt niet als PVC-profiellengte geconverteerd", () => {
  expect(
    supplierOrderQuantity(
      7.2,
      "m1",
      {
        sku: "GENERIC-M1",
        attributen: undefined,
        eenheid: "m1",
        bestelEenheid: "pack",
        stuksPerPak: 1,
        minimumBestelAantal: 2,
        bestelVeelvoud: 1
      },
      { bedrag: 12.2, prijsEenheid: "m1" }
    )
  ).toEqual({ orderQuantity: 7.2, orderUnit: "m1", purchasePrice: 12.2, note: undefined });
});

test("een nulhoeveelheid maakt nooit stilzwijgend een minimale leveranciersverpakking", () => {
  const result = supplierOrderQuantity(
    0,
    "step",
    {
      eenheid: "step",
      bestelEenheid: "pack",
      stuksPerPak: 4,
      minimumBestelAantal: 1,
      bestelVeelvoud: 1
    },
    { bedrag: 8.07, prijsEenheid: "step" }
  );

  expect(result).toEqual({
    orderQuantity: 0,
    orderUnit: "pack",
    purchasePrice: 8.07,
    note: undefined
  });
});

test("productgekoppelde materiaalregels gaan mee naar inkoop", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, projectId, quoteId, prodA1 } = await seed(t);
  const now = Date.now();

  const materialQuoteLineId = await t.run((ctx) =>
    ctx.db.insert("quoteLines", {
      tenantId,
      quoteId,
      productId: prodA1,
      regelType: "material",
      titel: "Extra PVC-materiaal",
      aantal: 2,
      eenheid: "m2",
      eenheidsprijsExBtw: 50,
      btwTarief: 21,
      regelTotaalExBtw: 100,
      regelBtwTotaal: 21,
      regelTotaalInclBtw: 121,
      sortOrder: 99,
      aangemaaktOp: now,
      gewijzigdOp: now
    })
  );

  await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });
  const lines = await t.run((ctx) =>
    ctx.db
      .query("supplierOrderLines")
      .withIndex("by_quote_line", (q) =>
        q.eq("tenantId", tenantId).eq("quoteLineId", materialQuoteLineId)
      )
      .collect()
  );

  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ productId: prodA1, aantal: 2, eenheid: "m2" });
});

test("minimum wordt voor het bestelmultiple toegepast en onbegrensde decimalen blijven intact", () => {
  expect(
    supplierOrderQuantity(
      9,
      "step",
      {
        eenheid: "step",
        bestelEenheid: "pack",
        stuksPerPak: 4,
        minimumBestelAantal: 3,
        bestelVeelvoud: 2
      },
      { bedrag: 8.07, prijsEenheid: "step" }
    )
  ).toMatchObject({ orderQuantity: 4, orderUnit: "pack", purchasePrice: 32.28 });

  expect(
    supplierOrderQuantity(
      10.5,
      "m2",
      {
        eenheid: "m2",
        bestelEenheid: undefined,
        stuksPerPak: undefined,
        minimumBestelAantal: undefined,
        bestelVeelvoud: undefined
      },
      { bedrag: 20, prijsEenheid: "m2" }
    )
  ).toEqual({ orderQuantity: 10.5, orderUnit: "m2", purchasePrice: 20, note: undefined });
});

test("reeds per pak berekende componenten worden niet nogmaals geconverteerd", () => {
  expect(
    supplierOrderQuantity(
      4,
      "pack",
      {
        eenheid: "pack",
        bestelEenheid: "pack",
        stuksPerPak: 4,
        minimumBestelAantal: 1,
        bestelVeelvoud: 1
      },
      { bedrag: 22.2, prijsEenheid: "pack" }
    )
  ).toEqual({ orderQuantity: 4, orderUnit: "pack", purchasePrice: 22.2, note: undefined });
});

test("berekende PVC-trapofferte levert exacte materiaalbestelling zonder dienstregel", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, projectId, quoteId, supplierA, serviceProductId } = await seed(t);
  const now = Date.now();

  const { treadQuoteLineId, profileQuoteLineId, profileLengthQuoteLineId } = await t.run(
    async (ctx) => {
      const categorieId = (await ctx.db.query("categories").collect())[0]._id;
      const treadProductId = await ctx.db.insert("products", {
        tenantId,
        categorieId,
        leverancierId: supplierA,
        sku: "5635380011",
        naam: "PVC-traptreden set",
        productAard: "standard",
        eenheid: "step",
        verkoopEenheid: "step",
        inkoopEenheid: "step",
        bestelEenheid: "pack",
        stuksPerPak: 4,
        minimumBestelAantal: 1,
        bestelVeelvoud: 1,
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      const profileProductId = await ctx.db.insert("products", {
        tenantId,
        categorieId,
        leverancierId: supplierA,
        sku: "5606145111",
        naam: "PVC-trapprofielset",
        productAard: "standard",
        eenheid: "pack",
        verkoopEenheid: "pack",
        inkoopEenheid: "pack",
        bestelEenheid: "pack",
        stuksPerPak: 4,
        minimumBestelAantal: 1,
        bestelVeelvoud: 1,
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      const profileLengthProductId = await ctx.db.insert("products", {
        tenantId,
        categorieId,
        leverancierId: supplierA,
        sku: "5607145111",
        naam: "PVC-trapprofiel per lengte",
        productAard: "standard",
        eenheid: "m1",
        verkoopEenheid: "m1",
        inkoopEenheid: "m1",
        bestelEenheid: "pack",
        stuksPerPak: 1,
        minimumBestelAantal: 1,
        bestelVeelvoud: 1,
        attributen: {
          stairMaterialMetadata: {
            family: "stair_renovation",
            covering: "pvc",
            componentRole: "profile_length",
            isPrimary: false,
            piecesPerPack: 1,
            lengthMPerUnit: 3,
            orderUnit: "pack"
          }
        },
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });

      await ctx.db.insert("productPrices", {
        tenantId,
        productId: treadProductId,
        prijsSoort: "net_purchase",
        prijsEenheid: "step",
        bedrag: 8.07,
        btwTarief: 21,
        btwModus: "exclusive",
        currency: "EUR",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      await ctx.db.insert("productPrices", {
        tenantId,
        productId: profileProductId,
        prijsSoort: "net_purchase",
        prijsEenheid: "pack",
        bedrag: 22.2,
        btwTarief: 21,
        btwModus: "exclusive",
        currency: "EUR",
        aangemaaktOp: now,
        gewijzigdOp: now
      });

      await ctx.db.insert("productPrices", {
        tenantId,
        productId: profileLengthProductId,
        prijsSoort: "net_purchase",
        prijsEenheid: "m1",
        bedrag: 12.2,
        btwTarief: 21,
        btwModus: "exclusive",
        currency: "EUR",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      const treadQuoteLineId = await ctx.db.insert("quoteLines", {
        tenantId,
        quoteId,
        productId: treadProductId,
        regelType: "material",
        titel: "13 PVC-traptreden",
        aantal: 13,
        eenheid: "step",
        eenheidsprijsExBtw: 27.45,
        btwTarief: 21,
        regelTotaalExBtw: 356.85,
        regelBtwTotaal: 74.94,
        regelTotaalInclBtw: 431.79,
        sortOrder: 100,
        metadata: {
          bundleType: "stair_renovation",
          bundleRole: "material",
          calculatedQuantity: 13,
          stairMaterialComponentRole: "standard_tread"
        },
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      const profileQuoteLineId = await ctx.db.insert("quoteLines", {
        tenantId,
        quoteId,
        productId: profileProductId,
        regelType: "material",
        titel: "4 pakken trapprofielen",
        aantal: 4,
        eenheid: "pack",
        eenheidsprijsExBtw: 59.95,
        btwTarief: 21,
        regelTotaalExBtw: 239.8,
        regelBtwTotaal: 50.36,
        regelTotaalInclBtw: 290.16,
        sortOrder: 101,
        metadata: {
          bundleType: "stair_renovation",
          bundleRole: "material",
          calculatedQuantity: 4,
          stairMaterialComponentRole: "profile_set"
        },
        aangemaaktOp: now,
        gewijzigdOp: now
      });

      const profileLengthQuoteLineId = await ctx.db.insert("quoteLines", {
        tenantId,
        quoteId,
        productId: profileLengthProductId,
        regelType: "material",
        titel: "7,2 meter trapprofiel",
        aantal: 7.2,
        eenheid: "m1",
        eenheidsprijsExBtw: 24.95,
        btwTarief: 21,
        regelTotaalExBtw: 179.64,
        regelBtwTotaal: 37.72,
        regelTotaalInclBtw: 217.36,
        sortOrder: 102,
        metadata: {
          bundleType: "stair_renovation",
          bundleRole: "material",
          calculatedQuantity: 7.2,
          stairMaterialComponentRole: "profile_length"
        },
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      return { treadQuoteLineId, profileQuoteLineId, profileLengthQuoteLineId };
    }
  );

  await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId
  });

  await t.run(async (ctx) => {
    const lines = await ctx.db.query("supplierOrderLines").collect();
    const tread = lines.find((line) => line.quoteLineId === treadQuoteLineId);
    const profile = lines.find((line) => line.quoteLineId === profileQuoteLineId);
    const profileLength = lines.find((line) => line.quoteLineId === profileLengthQuoteLineId);

    expect(tread).toMatchObject({
      aantal: 4,
      eenheid: "pack",
      inkoopPrijsExBtw: 32.28,
      regelTotaalExBtw: 129.12
    });
    expect(tread?.notities).toMatch(/4 pak.*13 benodigde.*3 reserve/i);
    expect(profile).toMatchObject({
      aantal: 4,
      eenheid: "pack",
      inkoopPrijsExBtw: 22.2,
      regelTotaalExBtw: 88.8
    });
    expect(profile?.notities).toBeUndefined();
    expect(profileLength).toMatchObject({
      aantal: 3,
      eenheid: "pack",
      inkoopPrijsExBtw: 36.6,
      regelTotaalExBtw: 109.8
    });
    expect(profileLength?.notities).toMatch(/3 pak.*3 m.*7\.2 benodigde m1.*1\.8 m reserve/i);
    expect(lines.some((line) => line.productId === serviceProductId)).toBe(false);
  });
});
