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
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });
const confirmReset = hasFlag(toolEnv.args, "--confirm-reset-imported-catalog");
const tenantSlug = toolEnv.tenantSlug;

if (!confirmReset) {
  throw new Error(
    "Catalog reset is destructive. Re-run with --confirm-reset-imported-catalog after checking the target Convex environment."
  );
}

requireCatalogToolTarget(toolEnv, {
  operation: "catalogus reset",
  mutates: true,
  requireAuthzSecret: toolEnv.target === "production",
  productionConfirmFlag: "--confirm-production-reset"
});

const convexUrl = toolEnv.convexUrl;
const client = new ConvexHttpClient(convexUrl);
const actor = createToolMutationActor(tenantSlug);

console.log(JSON.stringify({ ...targetSummary(toolEnv), action: "catalog reset" }, null, 2));
console.log(
  JSON.stringify(
    {
      before: await client.query(api.catalogImport.getCatalogImportStats, { tenantSlug }),
    },
    null,
    2
  )
);

const totals = {};
let iterations = 0;

while (true) {
  iterations += 1;

  const result = await client.mutation(api.catalogImport.resetCatalogChunk, {
    tenantSlug,
    actor,
    confirm: "RESET_IMPORTED_CATALOG",
    batchSize: 500,
  });

  if (result.done) {
    break;
  }

  totals[result.tableName] = (totals[result.tableName] ?? 0) + result.deleted;

  if (iterations % 10 === 0) {
    console.log(JSON.stringify({ iterations, totals }, null, 2));
  }
}

console.log(
  JSON.stringify(
    {
      done: true,
      iterations,
      deleted: totals,
      after: await client.query(api.catalogImport.getCatalogImportStats, { tenantSlug }),
    },
    null,
    2
  )
);
