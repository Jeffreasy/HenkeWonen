export function isValidNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function ceilToTwoDecimals(value: number): number {
  return Math.ceil((value + Number.EPSILON) * 100) / 100;
}

export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

