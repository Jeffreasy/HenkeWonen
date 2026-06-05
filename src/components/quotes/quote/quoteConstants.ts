/**
 * Gedeelde constanten voor de offerte-modules (quotes/).
 * Vervangt de dubbele lineTypes/lineTypeOptions arrays in QuoteLineEditor en QuoteLineEditForm.
 */
import type { QuoteLineType } from "../../../lib/portalTypes";

// ─── Offertepost-typen ────────────────────────────────────────────────────────

/**
 * Alle beschikbare post-typen voor een offerteregel.
 * Was eerder gedupliceeerd als `lineTypes` in QuoteLineEditor
 * en `lineTypeOptions` in QuoteLineEditForm.
 */
export const LINE_TYPE_OPTIONS: QuoteLineType[] = [
  "product",
  "service",
  "labor",
  "material",
  "discount",
  "text",
  "manual"
];

// ─── Getal-parsing ────────────────────────────────────────────────────────────

/**
 * Parst een decimale string (ook met komma) naar een number.
 * Re-export vanuit measurement/measurementUtils — één implementatie voor het hele project.
 */
export { parseDecimal } from "../../projects/measurement/measurementUtils";
