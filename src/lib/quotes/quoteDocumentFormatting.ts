export function formatCurrencyEUR(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: 3
  }).format(value);
}

export function formatVatRate(value: number): string {
  return `${new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: 2
  }).format(value)}%`;
}

export function formatDateNL(value?: Date | number | string): string {
  if (value === undefined || value === "") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Amsterdam"
  })
    .format(value instanceof Date ? value : new Date(value))
    .replace(/\//g, "-");
}
