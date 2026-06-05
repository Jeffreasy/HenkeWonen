/**
 * Gedeelde types, constanten en utilities voor de suppliers-modules.
 */
import type { PortalSupplier, ProductListStatus } from "../../../lib/portalTypes";

// ─── Types ──────────────────────────────────────────────────────────────────────

/**
 * Was gedupliceerd in: EditSupplierForm, SupplierTable, SupplierWorkspace (3×, identiek).
 */
export type SupplierStatus = NonNullable<PortalSupplier["status"]>;

// ─── Constanten ─────────────────────────────────────────────────────────────────

/**
 * Was gedupliceerd in: AddSupplierForm, EditSupplierForm, SupplierTable (3×, identiek).
 */
export const PRODUCT_LIST_STATUSES: ProductListStatus[] = [
  "unknown",
  "requested",
  "received",
  "download_available",
  "not_available",
  "manual_only"
];

/**
 * Was gedupliceerd in: EditSupplierForm + SupplierTable (2×, identiek).
 */
export const SUPPLIER_STATUSES: SupplierStatus[] = ["active", "inactive", "archived"];

// ─── Datum helpers ────────────────────────────────────────────────────────────

/**
 * Zet een HTML date-inputwaarde (YYYY-MM-DD) om naar een Unix-timestamp.
 * Was gedupliceerd in: AddSupplierForm + EditSupplierForm (2×, identiek).
 */
export function fromDateInputValue(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T12:00:00`).getTime();
}

/**
 * Formatteert een Unix-timestamp naar een korte datum (nl-NL).
 * Lokaal in SupplierTable — gecentraliseerd voor hergebruik.
 */
export function dateText(value?: number): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}
