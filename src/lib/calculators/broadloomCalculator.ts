import type { IndicativeCalculationResult, WasteInput } from "./types";
import { ceilToTwoDecimals, isValidNumber, roundToTwoDecimals } from "./number";

export type BroadloomCalculationInput = WasteInput & {
  roomWidthM: number;
  roomLengthM: number;
  rollWidthM: number;
};

export type BroadloomCalculationResult = IndicativeCalculationResult & {
  /** Aantal banen in de zuinigste legrichting. */
  strips: number;
  /** Lopende meters van de rol (zuinigste legrichting), inclusief snijverlies. */
  runningMeterM: number;
  areaM2: number;
  /** Te offreren/bestellen hoeveelheid in lopende meters (afgerond omhoog). */
  quoteQuantityM: number;
};

/**
 * Tapijt/vinyl op rol (broadloom): bepaalt de lopende meters van de rol bij de zuinigste
 * legrichting. Variant A = banen langs de lengte (rol dekt de breedte); B = andersom.
 * Pure port uit HenkeWonenDATA/convex/calculators.ts (`runningMeters`), in meters i.p.v. cm en
 * met snijverlies als heel-getal-percentage, conform de bestaande calculator-laag.
 */
export function calculateBroadloom(input: BroadloomCalculationInput): BroadloomCalculationResult {
  if (!isValidNumber(input.roomWidthM) || input.roomWidthM <= 0) {
    return invalidBroadloomResult("Kamerbreedte moet groter dan 0 zijn.");
  }
  if (!isValidNumber(input.roomLengthM) || input.roomLengthM <= 0) {
    return invalidBroadloomResult("Kamerlengte moet groter dan 0 zijn.");
  }
  if (!isValidNumber(input.rollWidthM) || input.rollWidthM <= 0) {
    return invalidBroadloomResult("Rolbreedte moet groter dan 0 zijn.");
  }
  if (!isValidNumber(input.wastePercent) || input.wastePercent < 0) {
    return invalidBroadloomResult("Snijverlies mag niet negatief zijn.");
  }

  const stripsA = Math.ceil(input.roomWidthM / input.rollWidthM);
  const metersA = stripsA * input.roomLengthM;
  const stripsB = Math.ceil(input.roomLengthM / input.rollWidthM);
  const metersB = stripsB * input.roomWidthM;
  const { strips, runM } =
    metersA <= metersB ? { strips: stripsA, runM: metersA } : { strips: stripsB, runM: metersB };

  const runningMeterM = roundToTwoDecimals(runM * (1 + input.wastePercent / 100));
  const areaM2 = roundToTwoDecimals(input.roomWidthM * input.roomLengthM);

  return {
    strips,
    runningMeterM,
    areaM2,
    quoteQuantityM: ceilToTwoDecimals(runningMeterM),
    isIndicative: true
  };
}

function invalidBroadloomResult(validationError: string): BroadloomCalculationResult {
  return {
    strips: 0,
    runningMeterM: 0,
    areaM2: 0,
    quoteQuantityM: 0,
    validationError,
    isIndicative: true
  };
}
