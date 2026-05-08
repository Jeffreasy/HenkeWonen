import type {
  CustomerStatus,
  CustomerType,
  PriceUnit,
  ProductImportRowKind,
  ProductImportRowStatus,
  ProductPriceType,
  ProductListStatus,
  MeasurementCalculationType,
  MeasurementProductGroup,
  MeasurementStatus,
  ProjectStatus,
  QuotePreparationStatus,
  QuoteLineType,
  QuoteStatus,
  VatMode
} from "../portalTypes";

const genericStatusLabels: Record<string, string> = {
  active: "Actief",
  inactive: "Inactief",
  archived: "Gearchiveerd",
  draft: "Concept",
  sent: "Verzonden",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
  expired: "Verlopen",
  cancelled: "Geannuleerd",
  paid: "Betaald",
  overdue: "Te laat",
  failed: "Mislukt",
  imported: "Verwerkt",
  uploaded: "Geüpload",
  mapped: "Gekoppeld",
  previewed: "Gecontroleerd",
  ready_to_import: "Klaar om te verwerken",
  importing: "Verwerken",
  analyzing: "Controleren",
  needs_mapping: "Btw-keuze nodig",
  blocked: "Geblokkeerd",
  ready: "Gereed",
  warning: "Waarschuwing",
  error: "Fout",
  valid: "Geldig",
  ignored: "Genegeerd",
  open: "Open",
  reviewed: "Beoordeeld",
  resolved: "Opgelost",
  success: "Geslaagd",
  info: "Informatie",
  default: "Standaard",
  flooring: "Vloeren",
  curtains: "Gordijnen",
  wall_panels: "Wandpanelen",
  custom: "Maatwerk",
  fixed: "Vast",
  per_m2: "per m²",
  per_meter: "per meter",
  per_roll: "per rol",
  per_side: "per zijde",
  per_staircase: "per trap",
  "geen imports": "Geen prijslijsten"
};

const projectStatusLabels: Record<ProjectStatus, string> = {
  lead: "Lead",
  quote_draft: "Offerteconcept",
  quote_sent: "Offerte verzonden",
  quote_accepted: "Offerte akkoord",
  quote_rejected: "Offerte afgewezen",
  measurement_planned: "Inmeting gepland",
  execution_planned: "Uitvoering gepland",
  ordering: "Bestellen",
  in_progress: "In uitvoering",
  invoiced: "Gefactureerd",
  paid: "Betaald",
  closed: "Gesloten",
  cancelled: "Geannuleerd"
};

const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: "Concept",
  sent: "Verzonden",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
  expired: "Verlopen",
  cancelled: "Geannuleerd"
};

const customerStatusLabels: Record<CustomerStatus, string> = {
  lead: "Lead",
  active: "Actief",
  inactive: "Inactief",
  archived: "Gearchiveerd"
};

const customerTypeLabels: Record<CustomerType, string> = {
  private: "Particulier",
  business: "Zakelijk"
};

const lineTypeLabels: Record<QuoteLineType, string> = {
  product: "Product",
  service: "Werkzaamheid",
  labor: "Arbeid",
  material: "Materiaal",
  discount: "Korting",
  text: "Tekst",
  manual: "Handmatig"
};

const importStatusLabels: Record<string, string> = {
  uploaded: "Geüpload",
  analyzing: "Controleren",
  needs_mapping: "Btw-keuze nodig",
  ready_to_import: "Klaar om te verwerken",
  importing: "Verwerken",
  imported: "Verwerkt",
  failed: "Mislukt",
  archived: "Gearchiveerd"
};

const importProfileStatusLabels: Record<string, string> = {
  active: "Actuele route",
  inactive: "Gearchiveerd profiel"
};

const productListStatusLabels: Record<ProductListStatus, string> = {
  unknown: "Onbekend",
  requested: "Opgevraagd",
  received: "Ontvangen",
  download_available: "Download beschikbaar",
  not_available: "Niet beschikbaar",
  manual_only: "Alleen handmatig"
};

const rowKindLabels: Record<ProductImportRowKind, string> = {
  header: "Kopregel",
  section: "Groep",
  product: "Productregel",
  empty: "Lege regel",
  warning: "Waarschuwing",
  error: "Fout",
  ignored: "Overgeslagen regel"
};

const rowStatusLabels: Record<ProductImportRowStatus, string> = {
  valid: "Geldig",
  warning: "Waarschuwing",
  error: "Fout",
  ignored: "Overgeslagen",
  imported: "Verwerkt"
};

const vatModeLabels: Record<VatMode, string> = {
  inclusive: "Inclusief btw",
  exclusive: "Exclusief btw",
  unknown: "Btw nog onbekend"
};

const priceTypeLabels: Record<ProductPriceType | string, string> = {
  purchase: "Inkoop",
  net_purchase: "Netto inkoop",
  retail: "Verkoop",
  advice_retail: "Adviesverkoop",
  commission: "Commissie",
  pallet: "Palletprijs",
  trailer: "Trailerprijs",
  roll: "Rolprijs",
  cut_length: "Coupage",
  package: "Verpakking",
  step: "Trede",
  manual: "Handmatig"
};

const unitLabels: Record<PriceUnit | string, string> = {
  m2: "m²",
  m1: "m¹",
  meter: "meter",
  piece: "stuk",
  package: "verpakking",
  pack: "pak",
  roll: "rol",
  pallet: "pallet",
  trailer: "trailer",
  step: "trede",
  stairs: "trap",
  liter: "liter",
  kg: "kg",
  tekst: "tekst",
  custom: "maatwerk"
};

const issueStatusLabels: Record<string, string> = {
  open: "Open",
  reviewed: "Beoordeeld",
  accepted: "Geaccepteerd",
  resolved: "Opgelost"
};

const reviewDecisionLabels: Record<string, string> = {
  keep_separate: "Gescheiden houden",
  merge_later: "Later beoordelen voor samenvoegen",
  source_error: "Fout in leverancierbestand",
  accepted_duplicate: "Bewust dubbel toegestaan",
  resolved: "Opgelost"
};

const recommendationLabels: Record<string, string> = {
  merge: "Mogelijk samenvoegen",
  keep_separate: "Gescheiden houden",
  needs_human_review: "Controle vereist",
  "needs human review": "Controle vereist",
  needs_review: "Controle vereist",
  accepted_duplicate: "Bewust dubbel toegestaan"
};

const measurementStatusLabels: Record<MeasurementStatus, string> = {
  draft: "Concept",
  measured: "Ingemeten",
  reviewed: "Gecontroleerd",
  converted_to_quote: "Verwerkt naar offerte"
};

const measurementProductGroupLabels: Record<MeasurementProductGroup, string> = {
  flooring: "Vloeren",
  plinths: "Plinten",
  wallpaper: "Behang",
  wall_panels: "Wandpanelen",
  curtains: "Gordijnen",
  rails: "Rails",
  stairs: "Trap",
  other: "Overig"
};

const measurementCalculationTypeLabels: Record<MeasurementCalculationType, string> = {
  area: "Oppervlakte",
  perimeter: "Omtrek",
  rolls: "Rollen",
  panels: "Panelen",
  stairs: "Trap",
  manual: "Handmatig"
};

const quotePreparationStatusLabels: Record<QuotePreparationStatus, string> = {
  draft: "Concept",
  ready_for_quote: "Klaar voor offerte",
  converted: "Verwerkt"
};

function readableFallback(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function formatStatusLabel(status: string): string {
  return genericStatusLabels[status] ?? readableFallback(status);
}

export function formatProjectStatus(status: string): string {
  return projectStatusLabels[status as ProjectStatus] ?? formatStatusLabel(status);
}

export function formatQuoteStatus(status: string): string {
  return quoteStatusLabels[status as QuoteStatus] ?? formatStatusLabel(status);
}

export function formatCustomerStatus(status: string): string {
  return customerStatusLabels[status as CustomerStatus] ?? formatStatusLabel(status);
}

export function formatCustomerType(type: string): string {
  return customerTypeLabels[type as CustomerType] ?? readableFallback(type);
}

export function formatImportStatus(status: string): string {
  return importStatusLabels[status] ?? formatStatusLabel(status);
}

export function formatImportProfileStatus(status: string): string {
  return importProfileStatusLabels[status] ?? formatStatusLabel(status);
}

export function formatProductListStatus(status: string): string {
  return productListStatusLabels[status as ProductListStatus] ?? formatStatusLabel(status);
}

export function formatVatMode(vatMode: string): string {
  return vatModeLabels[vatMode as VatMode] ?? readableFallback(vatMode);
}

export function formatLineType(lineType: string): string {
  return lineTypeLabels[lineType as QuoteLineType] ?? readableFallback(lineType);
}

export function formatIssueStatus(status: string): string {
  return issueStatusLabels[status] ?? formatStatusLabel(status);
}

export function formatReviewDecision(decision: string): string {
  return reviewDecisionLabels[decision] ?? recommendationLabels[decision] ?? readableFallback(decision);
}

export function formatRowKind(rowKind: string): string {
  return rowKindLabels[rowKind as ProductImportRowKind] ?? readableFallback(rowKind);
}

export function formatRowStatus(status: string): string {
  return rowStatusLabels[status as ProductImportRowStatus] ?? formatStatusLabel(status);
}

export function formatPriceType(priceType: string): string {
  return priceTypeLabels[priceType] ?? readableFallback(priceType);
}

export function formatUnit(unit: string): string {
  return unitLabels[unit] ?? unit;
}

export function formatRecommendation(value: string): string {
  return recommendationLabels[value] ?? reviewDecisionLabels[value] ?? readableFallback(value);
}

export function formatMeasurementStatus(status: string): string {
  return measurementStatusLabels[status as MeasurementStatus] ?? formatStatusLabel(status);
}

export function formatMeasurementProductGroup(productGroup: string): string {
  return (
    measurementProductGroupLabels[productGroup as MeasurementProductGroup] ??
    readableFallback(productGroup)
  );
}

export function formatMeasurementCalculationType(calculationType: string): string {
  return (
    measurementCalculationTypeLabels[calculationType as MeasurementCalculationType] ??
    readableFallback(calculationType)
  );
}

export function formatQuotePreparationStatus(status: string): string {
  return quotePreparationStatusLabels[status as QuotePreparationStatus] ?? formatStatusLabel(status);
}
