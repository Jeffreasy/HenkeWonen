import type {
  IndicativeCalculationResult,
  StairConstruction,
  StairShape,
  StairType
} from "./types";
import { roundToTwoDecimals } from "./number";
import {
  PVC_STAIR_RECIPE_KEY,
  PVC_STAIR_RECIPE_VERSION,
  validatePvcStairRecipeInput
} from "../quotes/pvcStairCalculator";

export type StairCalculationInput = {
  stairShape?: StairShape;
  stairConstruction?: StairConstruction;
  stairType?: StairType;
  treadCount: number;
  riserCount: number;
  stripLengthM?: number;
};

export type StairCalculationResult = IndicativeCalculationResult & {
  stairShape: StairShape;
  stairConstruction: StairConstruction;
  treadCount: number;
  riserCount: number;
  quoteQuantity: number;
  unit: "stairs";
  notes: string[];
};

export function calculateStairs(input: StairCalculationInput): StairCalculationResult {
  const selection = normalizeStairSelection(input);
  const validation = validatePvcStairRecipeInput({
    recipeKey: PVC_STAIR_RECIPE_KEY,
    recipeVersion: PVC_STAIR_RECIPE_VERSION,
    covering: "pvc",
    stairShape: selection.stairShape,
    stairConstruction: selection.stairConstruction,
    treadCount: input.treadCount,
    riserCount: input.riserCount,
    ...(input.stripLengthM !== undefined ? { stripLengthM: input.stripLengthM } : {})
  });
  if (!validation.ok) {
    return invalidStairResult(validation.errors.map((error) => error.message).join(" "));
  }
  const { stairShape, stairConstruction } = validation.value;
  const notes = [
    `stairShape:${stairShape}`,
    `stairConstruction:${stairConstruction}`,
    `treadCount:${input.treadCount}`,
    `riserCount:${input.riserCount}`
  ];

  if (stairConstruction === "open") {
    notes.push("open staircase");
  }

  if (stairConstruction === "closed") {
    notes.push("closed staircase");
  }

  if (input.stripLengthM !== undefined) {
    notes.push(`stripLengthM:${roundToTwoDecimals(input.stripLengthM)}`);
  }

  return {
    stairShape,
    stairConstruction,
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
    stairShape: "straight",
    stairConstruction: "closed",
    treadCount: 0,
    riserCount: 0,
    quoteQuantity: 0,
    unit: "stairs",
    notes: [],
    validationError,
    isIndicative: true
  };
}

function normalizeStairSelection(input: StairCalculationInput): {
  stairShape: StairShape;
  stairConstruction: StairConstruction;
} {
  let stairShape = input.stairShape;
  let stairConstruction = input.stairConstruction;

  if (
    input.stairType === "straight" ||
    input.stairType === "quarter_turn" ||
    input.stairType === "half_turn"
  ) {
    stairShape ??= input.stairType;
  }

  if (input.stairType === "open" || input.stairType === "closed") {
    stairConstruction ??= input.stairType;
  }

  return {
    stairShape: stairShape ?? "straight",
    stairConstruction: stairConstruction ?? "closed"
  };
}
