import type { PortalInvoiceDetail } from "../portalTypes";
import { roundMoney } from "../money";
import { henkeCompanyProfile, type QuoteCompanyProfile } from "../quotes/henkeCompanyProfile";
import { buildVatBreakdown, type VatBreakdownRow } from "../documents/vatBreakdown";

export type InvoiceDocumentModel = {
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
  };
  invoice: {
    invoiceNumber: string;
    invoiceDate: number;
    dueDate: number;
    subject: string;
    quoteNumber?: string;
    status: string;
  };
  lines: Array<{
    quantity: number;
    unit: string;
    description: string;
    discountExVat: number;
    unitPriceExVat: number;
    vatRate: number;
    lineTotalIncVat: number;
    isText: boolean;
  }>;
  totals: {
    subtotalExVat: number;
    vatTotal: number;
    totalIncVat: number;
    /** Btw uitgesplitst per tarief (grondslag + btw-bedrag) — verplicht factuurelement. */
    vatBreakdown: VatBreakdownRow[];
  };
  payment: {
    iban?: string;
    dueDate: number;
    totalIncVat: number;
    paidAmount: number;
    outstanding: number;
    reference: string;
  };
};

export type BuildInvoiceDocumentModelInput = {
  detail: PortalInvoiceDetail;
  companyProfile?: QuoteCompanyProfile;
};

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatAddressLine(...parts: Array<string | undefined>): string | undefined {
  const line = parts.map((part) => part?.trim()).filter(Boolean).join(" ");
  return line || undefined;
}

function formatCustomerAddress(customer: PortalInvoiceDetail["customer"]): string[] {
  if (!customer) {
    return [];
  }

  return [
    formatAddressLine(customer.straat, customer.huisnummer),
    formatAddressLine(customer.postcode, customer.plaats),
    customer.land
  ].filter(isText);
}

export function buildInvoiceDocumentModel({
  detail,
  companyProfile = henkeCompanyProfile
}: BuildInvoiceDocumentModelInput): InvoiceDocumentModel {
  const { invoice, customer, project, quote, quoteLines } = detail;
  const outstanding = Math.max(0, roundMoney(invoice.totaalInclBtw - invoice.betaaldBedrag));

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
      name: customer?.weergaveNaam ?? "Onbekende klant",
      addressLines: formatCustomerAddress(customer)
    },
    invoice: {
      invoiceNumber: invoice.factuurnummer,
      invoiceDate: invoice.factuurdatum,
      dueDate: invoice.vervaldatum,
      subject: quote?.titel || project?.titel || "Factuur",
      quoteNumber: quote?.offertenummer,
      status: invoice.status
    },
    lines: quoteLines
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((line) => ({
        quantity: line.aantal,
        unit: line.eenheid,
        description: line.titel,
        discountExVat: line.kortingExBtw ?? 0,
        unitPriceExVat: line.eenheidsprijsExBtw,
        vatRate: line.btwTarief,
        lineTotalIncVat: line.regelTotaalInclBtw,
        isText: line.regelType === "text"
      })),
    totals: {
      subtotalExVat: invoice.subtotaalExBtw,
      vatTotal: invoice.btwTotaal,
      totalIncVat: invoice.totaalInclBtw,
      vatBreakdown: buildVatBreakdown(quoteLines)
    },
    payment: {
      iban: companyProfile.iban,
      dueDate: invoice.vervaldatum,
      totalIncVat: invoice.totaalInclBtw,
      paidAmount: invoice.betaaldBedrag,
      outstanding,
      reference: invoice.factuurnummer
    }
  };
}
