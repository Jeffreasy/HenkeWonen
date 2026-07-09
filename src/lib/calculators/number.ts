export function isValidNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function ceilToTwoDecimals(value: number): number {
  // Kleine negatieve epsilon NA de vermenigvuldiging: 17.85 * 100 is in floats
  // 1785.0000000000002 en zou zonder correctie op-afronden naar 17.86.
  // (Number.EPSILON optellen vóór de vermenigvuldiging vangt dat niet af.)
  return Math.ceil(value * 100 - 1e-7) / 100;
}

export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

