import type { IndicativeCalculationResult } from "./types";
import { isValidNumber, roundToTwoDecimals } from "./number";

export type ScreedCalculationInput = {
  areaM2: number;
  layerThicknessMm: number;
  /** Verbruik in kg per m² per mm laagdikte (placeholder-bedrijfsregel, default 1.5). */
  consumptionKgPerM2PerMm?: number;
  /** Zakinhoud in kg (placeholder-bedrijfsregel, default 25). */
  packKg?: number;
};

export type ScreedCalculationResult = IndicativeCalculationResult & {
  kgNeeded: number;
  /** Aantal zakken (afgerond omhoog). */
  packsNeeded: number;
  consumptionKgPerM2PerMm: number;
  packKg: number;
};

const DEFAULT_CONSUMPTION_KG_M2_MM = 1.5;
const DEFAULT_PACK_KG = 25;

/**
 * Egaliseren: m² × laagdikte (mm) × verbruik → benodigde kg → aantal zakken (omhoog).
 * Pure port uit HenkeWonenDATA/convex/calculators.ts (`screed_m2`). Verbruik en zakinhoud zijn
 * placeholder-bedrijfsregels (bevestigen met Wim/Simone).
 */
export function calculateScreed(input: ScreedCalculationInput): ScreedCalculationResult {
  const consumption = input.consumptionKgPerM2PerMm ?? DEFAULT_CONSUMPTION_KG_M2_MM;
  const packKg = input.packKg ?? DEFAULT_PACK_KG;

  if (!isValidNumber(input.areaM2) || input.areaM2 <= 0) {
    return invalidScreedResult("Oppervlakte moet groter dan 0 m² zijn.", consumption, packKg);
  }
  if (!isValidNumber(input.layerThicknessMm) || input.layerThicknessMm <= 0) {
    return invalidScreedResult("Laagdikte moet groter dan 0 mm zijn.", consumption, packKg);
  }
  if (!isValidNumber(consumption) || consumption <= 0) {
    return invalidScreedResult("Verbruik (kg/m²/mm) moet groter dan 0 zijn.", consumption, packKg);
  }
  if (!isValidNumber(packKg) || packKg <= 0) {
    return invalidScreedResult("Zakinhoud moet groter dan 0 kg zijn.", consumption, packKg);
  }

  // De pack-ceil draait op de RUWE kg (zoals DATA); afronden vóór de ceil zou een fractie net
  // boven een zak-veelvoud wissen en zo één zak te weinig adviseren. kgNeeded wordt alleen voor
  // weergave afgerond.
  const kgNeededRaw = input.areaM2 * input.layerThicknessMm * consumption;
  const packsNeeded = Math.ceil(kgNeededRaw / packKg);
  const kgNeeded = roundToTwoDecimals(kgNeededRaw);

  return {
    kgNeeded,
    packsNeeded,
    consumptionKgPerM2PerMm: consumption,
    packKg,
    isIndicative: true
  };
}

function invalidScreedResult(
  validationError: string,
  consumption: number,
  packKg: number
): ScreedCalculationResult {
  return {
    kgNeeded: 0,
    packsNeeded: 0,
    consumptionKgPerM2PerMm: consumption,
    packKg,
    validationError,
    isIndicative: true
  };
}
