/**
 * Gedeelde types voor de settings-modules.
 */

// ─── Categorie ─────────────────────────────────────────────────────────────────

/**
 * Was gedupliceerd in: CategoriesSettings, CategoriesTable, CategoryForm (3×, identiek).
 */
export type CategoryRow = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  sortOrder: number;
  status: "active" | "inactive";
};

// ─── Serviceregel ──────────────────────────────────────────────────────────────

/**
 * Was gedupliceerd in: ServiceRulesSettings, ServiceRuleForm, ServiceRulesTable (3×, identiek).
 */
export type ServiceRuleStatus = "active" | "inactive";

/**
 * Was gedupliceerd in: ServiceRulesSettings, ServiceRuleForm, ServiceRulesTable (3×, identiek).
 */
export type ServiceRuleCalculationType =
  | "fixed"
  | "per_m2"
  | "per_meter"
  | "per_roll"
  | "per_side"
  | "per_staircase"
  | "manual";

/**
 * Was gedupliceerd in: ServiceRulesSettings, ServiceRuleForm, ServiceRulesTable (3×, identiek).
 */
export type ServiceRuleRow = {
  id: string;
  name: string;
  description?: string;
  calculationType: ServiceRuleCalculationType;
  priceExVat: number;
  vatRate: number;
  status: ServiceRuleStatus;
};
