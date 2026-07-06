import { describe, expect, it } from "vitest";
import {
  calculationTypeToUnit,
  filterServiceRules,
  serviceRuleDocToRow,
  toActiveServiceRuleRows,
  type ServiceRuleDoc
} from "../src/components/catalog/serviceRuleCatalog";

function doc(overrides: Partial<ServiceRuleDoc> & { naam: string }): ServiceRuleDoc {
  return {
    _id: overrides._id ?? `id-${overrides.naam}`,
    naam: overrides.naam,
    omschrijving: overrides.omschrijving,
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

describe("serviceRuleDocToRow", () => {
  it("mapt NL-Doc-velden naar de gedeelde ServiceRuleRow-vorm", () => {
    const row = serviceRuleDocToRow(
      doc({
        _id: "r1",
        naam: "Dichte trap tapijt",
        omschrijving: "incl. materiaal",
        berekeningType: "fixed",
        prijsExBtw: 400,
        btwTarief: 21,
        status: "active"
      })
    );

    expect(row).toEqual({
      id: "r1",
      name: "Dichte trap tapijt",
      description: "incl. materiaal",
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
