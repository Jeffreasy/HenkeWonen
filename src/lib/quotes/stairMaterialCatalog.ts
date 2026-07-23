export type StairMaterialComponent =
  | "standard_tread"
  | "riser"
  | "double_tread"
  | "profile_set"
  | "profile_length"
  | "tool"
  | "sealant"
  | "accessory";

export type StairMaterialMetadata = {
  family: "stair_renovation";
  covering: "pvc";
  componentRole: StairMaterialComponent;
  isPrimary: boolean;
  piecesPerPack?: number;
  lengthMPerUnit?: number;
  orderUnit?: "pack" | "piece" | "step";
};

type StairMaterialSource = {
  family?: unknown;
  covering?: unknown;
  componentRole?: unknown;
  component_role?: unknown;
  isPrimary?: unknown;
  is_primary?: unknown;
  piecesPerPack?: unknown;
  pieces_per_pack?: unknown;
  orderUnit?: unknown;
  order_unit?: unknown;
  lengthMPerUnit?: unknown;
  length_m_per_unit?: unknown;
  lengthM?: unknown;
  length_m?: unknown;
};

type StairMaterialProduct = {
  sku?: string;
  attributen?: Record<string, unknown>;
};

const COMPONENTS = new Set<StairMaterialComponent>([
  "standard_tread",
  "riser",
  "double_tread",
  "profile_set",
  "profile_length",
  "tool",
  "sealant",
  "accessory"
]);

const ORDER_UNITS = new Set(["pack", "piece", "step"]);

const SKU_FALLBACKS: Array<{
  prefixes: string[];
  metadata: StairMaterialMetadata;
}> = [
  {
    prefixes: ["563538", "563716", "563818", "563941"],
    metadata: {
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "standard_tread",
      isPrimary: true,
      piecesPerPack: 4,
      orderUnit: "pack"
    }
  },
  {
    prefixes: ["563690"],
    metadata: {
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "riser",
      isPrimary: false,
      piecesPerPack: 16,
      orderUnit: "pack"
    }
  },
  {
    prefixes: ["564652", "564545"],
    metadata: {
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "double_tread",
      isPrimary: false,
      piecesPerPack: 1,
      orderUnit: "pack"
    }
  },
  {
    prefixes: ["560614"],
    metadata: {
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "profile_set",
      isPrimary: false,
      piecesPerPack: 4,
      orderUnit: "pack"
    }
  },
  {
    prefixes: ["560714"],
    metadata: {
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "profile_length",
      isPrimary: false,
      piecesPerPack: 1,
      lengthMPerUnit: 3,
      orderUnit: "pack"
    }
  },
  {
    prefixes: ["486700"],
    metadata: {
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "tool",
      isPrimary: false,
      piecesPerPack: 1,
      orderUnit: "pack"
    }
  },
  {
    prefixes: ["488390"],
    metadata: {
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "sealant",
      isPrimary: false,
      piecesPerPack: 12,
      orderUnit: "pack"
    }
  }
];

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function fallbackForSku(sku?: string): StairMaterialMetadata | undefined {
  const normalized = sku?.trim().toUpperCase();
  if (!normalized) return undefined;
  return SKU_FALLBACKS.find((entry) =>
    entry.prefixes.some((prefix) => normalized.startsWith(prefix))
  )?.metadata;
}

export function resolveStairMaterialMetadata(
  product: StairMaterialProduct,
  explicitSource?: StairMaterialSource
): StairMaterialMetadata | undefined {
  const attributes = product.attributen;
  const stored =
    attributes?.stairMaterialMetadata && typeof attributes.stairMaterialMetadata === "object"
      ? (attributes.stairMaterialMetadata as StairMaterialSource)
      : undefined;
  const source = explicitSource ?? stored;
  const fallback = fallbackForSku(product.sku);
  const family = nonEmptyText(source?.family) ?? fallback?.family;
  const covering = nonEmptyText(source?.covering) ?? fallback?.covering;
  const component =
    nonEmptyText(source?.componentRole) ??
    nonEmptyText(source?.component_role) ??
    fallback?.componentRole;

  if (
    family !== "stair_renovation" ||
    covering !== "pvc" ||
    !component ||
    !COMPONENTS.has(component as StairMaterialComponent)
  ) {
    return undefined;
  }

  const componentRole = component as StairMaterialComponent;
  const fallbackMatchesComponent = fallback?.componentRole === componentRole;
  const lengthMPerUnit =
    positiveNumber(
      source?.lengthMPerUnit ?? source?.length_m_per_unit ?? source?.lengthM ?? source?.length_m
    ) ?? (fallbackMatchesComponent ? fallback?.lengthMPerUnit : undefined);
  const rawPrimary = source?.isPrimary ?? source?.is_primary;
  const piecesPerPack =
    positiveInteger(source?.piecesPerPack ?? source?.pieces_per_pack) ??
    (fallbackMatchesComponent ? fallback?.piecesPerPack : undefined);
  const rawOrderUnit =
    nonEmptyText(source?.orderUnit) ??
    nonEmptyText(source?.order_unit) ??
    (fallbackMatchesComponent ? fallback?.orderUnit : undefined);
  const isPrimary =
    componentRole === "standard_tread" &&
    (typeof rawPrimary === "boolean"
      ? rawPrimary
      : (fallbackMatchesComponent && fallback?.isPrimary) || false);

  return {
    family: "stair_renovation",
    covering: "pvc",
    componentRole,
    isPrimary,
    ...(piecesPerPack ? { piecesPerPack } : {}),
    ...(lengthMPerUnit ? { lengthMPerUnit } : {}),
    ...(rawOrderUnit && ORDER_UNITS.has(rawOrderUnit)
      ? { orderUnit: rawOrderUnit as "pack" | "piece" | "step" }
      : {})
  };
}

export function isPrimaryPvcStairMaterial(product: StairMaterialProduct): boolean {
  return resolveStairMaterialMetadata(product)?.isPrimary === true;
}
