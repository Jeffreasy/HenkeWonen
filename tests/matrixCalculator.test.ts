import { describe, it, expect } from "vitest";
import { lookupMatrix, calculateWindowCoveringMatrix } from "../src/lib/calculators/index";
import { priceMatricesSeed } from "../convex/catalog/priceMatricesSeed";

// Kleine synthetische matrix voor de pure-functie-tests.
// breedteAs/hoogteAs in cm; prijzen[hoogte-index][breedte-index].
const breedteAs = [60, 100, 140];
const hoogteAs = [100, 150];
const prijzen = [
  [10, 20, 30], // hoogteklasse 100
  [11, 21, 31] // hoogteklasse 150
];

describe("lookupMatrix", () => {
  it("rondt breedte en hoogte omhoog naar de eerstvolgende maatklasse", () => {
    // 90×120 → breedteklasse 100 (index 1), hoogteklasse 150 (index 1) → prijzen[1][1] = 21
    expect(lookupMatrix(breedteAs, hoogteAs, prijzen, 90, 120)).toBe(21);
  });

  it("matcht een exacte maat zonder afronden", () => {
    expect(lookupMatrix(breedteAs, hoogteAs, prijzen, 60, 100)).toBe(10);
    expect(lookupMatrix(breedteAs, hoogteAs, prijzen, 140, 150)).toBe(31);
  });

  it("geeft null buiten bereik (breedte of hoogte te groot)", () => {
    expect(lookupMatrix(breedteAs, hoogteAs, prijzen, 200, 100)).toBeNull();
    expect(lookupMatrix(breedteAs, hoogteAs, prijzen, 100, 200)).toBeNull();
  });
});

describe("calculateWindowCoveringMatrix", () => {
  it("geeft eenheidsprijs, maatklasse en totaal bij een aantal", () => {
    const r = calculateWindowCoveringMatrix({
      breedteAs,
      hoogteAs,
      prijzen,
      breedteCm: 90,
      hoogteCm: 120,
      quantity: 3
    });
    expect(r.validationError).toBeUndefined();
    expect(r.outOfRange).toBe(false);
    expect(r.matchedWidthCm).toBe(100);
    expect(r.matchedHeightCm).toBe(150);
    expect(r.unitPrice).toBe(21);
    expect(r.totalPrice).toBe(63);
    expect(r.isIndicative).toBe(true);
  });

  it("markeert buiten bereik als offerte op maat (outOfRange, geen prijs)", () => {
    const r = calculateWindowCoveringMatrix({
      breedteAs,
      hoogteAs,
      prijzen,
      breedteCm: 500,
      hoogteCm: 100
    });
    expect(r.outOfRange).toBe(true);
    expect(r.unitPrice).toBeNull();
    expect(r.totalPrice).toBeNull();
    expect(r.validationError).toBeUndefined();
  });

  it("valideert breedte, hoogte en aantal", () => {
    expect(
      calculateWindowCoveringMatrix({ breedteAs, hoogteAs, prijzen, breedteCm: 0, hoogteCm: 100 })
        .validationError
    ).toBeTruthy();
    expect(
      calculateWindowCoveringMatrix({ breedteAs, hoogteAs, prijzen, breedteCm: 90, hoogteCm: -1 })
        .validationError
    ).toBeTruthy();
    expect(
      calculateWindowCoveringMatrix({
        breedteAs,
        hoogteAs,
        prijzen,
        breedteCm: 90,
        hoogteCm: 100,
        quantity: 0
      }).validationError
    ).toBeTruthy();
  });
});

describe("priceMatricesSeed (geconsolideerde data uit HenkeWonenDATA)", () => {
  it("bevat 29 raambekleding-matrices, allemaal btw-bekend", () => {
    expect(priceMatricesSeed).toHaveLength(29);
    expect(priceMatricesSeed.every((m) => m.productToolSleutel === "raambekleding")).toBe(true);
    // Btw-guardrail: geen enkele matrix mag "unknown" zijn.
    expect(priceMatricesSeed.some((m) => m.btwModus === "unknown")).toBe(false);
  });

  it("grondwaarheid: Horizontaal 16 mm PRIJSGROEP 0, 100×100 = €243", () => {
    const m = priceMatricesSeed.find(
      (x) => x.bronBlad === "16 mm" && x.prijsgroep === "PRIJSGROEP 0"
    );
    expect(m).toBeDefined();
    expect(lookupMatrix(m!.breedteAs, m!.hoogteAs, m!.prijzen, 100, 100)).toBe(243);
  });

  it("alle matrix-assen zijn oplopend en consistent met de prijzen-dimensies", () => {
    for (const m of priceMatricesSeed) {
      const ascending = (a: number[]) => a.every((v, i) => i === 0 || v > a[i - 1]);
      expect(ascending(m.breedteAs), `${m.bronBlad}/${m.prijsgroep} breedteAs`).toBe(true);
      expect(ascending(m.hoogteAs), `${m.bronBlad}/${m.prijsgroep} hoogteAs`).toBe(true);
      expect(m.prijzen.length, `${m.bronBlad}/${m.prijsgroep} rijen`).toBe(m.hoogteAs.length);
      expect(
        m.prijzen.every((row) => row.length === m.breedteAs.length),
        `${m.bronBlad}/${m.prijsgroep} kolommen`
      ).toBe(true);
    }
  });
});
