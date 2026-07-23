import type { QuoteTemplateLine } from "../portalTypes";

const LEGACY_PVC_STAIR_SECTION = "traprenovatie";
const LEGACY_PVC_STAIR_TITLE = "Traprenovatie PVC fabrikant, kleur, kleur strip";

function normalizedTemplateIdentity(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("nl");
}

/**
 * Oude samengestelde PVC-trapregel. Deze omzeilt de geleide inmeting en mag
 * daarom niet meer als handmatige standaardregel worden aangeboden.
 */
export function isLegacyPvcStairTemplateLine(
  line: Pick<QuoteTemplateLine, "sectieSleutel" | "titel">
): boolean {
  return (
    normalizedTemplateIdentity(line.sectieSleutel) === LEGACY_PVC_STAIR_SECTION &&
    normalizedTemplateIdentity(line.titel) === normalizedTemplateIdentity(LEGACY_PVC_STAIR_TITLE)
  );
}

export function isSelectableQuoteTemplateLine(
  line: Pick<QuoteTemplateLine, "sectieSleutel" | "titel">
): boolean {
  return !isLegacyPvcStairTemplateLine(line);
}
