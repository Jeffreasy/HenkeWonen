import { describe, expect, it } from "vitest";
import { buildPvcStairQuoteBundle } from "../src/lib/quotes/stairQuoteBundle";

describe("buildPvcStairQuoteBundle", () => {
  it("mapt iedere PVC-trapvorm op de stabiele arbeids-SKU", () => {
    const cases = [
      ["straight", "HW-DIENST-016"],
      ["quarter_turn", "HW-DIENST-015"],
      ["half_turn", "HW-DIENST-014"]
    ] as const;

    for (const [stairShape, expectedSku] of cases) {
      const result = buildPvcStairQuoteBundle({
        covering: "pvc",
        stairShape,
        stairConstruction: "closed"
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.baseServiceSku).toBe(expectedSku);
      expect(result.value.serviceSkus).toEqual([expectedSku]);
      expect(result.value.surchargeServiceSkus).toEqual([]);
    }
  });

  it("voegt de open-traptoeslag onafhankelijk van de vorm toe", () => {
    const result = buildPvcStairQuoteBundle({
      covering: "pvc",
      stairShape: "half_turn",
      stairConstruction: "open"
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.serviceSkus).toEqual(["HW-DIENST-014", "HW-DIENST-006"]);
    expect(result.value.services[1]).toEqual({ sku: "HW-DIENST-006", bundleRole: "surcharge" });
  });

  it("weigert ongeldige invoer zonder op namen of prijzen terug te vallen", () => {
    const result = buildPvcStairQuoteBundle({
      covering: "tapijt",
      stairShape: "hele_draai",
      stairConstruction: "zwevend"
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      "unsupported_covering",
      "invalid_stair_shape",
      "invalid_stair_construction"
    ]);
  });
});
