/**
 * Verwijdert producten (en hun prijzen) uit Convex op basis van categorie of leverancier.
 * 
 * Gebruik:
 *   node tools/cleanup_catalog.mjs --category pvc-click
 *   node tools/cleanup_catalog.mjs --category raambekleding
 *   node tools/cleanup_catalog.mjs --supplier Roots
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor } from "./authz_actor.mjs";
import {
  loadCatalogToolEnv,
  optionValue,
  requireCatalogToolTarget,
  targetSummary
} from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });

const categorySlug = optionValue(toolEnv.args, "--category");
const supplierName = optionValue(toolEnv.args, "--supplier");

if (!categorySlug && !supplierName) {
  throw new Error("Geef ofwel --category <slug> of --supplier <naam> op om op te schonen.");
}

if (categorySlug && supplierName) {
  throw new Error("Niet tegelijk --category en --supplier opgeven. Kies één as.");
}

// Bepaal de juiste vlaggen en mutatieparameters
const operation = categorySlug
  ? `catalogus categorie opschonen (${categorySlug})`
  : `catalogus leverancier opschonen (${supplierName})`;

const productionConfirmFlag = categorySlug
  ? "--confirm-production-category-cleanup"
  : "--confirm-production-supplier-cleanup";

// Voer de veiligheidscontrole uit
requireCatalogToolTarget(toolEnv, {
  operation,
  mutates: true,
  productionConfirmFlag,
  requireAuthzSecret: true,
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

console.log(
  JSON.stringify(
    {
      ...targetSummary(toolEnv),
      action: "delete catalog products",
      categorySlug,
      supplierName,
    },
    null,
    2
  )
);

let totalProducts = 0;
let totalPrices = 0;
let iterations = 0;

if (categorySlug) {
  while (true) {
    iterations += 1;
    const result = await client.mutation(api.catalog.import.deleteProductsByCategoryChunk, {
      tenantSlug: toolEnv.tenantSlug,
      actor,
      categorySlug,
      confirm: "DELETE_PRODUCTS_BY_CATEGORY",
      batchSize: 200,
    });

    if (result.done) {
      console.log(
        JSON.stringify(
          {
            done: true,
            iterations,
            totalProducts,
            totalPrices,
            result
          },
          null,
          2
        )
      );
      break;
    }

    totalProducts += result.deletedProducts ?? 0;
    totalPrices += result.deletedPrices ?? 0;

    if (iterations % 5 === 0) {
      console.log(JSON.stringify({ iterations, totalProducts, totalPrices }, null, 2));
    }
  }
} else if (supplierName) {
  while (true) {
    iterations += 1;
    const result = await client.mutation(api.catalog.import.deleteProductsBySupplierChunk, {
      tenantSlug: toolEnv.tenantSlug,
      actor,
      supplierName,
      confirm: "DELETE_PRODUCTS_BY_SUPPLIER",
      batchSize: 200,
    });

    if (result.done) {
      console.log(
        JSON.stringify(
          {
            done: true,
            iterations,
            totalProducts,
            totalPrices,
            result
          },
          null,
          2
        )
      );
      break;
    }

    totalProducts += result.deletedProducts ?? 0;
    totalPrices += result.deletedPrices ?? 0;

    if (iterations % 5 === 0) {
      console.log(JSON.stringify({ iterations, totalProducts, totalPrices }, null, 2));
    }
  }
}
