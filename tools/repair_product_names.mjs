/**
 * Audit-bevinding H-1 (2026-06-13): verwijdert een bij de import gelekte
 * bron-bestandsnaam ("henke-swifterbant-artikeloverzicht") uit products.name.
 * De weergave was al beschermd (cleanProductDisplayName); dit maakt ook de
 * RUWE naam schoon zodat zoeken/import niet langer de slug bevat.
 *
 * Standaard dry-run; pas met --apply wordt er gepatcht.
 *
 * Gebruik:
 *   node tools/repair_product_names.mjs
 *   node tools/repair_product_names.mjs --apply
 *
 * Productie vereist --production --target=production
 * --confirm-production-name-repair en een geldige AUTHZ_TOKEN_SECRET.
 */
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
const apply = hasFlag(toolEnv.args, "--apply");
const dryRun = !apply;

requireCatalogToolTarget(toolEnv, {
  operation: "productnamen opschonen (gelekte bestandsnaam)",
  mutates: apply,
  productionConfirmFlag: "--confirm-production-name-repair",
  requireAuthzSecret: true
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

console.log(JSON.stringify({ ...targetSummary(toolEnv), mode: dryRun ? "dry-run" : "apply" }, null, 2));

let cursor;
let iterations = 0;
let scanned = 0;
let matched = 0;
let patched = 0;
let skippedEmpty = 0;
let firstSamples = null;

while (true) {
  iterations += 1;
  const result = await client.mutation(api.catalog.maintenance.stripLeakedFilenameFromNamesChunk, {
    tenantSlug: toolEnv.tenantSlug,
    actor,
    confirm: "STRIP_LEAKED_FILENAME",
    dryRun,
    cursor
  });

  scanned += result.scanned ?? 0;
  matched += result.matched ?? 0;
  patched += result.patched ?? 0;
  skippedEmpty += result.skippedEmpty ?? 0;
  if (!firstSamples && result.samples?.length) {
    firstSamples = result.samples;
  }

  if (iterations % 10 === 0) {
    console.log(JSON.stringify({ iterations, scanned, matched, patched }));
  }

  if (result.isDone) {
    break;
  }
  cursor = result.continueCursor;
}

console.log(
  JSON.stringify(
    { mode: dryRun ? "dry-run" : "apply", scanned, matched, patched, skippedEmpty, samples: firstSamples },
    null,
    2
  )
);

if (dryRun) {
  console.log("\nDry-run afgerond. Voer opnieuw uit met --apply om de namen te patchen.");
}
