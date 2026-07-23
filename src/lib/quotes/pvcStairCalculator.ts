import type { StairConstruction, StairShape } from "../calculators/types";
import type { StairMaterialComponent, StairMaterialMetadata } from "./stairMaterialCatalog";

export const PVC_STAIR_RECIPE_KEY = "pvc_stair" as const;
export const PVC_STAIR_RECIPE_VERSION = 1 as const;

export const PVC_STAIR_SERVICE_CONFIG = {
  family: "stair_renovation",
  covering: "pvc",
  sectionKey: "traprenovatie",
  baseByShape: {
    straight: {
      sku: "HW-DIENST-016",
      metadata: {
        family: "stair_renovation",
        covering: "pvc",
        shape: "straight",
        role: "base_labor",
        sectionKey: "traprenovatie"
      }
    },
    quarter_turn: {
      sku: "HW-DIENST-015",
      metadata: {
        family: "stair_renovation",
        covering: "pvc",
        shape: "quarter_turn",
        role: "base_labor",
        sectionKey: "traprenovatie"
      }
    },
    half_turn: {
      sku: "HW-DIENST-014",
      metadata: {
        family: "stair_renovation",
        covering: "pvc",
        shape: "half_turn",
        role: "base_labor",
        sectionKey: "traprenovatie"
      }
    }
  },
  openSurcharge: {
    sku: "HW-DIENST-006",
    metadata: {
      family: "stair_renovation",
      covering: "pvc",
      role: "surcharge",
      sectionKey: "traprenovatie"
    }
  }
} as const;

export type PvcStairRecipeInput = {
  recipeKey: typeof PVC_STAIR_RECIPE_KEY;
  recipeVersion: typeof PVC_STAIR_RECIPE_VERSION;
  covering: "pvc";
  stairShape: StairShape;
  stairConstruction: StairConstruction;
  treadCount: number;
  riserCount?: number;
  doubleTreadCount?: number;
  stripLengthM?: number;
  materialCompatibilityConfirmed?: boolean;
};

export type PvcStairQuantityUnit = "m1" | "pack" | "piece" | "step";

export type PvcStairComponentQuantity = {
  componentRole: StairMaterialComponent;
  salesQuantity: number;
  salesUnit: PvcStairQuantityUnit;
  expectedOrderQuantity: number;
  orderUnit: PvcStairQuantityUnit;
  piecesPerPack?: number;
  lengthMPerUnit?: number;
};

export type PvcStairCalculation = {
  recipeKey: typeof PVC_STAIR_RECIPE_KEY;
  recipeVersion: typeof PVC_STAIR_RECIPE_VERSION;
  input: PvcStairRecipeInput;
  components: PvcStairComponentQuantity[];
};

export type PvcStairDomainErrorCode =
  | "invalid_input"
  | "unsupported_recipe"
  | "unsupported_recipe_version"
  | "unsupported_covering"
  | "invalid_stair_shape"
  | "invalid_stair_construction"
  | "invalid_tread_count"
  | "invalid_riser_count"
  | "invalid_double_tread_count"
  | "invalid_strip_length"
  | "invalid_material_compatibility_confirmation"
  | "missing_component_input"
  | "invalid_component_metadata";

export type PvcStairDomainError = {
  code: PvcStairDomainErrorCode;
  field?: string;
  componentRole?: StairMaterialComponent;
  message: string;
};

export type PvcStairDomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: PvcStairDomainError[] };

const STAIR_SHAPES = new Set<StairShape>(["straight", "quarter_turn", "half_turn"]);
const STAIR_CONSTRUCTIONS = new Set<StairConstruction>(["open", "closed"]);
const COMPONENT_ROLES = new Set<StairMaterialComponent>([
  "standard_tread",
  "riser",
  "double_tread",
  "profile_set",
  "profile_length",
  "tool",
  "sealant",
  "accessory"
]);
const QUANTITY_UNITS = new Set<PvcStairQuantityUnit>(["pack", "piece", "step"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function domainError(
  code: PvcStairDomainErrorCode,
  field: string,
  message: string,
  componentRole?: StairMaterialComponent
): PvcStairDomainError {
  return {
    code,
    field,
    ...(componentRole ? { componentRole } : {}),
    message
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validatePvcStairRecipeInput(
  input: unknown
): PvcStairDomainResult<PvcStairRecipeInput> {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [
        domainError(
          "invalid_input",
          "input",
          "PVC-trapinvoer moet een object met expliciete receptvelden zijn."
        )
      ]
    };
  }

  const errors: PvcStairDomainError[] = [];

  if (input.recipeKey !== PVC_STAIR_RECIPE_KEY) {
    errors.push(
      domainError(
        "unsupported_recipe",
        "recipeKey",
        `recipeKey moet exact "${PVC_STAIR_RECIPE_KEY}" zijn.`
      )
    );
  }

  if (input.recipeVersion !== PVC_STAIR_RECIPE_VERSION) {
    errors.push(
      domainError(
        "unsupported_recipe_version",
        "recipeVersion",
        `recipeVersion moet exact ${PVC_STAIR_RECIPE_VERSION} zijn.`
      )
    );
  }

  if (input.covering !== "pvc") {
    errors.push(
      domainError("unsupported_covering", "covering", 'Bekleding moet exact "pvc" zijn.')
    );
  }

  if (typeof input.stairShape !== "string" || !STAIR_SHAPES.has(input.stairShape as StairShape)) {
    errors.push(
      domainError(
        "invalid_stair_shape",
        "stairShape",
        "Trapvorm moet straight, quarter_turn of half_turn zijn."
      )
    );
  }

  if (
    typeof input.stairConstruction !== "string" ||
    !STAIR_CONSTRUCTIONS.has(input.stairConstruction as StairConstruction)
  ) {
    errors.push(
      domainError(
        "invalid_stair_construction",
        "stairConstruction",
        "Trapconstructie moet open of closed zijn."
      )
    );
  }

  if (!isPositiveInteger(input.treadCount)) {
    errors.push(
      domainError(
        "invalid_tread_count",
        "treadCount",
        "Aantal treden is verplicht en moet een positief heel getal zijn."
      )
    );
  }

  if (input.riserCount !== undefined && !isNonNegativeInteger(input.riserCount)) {
    errors.push(
      domainError(
        "invalid_riser_count",
        "riserCount",
        "Aantal stootborden moet een niet-negatief heel getal zijn."
      )
    );
  }

  if (input.doubleTreadCount !== undefined && !isNonNegativeInteger(input.doubleTreadCount)) {
    errors.push(
      domainError(
        "invalid_double_tread_count",
        "doubleTreadCount",
        "Aantal dubbele treden moet een niet-negatief heel getal zijn."
      )
    );
  }

  if (input.stripLengthM !== undefined && !isNonNegativeFiniteNumber(input.stripLengthM)) {
    errors.push(
      domainError(
        "invalid_strip_length",
        "stripLengthM",
        "Profiellengte moet een eindig, niet-negatief aantal meters zijn."
      )
    );
  }

  if (
    input.materialCompatibilityConfirmed !== undefined &&
    typeof input.materialCompatibilityConfirmed !== "boolean"
  ) {
    errors.push(
      domainError(
        "invalid_material_compatibility_confirmation",
        "materialCompatibilityConfirmed",
        "Materiaalcompatibiliteit moet expliciet true of false zijn."
      )
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      recipeKey: PVC_STAIR_RECIPE_KEY,
      recipeVersion: PVC_STAIR_RECIPE_VERSION,
      covering: "pvc",
      stairShape: input.stairShape as StairShape,
      stairConstruction: input.stairConstruction as StairConstruction,
      treadCount: input.treadCount as number,
      ...(input.riserCount !== undefined ? { riserCount: input.riserCount as number } : {}),
      ...(input.doubleTreadCount !== undefined
        ? { doubleTreadCount: input.doubleTreadCount as number }
        : {}),
      ...(input.stripLengthM !== undefined ? { stripLengthM: input.stripLengthM as number } : {}),
      ...(input.materialCompatibilityConfirmed !== undefined
        ? { materialCompatibilityConfirmed: input.materialCompatibilityConfirmed as boolean }
        : {})
    }
  };
}

function validateComponentMetadata(
  metadata: StairMaterialMetadata
): PvcStairDomainResult<StairMaterialMetadata> {
  if (!isRecord(metadata)) {
    return {
      ok: false,
      errors: [
        domainError(
          "invalid_component_metadata",
          "metadata",
          "Componentmetadata ontbreekt of is geen object."
        )
      ]
    };
  }

  const rawRole = metadata.componentRole;
  const componentRole =
    typeof rawRole === "string" && COMPONENT_ROLES.has(rawRole as StairMaterialComponent)
      ? (rawRole as StairMaterialComponent)
      : undefined;
  const errors: PvcStairDomainError[] = [];
  const addMetadataError = (field: string, message: string) => {
    errors.push(domainError("invalid_component_metadata", field, message, componentRole));
  };

  if (metadata.family !== "stair_renovation") {
    addMetadataError("family", 'Materiaalfamilie moet exact "stair_renovation" zijn.');
  }
  if (metadata.covering !== "pvc") {
    addMetadataError("covering", 'Materiaalbekleding moet exact "pvc" zijn.');
  }
  if (!componentRole) {
    addMetadataError("componentRole", "Componentrol ontbreekt of wordt niet ondersteund.");
  }
  if (typeof metadata.isPrimary !== "boolean") {
    addMetadataError("isPrimary", "isPrimary moet expliciet true of false zijn.");
  }
  if (!metadata.orderUnit || !QUANTITY_UNITS.has(metadata.orderUnit)) {
    addMetadataError("orderUnit", "Besteleenheid moet pack, piece of step zijn.");
  }
  if (metadata.piecesPerPack !== undefined && !isPositiveInteger(metadata.piecesPerPack)) {
    addMetadataError("piecesPerPack", "Stuks per pak moet een positief heel getal zijn.");
  }
  if (metadata.lengthMPerUnit !== undefined && !isPositiveFiniteNumber(metadata.lengthMPerUnit)) {
    addMetadataError("lengthMPerUnit", "Lengte per besteleenheid moet positief en eindig zijn.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: metadata };
}

function requirePackMetadata(
  metadata: StairMaterialMetadata
): PvcStairDomainResult<{ piecesPerPack: number }> {
  const errors: PvcStairDomainError[] = [];
  if (metadata.orderUnit !== "pack") {
    errors.push(
      domainError(
        "invalid_component_metadata",
        "orderUnit",
        `Component ${metadata.componentRole} moet per pak besteld worden.`,
        metadata.componentRole
      )
    );
  }
  if (!isPositiveInteger(metadata.piecesPerPack)) {
    errors.push(
      domainError(
        "invalid_component_metadata",
        "piecesPerPack",
        `Voor component ${metadata.componentRole} ontbreekt een geldig aantal stuks per pak.`,
        metadata.componentRole
      )
    );
  }
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: { piecesPerPack: metadata.piecesPerPack as number } };
}

function componentQuantity(
  metadata: StairMaterialMetadata,
  salesQuantity: number,
  salesUnit: PvcStairQuantityUnit,
  expectedOrderQuantity: number
): PvcStairDomainResult<PvcStairComponentQuantity> {
  return {
    ok: true,
    value: {
      componentRole: metadata.componentRole,
      salesQuantity,
      salesUnit,
      expectedOrderQuantity,
      orderUnit: metadata.orderUnit as PvcStairQuantityUnit,
      ...(metadata.piecesPerPack !== undefined ? { piecesPerPack: metadata.piecesPerPack } : {}),
      ...(metadata.lengthMPerUnit !== undefined ? { lengthMPerUnit: metadata.lengthMPerUnit } : {})
    }
  };
}

export function calculatePvcStairComponentQuantity(
  input: PvcStairRecipeInput,
  metadata: StairMaterialMetadata
): PvcStairDomainResult<PvcStairComponentQuantity> {
  const validatedInput = validatePvcStairRecipeInput(input);
  if (!validatedInput.ok) return validatedInput;

  const validatedMetadata = validateComponentMetadata(metadata);
  if (!validatedMetadata.ok) return validatedMetadata;

  const recipe = validatedInput.value;
  const component = validatedMetadata.value;
  const role = component.componentRole;

  if (role === "standard_tread") {
    if (component.orderUnit === "pack") {
      const pack = requirePackMetadata(component);
      if (!pack.ok) return pack;
      return componentQuantity(
        component,
        recipe.treadCount,
        "step",
        Math.ceil(recipe.treadCount / pack.value.piecesPerPack)
      );
    }
    return componentQuantity(component, recipe.treadCount, "step", recipe.treadCount);
  }

  if (role === "riser") {
    if (recipe.riserCount === undefined) {
      return {
        ok: false,
        errors: [
          domainError(
            "missing_component_input",
            "riserCount",
            "riserCount is verplicht om stootborden te berekenen.",
            role
          )
        ]
      };
    }
    const pack = requirePackMetadata(component);
    if (!pack.ok) return pack;
    const packCount = Math.ceil(recipe.riserCount / pack.value.piecesPerPack);
    return componentQuantity(component, packCount, "pack", packCount);
  }

  if (role === "double_tread") {
    if (recipe.doubleTreadCount === undefined) {
      return {
        ok: false,
        errors: [
          domainError(
            "missing_component_input",
            "doubleTreadCount",
            "doubleTreadCount is verplicht om dubbele treden te berekenen.",
            role
          )
        ]
      };
    }
    if (component.orderUnit === "pack") {
      const pack = requirePackMetadata(component);
      if (!pack.ok) return pack;
      return componentQuantity(
        component,
        recipe.doubleTreadCount,
        "pack",
        Math.ceil(recipe.doubleTreadCount / pack.value.piecesPerPack)
      );
    }
    return componentQuantity(
      component,
      recipe.doubleTreadCount,
      component.orderUnit as PvcStairQuantityUnit,
      recipe.doubleTreadCount
    );
  }

  if (role === "profile_set") {
    const pack = requirePackMetadata(component);
    if (!pack.ok) return pack;
    const packCount = Math.ceil(recipe.treadCount / pack.value.piecesPerPack);
    return componentQuantity(component, packCount, "pack", packCount);
  }

  if (role === "profile_length") {
    if (recipe.stripLengthM === undefined) {
      return {
        ok: false,
        errors: [
          domainError(
            "missing_component_input",
            "stripLengthM",
            "stripLengthM is verplicht om lengteprofielen te berekenen.",
            role
          )
        ]
      };
    }
    if (component.orderUnit !== "pack") {
      return {
        ok: false,
        errors: [
          domainError(
            "invalid_component_metadata",
            "orderUnit",
            "Lengteprofielen moeten per pak worden besteld.",
            role
          )
        ]
      };
    }
    if (!isPositiveFiniteNumber(component.lengthMPerUnit)) {
      return {
        ok: false,
        errors: [
          domainError(
            "invalid_component_metadata",
            "lengthMPerUnit",
            "Voor een lengteprofiel ontbreekt een geldige lengte per besteleenheid.",
            role
          )
        ]
      };
    }
    const packCount = Math.ceil(recipe.stripLengthM / component.lengthMPerUnit);
    return componentQuantity(component, recipe.stripLengthM, "m1", packCount);
  }

  return componentQuantity(component, 1, component.orderUnit as PvcStairQuantityUnit, 1);
}

export function calculatePvcStairRecipe(
  input: unknown,
  metadata: readonly StairMaterialMetadata[] = []
): PvcStairDomainResult<PvcStairCalculation> {
  const validatedInput = validatePvcStairRecipeInput(input);
  if (!validatedInput.ok) return validatedInput;

  if (!Array.isArray(metadata)) {
    return {
      ok: false,
      errors: [
        domainError(
          "invalid_component_metadata",
          "metadata",
          "Componentmetadata moet een lijst zijn."
        )
      ]
    };
  }

  const components: PvcStairComponentQuantity[] = [];
  const errors: PvcStairDomainError[] = [];

  for (const componentMetadata of metadata) {
    const result = calculatePvcStairComponentQuantity(validatedInput.value, componentMetadata);
    if (result.ok) {
      components.push(result.value);
    } else {
      errors.push(...result.errors);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      recipeKey: PVC_STAIR_RECIPE_KEY,
      recipeVersion: PVC_STAIR_RECIPE_VERSION,
      input: validatedInput.value,
      components
    }
  };
}
