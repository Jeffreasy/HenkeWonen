import { describe, it, expect } from "vitest";
import type { PortalCustomer, PortalQuote, PortalQuoteLine, QuoteTemplate } from "../src/lib/portalTypes";
import { buildQuoteDocumentModel } from "../src/lib/quotes/quoteDocumentModel";

const baseCustomer: PortalCustomer = {
  id: "customer-1",
  tenantId: "henke-wonen",
  type: "private",
  displayName: "Familie Jansen",
  street: "Voorbeeldstraat",
  houseNumber: "12",
  postalCode: "8255 AA",
  city: "Swifterbant",
  status: "active",
  createdAt: Date.UTC(2026, 4, 1),
  updatedAt: Date.UTC(2026, 4, 1)
};

const template: Pick<QuoteTemplate, "sections"> = {
  sections: [
    {
      key: "vloeren",
      title: "Vloeren",
      sortOrder: 1
    },
    {
      key: "behang",
      title: "Behang",
      sortOrder: 2
    }
  ]
};

function line(overrides: Partial<PortalQuoteLine>): PortalQuoteLine {
  return {
    id: "line-1",
    quoteId: "quote-1",
    lineType: "product",
    title: "PVC geleverd",
    quantity: 2,
    unit: "m2",
    unitPriceExVat: 100,
    vatRate: 21,
    lineTotalExVat: 200,
    lineVatTotal: 42,
    lineTotalIncVat: 242,
    sortOrder: 1,
    ...overrides
  };
}

function quote(overrides: Partial<PortalQuote>): PortalQuote {
  return {
    id: "quote-1",
    tenantId: "henke-wonen",
    projectId: "project-1",
    customerId: "customer-1",
    quoteNumber: "OFF-2026-001",
    title: "PVC benedenverdieping",
    status: "draft",
    introText: "Hierbij mijn vrijblijvende offerte.",
    closingText: "Hopende u een passende aanbieding te hebben gedaan.",
    terms: ["Ruimtes leeg opleveren.\nWater en stroom beschikbaar."],
    paymentTerms: ["100% bij oplevering.", "Betalingstermijn 8 dagen."],
    subtotalExVat: 1234.56,
    vatTotal: 259.26,
    totalIncVat: 1493.82,
    lines: [line({ metadata: { source: "quoteTemplate", sectionKey: "vloeren" } })],
    createdAt: Date.UTC(2026, 4, 1),
    updatedAt: Date.UTC(2026, 4, 1),
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
      vatLabel: "Btw wordt berekend op basis van de offerteregels."
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
          line({ id: "line-1", vatRate: 9, lineVatTotal: 18, lineTotalIncVat: 218, sortOrder: 1 }),
          line({ id: "line-2", vatRate: 21, lineVatTotal: 42, lineTotalIncVat: 242, sortOrder: 2 })
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
          line({ id: "line-2", title: "Tweede regel", sortOrder: 2, metadata: undefined }),
          line({ id: "line-1", title: "Eerste regel", sortOrder: 1, metadata: undefined })
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
            unitPriceExVat: 0,
            vatRate: 0,
            lineTotalExVat: 0,
            lineVatTotal: 0,
            lineTotalIncVat: 0,
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
});
