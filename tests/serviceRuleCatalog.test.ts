import { describe, expect, it } from "vitest";
import {
  calculationTypeToUnit,
  filterServiceRules,
  excludeGuidedStairServiceRules,
  formatCalculationType,
  isGuidedStairServiceRule,
  isStandaloneServiceRule,
  normalizeCalculationType,
  serviceRuleDocToRow,
  toActiveServiceRuleRows,
  type ServiceRuleDoc
} from "../src/components/catalog/serviceRuleCatalog";

function doc(overrides: Partial<ServiceRuleDoc> & { naam: string }): ServiceRuleDoc {
  return {
    _id: overrides._id ?? `id-${overrides.naam}`,
    id: overrides.id ?? overrides._id ?? `id-${overrides.naam}`,
    productId: overrides.productId ?? overrides.id ?? overrides._id ?? `id-${overrides.naam}`,
    naam: overrides.naam,
    omschrijving: overrides.omschrijving,
    sku: overrides.sku,
    category: overrides.category,
    subcategory: overrides.subcategory,
    prijsEenheid: overrides.prijsEenheid,
    priceUnit: overrides.priceUnit,
    productGroup: overrides.productGroup,
    serviceMetadata: overrides.serviceMetadata,
    serviceFamily: overrides.serviceFamily,
    covering: overrides.covering,
    stairShape: overrides.stairShape,
    serviceRole: overrides.serviceRole,
    sectionKey: overrides.sectionKey,
    berekeningType: overrides.berekeningType ?? "fixed",
    prijsExBtw: overrides.prijsExBtw ?? 0,
    btwTarief: overrides.btwTarief ?? 21,
    status: overrides.status ?? "active"
  };
}

describe("calculationTypeToUnit", () => {
  it("mapt dimensionale berekeningstypes op de juiste eenheidssleutel", () => {
    expect(calculationTypeToUnit("per_m2")).toBe("m2");
    expect(calculationTypeToUnit("per_meter")).toBe("meter");
    expect(calculationTypeToUnit("per_roll")).toBe("roll");
    expect(calculationTypeToUnit("per_staircase")).toBe("stairs");
  });

  it("valt voor niet-dimensionale of onbekende types terug op stuk (piece)", () => {
    expect(calculationTypeToUnit("fixed")).toBe("piece");
    expect(calculationTypeToUnit("manual")).toBe("piece");
    expect(calculationTypeToUnit("per_side")).toBe("piece");
    expect(calculationTypeToUnit("iets-onbekends")).toBe("piece");
  });
});

describe("normalizeCalculationType", () => {
  it("laat geldige types ongemoeid", () => {
    expect(normalizeCalculationType("per_m2")).toBe("per_m2");
    expect(normalizeCalculationType("manual")).toBe("manual");
  });

  it("valt bij een onbekende/lege waarde veilig terug op manual", () => {
    expect(normalizeCalculationType("")).toBe("manual");
    expect(normalizeCalculationType("iets-onbekends")).toBe("manual");
  });
});

describe("formatCalculationType", () => {
  it("geeft een Nederlands label — óók voor manual (dat statusLabels niet vertaalt)", () => {
    expect(formatCalculationType("manual")).toBe("Handmatig");
    expect(formatCalculationType("fixed")).toBe("Vast bedrag");
    expect(formatCalculationType("per_m2")).toBe("Per m²");
  });

  it("valt voor onbekende waarden terug op Handmatig", () => {
    expect(formatCalculationType("kapot")).toBe("Handmatig");
  });
});

describe("serviceRuleDocToRow", () => {
  it("mapt NL-Doc-velden naar de gedeelde ServiceRuleRow-vorm", () => {
    const row = serviceRuleDocToRow(
      doc({
        _id: "r1",
        naam: "Dichte trap tapijt",
        omschrijving: "incl. materiaal",
        sku: "HW-DIENST-014",
        category: "Werkzaamheden",
        subcategory: "Traprenovatie (arbeid)",
        prijsEenheid: "piece",
        priceUnit: "piece",
        productGroup: "stairs",
        serviceMetadata: {
          family: "stair_renovation",
          covering: "pvc",
          shape: "half_turn",
          role: "base_labor",
          sectionKey: "traprenovatie"
        },
        serviceFamily: "stair_renovation",
        covering: "pvc",
        stairShape: "half_turn",
        serviceRole: "base_labor",
        sectionKey: "traprenovatie",
        berekeningType: "fixed",
        prijsExBtw: 400,
        btwTarief: 21,
        status: "active"
      })
    );

    expect(row).toEqual({
      id: "r1",
      productId: "r1",
      name: "Dichte trap tapijt",
      description: "incl. materiaal",
      sku: "HW-DIENST-014",
      category: "Werkzaamheden",
      subcategory: "Traprenovatie (arbeid)",
      priceUnit: "piece",
      productGroup: "stairs",
      serviceMetadata: {
        family: "stair_renovation",
        covering: "pvc",
        shape: "half_turn",
        role: "base_labor",
        sectionKey: "traprenovatie"
      },
      serviceFamily: "stair_renovation",
      covering: "pvc",
      stairShape: "half_turn",
      serviceRole: "base_labor",
      sectionKey: "traprenovatie",
      calculationType: "fixed",
      priceExVat: 400,
      vatRate: 21,
      status: "active"
    });
  });

  it("houdt inactive inactive en normaliseert een onbekende status naar active", () => {
    expect(serviceRuleDocToRow(doc({ naam: "A", status: "inactive" })).status).toBe("inactive");
    expect(serviceRuleDocToRow(doc({ naam: "B", status: "weird" })).status).toBe("active");
  });
});

describe("toActiveServiceRuleRows", () => {
  it("filtert gearchiveerde regels weg en sorteert op naam (nl)", () => {
    const rows = toActiveServiceRuleRows([
      doc({ naam: "Zagen", status: "active" }),
      doc({ naam: "Afmontage", status: "inactive" }),
      doc({ naam: "Egaliseren", status: "active" })
    ]);

    expect(rows.map((rule) => rule.name)).toEqual(["Egaliseren", "Zagen"]);
  });
});
describe("geleide trapdiensten in generieke kiezers", () => {
  it("herkent stair_renovation via platte én geneste metadata", () => {
    expect(isGuidedStairServiceRule({ serviceFamily: "stair_renovation" })).toBe(true);
    expect(isGuidedStairServiceRule({ serviceMetadata: { family: "stair_renovation" } })).toBe(
      true
    );
    expect(isStandaloneServiceRule({ serviceFamily: "flooring" })).toBe(true);
  });

  it("houdt traprenovatie uit een generieke dienstselectie maar laat losse diensten staan", () => {
    const rows = toActiveServiceRuleRows([
      doc({
        naam: "PVC trap halve draai",
        serviceFamily: "stair_renovation",
        productGroup: "stairs"
      }),
      doc({ naam: "Egaliseren", serviceFamily: "floor_preparation", productGroup: "flooring" })
    ]);

    expect(excludeGuidedStairServiceRules(rows).map((rule) => rule.name)).toEqual(["Egaliseren"]);
    expect(rows).toHaveLength(2);
  });
});

describe("filterServiceRules", () => {
  const rows = toActiveServiceRuleRows([
    doc({ naam: "Tapijt leggen", omschrijving: "per m²", berekeningType: "per_m2" }),
    doc({ naam: "Plinten monteren", omschrijving: "strekkende meter", berekeningType: "per_meter" })
  ]);

  it("geeft alles terug bij een lege zoekterm", () => {
    expect(filterServiceRules(rows, "  ")).toHaveLength(2);
  });

  it("zoekt case-insensitief in naam én omschrijving", () => {
    expect(filterServiceRules(rows, "TAPIJT").map((rule) => rule.name)).toEqual(["Tapijt leggen"]);
    expect(filterServiceRules(rows, "strekkende").map((rule) => rule.name)).toEqual([
      "Plinten monteren"
    ]);
  });
});
