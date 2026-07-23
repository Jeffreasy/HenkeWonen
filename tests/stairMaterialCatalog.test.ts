import { describe, expect, it } from "vitest";
import {
  isPrimaryPvcStairMaterial,
  resolveStairMaterialMetadata
} from "../src/lib/quotes/stairMaterialCatalog";

describe("PVC-trapmateriaalcatalogus", () => {
  it("herkent de V2-traptredensets als hoofdproduct met vier treden per pak", () => {
    const product = { sku: "5635380011" };

    expect(resolveStairMaterialMetadata(product)).toEqual({
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "standard_tread",
      isPrimary: true,
      piecesPerPack: 4,
      orderUnit: "pack"
    });
    expect(isPrimaryPvcStairMaterial(product)).toBe(true);
  });

  it("laat accessoires nooit als PVC-hoofdproduct tellen", () => {
    for (const sku of ["5606145111", "4867005911", "4883900911"]) {
      expect(isPrimaryPvcStairMaterial({ sku })).toBe(false);
    }
  });

  it("geeft bronmetadata voorrang boven SKU-fallback", () => {
    expect(
      resolveStairMaterialMetadata(
        { sku: "onbekend" },
        {
          family: "stair_renovation",
          covering: "pvc",
          componentRole: "standard_tread",
          isPrimary: true,
          piecesPerPack: 6,
          orderUnit: "pack"
        }
      )
    ).toMatchObject({ componentRole: "standard_tread", isPrimary: true, piecesPerPack: 6 });
  });

  it("mengt hoofdproduct- en pakmetadata niet met een afwijkende expliciete componentrol", () => {
    expect(
      resolveStairMaterialMetadata(
        { sku: "5635380011" },
        {
          family: "stair_renovation",
          covering: "pvc",
          componentRole: "tool"
        }
      )
    ).toEqual({
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "tool",
      isPrimary: false
    });
  });

  it("laat een niet-tredecomponent ook met onjuiste bronvlag nooit hoofdproduct worden", () => {
    expect(
      isPrimaryPvcStairMaterial({
        attributen: {
          stairMaterialMetadata: {
            family: "stair_renovation",
            covering: "pvc",
            componentRole: "sealant",
            isPrimary: true
          }
        }
      })
    ).toBe(false);
  });

  it("legt de verkooplengte van het 3000mm-profiel vast in metadata", () => {
    expect(resolveStairMaterialMetadata({ sku: "5607145111" })).toEqual({
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "profile_length",
      isPrimary: false,
      piecesPerPack: 1,
      lengthMPerUnit: 3,
      orderUnit: "pack"
    });
  });

  it("leest een expliciete profieldimensie uit camelCase en bronnotatie", () => {
    const baseSource = {
      family: "stair_renovation",
      covering: "pvc",
      componentRole: "profile_length",
      isPrimary: false,
      piecesPerPack: 1,
      orderUnit: "pack"
    } as const;

    expect(
      resolveStairMaterialMetadata({ sku: "5607145111" }, { ...baseSource, lengthMPerUnit: 2.4 })
    ).toMatchObject({ componentRole: "profile_length", lengthMPerUnit: 2.4 });
    expect(
      resolveStairMaterialMetadata({ sku: "onbekend" }, { ...baseSource, length_m_per_unit: 2.75 })
    ).toMatchObject({ componentRole: "profile_length", lengthMPerUnit: 2.75 });
  });
});
