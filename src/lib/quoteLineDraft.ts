import type {
  ServiceRuleCalculationType,
  ServiceRuleMetadata,
  ServiceRuleRow
} from "../components/settings/settings/settingsTypes";
import type { MeasurementProductGroup, PortalProduct, QuoteLineType } from "./portalTypes";

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
  selectedServiceRule: ServiceRuleRow | null;
};

/** localStorage-sleutel per offerte. Uniek per `quoteId` → geen kruisbesmetting tussen offertes. */
export function quoteLineDraftKey(quoteId: string): string {
  return `henke-offerteregel-${quoteId}`;
}

/**
 * Volledige set geldige regeltypen. De `Record<QuoteLineType, true>` dwingt via het typesysteem
 * af dat deze lijst mee-groeit als `QuoteLineType` verandert (anders een compilefout hier), zodat
 * het geen fragiele handmatige subset wordt.
 */
const QUOTE_LINE_TYPES: Record<QuoteLineType, true> = {
  product: true,
  service: true,
  labor: true,
  material: true,
  discount: true,
  text: true,
  manual: true
};
const QUOTE_LINE_TYPE_SET = new Set<string>(Object.keys(QUOTE_LINE_TYPES));

/** Alleen een echt bestaand regeltype telt — een corrupt concept mag geen onbekende waarde terugzetten. */
function isQuoteLineType(value: unknown): value is QuoteLineType {
  return typeof value === "string" && QUOTE_LINE_TYPE_SET.has(value);
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

const SERVICE_RULE_CALCULATION_TYPES: Record<ServiceRuleCalculationType, true> = {
  fixed: true,
  per_m2: true,
  per_meter: true,
  per_roll: true,
  per_side: true,
  per_staircase: true,
  manual: true
};
const SERVICE_RULE_CALCULATION_TYPE_SET = new Set<string>(
  Object.keys(SERVICE_RULE_CALCULATION_TYPES)
);

const MEASUREMENT_PRODUCT_GROUPS: Record<MeasurementProductGroup, true> = {
  flooring: true,
  plinths: true,
  wallpaper: true,
  wall_panels: true,
  curtains: true,
  rails: true,
  stairs: true,
  other: true
};
const MEASUREMENT_PRODUCT_GROUP_SET = new Set<string>(Object.keys(MEASUREMENT_PRODUCT_GROUPS));

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isRestorableServiceMetadata(value: unknown): value is ServiceRuleMetadata {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.family === "string" &&
    typeof candidate.role === "string" &&
    typeof candidate.sectionKey === "string" &&
    isOptionalString(candidate.covering) &&
    isOptionalString(candidate.shape)
  );
}

/** Alleen een complete, typeveilige catalogusdienst mag uit localStorage terugkeren. */
function isRestorableServiceRule(value: unknown): value is ServiceRuleRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const optionalStrings = [
    candidate.description,
    candidate.sku,
    candidate.category,
    candidate.subcategory,
    candidate.priceUnit,
    candidate.serviceFamily,
    candidate.covering,
    candidate.stairShape,
    candidate.serviceRole,
    candidate.sectionKey
  ];

  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.productId === "string" &&
    candidate.productId.length > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.length > 0 &&
    typeof candidate.calculationType === "string" &&
    SERVICE_RULE_CALCULATION_TYPE_SET.has(candidate.calculationType) &&
    typeof candidate.priceExVat === "number" &&
    Number.isFinite(candidate.priceExVat) &&
    typeof candidate.vatRate === "number" &&
    Number.isFinite(candidate.vatRate) &&
    (candidate.status === "active" || candidate.status === "inactive") &&
    optionalStrings.every(isOptionalString) &&
    (candidate.productGroup === undefined ||
      (typeof candidate.productGroup === "string" &&
        MEASUREMENT_PRODUCT_GROUP_SET.has(candidate.productGroup))) &&
    (candidate.serviceMetadata === undefined ||
      isRestorableServiceMetadata(candidate.serviceMetadata))
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
  selectedServiceRule?: unknown;
}): Partial<QuoteLineDraftState> {
  const restored: Partial<QuoteLineDraftState> = {};
  const str = (value: unknown): value is string => typeof value === "string";

  if (isQuoteLineType(draft.lineType)) restored.lineType = draft.lineType;
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
  if (isRestorableServiceRule(draft.selectedServiceRule)) {
    restored.selectedServiceRule = draft.selectedServiceRule;
  }
  return restored;
}
