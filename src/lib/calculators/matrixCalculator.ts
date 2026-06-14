import type { IndicativeCalculationResult } from "./types";
import { isValidNumber, roundToTwoDecimals } from "./number";

/**
 * Breedte×hoogte-matrix-lookup voor raambekleding. Rondt breedte én hoogte OMHOOG naar de
 * eerstvolgende maatklasse (standaard: je betaalt de volgende maat). `null` = buiten bereik.
 *
 * Pure port uit HenkeWonenDATA/convex/calculators.ts. `prijzen[hoogte-index][breedte-index]`;
 * assen in cm en oplopend gesorteerd.
 */
export function lookupMatrix(
  breedteAs: readonly number[],
  hoogteAs: readonly number[],
  prijzen: readonly (readonly number[])[],
  breedteCm: number,
  hoogteCm: number
): number | null {
  const wi = breedteAs.findIndex((w) => w >= breedteCm);
  const hi = hoogteAs.findIndex((h) => h >= hoogteCm);
  if (wi === -1 || hi === -1) return null;
  const rij = prijzen[hi];
  if (!rij || rij[wi] == null) return null;
  return rij[wi];
}

export type MatrixAxes = {
  breedteAs: readonly number[];
  hoogteAs: readonly number[];
  prijzen: readonly (readonly number[])[];
};

export type WindowCoveringMatrixInput = MatrixAxes & {
  breedteCm: number;
  hoogteCm: number;
  quantity?: number;
};

export type WindowCoveringMatrixResult = IndicativeCalculationResult & {
  /** true = aanvraag valt buiten de matrix → "offerte op maat" (geen richtprijs). */
  outOfRange: boolean;
  /** Maatklasse (cm) waarop omhoog is afgerond, of null bij buiten bereik/validatiefout. */
  matchedWidthCm: number | null;
  matchedHeightCm: number | null;
  /** Eenheidsprijs uit de matrix (zoals opgeslagen, doorgaans ex btw), of null. */
  unitPrice: number | null;
  quantity: number;
  /** unitPrice × quantity, afgerond op 2 decimalen, of null. */
  totalPrice: number | null;
};

/**
 * Hogere laag rond `lookupMatrix`: valideert input, multipliceert met aantal en signaleert
 * "offerte op maat" wanneer de maat buiten de matrix valt. Schema-onafhankelijk; de matrix-assen
 * komen van de `priceMatrices`-tabel.
 */
export function calculateWindowCoveringMatrix(
  input: WindowCoveringMatrixInput
): WindowCoveringMatrixResult {
  const quantity = input.quantity ?? 1;

  if (!isValidNumber(input.breedteCm) || input.breedteCm <= 0) {
    return invalidMatrixResult("breedteCm must be greater than 0.", quantity);
  }
  if (!isValidNumber(input.hoogteCm) || input.hoogteCm <= 0) {
    return invalidMatrixResult("hoogteCm must be greater than 0.", quantity);
  }
  if (!isValidNumber(quantity) || quantity <= 0) {
    return invalidMatrixResult("quantity must be greater than 0.", quantity);
  }
  if (input.breedteAs.length === 0 || input.hoogteAs.length === 0 || input.prijzen.length === 0) {
    return invalidMatrixResult("matrix must not be empty.", quantity);
  }

  const unitPrice = lookupMatrix(
    input.breedteAs,
    input.hoogteAs,
    input.prijzen,
    input.breedteCm,
    input.hoogteCm
  );

  if (unitPrice == null) {
    return {
      outOfRange: true,
      matchedWidthCm: null,
      matchedHeightCm: null,
      unitPrice: null,
      quantity,
      totalPrice: null,
      isIndicative: true
    };
  }

  const wi = input.breedteAs.findIndex((w) => w >= input.breedteCm);
  const hi = input.hoogteAs.findIndex((h) => h >= input.hoogteCm);

  return {
    outOfRange: false,
    matchedWidthCm: input.breedteAs[wi],
    matchedHeightCm: input.hoogteAs[hi],
    unitPrice,
    quantity,
    totalPrice: roundToTwoDecimals(unitPrice * quantity),
    isIndicative: true
  };
}

function invalidMatrixResult(
  validationError: string,
  quantity: number
): WindowCoveringMatrixResult {
  return {
    outOfRange: false,
    matchedWidthCm: null,
    matchedHeightCm: null,
    unitPrice: null,
    quantity,
    totalPrice: null,
    validationError,
    isIndicative: true
  };
}
