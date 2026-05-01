import type { IndicativeCalculationResult, PatternType, WasteInput } from "./types";
import { ceilToTwoDecimals, isValidNumber, roundToTwoDecimals } from "./number";

export type FlooringCalculationInput = WasteInput & {
  lengthM: number;
  widthM: number;
  patternType: PatternType;
};

export type FlooringCalculationResult = IndicativeCalculationResult & {
  areaM2: number;
  wasteM2: number;
  totalM2: number;
  quoteQuantityM2: number;
};

export function calculateFlooring(input: FlooringCalculationInput): FlooringCalculationResult {
  if (!isValidNumber(input.lengthM) || input.lengthM <= 0) {
    return invalidFlooringResult("lengthM must be greater than 0.");
  }

  if (!isValidNumber(input.widthM) || input.widthM <= 0) {
    return invalidFlooringResult("widthM must be greater than 0.");
  }

  if (!isValidNumber(input.wastePercent) || input.wastePercent < 0) {
    return invalidFlooringResult("wastePercent must be 0 or greater.");
  }

  const areaM2 = roundToTwoDecimals(input.lengthM * input.widthM);
  const wasteM2 = roundToTwoDecimals(areaM2 * (input.wastePercent / 100));
  const totalM2 = roundToTwoDecimals(areaM2 + wasteM2);

  return {
    areaM2,
    wasteM2,
    totalM2,
    quoteQuantityM2: ceilToTwoDecimals(totalM2),
    isIndicative: true
  };
}

function invalidFlooringResult(validationError: string): FlooringCalculationResult {
  return {
    areaM2: 0,
    wasteM2: 0,
    totalM2: 0,
    quoteQuantityM2: 0,
    validationError,
    isIndicative: true
  };
}

