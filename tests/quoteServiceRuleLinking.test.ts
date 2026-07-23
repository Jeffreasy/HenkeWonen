import { describe, expect, it } from "vitest";
import {
  serviceRuleProductId,
  serviceRuleQuoteMetadata
} from "../src/components/quotes/QuoteLineEditor";
import {
  quoteLineMetadataForEdit,
  quoteLineProductIdForEdit
} from "../src/components/quotes/QuoteLineEditForm";
import type { ServiceRuleRow } from "../src/components/settings/settings/settingsTypes";

function serviceRule(overrides: Partial<ServiceRuleRow> = {}): ServiceRuleRow {
  return {
    id: "service-doc-1",
    productId: "service-product-1",
    name: "PVC trap halve draai",
    calculationType: "per_staircase",
    priceExVat: 495,
    vatRate: 21,
    status: "active",
    ...overrides
  };
}

describe("offertekoppeling van dienstproducten", () => {
  it("koppelt het dienstproduct alleen aan service- en arbeidsregels", () => {
    const rule = serviceRule();

    expect(serviceRuleProductId("service", rule)).toBe("service-product-1");
    expect(serviceRuleProductId("labor", rule)).toBe("service-product-1");
    expect(serviceRuleProductId("material", rule)).toBeUndefined();
    expect(serviceRuleProductId("product", rule)).toBeUndefined();
    expect(serviceRuleProductId("service", null)).toBeUndefined();
  });

  it("bewaart de gestructureerde trapmetadata op een directe offerteregel", () => {
    const metadata = serviceRuleQuoteMetadata(
      serviceRule({
        sku: "HW-DIENST-014",
        serviceMetadata: {
          family: "stair_renovation",
          covering: "pvc",
          shape: "half_turn",
          role: "base_labor",
          sectionKey: "traprenovatie"
        }
      })
    );

    expect(metadata).toMatchObject({
      source: "serviceRule",
      serviceRuleId: "service-doc-1",
      serviceSku: "HW-DIENST-014",
      calculationType: "per_staircase",
      sectionKey: "traprenovatie",
      serviceFamily: "stair_renovation",
      covering: "pvc",
      stairShape: "half_turn",
      serviceRole: "base_labor"
    });
  });

  it("behoudt een bestaande dienstkoppeling bij edits en laat die niet naar productregels lekken", () => {
    const existingServiceLine = {
      productId: "service-product-old",
      regelType: "service" as const
    };

    expect(quoteLineProductIdForEdit(existingServiceLine, "labor", undefined)).toBe(
      "service-product-old"
    );
    expect(quoteLineProductIdForEdit(existingServiceLine, "product", undefined)).toBeUndefined();
    expect(
      quoteLineProductIdForEdit(
        existingServiceLine,
        "service",
        serviceRule({ productId: "service-product-new" })
      )
    ).toBe("service-product-new");
  });

  it("onderscheidt ongemoeid van bewust wissen bij een bestaande dienstkoppeling", () => {
    const existingServiceLine = {
      productId: "service-product-old",
      regelType: "service" as const
    };
    const metadata = {
      source: "serviceRule",
      serviceRuleId: "service-doc-old",
      serviceSku: "HW-DIENST-OLD",
      calculationType: "fixed",
      sectionKey: "traprenovatie",
      serviceFamily: "stair_renovation",
      covering: "pvc",
      stairShape: "half_turn",
      serviceRole: "base_labor",
      internalNote: "bewaren"
    };

    expect(quoteLineProductIdForEdit(existingServiceLine, "service", undefined)).toBe(
      "service-product-old"
    );
    expect(quoteLineProductIdForEdit(existingServiceLine, "service", null)).toBeUndefined();
    expect(quoteLineMetadataForEdit(metadata, true, undefined)).toBe(metadata);
    expect(quoteLineMetadataForEdit(metadata, true, null)).toEqual({
      internalNote: "bewaren"
    });
  });

  it("behoudt een bestelbaar product alleen binnen product- en materiaalregels", () => {
    const existingProductLine = {
      productId: "orderable-product-1",
      regelType: "material" as const
    };

    expect(quoteLineProductIdForEdit(existingProductLine, "product", undefined)).toBe(
      "orderable-product-1"
    );
    expect(quoteLineProductIdForEdit(existingProductLine, "service", undefined)).toBeUndefined();
  });
});
