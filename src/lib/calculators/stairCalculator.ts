import type { IndicativeCalculationResult, StairType } from "./types";
import { isValidNumber, roundToTwoDecimals } from "./number";

export type StairCalculationInput = {
  stairType: StairType;
  treadCount: number;
  riserCount: number;
  stripLengthM?: number;
};

export type StairCalculationResult = IndicativeCalculationResult & {
  treadCount: number;
  riserCount: number;
  quoteQuantity: number;
  unit: "stairs";
  notes: string[];
};

export function calculateStairs(input: StairCalculationInput): StairCalculationResult {
  if (!isValidNumber(input.treadCount) || input.treadCount <= 0) {
    return invalidStairResult("Vul minimaal 1 trede in.");
  }

  if (!isValidNumber(input.riserCount) || input.riserCount < 0) {
    return invalidStairResult("Aantal stootborden mag niet negatief zijn.");
  }

  if (
    input.stripLengthM !== undefined &&
    (!isValidNumber(input.stripLengthM) || input.stripLengthM < 0)
  ) {
    return invalidStairResult("Strooklengte mag niet negatief zijn.");
  }

  const notes = [
    `stairType:${input.stairType}`,
    `treadCount:${input.treadCount}`,
    `riserCount:${input.riserCount}`
  ];

  if (input.stairType === "open") {
    notes.push("open staircase");
  }

  if (input.stairType === "closed") {
    notes.push("closed staircase");
  }

  if (input.stripLengthM !== undefined) {
    notes.push(`stripLengthM:${roundToTwoDecimals(input.stripLengthM)}`);
  }

  return {
    treadCount: input.treadCount,
    riserCount: input.riserCount,
    quoteQuantity: 1,
    unit: "stairs",
    notes,
    isIndicative: true
  };
}

function invalidStairResult(validationError: string): StairCalculationResult {
  return {
    treadCount: 0,
    riserCount: 0,
    quoteQuantity: 0,
    unit: "stairs",
    notes: [],
    validationError,
    isIndicative: true
  };
}

