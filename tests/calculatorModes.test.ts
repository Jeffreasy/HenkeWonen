import { describe, it, expect } from "vitest";
import {
  calculateBroadloom,
  calculateCurtainFabric,
  calculateScreed
} from "../src/lib/calculators/index";

describe("calculateBroadloom (tapijt/vinyl op rol)", () => {
  it("kiest de zuinigste legrichting", () => {
    // 4×5 ruimte, rol 4m. A: 1 baan × 5m = 5m¹; B: 2 banen × 4m = 8m¹ → A wint.
    const r = calculateBroadloom({ roomWidthM: 4, roomLengthM: 5, rollWidthM: 4, wastePercent: 0 });
    expect(r.validationError).toBeUndefined();
    expect(r.strips).toBe(1);
    expect(r.runningMeterM).toBe(5);
    expect(r.areaM2).toBe(20);
    expect(r.quoteQuantityM).toBe(5);
  });

  it("verrekent snijverlies in de lopende meters", () => {
    // 5×4 ruimte, rol 4m. A: 2×4=8; B: 1×5=5 → B wint; +10% snijverlies = 5.5
    const r = calculateBroadloom({ roomWidthM: 5, roomLengthM: 4, rollWidthM: 4, wastePercent: 10 });
    expect(r.strips).toBe(1);
    expect(r.runningMeterM).toBe(5.5);
    expect(r.quoteQuantityM).toBe(5.5);
  });

  it("valideert ongeldige invoer", () => {
    expect(
      calculateBroadloom({ roomWidthM: 0, roomLengthM: 4, rollWidthM: 4, wastePercent: 0 })
        .validationError
    ).toBeTruthy();
    expect(
      calculateBroadloom({ roomWidthM: 4, roomLengthM: 4, rollWidthM: 0, wastePercent: 0 })
        .validationError
    ).toBeTruthy();
  });
});

describe("calculateCurtainFabric (gordijnstof)", () => {
  it("berekent banen en baanlengte (zonder rapport)", () => {
    const r = calculateCurtainFabric({
      railWidthM: 2,
      curtainHeightM: 2.6,
      fabricWidthM: 1.4,
      fullness: 2,
      makeUp: "banen"
    });
    expect(r.validationError).toBeUndefined();
    expect(r.requiredWidthM).toBe(4);
    expect(r.banen).toBe(3); // 4 / (1.4 - 0.06) = 2.99 -> 3
    expect(r.dropM).toBe(2.9); // 2.6 + 0.30 hem
    expect(r.fabricMetersM).toBe(8.7); // 3 × 2.9
    expect(r.quoteQuantityM).toBe(8.7);
  });

  it("rondt de baanlengte omhoog op het patroonrapport", () => {
    const r = calculateCurtainFabric({
      railWidthM: 2,
      curtainHeightM: 2.6,
      fabricWidthM: 1.4,
      fullness: 2,
      makeUp: "banen",
      rapportM: 0.32
    });
    // drop = ceil((2.6+0.3)/0.32) × 0.32 = ceil(9.0625)=10 → 3.2; 3 banen × 3.2 = 9.6
    expect(r.dropM).toBe(3.2);
    expect(r.fabricMetersM).toBe(9.6);
  });

  it("rekent kamerhoge confectie als gekantelde lopende meters", () => {
    const r = calculateCurtainFabric({
      railWidthM: 3,
      curtainHeightM: 2.7,
      fabricWidthM: 3,
      fullness: 2,
      makeUp: "kamerhoog"
    });
    expect(r.banen).toBeNull();
    expect(r.dropM).toBeNull();
    expect(r.fabricMetersM).toBe(6); // 3 × 2 (gekanteld)
  });

  it("weigert kamerhoog wanneer de stof smaller is dan gordijnhoogte + zoom", () => {
    const r = calculateCurtainFabric({
      railWidthM: 3,
      curtainHeightM: 2.6,
      fabricWidthM: 1.4, // < 2.6 + 0.3 zoom → fysiek niet kamerhoog te kantelen
      fullness: 2,
      makeUp: "kamerhoog"
    });
    expect(r.validationError).toBeTruthy();
    expect(r.fabricMetersM).toBe(0);
  });

  it("valideert ongeldige invoer", () => {
    expect(
      calculateCurtainFabric({
        railWidthM: 2,
        curtainHeightM: 2.6,
        fabricWidthM: 1.4,
        fullness: 0,
        makeUp: "banen"
      }).validationError
    ).toBeTruthy();
  });

  it("weigert banen-confectie zonder bruikbare stofbreedte (zijzoom >= stofbreedte)", () => {
    // Zonder guard zou de oude 1cm-clamp hier stilletjes 400 banen opleveren.
    const r = calculateCurtainFabric({
      railWidthM: 2,
      curtainHeightM: 2.6,
      fabricWidthM: 0.08,
      sideHemM: 0.1,
      fullness: 2,
      makeUp: "banen"
    });
    expect(r.validationError).toMatch(/stof te smal/i);
    expect(r.fabricMetersM).toBe(0);
    expect(r.quoteQuantityM).toBe(0);
  });

  it("accepteert een krappe maar bruikbare stofbreedte gewoon", () => {
    const r = calculateCurtainFabric({
      railWidthM: 2,
      curtainHeightM: 2.6,
      fabricWidthM: 0.7,
      sideHemM: 0.06,
      fullness: 2,
      makeUp: "banen"
    });
    expect(r.validationError).toBeUndefined();
    expect(r.banen).toBe(7); // 4 / 0.64 = 6.25 -> 7
  });
});

describe("calculateScreed (egaliseren)", () => {
  it("berekent kg en aantal zakken met defaults", () => {
    const r = calculateScreed({ areaM2: 20, layerThicknessMm: 3 });
    expect(r.validationError).toBeUndefined();
    expect(r.consumptionKgPerM2PerMm).toBe(1.5);
    expect(r.packKg).toBe(25);
    expect(r.kgNeeded).toBe(90); // 20 × 3 × 1.5
    expect(r.packsNeeded).toBe(4); // ceil(90/25)
  });

  it("respecteert opgegeven verbruik en zakinhoud", () => {
    const r = calculateScreed({
      areaM2: 50,
      layerThicknessMm: 5,
      consumptionKgPerM2PerMm: 1.6,
      packKg: 20
    });
    expect(r.kgNeeded).toBe(400);
    expect(r.packsNeeded).toBe(20);
  });

  it("rondt zakken naar boven af op de ruwe kg (geen onder-offerte door tussenafronding)", () => {
    // 16,667 × 3 × 1,5 = 75,00150 kg → ceil(75,00150/25) = 4 zakken.
    // Afronden vóór de ceil zou 75,00 → 3 zakken geven (één te weinig).
    const r = calculateScreed({ areaM2: 16.667, layerThicknessMm: 3 });
    expect(r.packsNeeded).toBe(4);
    expect(r.kgNeeded).toBe(75); // kgNeeded blijft afgerond voor weergave
  });

  it("valideert ongeldige invoer", () => {
    expect(calculateScreed({ areaM2: 0, layerThicknessMm: 3 }).validationError).toBeTruthy();
    expect(calculateScreed({ areaM2: 20, layerThicknessMm: 0 }).validationError).toBeTruthy();
  });
});
