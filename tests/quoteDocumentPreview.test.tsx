import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QuoteDocumentPreview from "../src/components/quotes/QuoteDocumentPreview";
import {
  formatCurrencyEUR,
  formatDateNL,
  formatQuantity,
  formatVatRate
} from "../src/lib/quotes/quoteDocumentFormatting";
import type { QuoteDocumentModel } from "../src/lib/quotes/quoteDocumentModel";

const model: QuoteDocumentModel = {
  company: {
    name: "Henke Wonen",
    addressLines: ["Zuidsingel 44", "8255 CH Swifterbant"],
    contactLine: "Telefoon: 06 23163067 / Email: henkewonen@hotmail.com",
    legalLine: "Rabobank: NL54RABO0166385220 / BTW nr: NL001593768B36",
    signatoryName: "W. Henke."
  },
  customer: {
    name: "Familie Jansen",
    addressLines: ["Voorbeeldstraat 12", "8255 AA Swifterbant"],
    salutation: "Geachte familie Jansen,"
  },
  quote: {
    quoteNumber: "OFF-2026-014",
    quoteDate: "01-05-2026",
    validUntil: "31-05-2026",
    subject: "Project familie Jansen - benedenverdieping en raambekleding",
    introText:
      "Hierbij ontvangt u onze offerte voor het leveren en uitvoeren van de besproken werkzaamheden.",
    closingText: "Wij vertrouwen erop u hiermee een passende aanbieding te doen.",
    status: "draft"
  },
  sections: [
    {
      key: "vloeren",
      title: "Vloeren",
      lines: [
        {
          quantity: 42.5,
          unit: "m2",
          description:
            "PVC vloer geleverd en gelegd inclusief egaliseren, snijverlies en aansluiting op bestaande plinten in woonkamer, keuken en hal.",
          unitPriceExVat: 38.75,
          vatRate: 21,
          lineTotalIncVat: 1992.72
        }
      ]
    },
    {
      key: "montage",
      title: "Montage en afwerking",
      lines: [
        {
          quantity: 1,
          unit: "post",
          description:
            "Voorbereidende werkzaamheden, transport, afvoer van schoon restmateriaal en afwerking rond dorpels.",
          unitPriceExVat: 325,
          vatRate: 21,
          lineTotalIncVat: 393.25
        },
        {
          quantity: 6.5,
          unit: "m1",
          description: "Plinten leveren en monteren langs lange wand met nette verstekafwerking.",
          unitPriceExVat: 12.5,
          vatRate: 21,
          lineTotalIncVat: 98.31
        }
      ]
    },
    {
      key: "raambekleding",
      title: "Raambekleding",
      lines: [
        {
          quantity: 1,
          unit: "post",
          description:
            "Inmeetregel voor raambekleding vanuit projectopname. Product, prijs en btw moeten nog handmatig worden gecontroleerd.",
          unitPriceExVat: 0,
          vatRate: 21,
          lineTotalIncVat: 0,
          requiresManualReview: true
        }
      ]
    }
  ],
  totals: {
    subtotalExVat: 2053.13,
    vatTotal: 431.16,
    totalIncVat: 2484.29,
    vatLabel: "Btw wordt berekend op basis van de offerteregels."
  },
  terms: [
    "Ruimtes leeg en bezemschoon opleveren.",
    "Water en stroom beschikbaar tijdens uitvoering.",
    "Planning in overleg na akkoord op de offerte."
  ],
  paymentTerms: ["50% bij akkoord.", "50% bij oplevering.", "Betalingstermijn 8 dagen."]
};

const html = renderToStaticMarkup(React.createElement(QuoteDocumentPreview, { model }));
const globalCss = fs.readFileSync(path.join(process.cwd(), "src/styles/global.css"), "utf8");

assert.ok(html.length > 0);
assert.ok(html.includes('class="quote-document-preview"'));
assert.ok(html.includes('class="quote-document-actions no-print"'));
assert.ok(html.includes('class="quote-document-totals print-keep-together"'));
assert.ok(html.includes("Concept preview"));
assert.ok(html.includes("Concept printen"));
assert.ok(html.includes("draft"));
assert.ok(html.includes("Btw wordt berekend op basis van de offerteregels."));
assert.ok(!html.includes("Prijzen zijn inclusief 21% btw."));
assert.ok(html.includes("Controleer product, prijs en btw."));
assert.ok(html.includes("Project familie Jansen - benedenverdieping en raambekleding"));
assert.ok(html.includes("OFF-2026-014"));
assert.ok(html.includes("Vloeren"));
assert.ok(html.includes("Montage en afwerking"));
assert.ok(html.includes("Raambekleding"));
assert.ok(html.includes("PVC vloer geleverd en gelegd inclusief egaliseren"));
assert.ok(html.includes("Product, prijs en btw moeten nog handmatig worden gecontroleerd."));
assert.ok(html.includes("Ruimtes leeg en bezemschoon opleveren."));
assert.ok(html.includes("50% bij akkoord."));

assert.ok(globalCss.includes(".quote-print-root"));
assert.ok(globalCss.includes("body.quote-print-active > :not(.quote-print-root)"));
assert.ok(globalCss.includes("body.quote-print-active .quote-print-root"));
assert.ok(globalCss.includes("position: static;"));
assert.ok(globalCss.includes(".quote-document-section h3"));
assert.ok(globalCss.includes("break-after: avoid;"));
assert.ok(globalCss.includes("break-before: avoid;"));
assert.ok(!globalCss.includes("body * {\n    visibility: hidden"));
assert.ok(!globalCss.includes("body:has(.quote-document-preview)"));

const formattedCurrency = formatCurrencyEUR(1234.5);
assert.ok(formattedCurrency.includes("€"));
assert.ok(formattedCurrency.includes("1.234,50"));
assert.equal(formatQuantity(12.3456), "12,346");
assert.equal(formatVatRate(9.5), "9,5%");
assert.equal(formatDateNL(new Date(Date.UTC(2026, 4, 1))), "01-05-2026");
assert.equal(formatDateNL("01-05-2026"), "01-05-2026");

console.log("Quote document preview tests passed.");
