/**
 * Verwijdert alle producten gekoppeld aan leverancier "Roots" uit Convex dev.
 * Na cleanup worden ze opnieuw geïmporteerd onder "Unilin Flooring" (correcte groothandel).
 * Roots blijft zichtbaar als merk-veld op de producten.
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
  operation: "Roots-leverancier producten verwijderen (→ Unilin Flooring)",
  mutates: true,
  productionConfirmFlag: "--confirm-production-supplier-cleanup",
  requireAuthzSecret: true,
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);
const SUPPLIER_NAME = "Roots";

console.log(JSON.stringify({
  ...targetSummary(toolEnv),
  action: "delete products by supplier",
  supplierName: SUPPLIER_NAME,
  reason: "Roots is een Unilin-merk; producten worden hergeïmporteerd onder Unilin Flooring"
}, null, 2));

let totalProducts = 0;
let totalPrices = 0;
let iterations = 0;

while (true) {
  iterations += 1;
  const result = await client.mutation(api.catalogImport.deleteProductsBySupplierChunk, {
    tenantSlug: toolEnv.tenantSlug,
    actor,
    supplierName: SUPPLIER_NAME,
    confirm: "DELETE_PRODUCTS_BY_SUPPLIER",
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
  totalPrices  += result.deletedPrices   ?? 0;

  if (iterations % 3 === 0) {
    console.log(JSON.stringify({ iterations, totalProducts, totalPrices }, null, 2));
  }
}
