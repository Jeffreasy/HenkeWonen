/**
 * Snelroute "maten al bekend" — een walk-in klant komt binnen met de maten en productkeuze al
 * bekend, en wil meteen inmeten zonder een buitendienst-bezoek te plannen.
 *
 * De intent leeft client-side als querystring-vlag (niet gepersisteerd): de klant/dossier-aanmaak
 * (producer, CustomerWorkspace) zet de vlag op de redirect-URL, en het inmeet-paneel (consumer,
 * MeasurementPanel) start daarop de inmeting automatisch. Eén bron voor naam + waarde zodat
 * producer en consumer niet via een losse string aan elkaar hangen.
 */
export const MEASUREMENT_AUTOSTART_PARAM = "intent";
export const MEASUREMENT_AUTOSTART_VALUE = "inmeten";

/**
 * Werksoort-hint van de dossier-intake naar het inmeet-paneel: de gekozen
 * werksoort ("Behang", "Trap", ...) reist als querystring mee zodat de
 * inmeting op de juiste product-tab opent i.p.v. altijd op "Vloer".
 * Waarden spiegelen AddType in MeasurementAssignPanel.
 */
export const MEASUREMENT_WORKTYPE_PARAM = "werksoort";

export const MEASUREMENT_WORKTYPES = [
  "vloer",
  "plint",
  "behang",
  "wandpaneel",
  "gordijn",
  "trap",
  "raambekleding",
  "dienst"
] as const;

export type MeasurementWorktype = (typeof MEASUREMENT_WORKTYPES)[number];

/** Bouwt het querystring-fragment voor de snelroute-redirect, bv. "?intent=inmeten". */
export function measurementAutostartQuery(): string {
  return `?${MEASUREMENT_AUTOSTART_PARAM}=${MEASUREMENT_AUTOSTART_VALUE}`;
}

/** Querystring voor de dossier-intake: alleen de werksoort-hint, bv. "?werksoort=behang". */
export function measurementWorktypeQuery(worktype: MeasurementWorktype): string {
  return `?${MEASUREMENT_WORKTYPE_PARAM}=${worktype}`;
}

/** Leest en valideert de werksoort-hint uit de querystring; onbekende waarde → null. */
export function measurementWorktypeFromSearch(search: string): MeasurementWorktype | null {
  const value = new URLSearchParams(search).get(MEASUREMENT_WORKTYPE_PARAM);
  return (MEASUREMENT_WORKTYPES as readonly string[]).includes(value ?? "")
    ? (value as MeasurementWorktype)
    : null;
}

/**
 * Pure beslissing of het inmeet-paneel de inmeting automatisch moet starten.
 *
 * Start ALLEEN wanneer:
 *  - de snelroute-vlag in de URL staat,
 *  - de gebruiker rechten heeft,
 *  - er nog GEEN inmeting bestaat (anders is er niets te starten / niet dubbel starten),
 *  - en nog niet eerder in deze sessie automatisch gestart (exact-één-keer-guard).
 *
 * Bewust primitieve argumenten zodat de helper los te unit-testen is zonder component-/Convex-types.
 */
export function shouldAutostartMeasurement(params: {
  search: string;
  hasMeasurement: boolean;
  canEdit: boolean;
  alreadyAutostarted: boolean;
}): boolean {
  if (params.alreadyAutostarted) return false;
  if (!params.canEdit) return false;
  if (params.hasMeasurement) return false;

  const value = new URLSearchParams(params.search).get(MEASUREMENT_AUTOSTART_PARAM);
  return value === MEASUREMENT_AUTOSTART_VALUE;
}
