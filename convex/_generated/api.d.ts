/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as authz from "../authz.js";
import type * as beheer_agenda from "../beheer/agenda.js";
import type * as beheer_categories from "../beheer/categories.js";
import type * as beheer_clearTenantData from "../beheer/clearTenantData.js";
import type * as beheer_customers from "../beheer/customers.js";
import type * as beheer_deleteProjects from "../beheer/deleteProjects.js";
import type * as beheer_migrateNlFields from "../beheer/migrateNlFields.js";
import type * as beheer_retention from "../beheer/retention.js";
import type * as beheer_serviceCostRules from "../beheer/serviceCostRules.js";
import type * as beheer_suppliers from "../beheer/suppliers.js";
import type * as beheer_tenants from "../beheer/tenants.js";
import type * as beheer_users from "../beheer/users.js";
import type * as catalog_calculatorRules from "../catalog/calculatorRules.js";
import type * as catalog_calculatorRulesSeed from "../catalog/calculatorRulesSeed.js";
import type * as catalog_core from "../catalog/core.js";
import type * as catalog_import from "../catalog/import.js";
import type * as catalog_imports from "../catalog/imports.js";
import type * as catalog_maintenance from "../catalog/maintenance.js";
import type * as catalog_pickerSearch from "../catalog/pickerSearch.js";
import type * as catalog_pilot from "../catalog/pilot.js";
import type * as catalog_priceColumnKey from "../catalog/priceColumnKey.js";
import type * as catalog_priceMatrices from "../catalog/priceMatrices.js";
import type * as catalog_priceMatricesSeed from "../catalog/priceMatricesSeed.js";
import type * as catalog_pricing from "../catalog/pricing.js";
import type * as catalog_pricingRules from "../catalog/pricingRules.js";
import type * as catalog_productionAudit from "../catalog/productionAudit.js";
import type * as catalog_reconciliation from "../catalog/reconciliation.js";
import type * as catalog_review from "../catalog/review.js";
import type * as catalog_v2_import from "../catalog/v2_import.js";
import type * as catalog_validation from "../catalog/validation.js";
import type * as crons from "../crons.js";
import type * as dossiers_attachments from "../dossiers/attachments.js";
import type * as facturen_core from "../facturen/core.js";
import type * as inkoop_core from "../inkoop/core.js";
import type * as offertes_core from "../offertes/core.js";
import type * as offertes_maintenance from "../offertes/maintenance.js";
import type * as offertes_templates from "../offertes/templates.js";
import type * as portal from "../portal.js";
import type * as portalUtils from "../portalUtils.js";
import type * as projecten_core from "../projecten/core.js";
import type * as projecten_fieldService from "../projecten/fieldService.js";
import type * as projecten_measurements from "../projecten/measurements.js";
import type * as projecten_nextStep from "../projecten/nextStep.js";
import type * as projecten_workflowEvents from "../projecten/workflowEvents.js";
import type * as seed_core from "../seed/core.js";
import type * as seed_demo from "../seed/demo.js";
import type * as stairBundles from "../stairBundles.js";
import type * as stairServiceProducts from "../stairServiceProducts.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  authz: typeof authz;
  "beheer/agenda": typeof beheer_agenda;
  "beheer/categories": typeof beheer_categories;
  "beheer/clearTenantData": typeof beheer_clearTenantData;
  "beheer/customers": typeof beheer_customers;
  "beheer/deleteProjects": typeof beheer_deleteProjects;
  "beheer/migrateNlFields": typeof beheer_migrateNlFields;
  "beheer/retention": typeof beheer_retention;
  "beheer/serviceCostRules": typeof beheer_serviceCostRules;
  "beheer/suppliers": typeof beheer_suppliers;
  "beheer/tenants": typeof beheer_tenants;
  "beheer/users": typeof beheer_users;
  "catalog/calculatorRules": typeof catalog_calculatorRules;
  "catalog/calculatorRulesSeed": typeof catalog_calculatorRulesSeed;
  "catalog/core": typeof catalog_core;
  "catalog/import": typeof catalog_import;
  "catalog/imports": typeof catalog_imports;
  "catalog/maintenance": typeof catalog_maintenance;
  "catalog/pickerSearch": typeof catalog_pickerSearch;
  "catalog/pilot": typeof catalog_pilot;
  "catalog/priceColumnKey": typeof catalog_priceColumnKey;
  "catalog/priceMatrices": typeof catalog_priceMatrices;
  "catalog/priceMatricesSeed": typeof catalog_priceMatricesSeed;
  "catalog/pricing": typeof catalog_pricing;
  "catalog/pricingRules": typeof catalog_pricingRules;
  "catalog/productionAudit": typeof catalog_productionAudit;
  "catalog/reconciliation": typeof catalog_reconciliation;
  "catalog/review": typeof catalog_review;
  "catalog/v2_import": typeof catalog_v2_import;
  "catalog/validation": typeof catalog_validation;
  crons: typeof crons;
  "dossiers/attachments": typeof dossiers_attachments;
  "facturen/core": typeof facturen_core;
  "inkoop/core": typeof inkoop_core;
  "offertes/core": typeof offertes_core;
  "offertes/maintenance": typeof offertes_maintenance;
  "offertes/templates": typeof offertes_templates;
  portal: typeof portal;
  portalUtils: typeof portalUtils;
  "projecten/core": typeof projecten_core;
  "projecten/fieldService": typeof projecten_fieldService;
  "projecten/measurements": typeof projecten_measurements;
  "projecten/nextStep": typeof projecten_nextStep;
  "projecten/workflowEvents": typeof projecten_workflowEvents;
  "seed/core": typeof seed_core;
  "seed/demo": typeof seed_demo;
  stairBundles: typeof stairBundles;
  stairServiceProducts: typeof stairServiceProducts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {};
