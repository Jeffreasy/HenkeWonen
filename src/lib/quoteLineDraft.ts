import type { PortalProduct, QuoteLineType } from "./portalTypes";

/**
 * Concept-vangnet voor de offerte-regeleditor (QuoteLineEditor). Net als bij de inmeting
 * op mobiel gooit de browser een achtergrond-tab weg zodra de monteur even naar de camera-
 * app wisselt; alle nog niet toegevoegde invoer — de half getypte offertepost — leeft in
 * React-state en was daarna weg. We spiegelen die invoer per offerte naar localStorage.
 *
 * ISOLATIE is hier kritiek: elke offerte krijgt een eigen sleutel (`quoteLineDraftKey`),
 * zodat een half getypte regel van offerte A nooit in offerte B opduikt. Het hele
 * `selectedProduct` gaat mee (niet enkel een id), zodat de picker-trigger én de latere
 * offerteregel-metadata (category/soort) intact herstellen — dezelfde reden als bij het
 * inmeet-concept. De template-KEUZE-indicator herstellen we bewust niet: de daaruit volgende
 * veldwaarden (titel/aantal/prijs) staan al in het concept, dus de getypte inhoud blijft
 * behouden; alleen het dropdown-vinkje en de (niet klantzichtbare) template-metadata vervallen.
 */
export type QuoteLineDraftState = {
  lineType: QuoteLineType;
  title: string;
  description: string;
  quantity: string;
  unit: string;
  unitPriceExVat: string;
  vatRate: string;
  discountExVat: string;
  projectRoomId: string;
  selectedProduct: PortalProduct | null;
};

/** localStorage-sleutel per offerte. Uniek per `quoteId` → geen kruisbesmetting tussen offertes. */
export function quoteLineDraftKey(quoteId: string): string {
  return `henke-offerteregel-${quoteId}`;
}

/**
 * Is dit teruggehaalde concept-veld een bruikbaar catalogusproduct? We eisen de velden die de
 * picker-trigger (id + naam/weergaveNaam) en de regel-metadata (category) nodig hebben. Een oud
 * of corrupt concept valt zo netjes terug op "geen product". (Bewust lokaal gehouden i.p.v.
 * gedeeld met het inmeet-concept, zodat de twee vangnetten los van elkaar kunnen evolueren.)
 */
function isRestorablePortalProduct(value: unknown): value is PortalProduct {
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
 * Leest de offerte-regelinvoer veilig terug uit een (mogelijk oud/corrupt) concept. Alleen
 * velden die hun type-check doorstaan komen in het resultaat; de rest blijft op de begininstelling
 * van de editor staan.
 */
export function readQuoteLineDraft(draft: {
  lineType?: unknown;
  title?: unknown;
  description?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitPriceExVat?: unknown;
  vatRate?: unknown;
  discountExVat?: unknown;
  projectRoomId?: unknown;
  selectedProduct?: unknown;
}): Partial<QuoteLineDraftState> {
  const restored: Partial<QuoteLineDraftState> = {};
  const str = (value: unknown): value is string => typeof value === "string";

  if (str(draft.lineType)) restored.lineType = draft.lineType as QuoteLineType;
  if (str(draft.title)) restored.title = draft.title;
  if (str(draft.description)) restored.description = draft.description;
  if (str(draft.quantity)) restored.quantity = draft.quantity;
  if (str(draft.unit)) restored.unit = draft.unit;
  if (str(draft.unitPriceExVat)) restored.unitPriceExVat = draft.unitPriceExVat;
  if (str(draft.vatRate)) restored.vatRate = draft.vatRate;
  if (str(draft.discountExVat)) restored.discountExVat = draft.discountExVat;
  if (str(draft.projectRoomId)) restored.projectRoomId = draft.projectRoomId;
  if (isRestorablePortalProduct(draft.selectedProduct)) {
    restored.selectedProduct = draft.selectedProduct;
  }
  return restored;
}
