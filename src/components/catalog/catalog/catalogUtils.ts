/**
 * Gedeelde utility functies voor de catalog-modules.
 * Vervangt identieke kopieën in DataIssuesTable, DataIssuesHeader en DataIssuesFilterBar.
 */

// ─── Getal weergave ───────────────────────────────────────────────────────────

/**
 * Formatteert een getal met nl-NL locale (bijv. 1.234).
 * Was gedupliceerd in DataIssuesTable, DataIssuesHeader en DataIssuesFilterBar.
 */
export function numberText(value: number): string {
  return new Intl.NumberFormat("nl-NL").format(value);
}

// ─── Datum weergave ───────────────────────────────────────────────────────────

/**
 * Formatteert een Unix-timestamp naar datum+tijd (nl-NL, kort formaat).
 * Was lokaal in DataIssuesTable; de measurement/measurementUtils versie
 * gebruikt dateStyle "short" zonder tijd — dit is de catalog-specifieke versie.
 */
export function dateTimeText(value?: number): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

// ─── Getal-string conversie ───────────────────────────────────────────────────

/**
 * Formatteert een optioneel getal naar string voor gebruik als input-value.
 * Was lokaal in ProductList.tsx.
 */
export function decimalText(value?: number): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}
