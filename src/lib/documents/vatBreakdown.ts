import { roundMoney } from "../money";

export type VatBreakdownRow = {
  rate: number;
  base: number;
  amount: number;
};

/**
 * Splitst de btw uit per tarief (grondslag excl. btw + btw-bedrag), exact
 * gesommeerd uit de opgeslagen regeltotalen. Gedeeld door het offerte- én
 * factuurdocument zodat beide dezelfde uitsplitsing tonen — een verplicht
 * factuurelement bij gemengde tarieven.
 */
export function buildVatBreakdown(
  lines: Array<{
    regelType?: string;
    btwTarief: number;
    regelTotaalExBtw: number;
    regelBtwTotaal: number;
  }>
): VatBreakdownRow[] {
  const perTarief = new Map<number, { base: number; amount: number }>();
  for (const line of lines) {
    if (line.regelType === "text") {
      continue;
    }
    const huidig = perTarief.get(line.btwTarief) ?? { base: 0, amount: 0 };
    huidig.base += line.regelTotaalExBtw;
    huidig.amount += line.regelBtwTotaal;
    perTarief.set(line.btwTarief, huidig);
  }
  return [...perTarief.entries()]
    .map(([rate, { base, amount }]) => ({
      rate,
      base: roundMoney(base),
      amount: roundMoney(amount)
    }))
    .filter((row) => row.base !== 0 || row.amount !== 0)
    .sort((left, right) => left.rate - right.rate);
}
