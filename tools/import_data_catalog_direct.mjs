// Directe catalogus-import: roept catalog/import.ts::importRows rechtstreeks aan, in chunks.
//
// Anders dan upload_catalog_batch_import.mjs past dit GEEN importProfiel-btw-mappings toe:
// de per-prijs `vatMode` uit het preview-bestand (= de schone DATA-bron) wordt 1-op-1 gerespecteerd
// (import.ts gebruikt price.vatMode verbatim). Bedoeld voor de DATA-als-bron-van-waarheid-vervanging.
//
// Gebruik: node tools/import_data_catalog_direct.mjs --target=dev --preview-file <pad> [--chunk 50]
//
// Productie vereist (zoals de andere tools): --production --target=production
// --confirm-production-catalog-import + geldige prod-env.

import { readFileSync } from "node:fs";
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

const previewFileArg = optionValue(toolEnv.args, "--preview-file");
const previewPath = previewFileArg
  ? resolve(root, previewFileArg)
  : resolve(root, "docs/generated/data-catalog-import-preview.json");

// Chunkgrootte via env-var (CATALOG_IMPORT_CHUNK), niet via CLI-flag: de gedeelde
// arg-parser kent geen --chunk en zou de waarde als positionele tenant interpreteren.
const chunkRaw = process.env.CATALOG_IMPORT_CHUNK ?? "50";
const chunkSize = Math.min(Math.max(Math.trunc(Number(chunkRaw)) || 50, 1), 200);

requireCatalogToolTarget(toolEnv, {
  operation: "directe catalogus-import (DATA)",
  mutates: true,
  requireAuthzSecret: toolEnv.target === "production",
  productionConfirmFlag: "--confirm-production-catalog-import"
});

const payload = JSON.parse(readFileSync(previewPath, "utf8"));
const rows = payload.rows ?? [];
const tenantSlug = payload.tenantSlug ?? toolEnv.tenantSlug;
if (tenantSlug !== toolEnv.tenantSlug) {
  throw new Error(`Preview tenantSlug=${tenantSlug} komt niet overeen met gekozen tenant=${toolEnv.tenantSlug}.`);
}

console.log(JSON.stringify({ target: targetSummary(toolEnv), previewPath, rows: rows.length, chunkSize }, null, 2));

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(tenantSlug);

const totals = {
  receivedRows: 0,
  skippedRows: 0,
  insertedProducts: 0,
  updatedProducts: 0,
  insertedPrices: 0,
  updatedPrices: 0
};

const chunks = [];
for (let i = 0; i < rows.length; i += chunkSize) chunks.push(rows.slice(i, i + chunkSize));

const started = Date.now();
for (let c = 0; c < chunks.length; c++) {
  const res = await client.mutation(api.catalog.import.importRows, {
    tenantSlug,
    actor,
    rows: chunks[c]
  });
  for (const k of Object.keys(totals)) totals[k] += res[k] ?? 0;
  if ((c + 1) % 25 === 0 || c === chunks.length - 1) {
    const pct = Math.round(((c + 1) / chunks.length) * 100);
    console.log(
      `chunk ${c + 1}/${chunks.length} (${pct}%) — producten +${totals.insertedProducts}/~${totals.updatedProducts}, prijzen +${totals.insertedPrices}/~${totals.updatedPrices}`
    );
  }
}

console.log("\n=== DIRECTE IMPORT KLAAR ===");
console.log(JSON.stringify({ ...totals, durationSec: Math.round((Date.now() - started) / 1000) }, null, 2));
