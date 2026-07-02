import { describe, it, expect } from "vitest";
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
    logoUrl: "/images/logo-henke-wonen.png",
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
            "PVC vloer geleverd en gelegd inclusief egaliseren, snijverlies and aansluiting op bestaande plinten in woonkamer, keuken en hal.",
          unitPriceExVat: 38.75,
          vatRate: 21,
          lineTotalIncVat: 1992.72,
          isText: false
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
          lineTotalIncVat: 393.25,
          isText: false
        },
        {
          quantity: 6.5,
          unit: "m1",
          description: "Plinten leveren en monteren langs lange wand met nette verstekafwerking.",
          unitPriceExVat: 12.5,
          vatRate: 21,
          lineTotalIncVat: 98.31,
          isText: false
        },
        {
          quantity: 0,
          unit: "",
          description: "Levering in overleg, circa week 32.",
          unitPriceExVat: 0,
          vatRate: 0,
          lineTotalIncVat: 0,
          isText: true
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
          isText: false,
          requiresManualReview: true
        }
      ]
    }
  ],
  totals: {
    subtotalExVat: 2053.13,
    vatTotal: 431.16,
    totalIncVat: 2484.29,
    vatLabel: "Btw wordt berekend op basis van de offerteregels.",
    vatBreakdown: [{ rate: 21, base: 2053.13, amount: 431.16 }]
  },
  terms: [
    "Ruimtes leeg en bezemschoon opleveren.",
    "Water en stroom beschikbaar tijdens uitvoering.",
    "Planning in overleg na akkoord op de offerte."
  ],
  paymentTerms: ["50% bij akkoord.", "50% bij oplevering.", "Betalingstermijn 8 dagen."]
};

describe("Quote Document Preview", () => {
  const html = renderToStaticMarkup(React.createElement(QuoteDocumentPreview, { model }));
  const globalCss = fs.readFileSync(path.join(process.cwd(), "src/styles/global.css"), "utf8");
  const printCss = fs.readFileSync(path.join(process.cwd(), "src/styles/layers/18-print.css"), "utf8");
  const combinedCss = globalCss + "\n" + printCss;

  it("should render the preview HTML document correctly", () => {
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('class="quote-document-preview"');
    expect(html).toContain('class="quote-document-sheet"');
    expect(html).toContain('class="quote-document-front-page"');
    expect(html).toContain('class="quote-document-back-matter"');
    expect(html).toContain('data-print-title="OFF-2026-014 - Familie Jansen"');
    expect(html).toContain('class="quote-document-logo"');
    expect(html).toContain('src="/images/logo-henke-wonen.png"');
    expect(html).toContain('class="quote-document-actions no-print"');
    expect(html).toContain('class="quote-document-cover print-page-break-avoid no-print"');
    expect(html).toContain('class="quote-document-review-warning no-print"');
    expect(html).toContain('class="quote-document-totals print-keep-together"');
    expect(html).toContain("Klantversie");
    expect(html).toContain("Concept");
    expect(html).toContain("Klantversie printen");
    expect(html).toContain("Alleen bekijken");
    expect(html).not.toContain("draft");
    expect(html).toContain("Btw wordt berekend op basis van de offerteregels.");
    expect(html).not.toContain("Prijzen zijn inclusief 21% btw.");
    expect(html).toContain("Controleer product, prijs en btw.");
    expect(html).toContain("Project familie Jansen - benedenverdieping en raambekleding");
    expect(html).toContain("OFF-2026-014");
    expect(html).toContain("Vloeren");
    expect(html).toContain("Montage en afwerking");
    expect(html).toContain("Raambekleding");
    expect(html).toContain("PVC vloer geleverd en gelegd inclusief egaliseren");
    expect(html).toContain("Product, prijs en btw moeten nog handmatig worden gecontroleerd.");
    expect(html).toContain("Ruimtes leeg en bezemschoon opleveren.");
    expect(html).toContain("50% bij akkoord.");
  });

  it("rendert een tekstregel zonder bedragen (zelfde opmaak als de factuur)", () => {
    expect(html).toContain("Levering in overleg, circa week 32.");
    // De tekstregel gebruikt de colspan-rij i.p.v. de bedragen-kolommen.
    expect(html).toContain('colSpan="4"');
  });

  it("toont de btw-uitsplitsing per tarief en het akkoordvak", () => {
    expect(html).toContain("Btw 21% over");
    expect(html).toContain("Voor akkoord");
    expect(html).toContain("Handtekening");
    expect(combinedCss).toContain(".quote-document-agreement");
  });

  it("should verify CSS classes and rules are defined", () => {
    expect(combinedCss).toContain(".quote-document-sheet");
    expect(combinedCss).toContain("min-height: 297mm");
    expect(combinedCss).toContain(".quote-print-root");
    expect(combinedCss).toContain(".quote-document-logo");
    expect(combinedCss).toContain("width: 48mm;");
    expect(combinedCss).toContain(".quote-document-front-page");
    expect(combinedCss).toContain("min-height: calc(297mm - 27mm);");
    expect(combinedCss).toContain("margin: auto 0 0 auto;");
    expect(combinedCss).toContain(".quote-document-back-matter");
    expect(combinedCss).toContain("body.quote-print-active > :not(.quote-print-root)");
    expect(combinedCss).toContain("body.quote-print-active .quote-print-root");
    expect(combinedCss).toContain("position: static;");
    expect(combinedCss).toContain(".quote-document-section h3");
    expect(combinedCss).toContain(".quote-document-line-needs-review td");
    expect(combinedCss).toContain("background: #fff !important;");
    expect(combinedCss).toContain("break-after: avoid;");
    expect(combinedCss).toContain("break-before: avoid;");
    expect(combinedCss).not.toContain("body * {\n    visibility: hidden");
    expect(combinedCss).not.toContain("body:has(.quote-document-preview)");
  });

  it("should format quote attributes correctly", () => {
    const formattedCurrency = formatCurrencyEUR(1234.5);
    expect(formattedCurrency).toContain("€");
    expect(formattedCurrency).toContain("1.234,50");
    expect(formatQuantity(12.3456)).toBe("12,346");
    expect(formatVatRate(9.5)).toBe("9,5%");
    expect(formatDateNL(new Date(Date.UTC(2026, 4, 1)))).toBe("01-05-2026");
    expect(formatDateNL("01-05-2026")).toBe("01-05-2026");
  });
});
