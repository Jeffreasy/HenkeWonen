import { roundMoney } from "../money";

export type CostCategory = "materiaal" | "arbeid" | "overig";

export type CostBreakdownRow = {
  category: CostCategory;
  label: string;
  /** Grondslag excl. btw voor deze categorie. */
  amount: number;
};

/**
 * Regeltype → kostencategorie. Materiaal = catalogusproduct + materiaal;
 * Arbeid = werkzaamheid + arbeid; Overig = handmatig + korting. Tekstregels
 * tellen niet mee (geen bedrag). Bevestigd met de eigenaar (2026-07-07).
 */
const CATEGORY_BY_TYPE: Record<string, CostCategory> = {
  product: "materiaal",
  material: "materiaal",
  service: "arbeid",
  labor: "arbeid",
  manual: "overig",
  discount: "overig"
};

const LABELS: Record<CostCategory, string> = {
  materiaal: "Materiaal",
  arbeid: "Arbeid",
  overig: "Overig"
};

const ORDER: CostCategory[] = ["materiaal", "arbeid", "overig"];

/**
 * Splitst het subtotaal (excl. btw) uit naar materiaal vs arbeid, exact gesommeerd
 * uit de regeltotalen. Sommeert per definitie op tot het subtotaal. Puur informatief;
 * verandert niets aan de bedragen. Gedeeld door het offerte- én factuurdocument.
 */
export function buildCostBreakdown(
  lines: Array<{ regelType?: string; regelTotaalExBtw: number }>
): CostBreakdownRow[] {
  const perCategory = new Map<CostCategory, number>();

  for (const line of lines) {
    if (line.regelType === "text") {
      continue;
    }
    const category = CATEGORY_BY_TYPE[line.regelType ?? ""] ?? "overig";
    perCategory.set(category, (perCategory.get(category) ?? 0) + line.regelTotaalExBtw);
  }

  return ORDER.filter((category) => perCategory.has(category))
    .map((category) => ({
      category,
      label: LABELS[category],
      amount: roundMoney(perCategory.get(category) ?? 0)
    }))
    .filter((row) => row.amount !== 0);
}

/**
 * Alleen tonen als er echt iets te splitsen valt (minstens twee categorieën met
 * een bedrag). Een offerte die volledig uit materiaal bestaat, zegt niets extra.
 */
export function shouldShowCostBreakdown(rows: CostBreakdownRow[]): boolean {
  return rows.length >= 2;
}
