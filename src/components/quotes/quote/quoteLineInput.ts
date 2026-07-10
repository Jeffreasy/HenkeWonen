import type { QuoteLineType } from "../../../lib/portalTypes";
import { parseDecimal } from "../../projects/measurement/measurementUtils";

/**
 * Eén parse-/validatiepad voor de getalvelden van een offerteregel
 * (toevoegen én bewerken). Vangt wat voorheen stil misging:
 *
 * - Nederlandse komma-invoer: `Number("12,50")` is NaN en werd via `|| 0`
 *   stilletjes € 0,00 op de offerte. parseDecimal accepteert 12,50 én 12.50.
 * - Onzin-invoer ("abc") werd ook stil 0 — nu een duidelijke foutmelding.
 * - Negatief of nul aantal, btw buiten 0–100 en negatieve korting worden
 *   geweigerd. Een negatieve prijs kan uitsluitend op een regel van het
 *   soort Korting (zelfde regel als calculateLineTotals server-side).
 *
 * Een lege prijs blijft bewust € 0: "prijs vullen we later in" is een
 * bestaande werkwijze en de klantversie markeert zulke regels al voor review.
 */
export type QuoteLineNumbersInput = {
  lineType: QuoteLineType;
  quantity: string;
  unitPriceExVat: string;
  vatRate: string;
  discountExVat: string;
};

export type QuoteLineNumbers = {
  quantity: number;
  unitPriceExVat: number;
  vatRate: number;
  discountExVat?: number;
};

export type QuoteLineNumbersResult =
  | { ok: true; values: QuoteLineNumbers }
  | { ok: false; error: string };

function invalid(error: string): QuoteLineNumbersResult {
  return { ok: false, error };
}

export function parseQuoteLineNumbers(input: QuoteLineNumbersInput): QuoteLineNumbersResult {
  if (input.lineType === "text") {
    return { ok: true, values: { quantity: 0, unitPriceExVat: 0, vatRate: 0 } };
  }

  const quantity = parseDecimal(input.quantity);
  if (quantity === undefined) {
    return invalid(`Vul een geldig aantal in (bijvoorbeeld 2 of 2,5) — "${input.quantity.trim() || "leeg"}" is geen getal.`);
  }
  if (quantity <= 0) {
    return invalid("Het aantal moet groter dan nul zijn.");
  }

  const priceRaw = input.unitPriceExVat.trim();
  const unitPriceExVat = priceRaw === "" ? 0 : parseDecimal(priceRaw);
  if (unitPriceExVat === undefined) {
    return invalid(`Vul een geldige prijs in (bijvoorbeeld 12,50) — "${priceRaw}" is geen bedrag.`);
  }
  if (unitPriceExVat < 0 && input.lineType !== "discount") {
    return invalid(
      "Een negatieve prijs kan alleen op een regel van het soort Korting. Gebruik anders het kortingsveld."
    );
  }

  const vatRate = parseDecimal(input.vatRate);
  if (vatRate === undefined) {
    return invalid(`Vul een geldig btw-percentage in (bijvoorbeeld 21) — "${input.vatRate.trim() || "leeg"}" is geen getal.`);
  }
  if (vatRate < 0 || vatRate > 100) {
    return invalid("Het btw-percentage moet tussen 0 en 100 liggen.");
  }

  const discountRaw = input.discountExVat.trim();
  let discountExVat: number | undefined;
  if (discountRaw !== "") {
    discountExVat = parseDecimal(discountRaw);
    if (discountExVat === undefined) {
      return invalid(`Vul een geldige korting in (bijvoorbeeld 25 of 12,50) — "${discountRaw}" is geen bedrag.`);
    }
    if (discountExVat < 0) {
      return invalid("Korting kan niet negatief zijn — een toeslag hoort in de prijs zelf.");
    }
  }

  return { ok: true, values: { quantity, unitPriceExVat, vatRate, discountExVat } };
}
