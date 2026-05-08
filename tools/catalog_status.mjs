import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import {
  loadCatalogToolEnv,
  requireCatalogToolTarget,
  targetSummary
} from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });

requireCatalogToolTarget(toolEnv, {
  operation: "catalogus status",
  mutates: false
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const tenantSlug = toolEnv.tenantSlug;

const [readiness, vatReview, catalogStats] = await Promise.all([
  client.query(api.catalogReview.productionReadiness, { tenantSlug }),
  client.query(api.catalogReview.vatMappingReview, { tenantSlug }),
  client.query(api.catalogImport.getCatalogImportStats, { tenantSlug })
]);

console.log(
  JSON.stringify(
    {
      ...targetSummary(toolEnv),
      productionImportStatus: readiness.productionImportStatus,
      vatMappings: readiness.vatMappings,
      duplicateEanIssues: readiness.duplicateEanIssues,
      latestImportRun: readiness.latestImportRun,
      catalogStats,
      reviewRows: vatReview.rows.length
    },
    null,
    2
  )
);
