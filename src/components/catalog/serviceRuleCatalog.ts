/**
 * Pure helpers voor de Werkzaamheid-kiezer (ServiceRulePicker).
 *
 * Los van React gehouden zodat de mapping/filtering rechtstreeks te unit-testen
 * is (zie tests/serviceRuleCatalog.test.ts). De kiezer put uit dezelfde
 * serviceCostRules-catalogus als /portal/instellingen/werkzaamheden.
 */
import type {
  ServiceRuleCalculationType,
  ServiceRuleRow
} from "../settings/settings/settingsTypes";

/**
 * Ruwe serviceCostRules-Doc zoals api.beheer.serviceCostRules.list hem teruggeeft
 * (Nederlandse veldnamen, ongemapt). Alleen de velden die de kiezer nodig heeft.
 */
export type ServiceRuleDoc = {
  _id: string;
  naam: string;
  omschrijving?: string;
  berekeningType: string;
  prijsExBtw: number;
  btwTarief: number;
  status: string;
};

/** De 7 geldige berekeningstypes — één bron voor validatie, labels en eenheid. */
const CALCULATION_TYPES: ServiceRuleCalculationType[] = [
  "fixed",
  "per_m2",
  "per_meter",
  "per_roll",
  "per_side",
  "per_staircase",
  "manual"
];

/**
 * Valideert een ruwe backend-string tegen de bekende berekeningstypes en valt
 * bij een onbekende waarde veilig terug op "manual". Zo krijgt niets
 * stroomafwaarts (labels/eenheid) ooit een ongeldig strikt type te zien.
 */
export function normalizeCalculationType(value: string): ServiceRuleCalculationType {
  return (CALCULATION_TYPES as string[]).includes(value)
    ? (value as ServiceRuleCalculationType)
    : "manual";
}

/**
 * Nederlandse labels per berekeningstype. Eigen map omdat de generieke
 * i18n/statusLabels "manual" (en "fixed") niet vertaalt.
 */
const CALCULATION_TYPE_LABELS: Record<ServiceRuleCalculationType, string> = {
  fixed: "Vast bedrag",
  per_m2: "Per m²",
  per_meter: "Per meter",
  per_roll: "Per rol",
  per_side: "Per zijde",
  per_staircase: "Per trap",
  manual: "Handmatig"
};

/** Leesbaar label voor een berekeningstype (onbekend -> "Handmatig"). */
export function formatCalculationType(calculationType: string): string {
  return CALCULATION_TYPE_LABELS[normalizeCalculationType(calculationType)];
}

/**
 * Eenheid-sleutel (unitLabels in i18n/statusLabels) per berekeningstype, voor de
 * offerteregel. Niet-dimensionale types (fixed/manual/per_side) vallen terug op
 * "piece" (stuk).
 */
const CALCULATION_TYPE_UNIT: Record<ServiceRuleCalculationType, string> = {
  fixed: "piece",
  per_m2: "m2",
  per_meter: "meter",
  per_roll: "roll",
  per_side: "piece",
  per_staircase: "stairs",
  manual: "piece"
};

/** Vertaalt het berekeningstype van een werkzaamheid naar de offerte-eenheid. */
export function calculationTypeToUnit(calculationType: string): string {
  return CALCULATION_TYPE_UNIT[normalizeCalculationType(calculationType)];
}

/** Mapt een ruwe serviceCostRules-Doc naar de gedeelde ServiceRuleRow-vorm. */
export function serviceRuleDocToRow(doc: ServiceRuleDoc): ServiceRuleRow {
  return {
    id: String(doc._id),
    name: doc.naam,
    description: doc.omschrijving,
    calculationType: normalizeCalculationType(doc.berekeningType),
    priceExVat: doc.prijsExBtw,
    vatRate: doc.btwTarief,
    // Alles wat niet expliciet "inactive" is behandelen we als actief.
    status: doc.status === "inactive" ? "inactive" : "active"
  };
}

/**
 * Zet ruwe Docs om naar actieve, op naam gesorteerde ServiceRuleRows.
 * Gearchiveerde (inactive) werkzaamheden vallen weg zodat je ze niet per
 * ongeluk op een nieuwe offerte kunt zetten.
 */
export function toActiveServiceRuleRows(docs: ServiceRuleDoc[]): ServiceRuleRow[] {
  return docs
    .map(serviceRuleDocToRow)
    .filter((rule) => rule.status === "active")
    .sort((left, right) => left.name.localeCompare(right.name, "nl"));
}

/** Client-side zoekfilter op naam + omschrijving (kleine lijst, geen serverzoek nodig). */
export function filterServiceRules(rules: ServiceRuleRow[], search: string): ServiceRuleRow[] {
  const term = search.trim().toLowerCase();
  if (!term) {
    return rules;
  }
  return rules.filter((rule) =>
    [rule.name, rule.description ?? ""].join(" ").toLowerCase().includes(term)
  );
}
