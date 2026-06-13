/**
 * Read-only audit van leveranciersproducten in Convex: telling per
 * (categorie, productKind, unit) + voorbeeldattributen.
 *
 * Gebruik: node tools/audit_supplier_products.mjs --supplier Casadeco
 *          node tools/audit_supplier_products.mjs --suppliers=Casadeco,Caselio
 * (geen positionals: het eerste positional-argument is per conventie de tenant-slug)
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor } from "./authz_actor.mjs";
import { loadCatalogToolEnv, optionValue, requireCatalogToolTarget, targetSummary } from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });

const suppliers = optionValue(toolEnv.args, "--supplier")
  ? [optionValue(toolEnv.args, "--supplier")]
  : optionValue(toolEnv.args, "--suppliers")
    ? optionValue(toolEnv.args, "--suppliers").split(",").map((name) => name.trim()).filter(Boolean)
    : ["Casadeco", "Caselio", "Casamance", "Texdecor"];

requireCatalogToolTarget(toolEnv, { operation: "leveranciersproducten auditen", mutates: false });

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

console.log(JSON.stringify({ ...targetSummary(toolEnv), suppliers }, null, 2));

for (const supplierName of suppliers) {
  let cursor = undefined;
  const groups = {};
  let samples = [];
  let total = 0;
  let supplierFound = true;

  while (true) {
    const result = await client.query(api.catalog.maintenance.supplierProductAudit, {
      tenantSlug: toolEnv.tenantSlug,
      actor,
      supplierName,
      cursor
    });

    if (!result.supplierFound) {
      supplierFound = false;
      break;
    }

    total += result.scanned ?? 0;

    for (const { key, count } of result.groups ?? []) {
      groups[key] = (groups[key] ?? 0) + count;
    }

    if (samples.length === 0) {
      samples = result.samples ?? [];
    }

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  console.log(JSON.stringify({ supplierName, supplierFound, total, groups, samples }, null, 2));
}
