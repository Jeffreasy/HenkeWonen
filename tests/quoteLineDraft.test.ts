import { describe, expect, it } from "vitest";
import type { PortalProduct } from "../src/lib/portalTypes";
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
  selectedProduct: SAMPLE_PRODUCT
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

  it("laat een leeg concept ongemoeid (geen product, lege velden)", () => {
    const restored = readQuoteLineDraft(
      throughDraft({
        lineType: "product",
        title: "",
        quantity: "1",
        selectedProduct: null
      })
    );

    expect(restored.title).toBe("");
    expect(restored.selectedProduct).toBeUndefined();
  });

  it("negeert niet-string velden en een corrupt product uit een kapot concept", () => {
    const restored = readQuoteLineDraft({
      title: 123,
      quantity: null,
      unitPriceExVat: { bad: true },
      selectedProduct: { id: "x" }
    });

    expect(restored.title).toBeUndefined();
    expect(restored.quantity).toBeUndefined();
    expect(restored.unitPriceExVat).toBeUndefined();
    expect(restored.selectedProduct).toBeUndefined();
  });

  it("houdt alleen de aanwezige velden aan (partieel concept)", () => {
    const restored = readQuoteLineDraft(throughDraft({ title: "Alleen titel" }));

    expect(restored.title).toBe("Alleen titel");
    expect(restored.quantity).toBeUndefined();
    expect(restored.selectedProduct).toBeUndefined();
  });
});
