/**
 * Driver voor de NL-veldnaam-datamigratie (Fase 2).
 *
 * Leest de bevroren spec tools/nl-rename-spec.json en draait per tabel de
 * chunked mutatie api.beheer.migrateNlFields.renameFieldsChunk (cursor-loop).
 * Standaard DRY-RUN (telt alleen). Pas met --apply wordt er gepatcht.
 *
 * Gebruik (dev):
 *   node tools/migrate_nl_fields.mjs                 # dry-run op dev
 *   node tools/migrate_nl_fields.mjs --apply         # uitvoeren op dev
 *   node tools/migrate_nl_fields.mjs --verify        # tel resterende OUDE velden (na apply: overal 0)
 *   node tools/migrate_nl_fields.mjs --only=products,quoteTemplates
 *
 * Productie (EIGENAARSACTIE — een AI muteert prod niet):
 *   1. npx convex export --prod --path <duurzaam pad buiten repo>.zip   (backup, bevat PII)
 *   2. zet { schemaValidation: false } in convex/schema.ts → npx convex deploy --prod
 *   3. node tools/migrate_nl_fields.mjs --apply \
 *        --env-file .env.production --production --target=production \
 *        --confirm-production-nl-rename     (vereist AUTHZ_TOKEN_SECRET in dat env-bestand)
 *   4. node tools/migrate_nl_fields.mjs --verify --env-file .env.production --production --target=production
 *      → moet overal docsWithAnyOld: 0 geven
 *   5. zet { schemaValidation: true } terug → npx convex deploy --prod
 *      (de deploy-validatie faalt zodra er nog één EN-veld rest = extra vangnet)
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
const verify = hasFlag(toolEnv.args, "--verify");
const dryRun = !apply;
const batchSize = Number(optionValue(toolEnv.args, "--batch-size") ?? 500);
const onlyOption = optionValue(toolEnv.args, "--only");
const onlyTables = onlyOption ? new Set(onlyOption.split(",").map((s) => s.trim())) : null;

requireCatalogToolTarget(toolEnv, {
  operation: "NL-veldnaam-datamigratie",
  mutates: apply,
  productionConfirmFlag: "--confirm-production-nl-rename",
  requireAuthzSecret: true
});

const specDoc = JSON.parse(readFileSync(resolve(root, "tools/nl-rename-spec.json"), "utf8"));
const allTables = Object.keys(specDoc.tables);
const tables = onlyTables ? allTables.filter((t) => onlyTables.has(t)) : allTables;

if (tables.length === 0) {
  throw new Error(`Geen tabellen geselecteerd (spec heeft: ${allTables.join(", ")}).`);
}

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

console.log(
  JSON.stringify(
    {
      ...targetSummary(toolEnv),
      action: verify ? "verify remaining old fields" : "rename NL fields",
      mode: verify ? "verify" : dryRun ? "dry-run" : "apply",
      tables,
      batchSize
    },
    null,
    2
  )
);

async function runChunked(label, runChunk) {
  let cursor = undefined;
  let iterations = 0;
  const agg = {};

  while (true) {
    iterations += 1;
    const result = await runChunk(cursor);

    for (const [k, val] of Object.entries(result)) {
      if (typeof val === "number") agg[k] = (agg[k] ?? 0) + val;
    }

    if (iterations % 20 === 0) {
      console.log(JSON.stringify({ step: label, iterations, ...agg }));
    }

    if (result.isDone) {
      // Bewaar laatste samples/perField voor de rapportage.
      if (result.samples?.length) agg.samples = result.samples;
      if (result.perField?.length) agg.perField = result.perField;
      break;
    }

    cursor = result.continueCursor;
  }

  return { iterations, ...agg };
}

const report = { mode: verify ? "verify" : dryRun ? "dry-run" : "apply", tables: {} };

for (const table of tables) {
  const spec = specDoc.tables[table];

  if (verify) {
    const oldFieldNames = [
      ...Object.keys(spec.fields),
      ...spec.nestedArrays.filter((n) => n.oldOuter !== n.newOuter).map((n) => n.oldOuter)
    ];

    report.tables[table] = await runChunked(`verify:${table}`, (cursor) =>
      client.mutation(api.beheer.migrateNlFields.countRemainingOldFields, {
        tenantSlug: toolEnv.tenantSlug,
        actor,
        table,
        oldFieldNames,
        batchSize: 1000,
        cursor
      })
    );
    continue;
  }

  report.tables[table] = await runChunked(`rename:${table}`, (cursor) =>
    client.mutation(api.beheer.migrateNlFields.renameFieldsChunk, {
      tenantSlug: toolEnv.tenantSlug,
      actor,
      confirm: "RENAME_NL_FIELDS",
      table,
      spec,
      dryRun,
      batchSize,
      cursor
    })
  );
}

console.log(JSON.stringify(report, null, 2));

if (verify) {
  const dirty = Object.entries(report.tables).filter(([, r]) => (r.docsWithAnyOld ?? 0) > 0);
  if (dirty.length === 0) {
    console.log("\n✅ Geen resterende oude (Engelse) velden gevonden — migratie compleet.");
  } else {
    console.log(`\n❌ Nog ${dirty.length} tabel(len) met oude velden: ${dirty.map(([t]) => t).join(", ")}`);
    process.exitCode = 1;
  }
} else {
  const totalMatched = Object.values(report.tables).reduce((s, r) => s + (r.matched ?? 0), 0);
  console.log(
    `\n${dryRun ? "Dry-run" : "Apply"}: ${totalMatched} docs ${dryRun ? "zouden worden" : "zijn"} gemigreerd over ${tables.length} tabellen.`
  );
  if (dryRun) {
    console.log("Draai opnieuw met --apply om de migratie uit te voeren (na backup + schemaValidation:false).");
  }
}
