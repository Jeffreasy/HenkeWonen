import type { StairConstruction, StairShape } from "../calculators";
import { PVC_STAIR_SERVICE_CONFIG } from "./pvcStairCalculator";

export type StairCovering = typeof PVC_STAIR_SERVICE_CONFIG.covering;

export type PvcStairQuoteBundleInput = {
  covering: string;
  stairShape: string;
  stairConstruction: string;
};

export type StairBundleRole = "labor" | "surcharge";
export type StairBundleErrorCode =
  | "unsupported_covering"
  | "invalid_stair_shape"
  | "invalid_stair_construction";

export type PvcStairQuoteBundle = {
  selection: {
    covering: StairCovering;
    stairShape: StairShape;
    stairConstruction: StairConstruction;
  };
  bundleType: typeof PVC_STAIR_SERVICE_CONFIG.family;
  sectionKey: typeof PVC_STAIR_SERVICE_CONFIG.sectionKey;
  baseServiceSku: string;
  surchargeServiceSkus: string[];
  serviceSkus: string[];
  services: Array<{
    sku: string;
    bundleRole: StairBundleRole;
  }>;
};

export type PvcStairQuoteBundleResult =
  | { ok: true; value: PvcStairQuoteBundle }
  | { ok: false; errors: StairBundleErrorCode[] };

const STAIR_SHAPES = new Set<string>(Object.keys(PVC_STAIR_SERVICE_CONFIG.baseByShape));
const STAIR_CONSTRUCTIONS: string[] = ["open", "closed"];

export function buildPvcStairQuoteBundle(
  input: PvcStairQuoteBundleInput
): PvcStairQuoteBundleResult {
  const errors: StairBundleErrorCode[] = [];

  if (input.covering !== PVC_STAIR_SERVICE_CONFIG.covering) {
    errors.push("unsupported_covering");
  }
  if (!STAIR_SHAPES.has(input.stairShape)) {
    errors.push("invalid_stair_shape");
  }
  if (!STAIR_CONSTRUCTIONS.includes(input.stairConstruction)) {
    errors.push("invalid_stair_construction");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const stairShape = input.stairShape as StairShape;
  const stairConstruction = input.stairConstruction as StairConstruction;
  const baseServiceSku = PVC_STAIR_SERVICE_CONFIG.baseByShape[stairShape].sku;
  const services: PvcStairQuoteBundle["services"] = [{ sku: baseServiceSku, bundleRole: "labor" }];

  if (stairConstruction === "open") {
    services.push({
      sku: PVC_STAIR_SERVICE_CONFIG.openSurcharge.sku,
      bundleRole: "surcharge"
    });
  }

  return {
    ok: true,
    value: {
      selection: {
        covering: PVC_STAIR_SERVICE_CONFIG.covering,
        stairShape,
        stairConstruction
      },
      bundleType: PVC_STAIR_SERVICE_CONFIG.family,
      sectionKey: PVC_STAIR_SERVICE_CONFIG.sectionKey,
      baseServiceSku,
      surchargeServiceSkus: services
        .filter((service) => service.bundleRole === "surcharge")
        .map((service) => service.sku),
      serviceSkus: services.map((service) => service.sku),
      services
    }
  };
}
