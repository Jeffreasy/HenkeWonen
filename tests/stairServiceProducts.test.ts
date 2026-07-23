import { describe, expect, it } from "vitest";
import {
  GUIDED_STAIR_SERVICE_FAMILY,
  STAIR_SERVICE_METADATA_BY_SKU,
  assertGuidedStairServiceHasBundle,
  isGuidedStairServiceProduct,
  resolveStairServiceMetadata
} from "../convex/stairServiceProducts";
import { PVC_STAIR_SERVICE_CONFIG } from "../src/lib/quotes/pvcStairCalculator";

const configuredServices = [
  ...Object.values(PVC_STAIR_SERVICE_CONFIG.baseByShape),
  PVC_STAIR_SERVICE_CONFIG.openSurcharge
];

describe("gedeelde PVC-trapdienstconfiguratie", () => {
  it("leidt iedere SKU-fallback en metadatawaarde af uit de domeinconfiguratie", () => {
    expect(GUIDED_STAIR_SERVICE_FAMILY).toBe(PVC_STAIR_SERVICE_CONFIG.family);
    expect(Object.keys(STAIR_SERVICE_METADATA_BY_SKU).sort()).toEqual(
      configuredServices.map((service) => service.sku).sort()
    );

    for (const service of configuredServices) {
      expect(STAIR_SERVICE_METADATA_BY_SKU[service.sku]).toEqual(service.metadata);
    }
  });

  it("resolveert bestaande producten via de gedeelde SKU-config en behoudt bronvoorrang", () => {
    expect(
      resolveStairServiceMetadata({
        sku: " hw-dienst-014 ",
        attributen: undefined
      })
    ).toEqual(PVC_STAIR_SERVICE_CONFIG.baseByShape.half_turn.metadata);

    expect(
      resolveStairServiceMetadata({
        sku: PVC_STAIR_SERVICE_CONFIG.baseByShape.half_turn.sku,
        attributen: {
          serviceMetadata: {
            shape: "custom_shape",
            role: "custom_role"
          }
        }
      })
    ).toEqual({
      family: PVC_STAIR_SERVICE_CONFIG.family,
      covering: PVC_STAIR_SERVICE_CONFIG.covering,
      shape: "custom_shape",
      role: "custom_role",
      sectionKey: PVC_STAIR_SERVICE_CONFIG.sectionKey
    });
  });

  it("bewaakt geconfigureerde diensten alleen voor serviceproducten en vereist bundellidmaatschap", () => {
    const product = {
      sku: PVC_STAIR_SERVICE_CONFIG.openSurcharge.sku,
      attributen: undefined,
      productAard: "service" as const
    };

    expect(isGuidedStairServiceProduct(product)).toBe(true);
    expect(
      isGuidedStairServiceProduct({
        ...product,
        productAard: "standard"
      })
    ).toBe(false);
    expect(() => assertGuidedStairServiceHasBundle(product, true)).not.toThrow();
    expect(() => assertGuidedStairServiceHasBundle(product, false)).toThrow(
      /alleen als onderdeel van een volledige trapbundel/
    );
  });
});
