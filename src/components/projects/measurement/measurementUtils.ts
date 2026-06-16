/**
 * Pure hulpfuncties voor de inmeting.
 * Geen side effects, geen React-dependencies — veilig te importeren overal.
 */

import { formatDate } from "../../../lib/dates";

// ─── Getal parsing ────────────────────────────────────────────────────────────

/**
 * Parst een decimale string (ook met komma) naar een number.
 * Geeft undefined terug bij leeg of niet-numerieke invoer.
 */
export function parseDecimal(value: string): number | undefined {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Formatteert een optioneel getal naar string voor gebruik als input-value.
 * Geeft "" terug bij undefined/null.
 */
export function decimalText(value?: number): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

/**
 * Formatteert een getal voor weergave in de UI (nl-NL locale).
 * @param suffix Optionele eenheid, bijv. " m²" of " m"
 */
export function formatNumber(value?: number, suffix = ""): string {
  if (value === undefined || value === null) {
    return "-";
  }

  return `${new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value)}${suffix}`;
}

// ─── Datum helpers ────────────────────────────────────────────────────────────

/**
 * Formatteert een Unix-timestamp (ms) naar leesbare datum (nl-NL).
 * Geeft "-" terug bij undefined/0.
 */
/** Alias voor {@link formatDate} — behoudt de bestaande aanroepnaam in de inmeting. */
export function dateText(value?: number): string {
  return formatDate(value);
}

/**
 * Converteert een Unix-timestamp naar ISO-datumstring (YYYY-MM-DD)
 * voor gebruik in `<input type="date">`.
 */
export function toDateInputValue(value?: number): string {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Converteert een ISO-datumstring (YYYY-MM-DD) van `<input type="date">`
 * terug naar een Unix-timestamp (ms). Gebruikt 12:00 UTC om timezone-issues te vermijden.
 */
export function fromDateInputValue(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T12:00:00`).getTime();
}
