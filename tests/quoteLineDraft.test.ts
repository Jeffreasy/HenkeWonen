import { describe, expect, it } from "vitest";
import type { PortalProduct } from "../src/lib/portalTypes";
import type { ServiceRuleRow } from "../src/components/settings/settings/settingsTypes";
import {
  quoteLineDraftKey,
  readQuoteLineDraft,
  type QuoteLineDraftState
} from "../src/lib/quoteLineDraft";

const SAMPLE_PRODUCT: PortalProduct = {
  id: "prod_123",
  tenantId: "henke",
  category: "PVC Vloeren",
  supplier: "Acme Vloeren",
  displaySupplierName: "Acme",
  naam: "PVC Click Eiken",
  weergaveNaam: "PVC Click Eiken Naturel",
  kleurnaam: "Naturel",
  productSoort: "click",
  eenheid: "m2",
  prijsExBtw: 29.95,
  prijsEenheid: "m2",
  btwTarief: 21,
  status: "active"
};

const SAMPLE_SERVICE_RULE: ServiceRuleRow = {
  id: "service_123",
  productId: "service_product_123",
  name: "PVC trap halve draai",
  description: "Arbeid voor een halve-draaitrap",
  sku: "HW-DIENST-014",
  productGroup: "stairs",
  serviceMetadata: {
    family: "stair_renovation",
    covering: "pvc",
    shape: "half_turn",
    role: "base_labor",
    sectionKey: "traprenovatie"
  },
  calculationType: "per_staircase",
  priceExVat: 495,
  vatRate: 21,
  status: "active"
};

const FILLED_LINE: QuoteLineDraftState = {
  lineType: "product",
  title: "Vloer woonkamer",
  description: "PVC click, naturel",
  quantity: "20",
  unit: "m2",
  unitPriceExVat: "29.95",
  vatRate: "21",
  discountExVat: "10",
  projectRoomId: "room_9",
  selectedProduct: SAMPLE_PRODUCT,
  selectedServiceRule: null
};

/** Bootst de `useFormDraft`-envelope na: state → localStorage (JSON) → parse → concept. */
function throughDraft(values: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify({ t: 123, d: values });
  return (JSON.parse(serialized) as { d: Record<string, unknown> }).d;
}

describe("quoteLineDraftKey (isolatie per offerte)", () => {
  it("geeft verschillende offertes een verschillende sleutel — geen kruisbesmetting", () => {
    expect(quoteLineDraftKey("quote_A")).not.toBe(quoteLineDraftKey("quote_B"));
  });

  it("is stabiel en herkenbaar geprefixt per offerte-id", () => {
    expect(quoteLineDraftKey("quote_A")).toBe("henke-offerteregel-quote_A");
    expect(quoteLineDraftKey("quote_A")).toBe(quoteLineDraftKey("quote_A"));
  });
});

describe("readQuoteLineDraft (offerteregel overleeft tab-eviction)", () => {
  it("herstelt de volledige regelinvoer ná een JSON-round-trip, inclusief het product", () => {
    const restored = readQuoteLineDraft(throughDraft({ ...FILLED_LINE }));

    expect(restored.title).toBe("Vloer woonkamer");
    expect(restored.quantity).toBe("20");
    expect(restored.unitPriceExVat).toBe("29.95");
    expect(restored.discountExVat).toBe("10");
    expect(restored.projectRoomId).toBe("room_9");
    expect(restored.lineType).toBe("product");
    // Het hele product komt terug — picker-trigger toont weer de naam, en de regel-metadata
    // (category/productSoort) blijft intact.
    expect(restored.selectedProduct).toEqual(SAMPLE_PRODUCT);
    expect(restored.selectedProduct?.category).toBe("PVC Vloeren");
    expect(restored.selectedProduct?.productSoort).toBe("click");
  });

  it("herstelt een gekozen werkzaamheid volledig en typeveilig na tab-eviction", () => {
    const restored = readQuoteLineDraft(
      throughDraft({
        ...FILLED_LINE,
        lineType: "service",
        selectedProduct: null,
        selectedServiceRule: SAMPLE_SERVICE_RULE
      })
    );

    expect(restored.selectedServiceRule).toEqual(SAMPLE_SERVICE_RULE);
    expect(restored.selectedServiceRule?.serviceMetadata?.shape).toBe("half_turn");
    expect(restored.selectedServiceRule?.productId).toBe("service_product_123");
  });

  it("laat een leeg concept ongemoeid (geen product, lege velden)", () => {
    const restored = readQuoteLineDraft(
      throughDraft({
        lineType: "product",
        title: "",
        quantity: "1",
        selectedProduct: null,
        selectedServiceRule: null
      })
    );

    expect(restored.title).toBe("");
    expect(restored.selectedProduct).toBeUndefined();
    expect(restored.selectedServiceRule).toBeUndefined();
  });

  it("herstelt alleen een geldig regeltype en negeert een onbekende/corrupte lineType", () => {
    expect(readQuoteLineDraft(throughDraft({ lineType: "service" })).lineType).toBe("service");
    expect(readQuoteLineDraft(throughDraft({ lineType: "text" })).lineType).toBe("text");
    expect(readQuoteLineDraft(throughDraft({ lineType: "bogus" })).lineType).toBeUndefined();
    expect(readQuoteLineDraft({ lineType: 7 }).lineType).toBeUndefined();
  });

  it("negeert niet-string velden en corrupte cataloguskeuzes", () => {
    const restored = readQuoteLineDraft({
      title: 123,
      quantity: null,
      unitPriceExVat: { bad: true },
      selectedProduct: { id: "x" },
      selectedServiceRule: { id: "service-zonder-verplichte-velden" }
    });

    expect(restored.title).toBeUndefined();
    expect(restored.quantity).toBeUndefined();
    expect(restored.unitPriceExVat).toBeUndefined();
    expect(restored.selectedProduct).toBeUndefined();
    expect(restored.selectedServiceRule).toBeUndefined();
  });

  it("houdt alleen de aanwezige velden aan (partieel concept)", () => {
    const restored = readQuoteLineDraft(throughDraft({ title: "Alleen titel" }));

    expect(restored.title).toBe("Alleen titel");
    expect(restored.quantity).toBeUndefined();
    expect(restored.selectedProduct).toBeUndefined();
    expect(restored.selectedServiceRule).toBeUndefined();
  });
});
