import { describe, expect, it } from "vitest";
import {
  isUnitCompatible,
  selectIndicativePrice,
  type IndicativePriceRow
} from "../convex/catalog/pricingRules";

const NOW = 1_750_000_000_000;

function row(overrides: Partial<IndicativePriceRow> & { id: string }): IndicativePriceRow {
  return {
    priceType: "advice_retail",
    priceUnit: "m2",
    amount: 10,
    vatRate: 21,
    vatMode: "exclusive",
    updatedAt: NOW - 1000,
    ...overrides
  };
}

describe("selectIndicativePrice — whitelist en btw-normalisatie", () => {
  it("kiest nooit een inkoop-, staffel- of pseudo-prijs, ook niet als enige optie", () => {
    for (const priceType of [
      "purchase",
      "net_purchase",
      "commission",
      "pallet",
      "trailer",
      "roll",
      "cut_length",
      "package",
      "step",
      "manual"
    ]) {
      const selection = selectIndicativePrice([row({ id: "p1", priceType })], {}, "m2", NOW);
      expect(selection, `priceType ${priceType} mag nooit winnen`).toBeNull();
    }
  });

  it("accepteert advice_retail en retail", () => {
    expect(selectIndicativePrice([row({ id: "a" })], {}, "m2", NOW)?.priceType).toBe("advice_retail");
    expect(
      selectIndicativePrice([row({ id: "r", priceType: "retail" })], {}, "m2", NOW)?.priceType
    ).toBe("retail");
  });

  it("rekent een exclusieve prijs om naar incl. btw", () => {
    const selection = selectIndicativePrice([row({ id: "ex", amount: 10 })], {}, "m2", NOW);

    expect(selection?.unitPriceExVat).toBe(10);
    expect(selection?.unitPriceIncVat).toBe(12.1);
    expect(selection?.vatModeUsed).toBe("exclusive");
  });

  it("rekent een inclusieve prijs terug naar excl. btw", () => {
    const selection = selectIndicativePrice(
      [row({ id: "inc", amount: 12.1, vatMode: "inclusive" })],
      {},
      "m2",
      NOW
    );

    expect(selection?.unitPriceIncVat).toBe(12.1);
    expect(selection?.unitPriceExVat).toBe(10);
    expect(selection?.vatModeUsed).toBe("inclusive");
  });

  it("levert nooit een prijs op basis van vatMode unknown", () => {
    expect(
      selectIndicativePrice([row({ id: "u", vatMode: "unknown" })], {}, "m2", NOW)
    ).toBeNull();
  });

  it("laat een unknown-regel een bruikbare kandidaat niet verdringen", () => {
    const selection = selectIndicativePrice(
      [
        row({ id: "u", vatMode: "unknown", updatedAt: NOW }),
        row({ id: "ok", amount: 8, updatedAt: NOW - 5000 })
      ],
      {},
      "m2",
      NOW
    );

    expect(selection?.priceRowId).toBe("ok");
  });

  it("negeert regels zonder positief bedrag", () => {
    expect(selectIndicativePrice([row({ id: "zero", amount: 0 })], {}, "m2", NOW)).toBeNull();
    expect(selectIndicativePrice([row({ id: "neg", amount: -5 })], {}, "m2", NOW)).toBeNull();
  });
});

describe("selectIndicativePrice — eenheden", () => {
  it("eist een matchende prijseenheid (geen m1-prijs voor een m2-meting)", () => {
    expect(
      selectIndicativePrice([row({ id: "m1", priceUnit: "m1" })], {}, "m2", NOW)
    ).toBeNull();
  });

  it("behandelt m1 en meter als uitwisselbaar", () => {
    expect(
      selectIndicativePrice([row({ id: "m1", priceUnit: "m1" })], {}, "meter", NOW)?.priceRowId
    ).toBe("m1");
    expect(
      selectIndicativePrice([row({ id: "meter", priceUnit: "meter" })], {}, "m1", NOW)?.priceRowId
    ).toBe("meter");
  });

  it("rekent een pakprijs om naar m² via packageContentM2", () => {
    const selection = selectIndicativePrice(
      [row({ id: "pak", priceUnit: "pack", amount: 50 })],
      { packageContentM2: 2.5 },
      "m2",
      NOW
    );

    expect(selection?.conversionApplied).toBe("package_to_m2");
    expect(selection?.priceUnit).toBe("m2");
    expect(selection?.unitPriceExVat).toBe(20);
    expect(selection?.unitPriceIncVat).toBe(24.2);
  });

  it("converteert geen pakprijs zonder bekende pakinhoud", () => {
    expect(
      selectIndicativePrice([row({ id: "pak", priceUnit: "pack" })], {}, "m2", NOW)
    ).toBeNull();
  });

  it("laat een directe m²-match altijd winnen van een pak-conversie", () => {
    const selection = selectIndicativePrice(
      [
        row({ id: "pak", priceUnit: "pack", amount: 50, updatedAt: NOW }),
        row({ id: "direct", priceUnit: "m2", amount: 30, updatedAt: NOW - 5000 })
      ],
      { packageContentM2: 2.5 },
      "m2",
      NOW
    );

    expect(selection?.priceRowId).toBe("direct");
    expect(selection?.conversionApplied).toBeUndefined();
  });

  it("geeft geen trede-prijs voor een hele trap (unit stairs)", () => {
    expect(
      selectIndicativePrice([row({ id: "step", priceUnit: "step" })], {}, "stairs", NOW)
    ).toBeNull();
  });

  it("geeft wel een trede-prijs voor een meting in treden", () => {
    expect(
      selectIndicativePrice([row({ id: "step", priceUnit: "step" })], {}, "trede", NOW)?.priceRowId
    ).toBe("step");
  });
});

describe("selectIndicativePrice — geldigheid en tie-breaks", () => {
  it("verwerpt regels met validFrom in de toekomst", () => {
    expect(
      selectIndicativePrice([row({ id: "future", validFrom: NOW + 1 })], {}, "m2", NOW)
    ).toBeNull();
  });

  it("laat de hoogste (ingegane) validFrom winnen", () => {
    const selection = selectIndicativePrice(
      [
        row({ id: "old", validFrom: NOW - 100_000, updatedAt: NOW }),
        row({ id: "new", validFrom: NOW - 1000, updatedAt: NOW - 50_000 })
      ],
      {},
      "m2",
      NOW
    );

    expect(selection?.priceRowId).toBe("new");
  });

  it("valt terug op nieuwste updatedAt bij gelijke validFrom", () => {
    const selection = selectIndicativePrice(
      [row({ id: "older", updatedAt: NOW - 9000 }), row({ id: "newer", updatedAt: NOW - 1000 })],
      {},
      "m2",
      NOW
    );

    expect(selection?.priceRowId).toBe("newer");
  });

  it("houdt de incl-prijs reconstrueerbaar uit de opgeslagen ex-prijs (geen cent-drift)", () => {
    // Inclusief bedrag dat niet glad deelt door 1,21: ex wordt op 4 decimalen
    // bewaard zodat ex × 1,21 afgerond weer exact de getoonde incl-prijs geeft.
    const selection = selectIndicativePrice(
      [row({ id: "drift", amount: 9.99, vatMode: "inclusive" })],
      {},
      "m2",
      NOW
    );

    expect(selection).not.toBeNull();
    const reconstructed =
      Math.round((selection!.unitPriceExVat * 1.21 + Number.EPSILON) * 100) / 100;
    expect(reconstructed).toBe(selection!.unitPriceIncVat);
    expect(selection!.unitPriceIncVat).toBe(9.99);
  });

  it("kiest deterministisch bij volledig gelijke duplicaten (dubbel geïmporteerde lijst)", () => {
    const duplicates = [
      row({ id: "a", updatedAt: NOW, creationTime: 1 }),
      row({ id: "b", updatedAt: NOW, creationTime: 2 })
    ];
    const first = selectIndicativePrice(duplicates, {}, "m2", NOW);
    const second = selectIndicativePrice([...duplicates].reverse(), {}, "m2", NOW);

    expect(first?.priceRowId).toBe("b");
    expect(second?.priceRowId).toBe("b");
  });
});

describe("isUnitCompatible — snapshot-geldigheid bij eenheidwijziging", () => {
  it("accepteert alleen passende prijseenheden", () => {
    expect(isUnitCompatible("m2", "m2")).toBe(true);
    expect(isUnitCompatible("meter", "m1")).toBe(true);
    expect(isUnitCompatible("m2", "m1")).toBe(false);
    expect(isUnitCompatible("roll", "m2")).toBe(false);
    expect(isUnitCompatible("stairs", "step")).toBe(false);
    expect(isUnitCompatible("onzin", "m2")).toBe(false);
    expect(isUnitCompatible("m2", undefined)).toBe(false);
  });
});
