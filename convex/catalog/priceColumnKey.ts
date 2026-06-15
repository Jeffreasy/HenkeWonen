/**
 * Maakt van een (mogelijk niet-ASCII) prijskolom-header een Convex-veilige object-veldnaam.
 *
 * Convex weigert non-ASCII- en controltekens als veldnaam ("Field names can only contain
 * non-control ASCII characters"). Sommige leveranciersheaders bevatten een euroteken
 * (bv. Masureel "Aanbevolen verkoopprijs € incl. BTW 010526/Stuk of m"), wat een insert van
 * `vatModeByPriceColumn`/`unitByPriceColumn`/`priceTypeByPriceColumn`/`vatModeReview` deed falen.
 *
 * De RUWE header blijft als VALUE bewaard in `priceColumnMappings` (de bron van waarheid die
 * lezers array-first gebruiken). Deze sleutel is enkel een secundaire index, dus de exacte
 * transformatie maakt functioneel niet uit zolang die deterministisch en ASCII-only is.
 */
export function toAsciiFieldKey(header: unknown): string {
  const key = String(header ?? "")
    .replace(/€/g, "EUR") // euroteken -> leesbaar EUR
    .replace(/[^\x20-\x7E]/g, " ") // overige non-ASCII/controltekens -> spatie (geen woord-join)
    .replace(/\s+/g, " ")
    .trim();
  return key.length > 0 ? key : "kolom";
}
