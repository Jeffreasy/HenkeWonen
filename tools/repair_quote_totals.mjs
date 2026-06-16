/**
 * Herstelt offertes waarvan de OPGESLAGEN totalen (subtotaalExBtw / btwTotaal /
 * totaalInclBtw) niet kloppen met de som van hun regels — de schade van de bug
 * waarbij recalculateQuote niet-bestaande regelvelden las (NaN-totalen die naar
 * facturen lekten). De regel-totalen zelf zijn correct; alleen het quote-aggregaat
 * wordt opnieuw berekend en weggeschreven.
 *
 * Standaard dry-run (telt + toont voorbeelden); pas met --apply wordt er gepatcht.
 *
 * Gebruik:
 *   node tools/repair_quote_totals.mjs            # dry-run (dev)
 *   node tools/repair_quote_totals.mjs --apply
 *
 * Productie vereist: --production --target=production
 *   --confirm-production-quote-totals-repair en een geldige AUTHZ_TOKEN_SECRET.
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
  operation: "Offerte-totalen herstellen (NaN/afgedreven aggregaten)",
  mutates: apply,
  productionConfirmFlag: "--confirm-production-quote-totals-repair",
  requireAuthzSecret: true
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

console.log(
  JSON.stringify(
    { ...targetSummary(toolEnv), action: "repair quote totals", mode: dryRun ? "dry-run" : "apply" },
    null,
    2
  )
);

let cursor = undefined;
let iterations = 0;
let scanned = 0;
let mismatched = 0;
let nanCount = 0;
let patched = 0;
const samples = [];

while (true) {
  iterations += 1;
  const result = await client.mutation(api.offertes.maintenance.recalculateQuoteTotalsChunk, {
    tenantSlug: toolEnv.tenantSlug,
    actor,
    confirm: "REPAIR_QUOTE_TOTALS",
    dryRun,
    cursor
  });

  scanned += result.scanned ?? 0;
  mismatched += result.mismatched ?? 0;
  nanCount += result.nanCount ?? 0;
  patched += result.patched ?? 0;
  for (const sample of result.samples ?? []) {
    if (samples.length < 25) {
      samples.push(sample);
    }
  }

  if (iterations % 10 === 0) {
    console.log(JSON.stringify({ iterations, scanned, mismatched, nanCount, patched }));
  }

  if (result.isDone) {
    break;
  }

  cursor = result.continueCursor;
}

console.log(
  JSON.stringify(
    { mode: dryRun ? "dry-run" : "apply", iterations, scanned, mismatched, nanCount, patched, samples },
    null,
    2
  )
);

if (dryRun) {
  console.log(
    `\nDry-run afgerond: ${mismatched} offerte(s) met onjuiste totalen (waarvan ${nanCount} NaN/null). ` +
      "Voer opnieuw uit met --apply om te herstellen."
  );
} else {
  console.log(`\nHerstel afgerond: ${patched} offerte(s) bijgewerkt.`);
}
