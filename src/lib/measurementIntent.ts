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

/** Bouwt het querystring-fragment voor de snelroute-redirect, bv. "?intent=inmeten". */
export function measurementAutostartQuery(): string {
  return `?${MEASUREMENT_AUTOSTART_PARAM}=${MEASUREMENT_AUTOSTART_VALUE}`;
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
