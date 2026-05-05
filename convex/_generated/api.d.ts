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
import type * as catalog from "../catalog.js";
import type * as catalogImport from "../catalogImport.js";
import type * as catalogReview from "../catalogReview.js";
import type * as catalogValidation from "../catalogValidation.js";
import type * as categories from "../categories.js";
import type * as customers from "../customers.js";
import type * as demoSeed from "../demoSeed.js";
import type * as importProductionAudit from "../importProductionAudit.js";
import type * as imports from "../imports.js";
import type * as measurements from "../measurements.js";
import type * as portal from "../portal.js";
import type * as projectWorkflowEvents from "../projectWorkflowEvents.js";
import type * as projects from "../projects.js";
import type * as quoteTemplates from "../quoteTemplates.js";
import type * as quotes from "../quotes.js";
import type * as seed from "../seed.js";
import type * as serviceCostRules from "../serviceCostRules.js";
import type * as suppliers from "../suppliers.js";
import type * as tenants from "../tenants.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  authz: typeof authz;
  catalog: typeof catalog;
  catalogImport: typeof catalogImport;
  catalogReview: typeof catalogReview;
  catalogValidation: typeof catalogValidation;
  categories: typeof categories;
  customers: typeof customers;
  demoSeed: typeof demoSeed;
  importProductionAudit: typeof importProductionAudit;
  imports: typeof imports;
  measurements: typeof measurements;
  portal: typeof portal;
  projectWorkflowEvents: typeof projectWorkflowEvents;
  projects: typeof projects;
  quoteTemplates: typeof quoteTemplates;
  quotes: typeof quotes;
  seed: typeof seed;
  serviceCostRules: typeof serviceCostRules;
  suppliers: typeof suppliers;
  tenants: typeof tenants;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
