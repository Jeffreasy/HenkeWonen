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
    "PVC Vloeren",
    "PVC Dryback",
    "Palletcollectie PVC",
    "Tapijt",
    "Vinyl",
    "Karpetten",
    "Ondervloer",
    "Egaline",
    "Lijm"
  ],
  plinths: ["Plinten"],
  wallpaper: ["Behang"],
  wall_panels: ["Wandpanelen"],
  curtains: ["Gordijnen"],
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
