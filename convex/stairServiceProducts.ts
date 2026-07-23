import type { Doc } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import { PVC_STAIR_SERVICE_CONFIG } from "../src/lib/quotes/pvcStairCalculator";

export const GUIDED_STAIR_SERVICE_FAMILY = PVC_STAIR_SERVICE_CONFIG.family;

export type StairServiceMetadata = {
  family: string;
  covering?: string;
  shape?: string;
  role: string;
  sectionKey: string;
};

const CONFIGURED_STAIR_SERVICES = [
  ...Object.values(PVC_STAIR_SERVICE_CONFIG.baseByShape),
  PVC_STAIR_SERVICE_CONFIG.openSurcharge
];

export const STAIR_SERVICE_METADATA_BY_SKU: Record<string, StairServiceMetadata> =
  Object.fromEntries(
    CONFIGURED_STAIR_SERVICES.map((service) => [service.sku, { ...service.metadata }])
  );

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function serviceMetadataRecord(product: Pick<Doc<"products">, "attributen">) {
  const attributes =
    product.attributen && typeof product.attributen === "object"
      ? (product.attributen as Record<string, unknown>)
      : undefined;
  return attributes?.serviceMetadata && typeof attributes.serviceMetadata === "object"
    ? (attributes.serviceMetadata as Record<string, unknown>)
    : undefined;
}

export function normalizedProductSku(product: Pick<Doc<"products">, "sku">): string | undefined {
  return nonEmptyText(product.sku)?.toUpperCase();
}

/**
 * Herkent de geleide PVC-trapdiensten aan structurele catalogusmetadata. Voor reeds
 * geimporteerde omgevingen zonder metadata blijft de stabiele V2-SKU een leesfallback.
 */
export function resolveStairServiceMetadata(
  product: Pick<Doc<"products">, "sku" | "attributen">
): StairServiceMetadata | undefined {
  const raw = serviceMetadataRecord(product);
  const sku = normalizedProductSku(product);
  const fallback = sku ? STAIR_SERVICE_METADATA_BY_SKU[sku] : undefined;
  const family = nonEmptyText(raw?.family) ?? fallback?.family;
  const role = nonEmptyText(raw?.role) ?? fallback?.role;
  const sectionKey =
    nonEmptyText(raw?.sectionKey) ?? nonEmptyText(raw?.section_key) ?? fallback?.sectionKey;

  if (!family || !role || !sectionKey) {
    return undefined;
  }

  const covering = nonEmptyText(raw?.covering) ?? fallback?.covering;
  const shape = nonEmptyText(raw?.shape) ?? fallback?.shape;
  return {
    family,
    ...(covering ? { covering } : {}),
    ...(shape ? { shape } : {}),
    role,
    sectionKey
  };
}

/**
 * Bewust ruimer dan resolveStairServiceMetadata: ook onvolledige maar expliciet als
 * stair_renovation gemarkeerde diensten mogen nooit via een generieke losse regel ontsnappen.
 */
export function isGuidedStairServiceProduct(
  product: Pick<Doc<"products">, "sku" | "attributen" | "productAard">
): boolean {
  if (product.productAard !== "service") return false;

  const sku = normalizedProductSku(product);
  if (sku && STAIR_SERVICE_METADATA_BY_SKU[sku]) return true;

  return nonEmptyText(serviceMetadataRecord(product)?.family) === GUIDED_STAIR_SERVICE_FAMILY;
}

export function assertGuidedStairServiceHasBundle(
  product: Pick<Doc<"products">, "sku" | "attributen" | "productAard">,
  isBundleMember: boolean
): void {
  if (isGuidedStairServiceProduct(product) && !isBundleMember) {
    throw new ConvexError(
      "Een PVC-trapdienst kan alleen als onderdeel van een volledige trapbundel worden toegevoegd of aangepast."
    );
  }
}
