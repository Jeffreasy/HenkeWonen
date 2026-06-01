/**
 * Verwijdert alle PVC Click producten (en hun prijzen) uit Convex dev.
 * Raakt PVC Dryback, PVC Vloeren en andere categorieën NIET aan.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor } from "./authz_actor.mjs";
import {
  loadCatalogToolEnv,
  requireCatalogToolTarget,
  targetSummary
} from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });

requireCatalogToolTarget(toolEnv, {
  operation: "PVC Click verwijderen",
  mutates: true,
  productionConfirmFlag: "--confirm-production-category-cleanup",
  requireAuthzSecret: true,
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);
const CATEGORY_SLUG = "pvc-click";

console.log(JSON.stringify({
  ...targetSummary(toolEnv),
  action: "delete PVC Click products",
  categorySlug: CATEGORY_SLUG
}, null, 2));

let totalProducts = 0;
let totalPrices = 0;
let iterations = 0;

while (true) {
  iterations += 1;
  const result = await client.mutation(api.catalogImport.deleteProductsByCategoryChunk, {
    tenantSlug: toolEnv.tenantSlug,
    actor,
    categorySlug: CATEGORY_SLUG,
    confirm: "DELETE_PRODUCTS_BY_CATEGORY",
    batchSize: 200,
  });

  if (result.done) {
    console.log(JSON.stringify({
      done: true,
      iterations,
      totalProducts,
      totalPrices,
      result
    }, null, 2));
    break;
  }

  totalProducts += result.deletedProducts ?? 0;
  totalPrices += result.deletedPrices ?? 0;

  if (iterations % 5 === 0) {
    console.log(JSON.stringify({ iterations, totalProducts, totalPrices }, null, 2));
  }
}
