import { describe, it, expect } from "vitest";
import { buildMatrixSelection, lookupMatrixPrice } from "../convex/catalog/pricingRules";

const breedteAs = [60, 100, 140];
const hoogteAs = [100, 150];
const prijzen = [
  [10, 20, 30],
  [11, 21, 31]
];

describe("lookupMatrixPrice (convex-port)", () => {
  it("rondt omhoog en geeft de gematchte maatklasse", () => {
    expect(lookupMatrixPrice(breedteAs, hoogteAs, prijzen, 90, 120)).toEqual({
      amount: 21,
      matchedWidthCm: 100,
      matchedHeightCm: 150
    });
  });

  it("matcht exact zonder afronden", () => {
    expect(lookupMatrixPrice(breedteAs, hoogteAs, prijzen, 60, 100)).toEqual({
      amount: 10,
      matchedWidthCm: 60,
      matchedHeightCm: 100
    });
  });

  it("geeft null buiten bereik", () => {
    expect(lookupMatrixPrice(breedteAs, hoogteAs, prijzen, 200, 100)).toBeNull();
    expect(lookupMatrixPrice(breedteAs, hoogteAs, prijzen, 100, 200)).toBeNull();
  });
});

describe("buildMatrixSelection (richtprijs-conforme btw)", () => {
  it("exclusive: matrixbedrag = ex-prijs, incl afgeleid op 2 decimalen", () => {
    const s = buildMatrixSelection(243, "exclusive");
    expect(s).not.toBeNull();
    expect(s!.unitPriceExVat).toBe(243);
    expect(s!.unitPriceIncVat).toBe(294.03); // 243 * 1.21
    expect(s!.vatRate).toBe(21);
    expect(s!.vatModeUsed).toBe("exclusive");
  });

  it("inclusive: ex = bedrag / 1.21 op 4 decimalen, incl terug op 2 decimalen", () => {
    const s = buildMatrixSelection(121, "inclusive");
    expect(s!.unitPriceExVat).toBe(100); // 121 / 1.21
    expect(s!.unitPriceIncVat).toBe(121);
    expect(s!.vatModeUsed).toBe("inclusive");
  });

  it("ex-prijs houdt 4 decimalen aan (cent-exacte reconstructie)", () => {
    const s = buildMatrixSelection(10, "inclusive");
    expect(s!.unitPriceExVat).toBe(8.2645); // 10/1.21 op 4 dec
  });

  it("unknown/ontbrekende btwModus -> geen richtprijs (null)", () => {
    expect(buildMatrixSelection(243, "unknown")).toBeNull();
    expect(buildMatrixSelection(243, undefined)).toBeNull();
  });
});
