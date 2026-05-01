import assert from "node:assert/strict";
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

const model = buildQuoteDocumentModel({
  quote: quote({}),
  customer: baseCustomer,
  template,
  salutation: "Beste familie Jansen"
});

assert.deepEqual(model.totals, {
  subtotalExVat: 1234.56,
  vatTotal: 259.26,
  totalIncVat: 1493.82,
  vatLabel: "Btw wordt berekend op basis van de offerteregels."
});
assert.equal(model.sections[0].key, "vloeren");
assert.equal(model.sections[0].title, "Vloeren");
assert.equal(model.sections[0].lines[0].unitPriceExVat, 100);
assert.equal(model.sections[0].lines[0].vatRate, 21);
assert.deepEqual(model.terms, ["Ruimtes leeg opleveren.", "Water en stroom beschikbaar."]);
assert.deepEqual(model.paymentTerms, ["100% bij oplevering.", "Betalingstermijn 8 dagen."]);
assert.deepEqual(model.customer.addressLines, ["Voorbeeldstraat 12", "8255 AA Swifterbant"]);
assert.equal(model.customer.salutation, "Beste familie Jansen");

const mixedVatModel = buildQuoteDocumentModel({
  quote: quote({
    lines: [
      line({ id: "line-1", vatRate: 9, lineVatTotal: 18, lineTotalIncVat: 218, sortOrder: 1 }),
      line({ id: "line-2", vatRate: 21, lineVatTotal: 42, lineTotalIncVat: 242, sortOrder: 2 })
    ]
  }),
  customer: baseCustomer
});

assert.equal(mixedVatModel.totals.vatLabel, "Btw wordt berekend op basis van de offerteregels.");
assert.ok(!mixedVatModel.totals.vatLabel.includes("21% btw"));

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

assert.equal(fallbackModel.sections.length, 1);
assert.equal(fallbackModel.sections[0].key, "overige");
assert.equal(fallbackModel.sections[0].title, "Overige offerteregels");
assert.equal(fallbackModel.sections[0].lines[0].description, "Eerste regel");
assert.equal(fallbackModel.sections[0].lines[1].description, "Tweede regel");

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

assert.equal(manualReviewModel.sections[0].lines[0].unitPriceExVat, 0);
assert.equal(manualReviewModel.sections[0].lines[0].vatRate, 0);
assert.equal(manualReviewModel.sections[0].lines[0].requiresManualReview, true);
assert.equal(manualReviewModel.totals.vatLabel, "Btw wordt berekend op basis van de offerteregels.");

console.log("Quote document model tests passed.");
