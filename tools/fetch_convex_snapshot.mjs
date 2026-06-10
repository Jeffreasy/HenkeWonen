import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { withToolActor } from "./authz_actor.mjs";
import {
  loadCatalogToolEnv,
  requireCatalogToolTarget
} from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = resolve(root, "docs/generated/reconciliation-snapshot.json");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });

requireCatalogToolTarget(toolEnv, {
  operation: "catalogus snapshot ophalen",
  mutates: false
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const tenantSlug = toolEnv.tenantSlug;

console.log(`Snapshot ophalen voor tenant: ${tenantSlug} op ${toolEnv.target}...`);

// 1. Metadata ophalen
const metadata = await client.query(
  api.catalog.reconciliation.getMetadata,
  withToolActor(tenantSlug, { tenantSlug })
);
const { suppliers, importProfiles } = metadata;
console.log(`Geladen suppliers: ${suppliers.length}, importProfiles: ${importProfiles.length}`);

// 2. Products ophalen (paginated)
const products = [];
let productCursor = null;
let productsDone = false;
while (!productsDone) {
  const result = await client.query(api.catalog.reconciliation.getProductsPage, {
    ...withToolActor(tenantSlug, { tenantSlug }),
    cursor: productCursor,
    limit: 4096
  });
  products.push(...result.page);
  productCursor = result.continueCursor;
  productsDone = result.isDone;
  console.log(`Products opgehaald: ${products.length}...`);
}

// 3. ProductPrices ophalen (paginated)
const productPrices = [];
let priceCursor = null;
let pricesDone = false;
while (!pricesDone) {
  const result = await client.query(api.catalog.reconciliation.getProductPricesPage, {
    ...withToolActor(tenantSlug, { tenantSlug }),
    cursor: priceCursor,
    limit: 4096
  });
  productPrices.push(...result.page);
  priceCursor = result.continueCursor;
  pricesDone = result.isDone;
  console.log(`ProductPrices opgehaald: ${productPrices.length}...`);
}

const snapshot = {
  suppliers,
  importProfiles,
  products,
  productPrices
};

writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
console.log(`Snapshot succesvol opgeslagen op: ${snapshotPath}`);
process.exit(0);
