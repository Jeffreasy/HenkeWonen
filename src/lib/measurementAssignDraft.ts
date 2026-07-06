import type { PortalProduct } from "./portalTypes";

/**
 * Het deel van het inmeet-concept dat NIET vanzelf herstelt na een mobiele tab-eviction:
 * de productselectie. De maatinvoer, de matrixvelden en het ruimteformulier staan al in
 * het concept (zie `useFormDraft` in MeasurementAssignPanel), maar het gekozen `product`
 * en — bij een losse dienst — `serviceRuleId` niet. Daardoor viel de CatalogProductPicker-
 * trigger na een remount terug op "Kies een product…" en moest de monteur opnieuw kiezen.
 *
 * We bewaren het hele PortalProduct (niet enkel een id) zodat niet alléén de knoptekst
 * herstelt, maar ook de rekenmachine: die leidt bij een vloer af uit `category` +
 * `productSoort` (zie calculatorForProduct). Een minimale {id, naam}-reconstructie zou de
 * rekenmachine op "manual" gooien en toevoegen blokkeren. De richtprijs (`productPrice`)
 * bewaren we bewust NIET: die her-fetcht zichzelf uit het herstelde product
 * (getIndicativePrice) en zou uit het concept juist kunnen verouderen. `bundleRuleIds`
 * laten we ook los — die worden bij remount opnieuw afgeleid uit de dienst-suggesties.
 */
export type MeasurementProductSelection = {
  product: PortalProduct | null;
  serviceRuleId: string;
};

/**
 * Is dit teruggehaalde concept-veld een bruikbaar catalogusproduct? We eisen de velden die
 * zowel de picker-trigger (id + naam/weergaveNaam) als de rekenmachine-afleiding (category)
 * nodig hebben. Een oud of corrupt concept valt zo netjes terug op "geen keuze".
 */
export function isRestorablePortalProduct(value: unknown): value is PortalProduct {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.naam === "string" &&
    typeof candidate.weergaveNaam === "string" &&
    typeof candidate.category === "string"
  );
}

/**
 * Leest de productselectie veilig terug uit een (mogelijk oud/corrupt) concept. Ontbrekende
 * of ongeldige velden komen niet in het resultaat, zodat de aanroeper ze niet terugzet en de
 * bijbehorende state gewoon op zijn begininstelling blijft.
 */
export function restoreMeasurementProductSelection(draft: {
  product?: unknown;
  serviceRuleId?: unknown;
}): Partial<MeasurementProductSelection> {
  const restored: Partial<MeasurementProductSelection> = {};
  if (isRestorablePortalProduct(draft.product)) {
    restored.product = draft.product;
  }
  if (typeof draft.serviceRuleId === "string") {
    restored.serviceRuleId = draft.serviceRuleId;
  }
  return restored;
}
