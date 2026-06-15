/**
 * Hercategoriseert Texdecor-producten (Casadeco/Caselio/Casamance) die door de
 * dubbele-spatie-parserbug in "Overig" stonden, op basis van het bewaarde
 * "Nom Type support"-attribuut, en zet de priceUnit van hun adviesprijsregels
 * van "custom" naar de juiste eenheid (roll/m1/piece).
 *
 * Standaard dry-run; pas met --apply wordt er gepatcht.
 *
 * Gebruik:
 *   node tools/repair_texdecor_categories.mjs           # dry-run
 *   node tools/repair_texdecor_categories.mjs --apply
 *
 * Productie vereist --production --target=production
 * --confirm-production-texdecor-repair en een geldige AUTHZ_TOKEN_SECRET.
 */
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
const suppliers = optionValue(toolEnv.args, "--suppliers")
  ? optionValue(toolEnv.args, "--suppliers").split(",").map((name) => name.trim()).filter(Boolean)
  : ["Casadeco", "Caselio", "Casamance"];

requireCatalogToolTarget(toolEnv, {
  operation: "Texdecor-categorieën repareren",
  mutates: apply,
  productionConfirmFlag: "--confirm-production-texdecor-repair",
  requireAuthzSecret: true
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

console.log(
  JSON.stringify(
    { ...targetSummary(toolEnv), action: "repair texdecor categories", mode: dryRun ? "dry-run" : "apply", suppliers },
    null,
    2
  )
);

const report = { mode: dryRun ? "dry-run" : "apply", suppliers: {} };

for (const supplierName of suppliers) {
  let cursor = undefined;
  let iterations = 0;
  let scanned = 0;
  let matched = 0;
  let productsPatched = 0;
  let priceRowsPatched = 0;
  const breakdown = {};
  let supplierFound = true;

  while (true) {
    iterations += 1;
    const result = await client.mutation(api.catalog.maintenance.repairTexdecorCategoriesChunk, {
      tenantSlug: toolEnv.tenantSlug,
      actor,
      confirm: "REPAIR_TEXDECOR_CATEGORIES",
      leverancierNaam: supplierName,
      dryRun,
      cursor
    });

    if (!result.supplierFound) {
      supplierFound = false;
      break;
    }

    scanned += result.scanned ?? 0;
    matched += result.matched ?? 0;
    productsPatched += result.productsPatched ?? 0;
    priceRowsPatched += result.priceRowsPatched ?? 0;

    for (const { key, count } of result.breakdown ?? []) {
      breakdown[key] = (breakdown[key] ?? 0) + count;
    }

    if (iterations % 10 === 0) {
      console.log(JSON.stringify({ supplierName, iterations, scanned, matched }));
    }

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  report.suppliers[supplierName] = supplierFound
    ? { iterations, scanned, matched, productsPatched, priceRowsPatched, breakdown }
    : { supplierFound: false };
}

console.log(JSON.stringify(report, null, 2));

if (dryRun) {
  console.log("\nDry-run afgerond. Voer opnieuw uit met --apply om de wijzigingen door te voeren.");
}
