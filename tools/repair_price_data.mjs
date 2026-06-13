/**
 * Fase 0 van het richtprijs-plan: btw-reparatie + pseudo-prijzen cleanup.
 * Zie docs/technisch/plan-richtprijs-inmeting-2026-06-13.md §4.
 *
 * Standaard draait dit als DRY-RUN (alleen tellen). Pas met --apply wordt er
 * daadwerkelijk gepatcht/verwijderd.
 *
 * Gebruik:
 *   node tools/repair_price_data.mjs                       # dry-run, beide stappen
 *   node tools/repair_price_data.mjs --apply               # uitvoeren op dev
 *   node tools/repair_price_data.mjs --skip-pseudo         # alleen btw-reparatie
 *   node tools/repair_price_data.mjs --skip-vat            # alleen pseudo-cleanup
 *   node tools/repair_price_data.mjs --rules-file=pad.json # eigen btw-regels
 *
 * Productie vereist daarnaast --production --target=production
 * --confirm-production-price-repair en een geldige AUTHZ_TOKEN_SECRET.
 *
 * Btw-regels (--rules-file, JSON-array). Standaardregel volgt het klantbesluit
 * "alle leverancierslijsten zijn exclusief btw": unknown + inclusive → exclusive.
 *
 * LET OP DE VOLGORDE: regels draaien sequentieel en latere regels zien de
 * vatMode die eerdere regels zojuist hebben gezet (last-write-wins). Zet de
 * brede catch-all dus EERST en kolomspecifieke uitzonderingen DAARNA, bv.:
 * [
 *   { "fromModes": ["unknown", "inclusive"], "toMode": "exclusive" },
 *   { "fromModes": ["exclusive"], "toMode": "inclusive",
 *     "sourceColumnNames": ["Adviesverkoopprijs incl. BTW. per verpakking"] }
 * ]
 * Andersom (uitzondering eerst) zou de catch-all de uitzondering meteen weer
 * overschrijven. Kanttekening bij dry-run met meerdere overlappende regels:
 * elke regel telt dan tegen de ÓNgepatchte staat, dus de tellingen voorspellen
 * het apply-eindresultaat niet exact — beoordeel per regel, niet als som.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor } from "./authz_actor.mjs";
import {
  hasFlag,
  loadCatalogToolEnv,
  optionValue,
  requireCatalogToolTarget,
  targetSummary
} from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });

const apply = hasFlag(toolEnv.args, "--apply");
const dryRun = !apply;
const skipVat = hasFlag(toolEnv.args, "--skip-vat");
const skipPseudo = hasFlag(toolEnv.args, "--skip-pseudo");
const skipPackageContent = hasFlag(toolEnv.args, "--skip-package-content");
const rulesFile = optionValue(toolEnv.args, "--rules-file");
const batchSize = Number(optionValue(toolEnv.args, "--batch-size") ?? 1000);

if (skipVat && skipPseudo && skipPackageContent) {
  throw new Error("Niets te doen: alle stappen zijn overgeslagen.");
}

requireCatalogToolTarget(toolEnv, {
  operation: "prijsdata repareren (vatMode + pseudo-prijzen)",
  mutates: apply,
  productionConfirmFlag: "--confirm-production-price-repair",
  requireAuthzSecret: true
});

const DEFAULT_VAT_RULES = [
  // Klantbesluit 2026-06-13: alle leverancierslijsten zijn exclusief btw.
  { fromModes: ["unknown", "inclusive"], toMode: "exclusive" }
];

const vatRules = rulesFile
  ? JSON.parse(readFileSync(resolve(root, rulesFile), "utf8"))
  : DEFAULT_VAT_RULES;

if (!Array.isArray(vatRules) || vatRules.length === 0) {
  throw new Error("Btw-regels moeten een niet-lege JSON-array zijn.");
}

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

console.log(
  JSON.stringify(
    {
      ...targetSummary(toolEnv),
      action: "repair price data",
      mode: dryRun ? "dry-run" : "apply",
      steps: {
        vatRepair: !skipVat,
        pseudoCleanup: !skipPseudo
      },
      vatRules: skipVat ? undefined : vatRules
    },
    null,
    2
  )
);

function mergeBreakdown(target, source) {
  for (const { key, count } of source ?? []) {
    target[key] = (target[key] ?? 0) + count;
  }
}

async function runChunked(label, runChunk) {
  let cursor = undefined;
  let iterations = 0;
  let scanned = 0;
  let matched = 0;
  const breakdown = {};

  while (true) {
    iterations += 1;
    const result = await runChunk(cursor);

    scanned += result.scanned ?? 0;
    matched += result.matched ?? 0;
    mergeBreakdown(breakdown, result.breakdown);

    if (iterations % 10 === 0) {
      console.log(JSON.stringify({ step: label, iterations, scanned, matched }));
    }

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  return { iterations, scanned, matched, breakdown };
}

const report = { mode: dryRun ? "dry-run" : "apply" };

if (!skipVat) {
  report.vatRepair = [];

  for (const [index, rule] of vatRules.entries()) {
    const summary = await runChunked(`vat-rule-${index + 1}`, (cursor) =>
      client.mutation(api.catalog.maintenance.repairPriceVatModesChunk, {
        tenantSlug: toolEnv.tenantSlug,
        actor,
        confirm: "REPAIR_PRICE_VAT_MODES",
        rule,
        dryRun,
        batchSize,
        cursor
      })
    );

    report.vatRepair.push({ rule, ...summary });
  }
}

if (!skipPseudo) {
  report.pseudoCleanup = await runChunked("pseudo-cleanup", (cursor) =>
    client.mutation(api.catalog.maintenance.deletePseudoPriceRowsChunk, {
      tenantSlug: toolEnv.tenantSlug,
      actor,
      confirm: "DELETE_PSEUDO_PRICE_ROWS",
      dryRun,
      batchSize,
      cursor
    })
  );
}

if (!skipPackageContent) {
  report.packageContent = await runChunked("package-content", (cursor) =>
    client.mutation(api.catalog.maintenance.repairPackageContentChunk, {
      tenantSlug: toolEnv.tenantSlug,
      actor,
      confirm: "REPAIR_PACKAGE_CONTENT",
      dryRun,
      batchSize,
      cursor
    })
  );
}

console.log(JSON.stringify(report, null, 2));

if (!skipVat && vatRules.length > 1) {
  console.log(
    "\nLet op: bij meerdere (overlappende) regels telt een dry-run per regel tegen de ongepatchte staat; het apply-eindresultaat volgt de regelvolgorde (last-write-wins)."
  );
}

if (!skipVat) {
  console.log(
    "\nLet op: dit script repareert alleen bestaande prijsregels, NIET de importprofiel-mappings. Controleer vóór een volgende catalogus-import de btw-workbench in de portal (de ZTAHL-verkooplijst stond bijvoorbeeld op 'inclusive'), anders komt de oude btw-stand bij her-import terug."
  );
}

if (dryRun) {
  console.log("\nDry-run afgerond. Voer opnieuw uit met --apply om de wijzigingen door te voeren.");
}
