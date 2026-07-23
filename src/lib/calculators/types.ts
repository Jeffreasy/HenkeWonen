export type CalculatorValidationResult = {
  validationError?: string;
};

export type IndicativeCalculationResult = CalculatorValidationResult & {
  isIndicative: true;
};

export type WasteInput = {
  wastePercent: number;
};

export type ProductGroup =
  | "flooring"
  | "plinths"
  | "wallpaper"
  | "wall_panels"
  | "curtains"
  | "rails"
  | "stairs"
  | "other";

export type PatternType = "straight" | "herringbone" | "tile" | "custom";

export type StairShape = "straight" | "quarter_turn" | "half_turn";
export type StairConstruction = "open" | "closed";
/** Legacy combinatie; nieuwe code gebruikt StairShape + StairConstruction apart. */
export type StairType = StairShape | StairConstruction;
