import { describe, it, expect } from "vitest";
import { calculatorRulesSeed } from "../convex/catalog/calculatorRulesSeed";

const KNOWN_TOOLS = new Set([
  "pvc_vloer",
  "tapijt",
  "vinyl",
  "egaliseren",
  "vloerkleed",
  "schoonloopmat",
  "wandpanelen",
  "behang",
  "raambekleding",
  "gordijnen"
]);

describe("calculatorRulesSeed (marge-/bedrijfsregels uit HenkeWonenDATA)", () => {
  it("bevat 51 regels met 18 placeholder-bedrijfsregels", () => {
    expect(calculatorRulesSeed).toHaveLength(51);
    expect(calculatorRulesSeed.filter((r) => r.vereistKlantInput)).toHaveLength(18);
  });

  it("verwijst alleen naar bekende producttools", () => {
    for (const r of calculatorRulesSeed) {
      expect(KNOWN_TOOLS.has(r.productToolSleutel), r.productToolSleutel).toBe(true);
    }
  });

  it("legt de marge-delers en bedrijfsregels vast (steekproef)", () => {
    const find = (tool: string, soort: string) =>
      calculatorRulesSeed.find((r) => r.productToolSleutel === tool && r.regelSoort === soort);
    expect(find("schoonloopmat", "markup_factor")?.waarde).toBe(1.3);
    expect(find("egaliseren", "consumption_kg_m2_mm")?.waarde).toBe(1.5);
    expect(find("egaliseren", "pack_kg")?.waarde).toBe(25);
    expect(find("gordijnen", "fullness")?.waarde).toBe(2);
  });

  it("markeert de placeholders (waste/labor/plooi/verbruik) als vereistKlantInput", () => {
    const placeholderSoorten = new Set(
      calculatorRulesSeed.filter((r) => r.vereistKlantInput).map((r) => r.regelSoort)
    );
    // Delers (pallet/commissie/coupage/roll) zijn juist NIET placeholder.
    expect(placeholderSoorten.has("pallet_divisor")).toBe(false);
    expect(placeholderSoorten.has("commission_divisor")).toBe(false);
    // Bedrijfsregels zijn dat wel.
    expect(placeholderSoorten.has("waste_pct")).toBe(true);
    expect(placeholderSoorten.has("labor_surcharge")).toBe(true);
  });
});
