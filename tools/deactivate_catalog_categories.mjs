/**
 * Soft-delete (status -> "inactive") van complete catalogus-categorieën, zodat ze
 * uit de catalogus én de product-pickers verdwijnen zonder producten, prijzen of
 * offertehistorie te verwijderen. Omkeerbaar: zet status terug op "active".
 *
 * Klantbesluit 2026-06-17: palletcollectie, douchepanelen, lijm, kit en de
 * egaliseren-producten uit de catalogus. Egaliseren blijft als legkost
 * (serviceCostRules) bestaan — die tabel wordt hier niet geraakt.
 *
 * Gebruik (dev, alleen tellen / dry-run):
 *   node tools/deactivate_catalog_categories.mjs
 * Toepassen op dev:
 *   node tools/deactivate_catalog_categories.mjs --apply
 * Eén losse categorie:
 *   node tools/deactivate_catalog_categories.mjs --category douchepanelen --apply
 * Dry-run op productie:
 *   node tools/deactivate_catalog_categories.mjs --env-file .env.production --target=production
 * Toepassen op productie (bewust):
 *   node tools/deactivate_catalog_categories.mjs --env-file .env.production --target=production \
 *     --apply --confirm-production-category-deactivate
 * Terugdraaien (reactiveren) op dev:
 *   node tools/deactivate_catalog_categories.mjs --reactivate --apply
 *
 * LET OP (runbook):
 * - Niet import-bestendig: een latere prijslijst-import van deze leverancierscategorieën
 *   (Co-pro lijm/kit/egaline, Floorlife palletcollectie/douchepanelen) zet de producten weer
 *   op "active". Draai na zo'n import deze soft-delete opnieuw.
 * - Open inmetingen die vóór de soft-delete een nu-inactief product koppelden, verliezen bij
 *   offerte-conversie hun voorgevulde richtprijs: die regel komt binnen op €0 met handmatige
 *   prijsbepaling (requiresManualProductReview). Geen verlies van de regel/het product, maar de
 *   winkel moet de prijs handmatig zetten. De catalogus-producten zelf, hun prijzen en de
 *   offertehistorie blijven intact (alleen status -> inactive).
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

const DEFAULT_CATEGORY_SLUGS = ["palletcollectie-pvc", "douchepanelen", "lijm", "kit", "egaline"];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });

const apply = hasFlag(toolEnv.args, "--apply");
const dryRun = !apply;
const reactivate = hasFlag(toolEnv.args, "--reactivate");
const categoryOverride = optionValue(toolEnv.args, "--category");
const categorySlugs = categoryOverride ? [categoryOverride] : DEFAULT_CATEGORY_SLUGS;

requireCatalogToolTarget(toolEnv, {
  operation: reactivate
    ? "catalogus categorieën reactiveren"
    : "catalogus categorieën soft-deleten",
  mutates: apply,
  productionConfirmFlag: "--confirm-production-category-deactivate",
  requireAuthzSecret: true
});

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

console.log(
  JSON.stringify(
    {
      ...targetSummary(toolEnv),
      action: reactivate ? "reactivate catalog categories" : "deactivate catalog categories",
      dryRun,
      categorySlugs
    },
    null,
    2
  )
);

const summary = [];

for (const categorySlug of categorySlugs) {
  let cursor;
  let scanned = 0;
  let matched = 0;
  let changed = 0;
  let categoryName = null;
  let categoryFound = false;
  let iterations = 0;

  while (true) {
    iterations += 1;
    const result = await client.mutation(
      api.catalog.maintenance.deactivateProductsByCategoryChunk,
      {
        tenantSlug: toolEnv.tenantSlug,
        actor,
        confirm: "DEACTIVATE_PRODUCTS_BY_CATEGORY",
        categorySlug,
        reactivate,
        dryRun,
        batchSize: 200,
        cursor
      }
    );

    categoryFound = result.categoryFound;
    categoryName = result.categoryName ?? categoryName;
    scanned += result.scanned ?? 0;
    matched += result.matched ?? 0;
    changed += result.changed ?? 0;

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  const row = { categorySlug, categoryName, categoryFound, iterations, scanned, matched, changed };
  summary.push(row);
  console.log(JSON.stringify({ ...row, reactivate, dryRun }, null, 2));
}

console.log(JSON.stringify({ done: true, reactivate, dryRun, summary }, null, 2));

// Luid falen bij een niet-gevonden categorie: anders leest een typefout in een slug als
// "0 gewijzigd, klaar" en blijft de opschoning stilletjes onvolledig.
const missing = summary.filter((row) => !row.categoryFound).map((row) => row.categorySlug);
if (missing.length > 0) {
  console.error(
    `\nWAARSCHUWING: categorie(ën) niet gevonden (slug klopt niet met category.slug): ${missing.join(", ")}. Niets gedaan voor deze. Controleer de slug.`
  );
  process.exitCode = 1;
}
