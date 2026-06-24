import { describe, expect, it } from "vitest";
import {
  calculatorForLine,
  calculatorForProduct,
  calculatorForService,
  deriveLineForRoom,
  paramsFromInvoer,
  PATTERN_WASTE_PCT
} from "../src/lib/quotes/roomLineDerivation";

describe("calculatorForProduct", () => {
  it("leidt plint/behang/ondervloer uit de categorie af", () => {
    expect(calculatorForProduct({ category: "Plinten" })).toBe("plinth");
    expect(calculatorForProduct({ category: "Behang" })).toBe("wallpaper");
    expect(calculatorForProduct({ category: "Ondervloer" })).toBe("underlay_area");
  });

  it("kiest binnen flooring tussen harde vloer (m²) en rolgoed (lopende meter)", () => {
    expect(calculatorForProduct({ category: "PVC Vloeren", productSoort: "click" })).toBe(
      "floor_area"
    );
    expect(calculatorForProduct({ category: "PVC Dryback", productSoort: "dryback" })).toBe(
      "floor_area"
    );
    expect(calculatorForProduct({ category: "Tapijt", productSoort: "carpet" })).toBe("floor_roll");
    expect(calculatorForProduct({ category: "Vinyl", productSoort: "vinyl" })).toBe("floor_roll");
  });

  it("valt terug op manual voor raam-/trapwerk", () => {
    expect(calculatorForProduct({ category: "Gordijnen" })).toBe("manual");
    expect(calculatorForProduct({ category: "Traprenovatie" })).toBe("manual");
  });

  it("routeert materialen (ondervloer/lijm/egaline) naar underlay_area en karpetten naar manual", () => {
    // Anders zou bv. een lijm-/egaline-product als vloer-per-m² mét legpatroon-snijverlies rekenen.
    expect(calculatorForProduct({ category: "Ondervloer" })).toBe("underlay_area");
    expect(calculatorForProduct({ category: "Lijm" })).toBe("underlay_area");
    expect(calculatorForProduct({ category: "Egaline" })).toBe("underlay_area");
    expect(calculatorForProduct({ category: "Karpetten", productSoort: "rug" })).toBe("manual");
    // Echte vloeren blijven floor_area / floor_roll.
    expect(calculatorForProduct({ category: "PVC Vloeren", productSoort: "click" })).toBe(
      "floor_area"
    );
  });
});

describe("calculatorForService", () => {
  it("mapt berekeningType naar oppervlak/omtrek", () => {
    expect(calculatorForService("per_m2")).toBe("service_area");
    expect(calculatorForService("per_meter")).toBe("service_perimeter");
    expect(calculatorForService("fixed")).toBe("manual");
  });
});

describe("deriveLineForRoom", () => {
  const room = { breedteM: 4, lengteM: 5, hoogteM: 2.6, oppervlakteM2: 20, omtrekM: 18 };

  it("vloer per m²: snijverlies uit legpatroon (recht 3%)", () => {
    const line = deriveLineForRoom("floor_area", room, { patternType: "straight" });
    expect(line.snijverliesPct).toBe(3);
    expect(line.aantal).toBe(20.6); // 20 + 3%
    expect(line.eenheid).toBe("m2");
    expect(line.productGroep).toBe("flooring");
    expect(line.offerteRegelType).toBe("product");
    expect(line.validationError).toBeUndefined();
  });

  it("vloer per m²: visgraat 5%", () => {
    const line = deriveLineForRoom("floor_area", room, { patternType: "herringbone" });
    expect(line.snijverliesPct).toBe(PATTERN_WASTE_PCT.herringbone);
    expect(line.aantal).toBe(21); // 20 + 5%
  });

  it("vloer per m²: berekent oppervlakte uit l×b als oppervlakteM2 ontbreekt", () => {
    const line = deriveLineForRoom("floor_area", { breedteM: 4, lengteM: 5 }, {});
    expect(line.aantal).toBe(20.6); // 20 m² + 3%
  });

  it("plint: hoeveelheid uit omtrek (− deuropening) + snijverlies", () => {
    const line = deriveLineForRoom("plinth", room, { doorOpeningM: 0 });
    expect(line.eenheid).toBe("meter");
    expect(line.productGroep).toBe("plinths");
    expect(line.aantal).toBe(18.9); // 18 m + 5%
  });

  it("dienst per m²: hoeveelheid = oppervlakte, regeltype service", () => {
    const line = deriveLineForRoom("service_area", room);
    expect(line.aantal).toBe(20);
    expect(line.eenheid).toBe("m2");
    expect(line.offerteRegelType).toBe("service");
    expect(line.productGroep).toBe("other");
  });

  it("dienst per meter: hoeveelheid = omtrek", () => {
    const line = deriveLineForRoom("service_perimeter", { omtrekM: 13 });
    expect(line.aantal).toBe(13);
    expect(line.eenheid).toBe("m1");
  });

  it("ondervloer: oppervlakte zonder snijverlies, regeltype material", () => {
    const line = deriveLineForRoom("underlay_area", room);
    expect(line.aantal).toBe(20);
    expect(line.offerteRegelType).toBe("material");
  });

  it("behang: rollen uit omtrek × hoogte", () => {
    const line = deriveLineForRoom("wallpaper", room);
    expect(line.eenheid).toBe("roll");
    expect(line.aantal).toBeGreaterThan(0);
    expect(line.productGroep).toBe("wallpaper");
  });

  it("ontbrekende maten leveren een validationError, geen exception", () => {
    const line = deriveLineForRoom("floor_area", {});
    expect(line.aantal).toBe(0);
    expect(line.validationError).toMatch(/oppervlakte/i);
  });
});

describe("calculatorForLine (reverse-mapping voor herrekenen)", () => {
  it("reconstrueert de rekenmachine uit een opgeslagen regel", () => {
    const c = (productGroep: any, berekeningType: any, eenheid: string, offerteRegelType: any) =>
      calculatorForLine({ productGroep, berekeningType, eenheid, offerteRegelType });
    expect(c("flooring", "area", "m2", "product")).toBe("floor_area");
    expect(c("flooring", "area", "meter", "product")).toBe("floor_roll");
    expect(c("flooring", "area", "m2", "material")).toBe("underlay_area");
    expect(c("plinths", "perimeter", "meter", "product")).toBe("plinth");
    expect(c("wallpaper", "rolls", "roll", "product")).toBe("wallpaper");
    expect(c("other", "area", "m2", "service")).toBe("service_area");
    expect(c("other", "perimeter", "m1", "service")).toBe("service_perimeter");
    expect(c("other", "manual", "stuk", "manual")).toBeNull();
  });

  it("herrekenen: nieuwe maten → nieuwe hoeveelheid, opgeslagen params behouden", () => {
    const oldLine = deriveLineForRoom(
      "floor_area",
      { oppervlakteM2: 20 },
      { patternType: "herringbone" }
    );
    const calc = calculatorForLine({
      productGroep: oldLine.productGroep,
      berekeningType: oldLine.berekeningType,
      eenheid: oldLine.eenheid,
      offerteRegelType: oldLine.offerteRegelType
    });
    expect(calc).toBe("floor_area");
    const recomputed = deriveLineForRoom(
      calc!,
      { oppervlakteM2: 30 },
      paramsFromInvoer(oldLine.invoer)
    );
    expect(recomputed.snijverliesPct).toBe(5); // visgraat-param overleeft de round-trip
    expect(recomputed.aantal).toBe(31.5); // 30 m² + 5%
  });
});
