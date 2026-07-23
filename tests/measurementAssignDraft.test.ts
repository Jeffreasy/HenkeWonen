import { describe, expect, it } from "vitest";
import type { PortalProduct } from "../src/lib/portalTypes";
import {
  isRestorablePortalProduct,
  restoreMeasurementProductSelection
} from "../src/lib/measurementAssignDraft";

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

/**
 * Bootst de `useFormDraft`-envelope na: React-state → localStorage (JSON) → parse → concept.
 * Precies de round-trip die een mobiele tab-eviction afdwingt.
 */
function throughDraft(values: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify({ t: 123, d: values });
  return (JSON.parse(serialized) as { d: Record<string, unknown> }).d;
}

describe("restoreMeasurementProductSelection (productselectie overleeft tab-eviction)", () => {
  it("herstelt het volledige product ná een JSON-round-trip, inclusief rekenmachine-velden", () => {
    const draft = throughDraft({ product: SAMPLE_PRODUCT, serviceRuleId: "" });

    const restored = restoreMeasurementProductSelection(draft);

    // Het product komt intact terug — de picker-trigger toont weer de naam i.p.v. de placeholder.
    expect(restored.product).toEqual(SAMPLE_PRODUCT);
    // category + productSoort bepalen de rekenmachine (vloer: per m² vs. rolgoed); zonder deze
    // zou calculatorForProduct op "manual" vallen en zou toevoegen geblokkeerd zijn.
    expect(restored.product?.category).toBe("PVC Vloeren");
    expect(restored.product?.productSoort).toBe("click");
  });

  it("herstelt de losse dienstkeuze (serviceRuleId) na de round-trip", () => {
    const draft = throughDraft({ product: null, serviceRuleId: "svc_9" });

    expect(restoreMeasurementProductSelection(draft).serviceRuleId).toBe("svc_9");
  });

  it("herstelt gekozen trapmaterialen met een expliciete gemotiveerde override", () => {
    const draft = throughDraft({
      stairMaterials: [
        { product: SAMPLE_PRODUCT, quantityOverride: "14", overrideReason: "Extra reservetrede" }
      ]
    });

    expect(restoreMeasurementProductSelection(draft).stairMaterials).toEqual([
      { product: SAMPLE_PRODUCT, quantityOverride: "14", overrideReason: "Extra reservetrede" }
    ]);
  });

  it("herstelt een oud vast aantal niet als verouderde override", () => {
    const restored = restoreMeasurementProductSelection({
      stairMaterials: [{ product: SAMPLE_PRODUCT, quantity: "1" }]
    });

    expect(restored.stairMaterials).toEqual([{ product: SAMPLE_PRODUCT }]);
  });

  it("filtert ongeldige trapmateriaalregels uit een corrupt concept", () => {
    const restored = restoreMeasurementProductSelection({
      stairMaterials: [
        { product: SAMPLE_PRODUCT, quantityOverride: "2", overrideReason: "Reserve" },
        { product: { id: "half" }, quantity: "1" },
        { product: SAMPLE_PRODUCT, quantity: 3 }
      ]
    });

    expect(restored.stairMaterials).toEqual([
      { product: SAMPLE_PRODUCT, quantityOverride: "2", overrideReason: "Reserve" }
    ]);
  });

  it("negeert een niet-string serviceRuleId uit een corrupt concept", () => {
    // Zet niet terug -> de state houdt zijn begininstelling ("") i.p.v. rommel.
    expect(
      restoreMeasurementProductSelection({ serviceRuleId: 123 }).serviceRuleId
    ).toBeUndefined();
    expect(
      restoreMeasurementProductSelection({ serviceRuleId: null }).serviceRuleId
    ).toBeUndefined();
  });

  it("laat de keuze leeg als er nog niets gekozen was", () => {
    const restored = restoreMeasurementProductSelection(
      throughDraft({ product: null, serviceRuleId: "" })
    );

    // Geen geldig product -> niet terugzetten (state blijft op zijn begininstelling null).
    expect(restored.product).toBeUndefined();
    expect(restored.serviceRuleId).toBe("");
  });

  it("negeert een corrupt of half product zodat de picker niet crasht", () => {
    expect(restoreMeasurementProductSelection({ product: { id: "x" } }).product).toBeUndefined();
    expect(restoreMeasurementProductSelection({ product: "nope" }).product).toBeUndefined();
    expect(
      restoreMeasurementProductSelection({
        product: { id: 5, naam: "a", weergaveNaam: "b", category: "c" }
      }).product
    ).toBeUndefined();
  });
});

describe("isRestorablePortalProduct", () => {
  it("accepteert een echt product en wijst rommel af", () => {
    expect(isRestorablePortalProduct(SAMPLE_PRODUCT)).toBe(true);
    expect(isRestorablePortalProduct(JSON.parse(JSON.stringify(SAMPLE_PRODUCT)))).toBe(true);
    expect(isRestorablePortalProduct(null)).toBe(false);
    expect(isRestorablePortalProduct(undefined)).toBe(false);
    expect(isRestorablePortalProduct({})).toBe(false);
    // Lege id telt niet als keuze.
    expect(isRestorablePortalProduct({ id: "", naam: "a", weergaveNaam: "b", category: "c" })).toBe(
      false
    );
  });
});
