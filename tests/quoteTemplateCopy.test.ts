import { describe, it, expect } from "vitest";
import {
  polishQuoteTemplateText,
  polishQuoteTemplateLines
} from "../src/lib/quotes/quoteTemplateCopy";

describe("Quote Template Text Polisher", () => {
  it("should replace shorthand abbreviations with proper typography", () => {
    expect(polishQuoteTemplateText("Meting tbv pvc vloer.")).toBe("Meting t.b.v. PVC vloer.");
    expect(polishQuoteTemplateText("Aantal m2 is 25.")).toBe("Aantal m² is 25.");
    expect(polishQuoteTemplateText("Geleverde Plisses.")).toBe("Geleverde Plissés.");
    expect(polishQuoteTemplateText("mooie plisses of plisse.")).toBe("mooie plissés of plissé.");
    expect(polishQuoteTemplateText("Grote selectie Jaloezieen.")).toBe("Grote selectie jaloezieën.");
  });

  it("should replace EUR representations with symbols", () => {
    expect(polishQuoteTemplateText("Totale kosten: EUR 10.000 voorbereiding.")).toBe("Totale kosten: €10.000 voorbereiding.");
    expect(polishQuoteTemplateText("Aanbetaling EUR 3000.")).toBe("Aanbetaling €3.000.");
  });

  it("should replace payment terms case-insensitively", () => {
    expect(polishQuoteTemplateText("Graag via PIN betaling voldoen.")).toBe("Graag via pinbetaling voldoen.");
    expect(polishQuoteTemplateText("Betaling per PIN.")).toBe("Betaling per pin.");
  });

  it("should polish an array of lines in bulk", () => {
    const input = [
      "Inmeten tbv pvc",
      "Kamer is 15 m2 groot"
    ];
    const output = polishQuoteTemplateLines(input);
    expect(output).toEqual([
      "Inmeten t.b.v. PVC",
      "Kamer is 15 m² groot"
    ]);
  });
});
