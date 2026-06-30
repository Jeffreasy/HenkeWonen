export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateVat(amountExVat: number, vatRate: number): number {
  return roundMoney(amountExVat * (vatRate / 100));
}

export function calculateIncVat(amountExVat: number, vatRate: number): number {
  return roundMoney(amountExVat + calculateVat(amountExVat, vatRate));
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

/**
 * Openstaand bedrag van een factuur (nooit negatief), afgerond op centen zodat het
 * exact aansluit op de backend-berekening (`roundMoney`).
 */
export function getOutstandingAmount(totalIncVat: number, paidAmount: number): number {
  return roundMoney(Math.max(0, totalIncVat - paidAmount));
}

/** Formatteert een geldbedrag als nl-NL invoerwaarde (komma-decimaal) voor een tekstveld. */
export function formatMoneyInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function calculateLineTotals(
  quantity: number,
  unitPriceExVat: number,
  vatRate: number,
  discountExVat = 0
) {
  const subtotalExVat = roundMoney(quantity * unitPriceExVat - discountExVat);
  const vatTotal = calculateVat(subtotalExVat, vatRate);

  return {
    subtotalExVat,
    vatTotal,
    totalIncVat: roundMoney(subtotalExVat + vatTotal)
  };
}
