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

/**
 * Posttypen waarvoor je een vaste werkzaamheid uit de catalogus
 * (/portal/instellingen/werkzaamheden) kunt kiezen i.p.v. handmatig typen.
 * Gedeeld door QuoteLineEditor (toevoegen) en QuoteLineEditForm (bewerken).
 */
export const SERVICE_RULE_LINE_TYPES: QuoteLineType[] = ["service", "labor", "material"];

/** True als voor dit posttype de Werkzaamheid-kiezer getoond wordt. */
export function isServiceRuleLineType(lineType: QuoteLineType): boolean {
  return SERVICE_RULE_LINE_TYPES.includes(lineType);
}

// ─── Getal-parsing ────────────────────────────────────────────────────────────

/**
 * Parst een decimale string (ook met komma) naar een number.
 * Re-export vanuit measurement/measurementUtils — één implementatie voor het hele project.
 */
export { parseDecimal } from "../../projects/measurement/measurementUtils";
