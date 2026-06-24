/**
 * Ruimte-centrische afleiding van inmeetregels (Fase C — workflow product → ruimtes → maten).
 *
 * Kerngedachte: de ruimtematen worden één keer ingevoerd (oppervlakte uit l×b, omtrek
 * uit 2·(l+b)). Een product of dienst dat aan een ruimte wordt gekoppeld leidt zijn
 * hoeveelheid automatisch af uit die maten — je typt de maat dus niet per rekenmachine
 * opnieuw. Eén product kan zo in één keer op meerdere ruimtes worden toegepast.
 *
 * Dit is een pure module (geen Convex/React) zodat de reken-logica los testbaar is en
 * zowel client (live voorbeeld) als server (bulk-mutatie) dezelfde uitkomst geven.
 */
import type {
  MeasurementProductGroup,
  MeasurementCalculationType,
  QuoteLineType
} from "../portalTypes";
import type { PatternType } from "../calculators";
import { calculateBroadloom, calculatePlinths, calculateWallpaperRolls } from "../calculators";
import { PRODUCT_GROUP_TO_CATEGORIES } from "./measurementCatalogMapping";

/** Snijverlies-vuistregel van de klant (gelijk aan de vloer-rekenmachine): recht 3%, visgraat 5%. */
export const PATTERN_WASTE_PCT: Record<PatternType, number> = {
  straight: 3,
  herringbone: 5,
  tile: 5,
  custom: 7
};

const DEFAULT_BROADLOOM_ROLL_WIDTH_M = 4;
const DEFAULT_BROADLOOM_WASTE_PCT = 7;
const DEFAULT_WALLPAPER_ROLL_WIDTH_CM = 53;
const DEFAULT_WALLPAPER_ROLL_LENGTH_M = 10.05;

/** Hoe een gekoppeld item zijn hoeveelheid uit de ruimtematen haalt. */
export type AssignableCalculator =
  | "floor_area" // harde vloer (PVC click/dryback, tegel) → per m² uit oppervlakte
  | "floor_roll" // tapijt/vinyl op rol → lopende meter uit kamermaten
  | "underlay_area" // ondervloer → per m² uit oppervlakte
  | "plinth" // plint → per meter uit omtrek
  | "wallpaper" // behang → rollen uit omtrek × hoogte
  | "service_area" // dienst per m² (egaliseren, legkosten) → oppervlakte
  | "service_perimeter" // dienst per meter → omtrek
  | "manual"; // gordijnen/trap/maatwerk → handmatige hoeveelheid

/** Ruimtematen zoals opgeslagen op een measurementRoom (meters, m², m). */
export type RoomDimensions = {
  breedteM?: number;
  lengteM?: number;
  hoogteM?: number;
  oppervlakteM2?: number;
  omtrekM?: number;
};

/** Per-koppeling instelbare parameters (alle optioneel; vallen terug op nette defaults). */
export type AssignmentParams = {
  patternType?: PatternType;
  wastePercent?: number;
  rollWidthM?: number;
  rollWidthCm?: number;
  rollLengthM?: number;
  patternRepeatCm?: number;
  doorOpeningM?: number;
  manualQuantity?: number;
  manualUnit?: string;
};

/** Een afgeleide meetregel, klaar om als measurementLine te worden opgeslagen. */
export type DerivedLine = {
  productGroep: MeasurementProductGroup;
  berekeningType: MeasurementCalculationType;
  invoer: Record<string, unknown>;
  resultaat: Record<string, unknown>;
  snijverliesPct?: number;
  aantal: number;
  eenheid: string;
  offerteRegelType: QuoteLineType;
  validationError?: string;
};

const CATEGORY_TO_GROUP: Record<string, MeasurementProductGroup> = (() => {
  const map: Record<string, MeasurementProductGroup> = {};
  for (const [group, categories] of Object.entries(PRODUCT_GROUP_TO_CATEGORIES)) {
    for (const category of categories) {
      map[category.toLowerCase()] = group as MeasurementProductGroup;
    }
  }
  return map;
})();

/** Productsoorten die als rolgoed (lopende meter) worden gelegd i.p.v. per m². */
const ROLL_SOORTEN = new Set(["carpet", "vinyl"]);

/**
 * Leidt de rekenmachine af uit een gekozen catalogusproduct. Plint/behang/ondervloer
 * volgen uit de categorie; binnen "flooring" bepaalt de productsoort of het rolgoed
 * (tapijt/vinyl op rol) of een harde vloer per m² is.
 */
export function calculatorForProduct(input: {
  category?: string;
  productSoort?: string;
}): AssignableCalculator {
  const category = (input.category ?? "").toLowerCase();
  const group = CATEGORY_TO_GROUP[category];

  if (group === "plinths") return "plinth";
  if (group === "wallpaper") return "wallpaper";

  // Materialen die per m² liggen maar GEEN snijverlies-vloer zijn (ondervloer, lijm, egaline).
  // Zonder deze uitzondering zou bv. een lijm-/egaline-product als vloer-per-m² mét legpatroon-
  // snijverlies worden gerekend. (egaline/lijm gaan in Fase B uit de catalogus, maar blijven hier
  // robuust afgehandeld.)
  if (category === "ondervloer" || category === "egaline" || category === "lijm") {
    return "underlay_area";
  }

  // Karpetten zijn kant-en-klare stukken (per stuk), geen op-maat-gelegde vloer per m².
  if (category === "karpetten") {
    return "manual";
  }

  if (group === "flooring") {
    return input.productSoort && ROLL_SOORTEN.has(input.productSoort) ? "floor_roll" : "floor_area";
  }

  return "manual";
}

/** Leidt de rekenmachine af uit een dienst-/legkostregel (serviceCostRules.berekeningType). */
export function calculatorForService(berekeningType: string): AssignableCalculator {
  if (berekeningType === "per_m2") return "service_area";
  if (berekeningType === "per_meter") return "service_perimeter";
  return "manual";
}

/**
 * Reconstrueert de rekenmachine uit een al opgeslagen meetregel (voor herrekenen bij
 * maatwijziging). Retourneert null voor regels die niet automatisch te herrekenen zijn
 * (handmatig/maatwerk/onbekend) — die blijven ongemoeid.
 */
export function calculatorForLine(line: {
  productGroep: MeasurementProductGroup;
  berekeningType: MeasurementCalculationType;
  eenheid: string;
  offerteRegelType: QuoteLineType;
}): AssignableCalculator | null {
  if (line.productGroep === "plinths") return "plinth";
  if (line.productGroep === "wallpaper") return "wallpaper";

  if (line.productGroep === "flooring") {
    if (line.offerteRegelType === "material") return "underlay_area";
    return line.eenheid === "meter" ? "floor_roll" : "floor_area";
  }

  if (line.productGroep === "other") {
    if (line.offerteRegelType === "service" || line.offerteRegelType === "labor") {
      return line.berekeningType === "perimeter" ? "service_perimeter" : "service_area";
    }
  }

  return null;
}

/** Haalt de per-koppeling-parameters terug uit de opgeslagen `invoer` van een regel. */
export function paramsFromInvoer(invoer: Record<string, unknown>): AssignmentParams {
  const num = (value: unknown) => (typeof value === "number" ? value : undefined);
  const pattern = invoer.patternType;
  return {
    patternType:
      pattern === "straight" ||
      pattern === "herringbone" ||
      pattern === "tile" ||
      pattern === "custom"
        ? pattern
        : undefined,
    wastePercent: num(invoer.wastePercent),
    rollWidthM: num(invoer.rollWidthM),
    rollWidthCm: num(invoer.rollWidthCm),
    rollLengthM: num(invoer.rollLengthM),
    patternRepeatCm: num(invoer.patternRepeatCm),
    doorOpeningM: num(invoer.doorOpeningM)
  };
}

function effectiveArea(room: RoomDimensions): number | undefined {
  if (typeof room.oppervlakteM2 === "number" && room.oppervlakteM2 > 0) return room.oppervlakteM2;
  if (room.breedteM && room.lengteM) return round2(room.breedteM * room.lengteM);
  return undefined;
}

function effectivePerimeter(room: RoomDimensions): number | undefined {
  if (typeof room.omtrekM === "number" && room.omtrekM > 0) return room.omtrekM;
  if (room.breedteM && room.lengteM) return round2(2 * (room.breedteM + room.lengteM));
  return undefined;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function ceil2(value: number): number {
  return Math.ceil(value * 100) / 100;
}

function invalid(
  productGroep: MeasurementProductGroup,
  berekeningType: MeasurementCalculationType,
  eenheid: string,
  offerteRegelType: QuoteLineType,
  validationError: string
): DerivedLine {
  return {
    productGroep,
    berekeningType,
    invoer: {},
    resultaat: {},
    aantal: 0,
    eenheid,
    offerteRegelType,
    validationError
  };
}

/**
 * Leidt voor één ruimte de complete meetregel af op basis van de gekozen rekenmachine
 * en de ruimtematen. Ontbrekende maten leveren een validationError (geen exception) zodat
 * de UI per ruimte kan tonen wat er nog mist.
 */
export function deriveLineForRoom(
  calculator: AssignableCalculator,
  room: RoomDimensions,
  params: AssignmentParams = {}
): DerivedLine {
  switch (calculator) {
    case "floor_area": {
      const area = effectiveArea(room);
      if (area === undefined) {
        return invalid("flooring", "area", "m2", "product", "Ruimte mist oppervlakte (l × b).");
      }
      const patternType: PatternType = params.patternType ?? "straight";
      const wastePercent = params.wastePercent ?? PATTERN_WASTE_PCT[patternType];
      const wasteM2 = round2(area * (wastePercent / 100));
      const totalM2 = round2(area + wasteM2);
      const quoteQuantityM2 = ceil2(totalM2);
      return {
        productGroep: "flooring",
        berekeningType: "area",
        invoer: { areaM2: area, wastePercent, patternType },
        resultaat: { areaM2: area, wasteM2, totalM2, quoteQuantityM2, isIndicative: true },
        snijverliesPct: wastePercent,
        aantal: quoteQuantityM2,
        eenheid: "m2",
        offerteRegelType: "product"
      };
    }

    case "floor_roll": {
      if (!room.breedteM || !room.lengteM) {
        return invalid("flooring", "area", "meter", "product", "Ruimte mist breedte/lengte.");
      }
      const wastePercent = params.wastePercent ?? DEFAULT_BROADLOOM_WASTE_PCT;
      const rollWidthM = params.rollWidthM ?? DEFAULT_BROADLOOM_ROLL_WIDTH_M;
      const result = calculateBroadloom({
        roomWidthM: room.breedteM,
        roomLengthM: room.lengteM,
        rollWidthM,
        wastePercent
      });
      return {
        productGroep: "flooring",
        berekeningType: "area",
        invoer: {
          roomWidthM: room.breedteM,
          roomLengthM: room.lengteM,
          rollWidthM,
          wastePercent
        },
        resultaat: result as unknown as Record<string, unknown>,
        snijverliesPct: wastePercent,
        aantal: result.quoteQuantityM,
        eenheid: "meter",
        offerteRegelType: "product",
        validationError: result.validationError
      };
    }

    case "underlay_area": {
      const area = effectiveArea(room);
      if (area === undefined) {
        return invalid("flooring", "area", "m2", "material", "Ruimte mist oppervlakte (l × b).");
      }
      return {
        productGroep: "flooring",
        berekeningType: "area",
        invoer: { areaM2: area },
        resultaat: { areaM2: area, quoteQuantityM2: area, isIndicative: true },
        aantal: area,
        eenheid: "m2",
        offerteRegelType: "material"
      };
    }

    case "plinth": {
      const perimeter = effectivePerimeter(room);
      if (perimeter === undefined) {
        return invalid("plinths", "perimeter", "meter", "product", "Ruimte mist omtrek.");
      }
      const wastePercent = params.wastePercent ?? 5;
      const doorOpeningM = params.doorOpeningM ?? 0;
      const result = calculatePlinths({ perimeterM: perimeter, doorOpeningM, wastePercent });
      return {
        productGroep: "plinths",
        berekeningType: "perimeter",
        invoer: { perimeterM: perimeter, doorOpeningM, wastePercent },
        resultaat: result as unknown as Record<string, unknown>,
        snijverliesPct: wastePercent,
        aantal: result.quoteQuantityMeter,
        eenheid: "meter",
        offerteRegelType: "product",
        validationError: result.validationError
      };
    }

    case "wallpaper": {
      const perimeter = effectivePerimeter(room);
      if (perimeter === undefined || !room.hoogteM) {
        return invalid("wallpaper", "rolls", "roll", "product", "Ruimte mist omtrek of hoogte.");
      }
      const rollWidthCm = params.rollWidthCm ?? DEFAULT_WALLPAPER_ROLL_WIDTH_CM;
      const rollLengthM = params.rollLengthM ?? DEFAULT_WALLPAPER_ROLL_LENGTH_M;
      const patternRepeatCm = params.patternRepeatCm ?? 0;
      const result = calculateWallpaperRolls({
        wallWidthM: perimeter,
        wallHeightM: room.hoogteM,
        rollWidthCm,
        rollLengthM,
        patternRepeatCm,
        wastePercent: 0
      });
      return {
        productGroep: "wallpaper",
        berekeningType: "rolls",
        invoer: {
          wallWidthM: perimeter,
          wallHeightM: room.hoogteM,
          rollWidthCm,
          rollLengthM,
          patternRepeatCm
        },
        resultaat: result as unknown as Record<string, unknown>,
        aantal: result.rollsNeeded,
        eenheid: "roll",
        offerteRegelType: "product",
        validationError: result.validationError
      };
    }

    case "service_area": {
      const area = effectiveArea(room);
      if (area === undefined) {
        return invalid("other", "area", "m2", "service", "Ruimte mist oppervlakte (l × b).");
      }
      return {
        productGroep: "other",
        berekeningType: "area",
        invoer: { areaM2: area },
        resultaat: { areaM2: area, quoteQuantityM2: area, isIndicative: true },
        aantal: area,
        eenheid: "m2",
        offerteRegelType: "service"
      };
    }

    case "service_perimeter": {
      const perimeter = effectivePerimeter(room);
      if (perimeter === undefined) {
        return invalid("other", "perimeter", "m1", "service", "Ruimte mist omtrek.");
      }
      const doorOpeningM = params.doorOpeningM ?? 0;
      const netMeter = round2(Math.max(perimeter - doorOpeningM, 0));
      return {
        productGroep: "other",
        berekeningType: "perimeter",
        invoer: { perimeterM: perimeter, doorOpeningM },
        resultaat: { netMeter, quoteQuantityMeter: ceil2(netMeter), isIndicative: true },
        aantal: ceil2(netMeter),
        eenheid: "m1",
        offerteRegelType: "service"
      };
    }

    case "manual":
    default: {
      const aantal = params.manualQuantity ?? 0;
      return {
        productGroep: "other",
        berekeningType: "manual",
        invoer: { manualQuantity: aantal },
        resultaat: { quoteQuantity: aantal },
        aantal,
        eenheid: params.manualUnit ?? "stuk",
        offerteRegelType: "manual"
      };
    }
  }
}
