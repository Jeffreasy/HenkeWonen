/**
 * Deterministische prijskeuzeregel voor de richtprijs bij inmeten.
 *
 * Pure logica zonder Convex-imports zodat dit direct unit-testbaar is.
 * Zie docs/technisch/plan-richtprijs-inmeting-2026-06-13.md §3 voor de onderbouwing.
 *
 * Kernprincipes:
 * - Alleen klantgerichte prijstypes (advice_retail/retail) komen in aanmerking;
 *   inkoop-, staffel- en pseudo-prijzen mogen NOOIT als richtprijs lekken.
 * - vatMode "unknown" levert nooit een prijs op — liever geen richtprijs dan een
 *   bedrag dat er 21% naast kan zitten.
 * - De prijseenheid moet matchen met de meeteenheid; de enige toegestane
 *   conversie is pak/verpakking → m² via packageContentM2.
 */

export type IndicativePriceRow = {
  id: string;
  priceType: string;
  priceUnit?: string;
  amount: number;
  vatRate: number;
  vatMode?: string;
  validFrom?: number;
  updatedAt: number;
  creationTime?: number;
};

export type IndicativePriceProduct = {
  packageContentM2?: number;
};

export type IndicativePriceSelection = {
  priceRowId: string;
  unitPriceExVat: number;
  unitPriceIncVat: number;
  vatRate: number;
  priceType: string;
  priceUnit?: string;
  vatModeUsed: "exclusive" | "inclusive";
  validFrom?: number;
  /** Gezet wanneer een pak-/verpakkingsprijs is omgerekend naar m². */
  conversionApplied?: "package_to_m2";
};

/** Prijstypes die klantzichtbaar mogen zijn. Bewust géén fallback naar andere types. */
const CUSTOMER_FACING_PRICE_TYPES = new Set(["advice_retail", "retail"]);

/** Meeteenheid → toegestane priceUnits (exacte match, geen aannames). */
const UNIT_COMPATIBILITY: Record<string, string[]> = {
  m2: ["m2"],
  m1: ["m1", "meter"],
  meter: ["m1", "meter"],
  roll: ["roll"],
  rol: ["roll"],
  piece: ["piece"],
  stuk: ["piece"],
  stuks: ["piece"],
  pack: ["pack", "package"],
  pak: ["pack", "package"],
  package: ["pack", "package"],
  // "step"/"trede" = hoeveelheid in treden; "stairs" (1 hele trap) bewust NIET
  // gemapt op trede-prijzen — dat zou 1 × prijs-per-trede rekenen.
  step: ["step"],
  trede: ["step"]
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Afgeleide eenheidsprijzen (incl→excl, pakconversie) op 4 decimalen houden:
 * het snapshot slaat alleen de ex-prijs op, dus de incl-prijs wordt later als
 * ex × (1 + btw) gereconstrueerd — met 2 decimalen zou dat een cent kunnen
 * verschuiven t.o.v. wat de buitendienst live zag.
 */
function roundUnitPrice(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function allowedPriceUnitsForMeasurementUnit(measurementUnit: string): string[] {
  const normalized = measurementUnit.trim().toLowerCase();

  return UNIT_COMPATIBILITY[normalized] ?? [];
}

/**
 * Is een prijssnapshot met deze priceUnit nog geldig voor de (nieuwe) meeteenheid?
 * Gebruikt door updateMeasurementLine om verouderde snapshots te laten vervallen
 * wanneer de eenheid van een meetregel wijzigt.
 */
export function isUnitCompatible(measurementUnit: string, priceUnit?: string) {
  const normalized = (priceUnit ?? "").trim().toLowerCase();

  return allowedPriceUnitsForMeasurementUnit(measurementUnit).includes(normalized);
}

function normalizeVat(
  row: IndicativePriceRow
): { unitPriceExVat: number; vatModeUsed: "exclusive" | "inclusive" } | null {
  const vatRate = row.vatRate ?? 21;

  if (row.vatMode === "exclusive") {
    return {
      unitPriceExVat: roundUnitPrice(row.amount),
      vatModeUsed: "exclusive"
    };
  }

  if (row.vatMode === "inclusive") {
    return {
      unitPriceExVat: roundUnitPrice(row.amount / (1 + vatRate / 100)),
      vatModeUsed: "inclusive"
    };
  }

  // "unknown" of ontbrekend: nooit een richtprijs op een onbesliste btw-modus baseren.
  return null;
}

/**
 * Kiest deterministisch één prijsregel als basis voor de richtprijs, of null.
 *
 * Tie-break bij meerdere kandidaten (komt voor, o.a. door dubbel geïmporteerde
 * prijslijsten): hoogste validFrom → nieuwste updatedAt → hoogste creationTime →
 * stabiele id-vergelijking.
 */
export function selectIndicativePrice(
  rows: IndicativePriceRow[],
  product: IndicativePriceProduct,
  measurementUnit: string,
  now: number
): IndicativePriceSelection | null {
  const allowedUnits = allowedPriceUnitsForMeasurementUnit(measurementUnit);
  const wantsM2 = allowedUnits.includes("m2");
  const candidates: Array<{ row: IndicativePriceRow; conversionApplied?: "package_to_m2" }> = [];

  for (const row of rows) {
    if (!CUSTOMER_FACING_PRICE_TYPES.has(row.priceType)) {
      continue;
    }

    if (!(row.amount > 0)) {
      continue;
    }

    if (row.validFrom !== undefined && row.validFrom > now) {
      continue;
    }

    // Onbesliste btw-modus is onbruikbaar; vroeg uitsluiten zodat zo'n regel
    // geen bruikbare kandidaat (bijv. een pak→m²-conversie) kan verdringen.
    if (row.vatMode !== "exclusive" && row.vatMode !== "inclusive") {
      continue;
    }

    const priceUnit = (row.priceUnit ?? "").trim().toLowerCase();

    if (allowedUnits.includes(priceUnit)) {
      candidates.push({ row });
      continue;
    }

    // Enige toegestane conversie: meeteenheid m² + pakprijs + bekende pakinhoud.
    if (
      wantsM2 &&
      (priceUnit === "pack" || priceUnit === "package") &&
      typeof product.packageContentM2 === "number" &&
      product.packageContentM2 > 0
    ) {
      candidates.push({ row, conversionApplied: "package_to_m2" });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Directe eenheid-matches winnen altijd van conversies.
  const directMatches = candidates.filter((candidate) => !candidate.conversionApplied);
  const pool = directMatches.length > 0 ? directMatches : candidates;

  pool.sort((left, right) => {
    const leftValidFrom = left.row.validFrom ?? 0;
    const rightValidFrom = right.row.validFrom ?? 0;

    if (leftValidFrom !== rightValidFrom) {
      return rightValidFrom - leftValidFrom;
    }

    if (left.row.updatedAt !== right.row.updatedAt) {
      return right.row.updatedAt - left.row.updatedAt;
    }

    const leftCreation = left.row.creationTime ?? 0;
    const rightCreation = right.row.creationTime ?? 0;

    if (leftCreation !== rightCreation) {
      return rightCreation - leftCreation;
    }

    return left.row.id < right.row.id ? 1 : left.row.id > right.row.id ? -1 : 0;
  });

  const chosen = pool[0];
  const normalized = normalizeVat(chosen.row);

  if (!normalized) {
    return null;
  }

  return buildSelection(chosen, normalized, product);
}

function buildSelection(
  candidate: { row: IndicativePriceRow; conversionApplied?: "package_to_m2" },
  normalized: { unitPriceExVat: number; vatModeUsed: "exclusive" | "inclusive" },
  product: IndicativePriceProduct
): IndicativePriceSelection {
  const vatRate = candidate.row.vatRate ?? 21;
  let unitPriceExVat = normalized.unitPriceExVat;

  if (candidate.conversionApplied === "package_to_m2" && product.packageContentM2) {
    unitPriceExVat = roundUnitPrice(unitPriceExVat / product.packageContentM2);
  }

  // Incl-prijs altijd afleiden uit de (opgeslagen) ex-prijs, zodat wat de
  // buitendienst live ziet exact gelijk is aan wat later uit het snapshot en
  // in de offerte wordt gereconstrueerd.
  const unitPriceIncVat = roundMoney(unitPriceExVat * (1 + vatRate / 100));

  return {
    priceRowId: candidate.row.id,
    unitPriceExVat,
    unitPriceIncVat,
    vatRate,
    priceType: candidate.row.priceType,
    priceUnit: candidate.conversionApplied === "package_to_m2" ? "m2" : candidate.row.priceUnit,
    vatModeUsed: normalized.vatModeUsed,
    validFrom: candidate.row.validFrom,
    conversionApplied: candidate.conversionApplied
  };
}
