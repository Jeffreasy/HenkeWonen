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
