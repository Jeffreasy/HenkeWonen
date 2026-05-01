export type WallpaperCalculationInput = {
  wallWidthM: number;
  wallHeightM: number;
  rollWidthCm?: number;
  rollLengthM?: number;
  patternRepeatCm?: number;
  wastePercent?: number;
};

export type WallpaperCalculationResult = {
  banenNeeded: number;
  baanLengteM: number;
  banenPerRol: number;
  baseRollsNeeded: number;
  rollsNeeded: number;
  wasteExtraRolls: number;
  validationError?: string;
  isIndicative: true;
};

const DEFAULT_ROLL_WIDTH_CM = 53;
const DEFAULT_ROLL_LENGTH_M = 10.05;
const DEFAULT_PATTERN_REPEAT_CM = 0;
const DEFAULT_WASTE_PERCENT = 10;

function toPositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function calculateWallpaperRolls(
  input: WallpaperCalculationInput
): WallpaperCalculationResult {
  const wallWidthM = toPositiveNumber(input.wallWidthM, 0);
  const wallHeightM = toPositiveNumber(input.wallHeightM, 0);
  const rollWidthCm = toPositiveNumber(input.rollWidthCm, DEFAULT_ROLL_WIDTH_CM);
  const rollLengthM = toPositiveNumber(input.rollLengthM, DEFAULT_ROLL_LENGTH_M);
  const patternRepeatCm = Math.max(
    0,
    toPositiveNumber(input.patternRepeatCm, DEFAULT_PATTERN_REPEAT_CM)
  );
  const wastePercent = Math.max(0, toPositiveNumber(input.wastePercent, DEFAULT_WASTE_PERCENT));

  if (wallWidthM <= 0 || wallHeightM <= 0 || rollWidthCm <= 0 || rollLengthM <= 0) {
    return {
      banenNeeded: 0,
      baanLengteM: 0,
      banenPerRol: 0,
      baseRollsNeeded: 0,
      rollsNeeded: 0,
      wasteExtraRolls: 0,
      validationError: "Vul geldige wand- en rolmaten in.",
      isIndicative: true
    };
  }

  const banenNeeded = Math.ceil((wallWidthM * 100) / rollWidthCm);
  const baanLengteM = wallHeightM + patternRepeatCm / 100;
  const banenPerRol = Math.floor(rollLengthM / baanLengteM);

  if (banenPerRol < 1) {
    return {
      banenNeeded,
      baanLengteM,
      banenPerRol,
      baseRollsNeeded: 0,
      rollsNeeded: 0,
      wasteExtraRolls: 0,
      validationError: "De baanlengte is langer dan de rollengte; controleer hoogte of patroonrapport.",
      isIndicative: true
    };
  }

  const baseRollsNeeded = Math.max(1, Math.ceil(banenNeeded / banenPerRol));
  const rollsWithWaste = Math.ceil(baseRollsNeeded * (1 + wastePercent / 100));
  const rollsNeeded = Math.max(1, rollsWithWaste);

  return {
    banenNeeded,
    baanLengteM,
    banenPerRol,
    baseRollsNeeded,
    rollsNeeded,
    wasteExtraRolls: Math.max(0, rollsNeeded - baseRollsNeeded),
    isIndicative: true
  };
}

