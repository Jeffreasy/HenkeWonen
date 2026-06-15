/**
 * Driver voor de eenmalige ruimte-koppeling-backfill (ruimte-model A).
 *
 * Koppelt bestaande inmeet-ruimtes (measurementRooms) zonder dossier-koppeling aan een
 * dossier-ruimte (find-or-create op naam), zodat measurementRooms.projectRuimteId daarna
 * verplicht kan worden gemaakt. Standaard DRY-RUN; pas met --apply wordt er gekoppeld.
 *
 * Gebruik (dev):
 *   node tools/backfill_room_links.mjs            # dry-run op dev
 *   node tools/backfill_room_links.mjs --apply    # uitvoeren op dev
 *
 * Productie (EIGENAARSACTIE):
 *   node tools/backfill_room_links.mjs --apply --env-file .env.production --production \
 *     --target=production --confirm-production-room-backfill   (vereist AUTHZ_TOKEN_SECRET)
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
  operation: "ruimte-koppelingen backfillen",
  mutates: apply,
  productionConfirmFlag: "--confirm-production-room-backfill",
  requireAuthzSecret: true
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

const agg = { scanned: 0, alreadyLinked: 0, matched: 0, linked: 0, skippedNoMeasurement: 0 };
let cursor = undefined;

while (true) {
  const result = await client.mutation(
    api.projecten.measurements.backfillMeasurementRoomLinksChunk,
    { tenantSlug: toolEnv.tenantSlug, actor, confirm: "BACKFILL_ROOM_LINKS", dryRun, cursor }
  );

  for (const key of Object.keys(agg)) {
    agg[key] += result[key] ?? 0;
  }

  if (result.isDone) break;
  cursor = result.continueCursor;
}

console.log(
  JSON.stringify({ ...targetSummary(toolEnv), mode: dryRun ? "dry-run" : "apply", ...agg }, null, 2)
);
console.log(
  dryRun
    ? `\nDry-run: ${agg.matched} inmeet-ruimte(s) zonder koppeling gevonden. Draai met --apply om te koppelen.`
    : `\n${agg.linked} inmeet-ruimte(s) gekoppeld aan een dossier-ruimte (${agg.alreadyLinked} waren al gekoppeld).`
);
