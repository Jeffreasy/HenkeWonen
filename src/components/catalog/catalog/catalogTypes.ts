/**
 * Gedeelde types en constanten voor de catalog-modules.
 */
import type { PortalProduct } from "../../../lib/portalTypes";
import type { IssueStatusFilter } from "../DataIssuesFilterBar";

// ─── Product-status ────────────────────────────────────────────────────────────

/**
 * Status-type voor catalogusproducten.
 * Was gedupliceerd in ProductList, ProductListTable, ProductEditPanel en ProductFilterBar.
 */
export type ProductStatus = PortalProduct["status"];

/**
 * Geordende lijst van alle product-statussen.
 * Was gedupliceerd in ProductEditPanel en ProductFilterBar.
 */
export const PRODUCT_STATUSES: ProductStatus[] = [
  "draft",
  "active",
  "inactive",
  "archived"
];

// ─── Issue status filters ──────────────────────────────────────────────────────

/**
 * Filteropties voor het DataIssues-paneel.
 * Was gedupliceerd in CatalogDataIssues en DataIssuesFilterBar.
 */
export const STATUS_FILTERS: Array<{ value: IssueStatusFilter; label: string }> = [
  { value: "open", label: "Te beoordelen" },
  { value: "reviewed", label: "Beoordeeld" },
  { value: "accepted", label: "Bewust toegestaan" },
  { value: "resolved", label: "Opgelost" },
  { value: "all", label: "Alle" }
];
