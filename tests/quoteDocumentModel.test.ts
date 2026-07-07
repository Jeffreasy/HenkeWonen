import { describe, it, expect } from "vitest";
import type { PortalCustomer, PortalQuote, PortalQuoteLine, QuoteTemplate } from "../src/lib/portalTypes";
import { buildQuoteDocumentModel } from "../src/lib/quotes/quoteDocumentModel";

const baseCustomer: PortalCustomer = {
  id: "customer-1",
  tenantId: "henke-wonen",
  type: "private",
  weergaveNaam: "Familie Jansen",
  straat: "Voorbeeldstraat",
  huisnummer: "12",
  postcode: "8255 AA",
  plaats: "Swifterbant",
  status: "active",
  aangemaaktOp: Date.UTC(2026, 4, 1),
  gewijzigdOp: Date.UTC(2026, 4, 1)
};

const template: Pick<QuoteTemplate, "secties"> = {
  secties: [
    {
      sleutel: "vloeren",
      titel: "Vloeren",
      sortOrder: 1
    },
    {
      sleutel: "behang",
      titel: "Behang",
      sortOrder: 2
    }
  ]
};

function line(overrides: Partial<PortalQuoteLine>): PortalQuoteLine {
  return {
    id: "line-1",
    quoteId: "quote-1",
    regelType: "product",
    titel: "PVC geleverd",
    aantal: 2,
    eenheid: "m2",
    eenheidsprijsExBtw: 100,
    btwTarief: 21,
    regelTotaalExBtw: 200,
    regelBtwTotaal: 42,
    regelTotaalInclBtw: 242,
    sortOrder: 1,
    ...overrides
  };
}

function quote(overrides: Partial<PortalQuote>): PortalQuote {
  return {
    id: "quote-1",
    tenantId: "henke-wonen",
    projectId: "project-1",
    klantId: "customer-1",
    offertenummer: "OFF-2026-001",
    titel: "PVC benedenverdieping",
    status: "draft",
    inleidingTekst: "Hierbij mijn vrijblijvende offerte.",
    afsluitTekst: "Hopende u een passende aanbieding te hebben gedaan.",
    voorwaarden: ["Ruimtes leeg opleveren.\nWater en stroom beschikbaar."],
    betalingsvoorwaarden: ["100% bij oplevering.", "Betalingstermijn 8 dagen."],
    subtotaalExBtw: 1234.56,
    btwTotaal: 259.26,
    totaalInclBtw: 1493.82,
    lines: [line({ metadata: { source: "quoteTemplate", sectionKey: "vloeren" } })],
    aangemaaktOp: Date.UTC(2026, 4, 1),
    gewijzigdOp: Date.UTC(2026, 4, 1),
    ...overrides
  };
}

describe("Quote Document Model", () => {
  it("should correctly calculate totals and section lines", () => {
    const model = buildQuoteDocumentModel({
      quote: quote({}),
      customer: baseCustomer,
      template,
      salutation: "Beste familie Jansen"
    });

    expect(model.totals).toEqual({
      subtotalExVat: 1234.56,
      vatTotal: 259.26,
      totalIncVat: 1493.82,
      vatLabel: "Btw wordt berekend op basis van de offerteregels.",
      vatBreakdown: [{ rate: 21, base: 200, amount: 42 }],
      costBreakdown: [{ category: "materiaal", label: "Materiaal", amount: 200 }]
    });
    expect(model.sections[0].key).toBe("vloeren");
    expect(model.sections[0].title).toBe("Vloeren");
    expect(model.sections[0].lines[0].unitPriceExVat).toBe(100);
    expect(model.sections[0].lines[0].vatRate).toBe(21);
    expect(model.terms).toEqual(["Ruimtes leeg opleveren.", "Water en stroom beschikbaar."]);
    expect(model.paymentTerms).toEqual(["100% bij oplevering.", "Betalingstermijn 8 dagen."]);
    expect(model.customer.addressLines).toEqual(["Voorbeeldstraat 12", "8255 AA Swifterbant"]);
    expect(model.customer.salutation).toBe("Beste familie Jansen");
    expect(model.company.logoUrl).toBe("/images/logo-henke-wonen.png");
  });

  it("should formulate the correct vat label for mixed vat rates", () => {
    const mixedVatModel = buildQuoteDocumentModel({
      quote: quote({
        lines: [
          line({ id: "line-1", btwTarief: 9, regelBtwTotaal: 18, regelTotaalInclBtw: 218, sortOrder: 1 }),
          line({ id: "line-2", btwTarief: 21, regelBtwTotaal: 42, regelTotaalInclBtw: 242, sortOrder: 2 })
        ]
      }),
      customer: baseCustomer
    });

    expect(mixedVatModel.totals.vatLabel).toBe("Btw wordt berekend op basis van de offerteregels.");
    expect(mixedVatModel.totals.vatLabel).not.toContain("21% btw");
  });

  it("should categorize lines into default 'overige' section when sectionKey is missing", () => {
    const fallbackModel = buildQuoteDocumentModel({
      quote: quote({
        lines: [
          line({ id: "line-2", titel: "Tweede regel", sortOrder: 2, metadata: undefined }),
          line({ id: "line-1", titel: "Eerste regel", sortOrder: 1, metadata: undefined })
        ]
      }),
      customer: baseCustomer,
      template
    });

    expect(fallbackModel.sections.length).toBe(1);
    expect(fallbackModel.sections[0].key).toBe("overige");
    expect(fallbackModel.sections[0].title).toBe("Overige offerteregels");
    expect(fallbackModel.sections[0].lines[0].description).toBe("Eerste regel");
    expect(fallbackModel.sections[0].lines[1].description).toBe("Tweede regel");
  });

  it("should identify measurement lines requiring manual review", () => {
    const manualReviewModel = buildQuoteDocumentModel({
      quote: quote({
        lines: [
          line({
            id: "measurement-line",
            eenheidsprijsExBtw: 0,
            btwTarief: 0,
            regelTotaalExBtw: 0,
            regelBtwTotaal: 0,
            regelTotaalInclBtw: 0,
            metadata: {
              source: "measurement",
              measurementLineId: "measurement-line-1"
            }
          })
        ]
      }),
      customer: baseCustomer
    });

    expect(manualReviewModel.sections[0].lines[0].unitPriceExVat).toBe(0);
    expect(manualReviewModel.sections[0].lines[0].vatRate).toBe(0);
    expect(manualReviewModel.sections[0].lines[0].requiresManualReview).toBe(true);
    expect(manualReviewModel.totals.vatLabel).toBe("Btw wordt berekend op basis van de offerteregels.");
  });

  it("filtert interne werkinstructies uit de omschrijving op de klantversie", () => {
    const model = buildQuoteDocumentModel({
      quote: quote({
        lines: [
          line({
            titel: "Basic dark grey - Woonkamer",
            omschrijving: [
              "Overgenomen uit inmeting.",
              "Richtprijs uit de inmeting overgenomen. Controleer product, verkoopprijs en btw bewust voordat je de offerte verstuurt.",
              "Snijverlies: 3%.",
              "Meetnotitie: let op scheve muur bij de erker.",
              "Inclusief egaliseren en plaatsen."
            ].join("\n")
          })
        ]
      }),
      customer: baseCustomer
    });

    const beschrijving = model.sections[0].lines[0].description;
    expect(beschrijving).toBe("Basic dark grey - Woonkamer\nInclusief egaliseren en plaatsen.");
    expect(beschrijving).not.toMatch(/Controleer|Snijverlies|Meetnotitie|Overgenomen/);
  });

  it("houdt van de matrix-contextregel alleen de klantrelevante afmeting over", () => {
    const model = buildQuoteDocumentModel({
      quote: quote({
        lines: [
          line({
            titel: "Raambekleding - Matrix - Woonkamer",
            omschrijving:
              "Overgenomen uit inmeting.\nMatrix-richtprijs uit de inmeting overgenomen. Controleer verkoopprijs en btw bewust voordat je de offerte verstuurt.\nRaambekleding (matrix): PRIJSLIJST-2026 – Groep 3 – 120×180 cm."
          })
        ]
      }),
      customer: baseCustomer
    });

    expect(model.sections[0].lines[0].description).toBe(
      "Raambekleding - Matrix - Woonkamer\nAfmeting: 120×180 cm."
    );
  });

  it("splitst de btw per tarief uit over de offerteregels", () => {
    const model = buildQuoteDocumentModel({
      quote: quote({
        lines: [
          line({ id: "l1", btwTarief: 9, regelTotaalExBtw: 200, regelBtwTotaal: 18, sortOrder: 1 }),
          line({ id: "l2", btwTarief: 21, regelTotaalExBtw: 300, regelBtwTotaal: 63, sortOrder: 2 })
        ]
      }),
      customer: baseCustomer
    });

    expect(model.totals.vatBreakdown).toEqual([
      { rate: 9, base: 200, amount: 18 },
      { rate: 21, base: 300, amount: 63 }
    ]);
  });

  it("markeert tekstregels als isText zodat de klantversie geen 0-bedragen toont", () => {
    const model = buildQuoteDocumentModel({
      quote: quote({
        lines: [
          line({ id: "line-1", sortOrder: 1 }),
          line({
            id: "line-2",
            regelType: "text",
            titel: "Levering in overleg, circa week 32.",
            aantal: 0,
            eenheidsprijsExBtw: 0,
            btwTarief: 0,
            regelTotaalExBtw: 0,
            regelBtwTotaal: 0,
            regelTotaalInclBtw: 0,
            sortOrder: 2
          })
        ]
      }),
      customer: baseCustomer
    });

    const [productLine, textLine] = model.sections[0].lines;
    expect(productLine.isText).toBe(false);
    expect(textLine.isText).toBe(true);
    expect(textLine.description).toBe("Levering in overleg, circa week 32.");
  });
});
