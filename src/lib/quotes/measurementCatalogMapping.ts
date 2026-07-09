/**
 * Koppeling tussen meetproductgroepen en cataloguscategorieën.
 *
 * Categorienamen moeten exact overeenkomen met de `name` velden
 * in de `categories` tabel in Convex (zie catalog/core.ts `categoryOrder`).
 *
 * Lege array (`[]`) = geen filter → volledige catalogus zichtbaar.
 */
import type { MeasurementProductGroup } from "../portalTypes";

export const PRODUCT_GROUP_TO_CATEGORIES: Record<MeasurementProductGroup, string[]> = {
  flooring: [
    // V2-catalogus gebruikt "PVC" en "Tapijt & Vinyl" als subcategorie;
    // de overige namen blijven staan voor oudere datasets.
    "PVC",
    "PVC Vloeren",
    "PVC Dryback",
    "Palletcollectie PVC",
    "Tapijt",
    "Tapijt & Vinyl",
    "Vinyl",
    "Karpetten",
    "Ondervloer",
    "Egaline",
    "Lijm"
  ],
  plinths: ["Plinten"],
  wallpaper: ["Behang"],
  wall_panels: ["Wandpanelen", "Akoestische Panelen", "Badkamer"],
  curtains: ["Gordijnen", "Gordijnstoffen", "Rolgordijnen", "Jaloezieën"],
  rails: ["Roedes/Railsen"],
  stairs: ["Traprenovatie"],
  other: []
};

/**
 * Geeft de toegestane cataloguscategorienamen terug voor een productgroep.
 * Retourneert `null` als er geen filter van toepassing is (lege mapping of geen hint).
 */
export function getAllowedCategories(
  productGroup: MeasurementProductGroup | null | undefined
): string[] | null {
  if (!productGroup) return null;
  const cats = PRODUCT_GROUP_TO_CATEGORIES[productGroup];
  return cats && cats.length > 0 ? cats : null;
}
