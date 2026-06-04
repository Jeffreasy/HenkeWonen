import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor } from "./authz_actor.mjs";
import {
  loadCatalogToolEnv,
  optionValue,
  requireCatalogToolTarget,
  targetSummary
} from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });
const previewFileArg = optionValue(toolEnv.args, "--preview-file");
const previewPath = previewFileArg
  ? resolve(root, previewFileArg)
  : resolve(root, "docs/generated/catalog-import-preview.json");
const dateStamp = optionValue(toolEnv.args, "--date-stamp") ?? new Date().toISOString().slice(0, 10);
const batchSizeRaw = optionValue(toolEnv.args, "--batch-size") ?? "25";
const batchSizeNumber = Number(batchSizeRaw);

if (!Number.isFinite(batchSizeNumber)) {
  throw new Error("--batch-size moet een getal zijn.");
}

const batchSize = Math.min(Math.max(Math.trunc(batchSizeNumber), 1), 100);

requireCatalogToolTarget(toolEnv, {
  operation: "duplicate-EAN sync",
  mutates: true,
  requireAuthzSecret: toolEnv.target === "production",
  productionConfirmFlag: "--confirm-production-duplicate-ean-sync"
});

function cleanText(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function uniqueTexts(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}

function productIdentity(row) {
  return cleanText(row.importKey) ?? [row.supplierName, row.ean, row.productName].join("|");
}

function buildDuplicateGroups(rows) {
  const bySupplierEan = new Map();

  for (const row of rows) {
    const supplierName = cleanText(row.supplierName);
    const ean = cleanText(row.ean);

    if (!supplierName || !ean) {
      continue;
    }

    const key = `${supplierName}|||${ean}`;
    const productMap = bySupplierEan.get(key) ?? new Map();

    productMap.set(
      productIdentity(row),
      compactObject({
        importKey: cleanText(row.importKey),
        productName: cleanText(row.productName) ?? "Onbekend product",
        articleNumber: cleanText(row.articleNumber),
        supplierCode: cleanText(row.supplierCode),
        sourceFileName: cleanText(row.sourceFileName),
        sourceSheetName: cleanText(row.sourceSheetName),
        sourceRowNumber: typeof row.sourceRowNumber === "number" ? row.sourceRowNumber : undefined
      })
    );
    bySupplierEan.set(key, productMap);
  }

  return [...bySupplierEan.entries()]
    .map(([key, productMap]) => {
      const [supplierName, ean] = key.split("|||");

      return {
        supplierName,
        ean,
        products: [...productMap.values()]
      };
    })
    .filter((group) => group.products.length > 1)
    .sort(
      (left, right) =>
        left.supplierName.localeCompare(right.supplierName, "nl") || left.ean.localeCompare(right.ean)
    );
}

function groupSummary(groups) {
  const bySupplier = {};
  const bySourceFile = {};

  for (const group of groups) {
    bySupplier[group.supplierName] ??= { groups: 0, products: 0 };
    bySupplier[group.supplierName].groups += 1;
    bySupplier[group.supplierName].products += group.products.length;

    for (const sourceFileName of uniqueTexts(group.products.map((product) => product.sourceFileName))) {
      bySourceFile[sourceFileName] ??= { groups: 0, products: 0 };
      bySourceFile[sourceFileName].groups += 1;
      bySourceFile[sourceFileName].products += group.products.length;
    }
  }

  return { bySupplier, bySourceFile };
}

function tableRow(values) {
  return `| ${values.map((value) => String(value ?? "-").replaceAll("|", "\\|")).join(" | ")} |`;
}

function buildMarkdown({ groups, summary, syncResult, target }) {
  const lines = [
    `# Duplicate-EAN review - ${dateStamp}`,
    "",
    "Deze export is opgebouwd vanuit `docs/generated/catalog-import-preview.json` en daarna batchgewijs gesynchroniseerd naar Convex development.",
    "",
    "## Samenvatting",
    "",
    `- Target: ${target.target}`,
    `- Convex deployment: ${target.convexDeployment}`,
    `- Duplicate groepen: ${groups.length}`,
    `- Producten in duplicate groepen: ${groups.reduce((sum, group) => sum + group.products.length, 0)}`,
    `- Sync created: ${syncResult.created}`,
    `- Sync updated: ${syncResult.updated}`,
    `- Sync skipped: ${syncResult.skipped}`,
    `- Active after finalize: ${syncResult.active ?? groups.length}`,
    `- Stale resolved: ${syncResult.resolvedStale}`,
    "",
    "## Per leverancier",
    "",
    tableRow(["Leverancier", "Groepen", "Producten"]),
    "| --- | ---: | ---: |",
    ...Object.entries(summary.bySupplier).map(([supplierName, value]) =>
      tableRow([supplierName, value.groups, value.products])
    ),
    "",
    "## Per bronbestand",
    "",
    tableRow(["Bronbestand", "Groepen", "Producten"]),
    "| --- | ---: | ---: |",
    ...Object.entries(summary.bySourceFile).map(([sourceFileName, value]) =>
      tableRow([sourceFileName, value.groups, value.products])
    ),
    "",
    "## Eerste voorbeelden",
    "",
    tableRow(["Leverancier", "EAN", "Producten", "Productnamen"]),
    "| --- | --- | ---: | --- |",
    ...groups.slice(0, 25).map((group) =>
      tableRow([
        group.supplierName,
        group.ean,
        group.products.length,
        uniqueTexts(group.products.map((product) => product.productName)).slice(0, 4).join("; ")
      ])
    ),
    ""
  ];

  return lines.join("\n");
}

function chunk(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

const payload = JSON.parse(readFileSync(previewPath, "utf8"));
const rows = Array.isArray(payload.rows) ? payload.rows : [];
const groups = buildDuplicateGroups(rows);
const syncRunId = `duplicate-ean-${dateStamp}-${Date.now()}`;
const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);
const syncTotals = { created: 0, updated: 0, skipped: 0, resolvedStale: 0 };
const batches = chunk(groups, batchSize);

for (const [index, batch] of batches.entries()) {
  const result = await client.mutation(api.catalog.review.syncDuplicateEanIssues, {
    tenantSlug: toolEnv.tenantSlug,
    actor,
    groups: batch,
    syncRunId
  });

  syncTotals.created += result.created ?? 0;
  syncTotals.updated += result.updated ?? 0;
  syncTotals.skipped += result.skipped ?? 0;

  if ((index + 1) % 10 === 0 || index + 1 === batches.length) {
    console.log(
      JSON.stringify(
        {
          batchesDone: index + 1,
          batchesTotal: batches.length,
          syncTotals
        },
        null,
        2
      )
    );
  }
}

const finalize = await client.mutation(api.catalog.review.finalizeDuplicateEanIssueSync, {
  tenantSlug: toolEnv.tenantSlug,
  actor,
  syncRunId
});
syncTotals.resolvedStale = finalize.resolvedStale ?? 0;
syncTotals.active = finalize.active ?? groups.length;

const summary = groupSummary(groups);
const outputDir = resolve(root, "docs/release-readiness/data-issues");
const outputJson = resolve(outputDir, `catalog-duplicate-ean-review-${dateStamp}.json`);
const outputMd = resolve(outputDir, `catalog-duplicate-ean-review-${dateStamp}.md`);
const target = targetSummary(toolEnv);
const result = {
  tenantSlug: toolEnv.tenantSlug,
  target,
  syncRunId,
  previewFile: previewPath,
  duplicateGroupCount: groups.length,
  duplicateProductCount: groups.reduce((sum, group) => sum + group.products.length, 0),
  sync: {
    ...syncTotals
  },
  summary,
  groups
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputJson, `${JSON.stringify(result, null, 2)}\n`, "utf8");
writeFileSync(outputMd, buildMarkdown({ groups, summary, syncResult: syncTotals, target }), "utf8");

console.log(
  JSON.stringify(
    {
      ...target,
      syncRunId,
      duplicateGroupCount: result.duplicateGroupCount,
      duplicateProductCount: result.duplicateProductCount,
      sync: result.sync,
      outputJson: "docs/release-readiness/data-issues/" + outputJson.split(/[\\/]/).at(-1),
      outputMarkdown: "docs/release-readiness/data-issues/" + outputMd.split(/[\\/]/).at(-1)
    },
    null,
    2
  )
);
