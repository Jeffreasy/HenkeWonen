/**
 * Gedeelde types voor de settings-modules.
 */
import type { MeasurementProductGroup } from "../../../lib/portalTypes";

// ─── Categorie ─────────────────────────────────────────────────────────────────

/**
 * Was gedupliceerd in: CategoriesSettings, CategoriesTable, CategoryForm (3×, identiek).
 */
export type CategoryRow = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  /** Gekoppelde productgroep; bepaalt waarop de catalogus-/offertekiezer filtert. */
  productGroep?: MeasurementProductGroup;
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

/** Gestructureerde catalogusclassificatie van een vaste werkzaamheid. */
export type ServiceRuleMetadata = {
  family: string;
  covering?: string;
  shape?: string;
  role: string;
  sectionKey: string;
};

/**
 * Was gedupliceerd in: ServiceRulesSettings, ServiceRuleForm, ServiceRulesTable (3×, identiek).
 */
export type ServiceRuleRow = {
  id: string;
  /** Catalogusproduct achter de dienst; gelijk aan id, expliciet voor koppelingen. */
  productId: string;
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  subcategory?: string;
  priceUnit?: string;
  productGroup?: MeasurementProductGroup;
  serviceMetadata?: ServiceRuleMetadata;
  serviceFamily?: string;
  covering?: string;
  stairShape?: string;
  serviceRole?: string;
  sectionKey?: string;
  calculationType: ServiceRuleCalculationType;
  priceExVat: number;
  vatRate: number;
  status: ServiceRuleStatus;
};
