import type { IndicativeCalculationResult, WasteInput } from "./types";
import { isValidNumber, roundToTwoDecimals } from "./number";

export type WallPanelCalculationInput = WasteInput & {
  wallWidthM: number;
  wallHeightM: number;
  panelWidthM: number;
  panelHeightM: number;
};

export type WallPanelCalculationResult = IndicativeCalculationResult & {
  wallAreaM2: number;
  panelAreaM2: number;
  /** Aantal panelen naast elkaar over de wandbreedte. */
  columns: number;
  /** Aantal panelen gestapeld over de wandhoogte (>1 als een paneel korter is dan de wand). */
  rows: number;
  panelsNeeded: number;
  wastePanels: number;
  totalPanels: number;
  quoteQuantityPieces: number;
};

/**
 * Wandpanelen: tel via STROKEN (breedte) × RIJEN (hoogte), niet via kale oppervlaktedeling.
 * Elk paneel dekt `panelWidthM` wandbreedte; overhoogte (paneel hoger dan de wand) mag de telling
 * niet verlagen, en een paneel korter dan de wand stapelt in meerdere rijen. Offcuts worden bewust
 * NIET hergebruikt over stroken/rijen heen (conservatief, geen onder-offerte).
 */
export function calculateWallPanels(
  input: WallPanelCalculationInput
): WallPanelCalculationResult {
  if (!isValidNumber(input.wallWidthM) || input.wallWidthM <= 0) {
    return invalidWallPanelResult("wallWidthM must be greater than 0.");
  }

  if (!isValidNumber(input.wallHeightM) || input.wallHeightM <= 0) {
    return invalidWallPanelResult("wallHeightM must be greater than 0.");
  }

  if (!isValidNumber(input.panelWidthM) || input.panelWidthM <= 0) {
    return invalidWallPanelResult("panelWidthM must be greater than 0.");
  }

  if (!isValidNumber(input.panelHeightM) || input.panelHeightM <= 0) {
    return invalidWallPanelResult("panelHeightM must be greater than 0.");
  }

  if (!isValidNumber(input.wastePercent) || input.wastePercent < 0) {
    return invalidWallPanelResult("wastePercent must be 0 or greater.");
  }

  const wallAreaM2 = roundToTwoDecimals(input.wallWidthM * input.wallHeightM);
  const panelAreaM2 = roundToTwoDecimals(input.panelWidthM * input.panelHeightM);
  const columns = Math.ceil(input.wallWidthM / input.panelWidthM);
  const rows = Math.ceil(input.wallHeightM / input.panelHeightM);
  const panelsNeeded = columns * rows;
  const totalPanels = Math.ceil(panelsNeeded * (1 + input.wastePercent / 100));

  return {
    wallAreaM2,
    panelAreaM2,
    columns,
    rows,
    panelsNeeded,
    wastePanels: Math.max(0, totalPanels - panelsNeeded),
    totalPanels,
    quoteQuantityPieces: totalPanels,
    isIndicative: true
  };
}

function invalidWallPanelResult(validationError: string): WallPanelCalculationResult {
  return {
    wallAreaM2: 0,
    panelAreaM2: 0,
    columns: 0,
    rows: 0,
    panelsNeeded: 0,
    wastePanels: 0,
    totalPanels: 0,
    quoteQuantityPieces: 0,
    validationError,
    isIndicative: true
  };
}

