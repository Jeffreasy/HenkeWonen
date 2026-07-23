import { describe, expect, it } from "vitest";
import {
  isLegacyPvcStairTemplateLine,
  isSelectableQuoteTemplateLine
} from "../src/lib/quotes/quoteTemplateAvailability";

describe("offertetemplate-beschikbaarheid", () => {
  it("verbergt uitsluitend de oude samengestelde PVC-trapregel op structurele identiteit", () => {
    const legacy = {
      sectieSleutel: " traprenovatie ",
      titel: "Traprenovatie\u00a0PVC fabrikant, kleur, kleur strip"
    };

    expect(isLegacyPvcStairTemplateLine(legacy)).toBe(true);
    expect(isSelectableQuoteTemplateLine(legacy)).toBe(false);
    expect(
      isSelectableQuoteTemplateLine({
        sectieSleutel: "traprenovatie",
        titel: "Traprenovatie tapijt fabrikant en kleur"
      })
    ).toBe(true);
    expect(
      isSelectableQuoteTemplateLine({
        sectieSleutel: "vrije-regels",
        titel: "Traprenovatie PVC fabrikant, kleur, kleur strip"
      })
    ).toBe(true);
  });
});
