import { describe, expect, it } from "vitest";
import { parseQuoteLineNumbers } from "../src/components/quotes/quote/quoteLineInput";

function base(overrides: Partial<Parameters<typeof parseQuoteLineNumbers>[0]> = {}) {
  return parseQuoteLineNumbers({
    lineType: "product",
    quantity: "1",
    unitPriceExVat: "10",
    vatRate: "21",
    discountExVat: "",
    ...overrides
  });
}

/**
 * Validatie-audit 2026-07-10: voorheen ging alles door `Number(x) || 0`,
 * waardoor Nederlandse komma-invoer ("12,50" → NaN) stil € 0,00 op de
 * offerte werd en negatieve aantallen/prijzen zonder melding passeerden.
 */
describe("parseQuoteLineNumbers", () => {
  it("accepteert Nederlandse komma-invoer als geldig bedrag", () => {
    const result = base({ quantity: "2,5", unitPriceExVat: "12,50", discountExVat: "1,25" });
    expect(result).toEqual({
      ok: true,
      values: { quantity: 2.5, unitPriceExVat: 12.5, vatRate: 21, discountExVat: 1.25 }
    });
  });

  it("weigert onzin-invoer met een melding in plaats van stil nul", () => {
    expect(base({ unitPriceExVat: "abc" })).toMatchObject({ ok: false });
    expect(base({ quantity: "twee" })).toMatchObject({ ok: false });
    expect(base({ discountExVat: "€25" })).toMatchObject({ ok: false });
  });

  it("weigert nul, negatief of leeg aantal", () => {
    expect(base({ quantity: "0" })).toMatchObject({ ok: false });
    expect(base({ quantity: "-2" })).toMatchObject({ ok: false });
    expect(base({ quantity: "" })).toMatchObject({ ok: false });
  });

  it("staat een lege prijs toe als bewuste € 0 (prijs later invullen)", () => {
    expect(base({ unitPriceExVat: "" })).toMatchObject({
      ok: true,
      values: expect.objectContaining({ unitPriceExVat: 0 })
    });
  });

  it("staat een negatieve prijs alleen toe op een kortingsregel", () => {
    expect(base({ unitPriceExVat: "-5" })).toMatchObject({ ok: false });
    expect(base({ lineType: "discount", unitPriceExVat: "-5" })).toMatchObject({
      ok: true,
      values: expect.objectContaining({ unitPriceExVat: -5 })
    });
  });

  it("begrenst het btw-percentage op 0-100", () => {
    expect(base({ vatRate: "-1" })).toMatchObject({ ok: false });
    expect(base({ vatRate: "101" })).toMatchObject({ ok: false });
    expect(base({ vatRate: "9" })).toMatchObject({ ok: true });
    expect(base({ vatRate: "" })).toMatchObject({ ok: false });
  });

  it("weigert negatieve korting", () => {
    expect(base({ discountExVat: "-10" })).toMatchObject({ ok: false });
  });

  it("laat tekstregels ongemoeid (geen bedragen)", () => {
    expect(
      parseQuoteLineNumbers({
        lineType: "text",
        quantity: "",
        unitPriceExVat: "",
        vatRate: "",
        discountExVat: ""
      })
    ).toEqual({ ok: true, values: { quantity: 0, unitPriceExVat: 0, vatRate: 0 } });
  });
});
