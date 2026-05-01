import type { IndicativeCalculationResult, WasteInput } from "./types";
import { ceilToTwoDecimals, isValidNumber, roundToTwoDecimals } from "./number";

export type PlinthCalculationInput = WasteInput & {
  perimeterM: number;
  doorOpeningM: number;
};

export type PlinthCalculationResult = IndicativeCalculationResult & {
  netMeter: number;
  wasteMeter: number;
  totalMeter: number;
  quoteQuantityMeter: number;
};

export function calculatePlinths(input: PlinthCalculationInput): PlinthCalculationResult {
  if (!isValidNumber(input.perimeterM) || input.perimeterM <= 0) {
    return invalidPlinthResult("perimeterM must be greater than 0.");
  }

  if (!isValidNumber(input.doorOpeningM) || input.doorOpeningM < 0) {
    return invalidPlinthResult("doorOpeningM must be 0 or greater.");
  }

  if (!isValidNumber(input.wastePercent) || input.wastePercent < 0) {
    return invalidPlinthResult("wastePercent must be 0 or greater.");
  }

  const netMeter = roundToTwoDecimals(Math.max(input.perimeterM - input.doorOpeningM, 0));
  const wasteMeter = roundToTwoDecimals(netMeter * (input.wastePercent / 100));
  const totalMeter = roundToTwoDecimals(netMeter + wasteMeter);

  return {
    netMeter,
    wasteMeter,
    totalMeter,
    quoteQuantityMeter: ceilToTwoDecimals(totalMeter),
    validationError:
      input.doorOpeningM > input.perimeterM
        ? "doorOpeningM is greater than perimeterM; netMeter was clamped to 0."
        : undefined,
    isIndicative: true
  };
}

function invalidPlinthResult(validationError: string): PlinthCalculationResult {
  return {
    netMeter: 0,
    wasteMeter: 0,
    totalMeter: 0,
    quoteQuantityMeter: 0,
    validationError,
    isIndicative: true
  };
}

