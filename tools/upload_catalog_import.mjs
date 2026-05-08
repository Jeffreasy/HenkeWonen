import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor } from "./authz_actor.mjs";
import {
  hasFlag,
  loadCatalogToolEnv,
  requireCatalogToolTarget,
  targetSummary
} from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const previewPath = resolve(root, "docs/catalog-import-preview.json");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });

if (!hasFlag(toolEnv.args, "--legacy-direct-confirm")) {
  throw new Error(
    "Legacy direct catalog import is disabled. Use npm run catalog:import or npm run catalog:import:dev so every import creates productImportBatches and productImportRows."
  );
}

requireCatalogToolTarget(toolEnv, {
  operation: "legacy direct catalogusimport",
  mutates: true,
  requireAuthzSecret: toolEnv.target === "production",
  productionConfirmFlag: "--confirm-production-legacy-direct-import"
});

if (toolEnv.target === "production") {
  throw new Error(
    "Legacy direct catalogusimport is uitgeschakeld voor production. Gebruik catalog:import zodat batches, auditrijen en btw-guardrails meelopen."
  );
}

function chunk(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

const convexUrl = toolEnv.convexUrl;
const payload = JSON.parse(readFileSync(previewPath, "utf8"));
const rows = payload.rows ?? [];
const tenantSlug = payload.tenantSlug ?? toolEnv.tenantSlug;

if (tenantSlug !== toolEnv.tenantSlug) {
  throw new Error(
    `Preview tenantSlug=${tenantSlug} komt niet overeen met gekozen tenant=${toolEnv.tenantSlug}.`
  );
}

const actor = createToolMutationActor(tenantSlug);
const client = new ConvexHttpClient(convexUrl);
const chunks = chunk(rows, 75);
const totals = {
  receivedRows: 0,
  skippedRows: 0,
  insertedProducts: 0,
  updatedProducts: 0,
  insertedPrices: 0,
  updatedPrices: 0,
};

console.log(
  JSON.stringify(
    {
      ...targetSummary(toolEnv),
      tenantSlug,
      convexUrl,
      rows: rows.length,
      chunks: chunks.length,
    },
    null,
    2
  )
);

for (let index = 0; index < chunks.length; index += 1) {
  const result = await client.mutation(api.catalogImport.importRows, {
    tenantSlug,
    actor,
    rows: chunks[index],
  });

  for (const key of Object.keys(totals)) {
    totals[key] += result[key] ?? 0;
  }

  if ((index + 1) % 10 === 0 || index === chunks.length - 1) {
    console.log(
      JSON.stringify(
        {
          chunk: index + 1,
          chunks: chunks.length,
          totals,
        },
        null,
        2
      )
    );
  }
}

console.log(JSON.stringify({ done: true, totals }, null, 2));
