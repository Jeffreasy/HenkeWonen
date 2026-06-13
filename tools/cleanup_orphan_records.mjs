/**
 * Ruimt de 13 cascade-delete-wezen op productie op (resten van verwijderde
 * test-projecten/quotes), geïdentificeerd in
 * docs/release-readiness/data-issues/prod-cleanup-analysis-2026-06-13.md §B1.
 *
 * Veilig: per-tabel, admin-actor + confirm + dryRun-default + tenant-scope in de
 * mutatie (deleteDocumentsByIdChunk). Standaard dry-run; pas met --apply wordt er
 * verwijderd.
 *
 * Gebruik:
 *   node tools/cleanup_orphan_records.mjs                       # dry-run (dev)
 *   node tools/cleanup_orphan_records.mjs --apply               # verwijder (dev)
 *
 * Productie vereist: --production --target=production
 *   --confirm-production-orphan-cleanup en een geldige AUTHZ_TOKEN_SECRET (zie §6 overdracht).
 *
 * LET OP: de IDs hieronder zijn de vooraf geverifieerde prod-wezen van 2026-06-13.
 * Controleer eerst met een dry-run dat matched == verwacht en skipped leeg is.
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

// Cascade-wezen per tabel (prod accomplished-kangaroo-354, audit 2026-06-13 §B1).
const ORPHANS = {
  projectRooms: [
    "m577fkfsp3c2bppkrmrsbz606588dn69",
    "m57914wby4jcspx11e4pcx1bsh88cdcm"
  ],
  projectTasks: [
    "ns70tjtf30pj8dk64744zap9v988c0r7",
    "ns74qyzs2wts2dtzt0yjt6rhr588dass",
    "ns7a3hr3zw4rvjpeffvmmd30g588cetz"
  ],
  projectWorkflowEvents: [
    "m9720rj4kwh0zaczpejq141kws88c5dr",
    "m973gdh3rk2nkk1vvd95efknes88dvf6",
    "m9748xkss5xxv5kf4rd719g4w188cp9f",
    "m974zfn54v6rvx2mvarn9hje5588cq0n",
    "m97afvnp742yc8nw8g38wrstf188c06y",
    "m97akxxxrjw0q0cgta0asysjfd88crbp",
    "m97ft6nj4gqhz20gny8j8tgmz188cwwr"
  ],
  quoteLines: [
    "mh77mas12gtr0dsf82wpd06md588dp8t"
  ]
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });
const apply = hasFlag(toolEnv.args, "--apply");
const dryRun = !apply;

requireCatalogToolTarget(toolEnv, {
  operation: "cascade-wezen opruimen (prod-orphans)",
  mutates: apply,
  productionConfirmFlag: "--confirm-production-orphan-cleanup",
  requireAuthzSecret: true
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

console.log(JSON.stringify({ ...targetSummary(toolEnv), mode: dryRun ? "dry-run" : "apply" }, null, 2));

const summary = {};
let totalMatched = 0;
let totalDeleted = 0;

for (const [table, ids] of Object.entries(ORPHANS)) {
  const result = await client.mutation(api.catalog.maintenance.deleteDocumentsByIdChunk, {
    tenantSlug: toolEnv.tenantSlug,
    actor,
    confirm: "DELETE_ORPHAN_RECORDS",
    table,
    ids,
    dryRun
  });
  summary[table] = result;
  totalMatched += result.matched ?? 0;
  totalDeleted += result.deleted ?? 0;
  console.log(JSON.stringify({ table, ...result }, null, 2));
}

console.log(
  JSON.stringify(
    { mode: dryRun ? "dry-run" : "apply", totalRequested: 13, totalMatched, totalDeleted, summary },
    null,
    2
  )
);

if (dryRun) {
  console.log("\nDry-run afgerond. Controleer matched/skipped en voer opnieuw uit met --apply (+ prod-vlaggen voor productie).");
}
