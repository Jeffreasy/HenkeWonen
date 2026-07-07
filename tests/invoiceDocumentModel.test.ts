import { describe, expect, it } from "vitest";
import { buildInvoiceDocumentModel } from "../src/lib/invoices/invoiceDocumentModel";
import type { PortalInvoiceDetail } from "../src/lib/portalTypes";

function makeDetail(overrides: Partial<PortalInvoiceDetail> = {}): PortalInvoiceDetail {
  return {
    invoice: {
      id: "inv1",
      tenantId: "t1",
      projectId: "p1",
      klantId: "c1",
      quoteId: "q1",
      factuurnummer: "2026-0042",
      status: "sent",
      factuurdatum: 1_700_000_000_000,
      vervaldatum: 1_701_000_000_000,
      subtotaalExBtw: 2000,
      btwTotaal: 420,
      totaalInclBtw: 2420,
      betaaldBedrag: 500,
      aangemaaktOp: 1_700_000_000_000,
      gewijzigdOp: 1_700_000_000_000
    },
    customer: {
      id: "c1",
      weergaveNaam: "Familie De Vries",
      type: "private",
      straat: "Dorpsstraat",
      huisnummer: "12",
      postcode: "8255 AB",
      plaats: "Swifterbant",
      land: "Nederland"
    },
    project: { id: "p1", titel: "PVC-vloer", status: "in_progress" },
    quote: { id: "q1", offertenummer: "OF-2026-0031", titel: "PVC-vloer woonkamer", status: "accepted" },
    quoteLines: [
      {
        id: "l2",
        regelType: "service",
        titel: "Leggen visgraat",
        aantal: 24,
        eenheid: "m2",
        eenheidsprijsExBtw: 22.5,
        btwTarief: 21,
        kortingExBtw: 40,
        regelTotaalExBtw: 440,
        regelBtwTotaal: 92.4,
        regelTotaalInclBtw: 532.4,
        sortOrder: 2
      },
      {
        id: "l1",
        regelType: "product",
        titel: "Floorlife PVC Click",
        aantal: 24,
        eenheid: "m2",
        eenheidsprijsExBtw: 65,
        btwTarief: 21,
        regelTotaalExBtw: 1560,
        regelBtwTotaal: 327.6,
        regelTotaalInclBtw: 1887.6,
        sortOrder: 1
      },
      {
        id: "l3",
        regelType: "text",
        titel: "Levering in week 27.",
        aantal: 0,
        eenheid: "",
        eenheidsprijsExBtw: 0,
        btwTarief: 0,
        regelTotaalExBtw: 0,
        regelBtwTotaal: 0,
        regelTotaalInclBtw: 0,
        sortOrder: 3
      }
    ],
    ...overrides
  };
}

describe("buildInvoiceDocumentModel", () => {
  it("neemt de factuurkop, totalen en offerte-referentie over", () => {
    const model = buildInvoiceDocumentModel({ detail: makeDetail() });

    expect(model.invoice.invoiceNumber).toBe("2026-0042");
    expect(model.invoice.quoteNumber).toBe("OF-2026-0031");
    expect(model.invoice.subject).toBe("PVC-vloer woonkamer");
    expect(model.totals).toEqual({
      subtotalExVat: 2000,
      vatTotal: 420,
      totalIncVat: 2420,
      vatBreakdown: [{ rate: 21, base: 2000, amount: 420 }],
      costBreakdown: [
        { category: "materiaal", label: "Materiaal", amount: 1560 },
        { category: "arbeid", label: "Arbeid", amount: 440 }
      ]
    });
  });

  it("splitst de btw exact uit per tarief (tekstregels tellen niet mee)", () => {
    const detail = makeDetail();
    detail.quoteLines[0].btwTarief = 9;
    detail.quoteLines[0].regelBtwTotaal = 39.6; // 440 × 9%
    const model = buildInvoiceDocumentModel({ detail });

    expect(model.totals.vatBreakdown).toEqual([
      { rate: 9, base: 440, amount: 39.6 },
      { rate: 21, base: 1560, amount: 327.6 }
    ]);
  });

  it("sorteert regels op sortOrder en markeert tekstregels", () => {
    const model = buildInvoiceDocumentModel({ detail: makeDetail() });

    expect(model.lines.map((line) => line.description)).toEqual([
      "Floorlife PVC Click",
      "Leggen visgraat",
      "Levering in week 27."
    ]);
    expect(model.lines[2].isText).toBe(true);
    expect(model.lines[0].isText).toBe(false);
  });

  it("geeft de korting per regel los terug (formattering in de component)", () => {
    const model = buildInvoiceDocumentModel({ detail: makeDetail() });
    const visgraat = model.lines.find((line) => line.description === "Leggen visgraat");

    expect(visgraat?.discountExVat).toBe(40);
    expect(model.lines[0].discountExVat).toBe(0);
  });

  it("berekent het openstaande bedrag en de betaalreferentie", () => {
    const model = buildInvoiceDocumentModel({ detail: makeDetail() });

    expect(model.payment.outstanding).toBe(1920);
    expect(model.payment.paidAmount).toBe(500);
    expect(model.payment.reference).toBe("2026-0042");
    expect(model.payment.iban).toBe("NL54RABO0166385220");
  });

  it("klemt het openstaande bedrag op nul bij overbetaling", () => {
    const detail = makeDetail();
    detail.invoice.betaaldBedrag = 3000;
    const model = buildInvoiceDocumentModel({ detail });

    expect(model.payment.outstanding).toBe(0);
  });

  it("valt terug op een nette naam en leeg adres zonder klant", () => {
    const detail = makeDetail();
    detail.customer = null;
    const model = buildInvoiceDocumentModel({ detail });

    expect(model.customer.name).toBe("Onbekende klant");
    expect(model.customer.addressLines).toEqual([]);
  });
});
