import type {
  PortalCustomer,
  PortalProject,
  PortalQuote,
  PortalQuoteLine,
  QuoteTemplate,
  QuoteTemplateSection
} from "../portalTypes";
import { buildCostBreakdown, type CostBreakdownRow } from "../documents/costBreakdown";
import { buildVatBreakdown, type VatBreakdownRow } from "../documents/vatBreakdown";
import { henkeCompanyProfile, type QuoteCompanyProfile } from "./henkeCompanyProfile";

export type QuoteDocumentModel = {
  company: {
    name: string;
    logoUrl?: string;
    addressLines: string[];
    contactLine: string;
    legalLine: string;
    signatoryName: string;
  };
  customer: {
    name: string;
    addressLines: string[];
    email?: string;
    telefoon?: string;
    salutation: string;
  };
  quote: {
    quoteNumber: string;
    quoteDate: string;
    validUntil?: string;
    subject: string;
    introText?: string;
    closingText?: string;
    status: string;
  };
  sections: Array<{
    key?: string;
    title?: string;
    lines: Array<{
      quantity: number;
      unit: string;
      description: string;
      unitPriceExVat: number;
      vatRate: number;
      lineTotalIncVat: number;
      /** Tekstregel (regelType "text"): alleen de omschrijving tonen, geen bedragen. */
      isText: boolean;
      requiresManualReview?: boolean;
    }>;
  }>;
  totals: {
    subtotalExVat: number;
    vatTotal: number;
    totalIncVat: number;
    vatLabel: string;
    /** Btw uitgesplitst per tarief (grondslag + btw-bedrag), zoals op een nette NL-factuur. */
    vatBreakdown: VatBreakdownRow[];
    /** Informatieve materiaal/arbeid-splitsing van het subtotaal (excl. btw). */
    costBreakdown: CostBreakdownRow[];
  };
  terms: string[];
  paymentTerms: string[];
};

// Gedeeld met het factuurdocument: zie src/lib/documents/vatBreakdown.ts.

export type BuildQuoteDocumentModelInput = {
  quote: PortalQuote;
  customer: PortalCustomer;
  project?: Pick<PortalProject, "titel" | "omschrijving">;
  template?: Pick<QuoteTemplate, "secties">;
  companyProfile?: QuoteCompanyProfile;
  salutation?: string;
  timeZone?: string;
};

const FALLBACK_SECTION_KEY = "overige";
const FALLBACK_SECTION_TITLE = "Overige offerteregels";
const VAT_LABEL = "Btw wordt berekend op basis van de offerteregels.";

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function metadataString(line: PortalQuoteLine, key: string): string | undefined {
  const value = line.metadata?.[key];
  return isText(value) ? value.trim() : undefined;
}

function metadataBoolean(line: PortalQuoteLine, key: string): boolean {
  return line.metadata?.[key] === true;
}

function normalizeLines(lines?: string[]): string[] {
  return (lines ?? [])
    .flatMap((line) => line.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatAddressLine(...parts: Array<string | undefined>): string | undefined {
  const line = parts.map((part) => part?.trim()).filter(Boolean).join(" ");
  return line || undefined;
}

function formatCustomerAddress(customer: PortalCustomer): string[] {
  return [
    formatAddressLine(customer.straat, customer.huisnummer),
    formatAddressLine(customer.postcode, customer.plaats)
  ].filter(isText);
}

function formatDate(timestamp: number | undefined, timeZone: string): string {
  if (timestamp === undefined) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone
  }).formatToParts(new Date(timestamp));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${byType.day}-${byType.month}-${byType.year}`;
}

/**
 * Interne werkregels die bij het importeren van inmeetregels in de omschrijving
 * terechtkomen (zie convex/portalUtils.ts, importedMeasurementLineDescription).
 * Die instructies zijn voor de winkel — niet voor de klant — en maakten de
 * productteksten op de klantversie onnodig lang.
 */
const INTERNE_OMSCHRIJVING_PREFIXEN = [
  "Overgenomen uit inmeting",
  "Richtprijs",
  "Matrix-richtprijs",
  "Snijverlies:",
  "Meetnotitie:"
];

const MATRIX_CONTEXT_PREFIX = "Raambekleding (matrix):";
const MATRIX_AFMETING_PATROON = /(\d+(?:[.,]\d+)?\s*×\s*\d+(?:[.,]\d+)?\s*cm)/;

/**
 * Filtert de omschrijving tot wat de klant hoort te zien: interne
 * werkinstructies vallen weg; van de matrix-contextregel blijft alleen de
 * (klantrelevante) afmeting over.
 */
function klantOmschrijvingRegels(omschrijving: string | undefined): string[] {
  if (!isText(omschrijving)) {
    return [];
  }
  const regels: string[] = [];
  for (const ruweRegel of omschrijving.split(/\r?\n/)) {
    const regel = ruweRegel.trim();
    if (regel.length === 0) {
      continue;
    }
    if (regel.startsWith(MATRIX_CONTEXT_PREFIX)) {
      const afmeting = regel.match(MATRIX_AFMETING_PATROON);
      if (afmeting) {
        regels.push(`Afmeting: ${afmeting[1]}.`);
      }
      continue;
    }
    if (INTERNE_OMSCHRIJVING_PREFIXEN.some((prefix) => regel.startsWith(prefix))) {
      continue;
    }
    regels.push(regel);
  }
  return regels;
}

function quoteLineDescription(line: PortalQuoteLine): string {
  return [line.titel, ...klantOmschrijvingRegels(line.omschrijving)].filter(isText).join("\n");
}

function requiresManualReview(line: PortalQuoteLine): boolean {
  return (
    line.eenheidsprijsExBtw === 0 ||
    metadataString(line, "source") === "measurement" ||
    metadataString(line, "measurementLineId") !== undefined ||
    metadataBoolean(line, "requiresManualProductReview") ||
    metadataBoolean(line, "requiresManualPriceReview") ||
    metadataBoolean(line, "requiresManualVatReview")
  );
}

function buildVatLabel(): string {
  return VAT_LABEL;
}

function sectionMap(template?: Pick<QuoteTemplate, "secties">): Map<string, QuoteTemplateSection> {
  return new Map((template?.secties ?? []).map((section) => [section.sleutel, section]));
}

function sortLines(lines: PortalQuoteLine[]): PortalQuoteLine[] {
  return lines.slice().sort((left, right) => left.sortOrder - right.sortOrder);
}

function groupQuoteLines(
  lines: PortalQuoteLine[],
  template?: Pick<QuoteTemplate, "secties">
): QuoteDocumentModel["sections"] {
  const sectionsByKey = sectionMap(template);
  const grouped = new Map<string, PortalQuoteLine[]>();

  for (const line of sortLines(lines)) {
    const sectionKey = metadataString(line, "sectionKey") ?? FALLBACK_SECTION_KEY;
    grouped.set(sectionKey, [...(grouped.get(sectionKey) ?? []), line]);
  }

  return Array.from(grouped.entries())
    .sort(([leftKey], [rightKey]) => {
      const leftSection = sectionsByKey.get(leftKey);
      const rightSection = sectionsByKey.get(rightKey);

      if (leftSection && rightSection) {
        return leftSection.sortOrder - rightSection.sortOrder;
      }

      if (leftSection) {
        return -1;
      }

      if (rightSection) {
        return 1;
      }

      return 0;
    })
    .map(([key, sectionLines]) => {
      const templateSection = sectionsByKey.get(key);

      return {
        key,
        title: templateSection?.titel ?? (key === FALLBACK_SECTION_KEY ? FALLBACK_SECTION_TITLE : undefined),
        lines: sectionLines.map((line) => {
          const manualReview = requiresManualReview(line);

          return {
            quantity: line.aantal,
            unit: line.eenheid,
            description: quoteLineDescription(line),
            unitPriceExVat: line.eenheidsprijsExBtw,
            vatRate: line.btwTarief,
            lineTotalIncVat: line.regelTotaalInclBtw,
            isText: line.regelType === "text",
            ...(manualReview ? { requiresManualReview: true } : {})
          };
        })
      };
    });
}

export function buildQuoteDocumentModel({
  quote,
  customer,
  project,
  template,
  companyProfile = henkeCompanyProfile,
  salutation,
  timeZone = "Europe/Amsterdam"
}: BuildQuoteDocumentModelInput): QuoteDocumentModel {
  return {
    company: {
      name: companyProfile.name,
      logoUrl: companyProfile.logoUrl,
      addressLines: [...companyProfile.addressLines],
      contactLine: companyProfile.contactLine,
      legalLine: companyProfile.legalLine,
      signatoryName: companyProfile.signatoryName
    },
    customer: {
      name: customer.weergaveNaam,
      addressLines: formatCustomerAddress(customer),
      email: customer.email,
      telefoon: customer.telefoon,
      salutation: salutation?.trim() || `Beste ${customer.weergaveNaam}`
    },
    quote: {
      quoteNumber: quote.offertenummer,
      quoteDate: formatDate(quote.aangemaaktOp, timeZone),
      validUntil: quote.geldigTot ? formatDate(quote.geldigTot, timeZone) : undefined,
      subject: quote.titel || project?.titel || "",
      introText: quote.inleidingTekst,
      closingText: quote.afsluitTekst,
      status: quote.status
    },
    sections: groupQuoteLines(quote.lines, template),
    totals: {
      subtotalExVat: quote.subtotaalExBtw,
      vatTotal: quote.btwTotaal,
      totalIncVat: quote.totaalInclBtw,
      vatLabel: buildVatLabel(),
      vatBreakdown: buildVatBreakdown(quote.lines),
      costBreakdown: buildCostBreakdown(quote.lines)
    },
    terms: normalizeLines(quote.voorwaarden),
    paymentTerms: normalizeLines(quote.betalingsvoorwaarden)
  };
}
