import { describe, expect, it } from "vitest";
import {
  PVC_STAIR_RECIPE_KEY,
  PVC_STAIR_RECIPE_VERSION,
  PVC_STAIR_SERVICE_CONFIG,
  calculatePvcStairComponentQuantity,
  calculatePvcStairRecipe,
  validatePvcStairRecipeInput,
  type PvcStairRecipeInput
} from "../src/lib/quotes/pvcStairCalculator";
import type {
  StairMaterialComponent,
  StairMaterialMetadata
} from "../src/lib/quotes/stairMaterialCatalog";

const validInput: PvcStairRecipeInput = {
  recipeKey: PVC_STAIR_RECIPE_KEY,
  recipeVersion: PVC_STAIR_RECIPE_VERSION,
  covering: "pvc",
  stairShape: "half_turn",
  stairConstruction: "open",
  treadCount: 13,
  riserCount: 17,
  doubleTreadCount: 2,
  stripLengthM: 6.1
};

function componentMetadata(
  componentRole: StairMaterialComponent,
  overrides: Partial<StairMaterialMetadata> = {}
): StairMaterialMetadata {
  return {
    family: "stair_renovation",
    covering: "pvc",
    componentRole,
    isPrimary: componentRole === "standard_tread",
    orderUnit: "pack",
    ...overrides
  };
}

describe("PVC-traprecept", () => {
  it("valideert het expliciete versie-1-contract zonder waarden te normaliseren", () => {
    expect(validatePvcStairRecipeInput(validInput)).toEqual({
      ok: true,
      value: validInput
    });
  });

  it("behoudt een expliciete materiaalcompatibiliteitsbevestiging", () => {
    const input = {
      ...validInput,
      materialCompatibilityConfirmed: false
    };

    expect(validatePvcStairRecipeInput(input)).toEqual({
      ok: true,
      value: input
    });
  });

  it("weigert ontbrekende verplichte velden in plaats van impliciete defaults te gebruiken", () => {
    const result = validatePvcStairRecipeInput({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.field)).toEqual([
      "recipeKey",
      "recipeVersion",
      "covering",
      "stairShape",
      "stairConstruction",
      "treadCount"
    ]);
    expect(result.errors.map((error) => error.code)).toEqual([
      "unsupported_recipe",
      "unsupported_recipe_version",
      "unsupported_covering",
      "invalid_stair_shape",
      "invalid_stair_construction",
      "invalid_tread_count"
    ]);
  });

  it("weigert onbekende recept-, bekledings- en trapwaarden", () => {
    const result = validatePvcStairRecipeInput({
      ...validInput,
      recipeKey: "other",
      recipeVersion: 2,
      covering: "laminate",
      stairShape: "spiral",
      stairConstruction: "unknown"
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.code)).toEqual([
      "unsupported_recipe",
      "unsupported_recipe_version",
      "unsupported_covering",
      "invalid_stair_shape",
      "invalid_stair_construction"
    ]);
  });

  it.each([
    ["treadCount", 0, "invalid_tread_count"],
    ["treadCount", 1.5, "invalid_tread_count"],
    ["riserCount", -1, "invalid_riser_count"],
    ["riserCount", 1.5, "invalid_riser_count"],
    ["doubleTreadCount", -1, "invalid_double_tread_count"],
    ["doubleTreadCount", 1.5, "invalid_double_tread_count"],
    ["stripLengthM", -0.1, "invalid_strip_length"],
    ["stripLengthM", Number.NaN, "invalid_strip_length"],
    ["stripLengthM", Number.POSITIVE_INFINITY, "invalid_strip_length"],
    ["materialCompatibilityConfirmed", "yes", "invalid_material_compatibility_confirmation"]
  ])("weigert %s=%s met foutcode %s", (field, value, code) => {
    const result = validatePvcStairRecipeInput({ ...validInput, [field]: value });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code, field })])
    );
  });

  it("berekent verkoop- en bestelwaarden per component volgens het cataloguscontract", () => {
    const result = calculatePvcStairRecipe(validInput, [
      componentMetadata("standard_tread", { piecesPerPack: 4 }),
      componentMetadata("riser", { piecesPerPack: 16 }),
      componentMetadata("double_tread", { piecesPerPack: 1 }),
      componentMetadata("profile_set", { piecesPerPack: 4 }),
      componentMetadata("profile_length", {
        piecesPerPack: 1,
        lengthMPerUnit: 3
      }),
      componentMetadata("tool", { piecesPerPack: 1 }),
      componentMetadata("sealant", { piecesPerPack: 12 }),
      componentMetadata("accessory", { orderUnit: "piece" })
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.components.map(
        ({ componentRole, salesQuantity, salesUnit, expectedOrderQuantity, orderUnit }) => ({
          componentRole,
          salesQuantity,
          salesUnit,
          expectedOrderQuantity,
          orderUnit
        })
      )
    ).toEqual([
      {
        componentRole: "standard_tread",
        salesQuantity: 13,
        salesUnit: "step",
        expectedOrderQuantity: 4,
        orderUnit: "pack"
      },
      {
        componentRole: "riser",
        salesQuantity: 2,
        salesUnit: "pack",
        expectedOrderQuantity: 2,
        orderUnit: "pack"
      },
      {
        componentRole: "double_tread",
        salesQuantity: 2,
        salesUnit: "pack",
        expectedOrderQuantity: 2,
        orderUnit: "pack"
      },
      {
        componentRole: "profile_set",
        salesQuantity: 4,
        salesUnit: "pack",
        expectedOrderQuantity: 4,
        orderUnit: "pack"
      },
      {
        componentRole: "profile_length",
        salesQuantity: 6.1,
        salesUnit: "m1",
        expectedOrderQuantity: 3,
        orderUnit: "pack"
      },
      {
        componentRole: "tool",
        salesQuantity: 1,
        salesUnit: "pack",
        expectedOrderQuantity: 1,
        orderUnit: "pack"
      },
      {
        componentRole: "sealant",
        salesQuantity: 1,
        salesUnit: "pack",
        expectedOrderQuantity: 1,
        orderUnit: "pack"
      },
      {
        componentRole: "accessory",
        salesQuantity: 1,
        salesUnit: "piece",
        expectedOrderQuantity: 1,
        orderUnit: "piece"
      }
    ]);
  });

  it.each([
    ["riser", "riserCount", { piecesPerPack: 16 }],
    ["double_tread", "doubleTreadCount", { piecesPerPack: 1 }],
    ["profile_length", "stripLengthM", { piecesPerPack: 1, lengthMPerUnit: 3 }]
  ] as const)(
    "geeft voor %s een invoerfout als %s ontbreekt, nooit een minimumhoeveelheid 1",
    (componentRole, field, overrides) => {
      const {
        riserCount: _riserCount,
        doubleTreadCount: _doubleTreadCount,
        stripLengthM: _stripLengthM,
        ...inputWithoutOptionalCounts
      } = validInput;
      const result = calculatePvcStairComponentQuantity(
        inputWithoutOptionalCounts,
        componentMetadata(componentRole, overrides)
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors).toEqual([
        expect.objectContaining({
          code: "missing_component_input",
          componentRole,
          field
        })
      ]);
    }
  );

  it("behoudt expliciete nulwaarden als nul en forceert geen minimum van ��n", () => {
    const zeroInput: PvcStairRecipeInput = {
      ...validInput,
      riserCount: 0,
      doubleTreadCount: 0,
      stripLengthM: 0
    };
    const result = calculatePvcStairRecipe(zeroInput, [
      componentMetadata("riser", { piecesPerPack: 16 }),
      componentMetadata("double_tread", { piecesPerPack: 1 }),
      componentMetadata("profile_length", {
        piecesPerPack: 1,
        lengthMPerUnit: 3
      })
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.components.map((component) => [
        component.salesQuantity,
        component.expectedOrderQuantity
      ])
    ).toEqual([
      [0, 0],
      [0, 0],
      [0, 0]
    ]);
    expect(result.value.components[2]).toMatchObject({
      componentRole: "profile_length",
      salesQuantity: 0,
      salesUnit: "m1",
      expectedOrderQuantity: 0,
      orderUnit: "pack"
    });
  });

  it("weigert ontbrekende pak- en lengtemetadata", () => {
    const missingPack = calculatePvcStairComponentQuantity(validInput, componentMetadata("riser"));
    const missingLength = calculatePvcStairComponentQuantity(
      validInput,
      componentMetadata("profile_length", { piecesPerPack: 1 })
    );

    expect(missingPack.ok).toBe(false);
    if (!missingPack.ok) {
      expect(missingPack.errors).toEqual([
        expect.objectContaining({
          code: "invalid_component_metadata",
          componentRole: "riser",
          field: "piecesPerPack"
        })
      ]);
    }
    expect(missingLength.ok).toBe(false);
    if (!missingLength.ok) {
      expect(missingLength.errors).toEqual([
        expect.objectContaining({
          code: "invalid_component_metadata",
          componentRole: "profile_length",
          field: "lengthMPerUnit"
        })
      ]);
    }
  });

  it("weigert onbekende componentrollen en ongeldige eenheden fail-closed", () => {
    const unknownRole = calculatePvcStairComponentQuantity(
      validInput,
      componentMetadata("unknown" as StairMaterialComponent)
    );
    const invalidUnit = calculatePvcStairComponentQuantity(
      validInput,
      componentMetadata("standard_tread", {
        piecesPerPack: 4,
        orderUnit: "box" as StairMaterialMetadata["orderUnit"]
      })
    );

    expect(unknownRole.ok).toBe(false);
    if (!unknownRole.ok) {
      expect(unknownRole.errors).toEqual([
        expect.objectContaining({
          code: "invalid_component_metadata",
          field: "componentRole"
        })
      ]);
    }
    expect(invalidUnit.ok).toBe(false);
    if (!invalidUnit.ok) {
      expect(invalidUnit.errors).toEqual([
        expect.objectContaining({
          code: "invalid_component_metadata",
          componentRole: "standard_tread",
          field: "orderUnit"
        })
      ]);
    }
  });

  it("biedt ��n gezaghebbende dienstconfiguratie voor vorm, toeslag en metadata", () => {
    expect(
      Object.fromEntries(
        Object.entries(PVC_STAIR_SERVICE_CONFIG.baseByShape).map(([shape, service]) => [
          shape,
          service.sku
        ])
      )
    ).toEqual({
      straight: "HW-DIENST-016",
      quarter_turn: "HW-DIENST-015",
      half_turn: "HW-DIENST-014"
    });
    expect(PVC_STAIR_SERVICE_CONFIG.baseByShape.half_turn.metadata).toEqual({
      family: "stair_renovation",
      covering: "pvc",
      shape: "half_turn",
      role: "base_labor",
      sectionKey: "traprenovatie"
    });
    expect(PVC_STAIR_SERVICE_CONFIG.openSurcharge).toEqual({
      sku: "HW-DIENST-006",
      metadata: {
        family: "stair_renovation",
        covering: "pvc",
        role: "surcharge",
        sectionKey: "traprenovatie"
      }
    });
  });
});
