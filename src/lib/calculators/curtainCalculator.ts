import type { IndicativeCalculationResult } from "./types";
import { ceilToTwoDecimals, isValidNumber, roundToTwoDecimals } from "./number";

export type CurtainMakeUp = "banen" | "kamerhoog";

export type CurtainFabricCalculationInput = {
  railWidthM: number;
  curtainHeightM: number;
  fabricWidthM: number;
  /** Plooifactor (bedrijfsregel, bv. 2.0). */
  fullness: number;
  makeUp: CurtainMakeUp;
  /** Patroonrapport in meter (0 = geen rapport). */
  rapportM?: number;
  /** Zoom boven + onder per baan, in meter (placeholder-bedrijfsregel, default 0.30). */
  hemM?: number;
  /** Zijzoom in meter; vermindert de bruikbare stofbreedte (default 0.06). */
  sideHemM?: number;
};

export type CurtainFabricCalculationResult = IndicativeCalculationResult & {
  makeUp: CurtainMakeUp;
  /** Benodigde gordijnbreedte = railbreedte × plooifactor. */
  requiredWidthM: number;
  /** Aantal banen (null bij kamerhoog: stof wordt gekanteld verwerkt). */
  banen: number | null;
  /** Benodigde baanlengte incl. zoom en rapport-afronding (null bij kamerhoog). */
  dropM: number | null;
  /** Benodigde lopende meters stof. */
  fabricMetersM: number;
  /** Te offreren/bestellen hoeveelheid stof in lopende meters (afgerond omhoog). */
  quoteQuantityM: number;
};

const DEFAULT_HEM_M = 0.3;
const DEFAULT_SIDE_HEM_M = 0.06;

/**
 * Gordijnstof-berekening: aantal banen + baanlengte (met rapport-afronding omhoog) of, bij
 * kamerhoge confectie, de gekantelde lopende meters. Pure port uit
 * HenkeWonenDATA/convex/calculators.ts (`curtain_fabric`), in meters i.p.v. cm.
 * De hem/plooi-defaults zijn placeholder-bedrijfsregels (bevestigen met Wim/Simone).
 */
export function calculateCurtainFabric(
  input: CurtainFabricCalculationInput
): CurtainFabricCalculationResult {
  const hemM = input.hemM ?? DEFAULT_HEM_M;
  const sideHemM = input.sideHemM ?? DEFAULT_SIDE_HEM_M;
  const rapportM = input.rapportM ?? 0;

  if (!isValidNumber(input.railWidthM) || input.railWidthM <= 0) {
    return invalidCurtainResult(input.makeUp, "railWidthM must be greater than 0.");
  }
  if (!isValidNumber(input.curtainHeightM) || input.curtainHeightM <= 0) {
    return invalidCurtainResult(input.makeUp, "curtainHeightM must be greater than 0.");
  }
  if (!isValidNumber(input.fabricWidthM) || input.fabricWidthM <= 0) {
    return invalidCurtainResult(input.makeUp, "fabricWidthM must be greater than 0.");
  }
  if (!isValidNumber(input.fullness) || input.fullness <= 0) {
    return invalidCurtainResult(input.makeUp, "fullness must be greater than 0.");
  }
  if (!isValidNumber(hemM) || hemM < 0 || !isValidNumber(sideHemM) || sideHemM < 0) {
    return invalidCurtainResult(input.makeUp, "hemM and sideHemM must be 0 or greater.");
  }
  if (!isValidNumber(rapportM) || rapportM < 0) {
    return invalidCurtainResult(input.makeUp, "rapportM must be 0 or greater.");
  }

  const requiredWidthM = roundToTwoDecimals(input.railWidthM * input.fullness);

  if (input.makeUp === "kamerhoog") {
    // Stof gekanteld (breedte = gordijnhoogte): lopende meters = benodigde breedte.
    const fabricMetersM = roundToTwoDecimals(input.railWidthM * input.fullness);
    return {
      makeUp: "kamerhoog",
      requiredWidthM,
      banen: null,
      dropM: null,
      fabricMetersM,
      quoteQuantityM: ceilToTwoDecimals(fabricMetersM),
      isIndicative: true
    };
  }

  const useableWidthM = Math.max(0.01, input.fabricWidthM - sideHemM);
  const banen = Math.ceil((input.railWidthM * input.fullness) / useableWidthM);
  let drop = input.curtainHeightM + hemM;
  if (rapportM > 0) {
    drop = Math.ceil(drop / rapportM) * rapportM; // rapport-afronding omhoog
  }
  const fabricMetersM = roundToTwoDecimals(banen * drop);

  return {
    makeUp: "banen",
    requiredWidthM,
    banen,
    dropM: roundToTwoDecimals(drop),
    fabricMetersM,
    quoteQuantityM: ceilToTwoDecimals(fabricMetersM),
    isIndicative: true
  };
}

function invalidCurtainResult(
  makeUp: CurtainMakeUp,
  validationError: string
): CurtainFabricCalculationResult {
  return {
    makeUp,
    requiredWidthM: 0,
    banen: null,
    dropM: null,
    fabricMetersM: 0,
    quoteQuantityM: 0,
    validationError,
    isIndicative: true
  };
}
