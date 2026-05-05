import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor } from "./authz_actor.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const previewPath = resolve(root, "docs/catalog-import-preview.json");
const envPath = resolve(root, ".env.local");
const args = new Set(process.argv.slice(2));
const allowUnknownVatMode = args.has("--allow-unknown-vat");
const noCommit = args.has("--no-commit");

function loadEnv(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0 && !process.env[key]) {
        process.env[key] = rest.join("=");
      }
    }
  } catch {
    // Environment can also be provided by the shell.
  }
}

function chunk(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const values = groups.get(key) ?? [];
    values.push(row);
    groups.set(key, values);
  }
  return groups;
}

function fileTypeFor(fileName) {
  return fileName.toLowerCase().endsWith(".xls") ? "xls" : "xlsx";
}

function wildcardToRegExp(pattern) {
  return new RegExp(
    `^${String(pattern)
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replaceAll("*", ".*")}$`,
    "i"
  );
}

function profileMatchesFile(profile, sourceFileName) {
  return profile.filePattern ? wildcardToRegExp(profile.filePattern).test(sourceFileName) : false;
}

function profilePriceColumns(profile) {
  return Array.isArray(profile.priceColumnMappings) ? profile.priceColumnMappings : [];
}

function currentColumnVatMode(profile, sourceColumnName) {
  const column = profilePriceColumns(profile).find(
    (item) => (item.header ?? item.sourceColumnName) === sourceColumnName
  );
  return column?.vatMode ?? profile.vatModeByPriceColumn?.[sourceColumnName] ?? "unknown";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && value.constructor === Object;
}

function isSafeConvexFieldName(key) {
  return typeof key === "string" && key.length > 0 && /^[\x20-\x7E]+$/.test(key);
}

function toConvexValue(value) {
  if (Array.isArray(value)) {
    return value.map(toConvexValue);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const entries = Object.entries(value);
  const hasUnsafeKey = entries.some(([key]) => !isSafeConvexFieldName(key));

  if (hasUnsafeKey) {
    return {
      __encodedObject: true,
      entries: entries.map(([key, entryValue]) => ({
        key,
        value: toConvexValue(entryValue),
      })),
    };
  }

  return Object.fromEntries(entries.map(([key, entryValue]) => [key, toConvexValue(entryValue)]));
}

function toPreviewRow(row) {
  if (row.rowKind && row.raw) {
    const sanitized = {
      ...row,
      raw: toConvexValue(row.raw),
    };

    if (Object.prototype.hasOwnProperty.call(row, "normalized")) {
      sanitized.normalized = toConvexValue(row.normalized);
    }

    return sanitized;
  }

  return {
    rowKind: "product",
    status: "valid",
    sourceFileName: row.sourceFileName,
    sourceSheetName: row.sourceSheetName,
    rowNumber: row.sourceRowNumber,
    rowHash: row.importKey,
    raw: toConvexValue(row),
    normalized: toConvexValue(row),
    warnings: [],
    errors: [],
  };
}

function applyProfileVatMappingsToRow(row, profile) {
  const normalized = row.normalized;

  if (!normalized || !Array.isArray(normalized.prices) || !profile) {
    return row;
  }

  const prices = normalized.prices.map((price) => {
    const sourceColumnName = price.sourceColumnName;
    const mappedVatMode = sourceColumnName ? currentColumnVatMode(profile, sourceColumnName) : "unknown";

    return mappedVatMode === "inclusive" || mappedVatMode === "exclusive"
      ? {
          ...price,
          vatMode: mappedVatMode,
        }
      : price;
  });
  const stillHasUnknownVatMode = prices.some((price) => price.vatMode === "unknown");
  const warnings = stillHasUnknownVatMode
    ? row.warnings ?? []
    : (row.warnings ?? []).filter((warning) => warning !== "Btw-modus onbekend voor een of meer prijskolommen.");

  return {
    ...row,
    status: row.errors?.length > 0 ? "error" : warnings.length > 0 ? "warning" : row.status === "ignored" ? "ignored" : "valid",
    warnings,
    normalized: {
      ...normalized,
      prices,
    },
  };
}

loadEnv(envPath);

const convexUrl = process.env.PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("PUBLIC_CONVEX_URL is missing. Check .env.local.");
}

const client = new ConvexHttpClient(convexUrl);
const defaultTenantSlug = "henke-wonen";
const initialVatReview = await client.query(api.catalogReview.vatMappingReview, {
  tenantSlug: defaultTenantSlug,
});
const initialUnresolvedProfileMappings = initialVatReview.rows.filter(
  (row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode
);

if (!allowUnknownVatMode && !noCommit && initialUnresolvedProfileMappings.length > 0) {
  const samples = initialUnresolvedProfileMappings.slice(0, 12).map((row) => ({
    profileName: row.profileName,
    sourceColumnName: row.sourceColumnName,
    detectedPriceType: row.detectedPriceType,
    detectedUnit: row.detectedUnit,
    suggestedVatMode: row.suggestedVatMode,
    confidence: row.confidence,
  }));

  throw new Error(
    `This import contains unresolved vatMode mappings (${initialUnresolvedProfileMappings.length} profile columns). ` +
      `Set profile price columns to inclusive/exclusive or explicitly allow unknown per profile. Samples: ${JSON.stringify(samples)}`
  );
}

const payload = JSON.parse(readFileSync(previewPath, "utf8"));
const rows = payload.rows ?? [];
const tenantSlug = payload.tenantSlug ?? "henke-wonen";
const actor = createToolMutationActor(tenantSlug);
const vatReview =
  tenantSlug === defaultTenantSlug
    ? initialVatReview
    : await client.query(api.catalogReview.vatMappingReview, { tenantSlug });
const profiles = await client.query(api.imports.listProfilesForPortal, { tenantSlug });
const profileBySourceFile = new Map();

for (const row of payload.previewRows ?? rows.map(toPreviewRow)) {
  const sourceFileName = row.sourceFileName ?? row.normalized?.sourceFileName ?? "Onbekend bestand";
  if (!profileBySourceFile.has(sourceFileName)) {
    profileBySourceFile.set(
      sourceFileName,
      profiles.find((profile) => profileMatchesFile(profile, sourceFileName))
    );
  }
}

const unresolvedProfileMappings = vatReview.rows.filter(
  (row) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode
);
const previewRows = (payload.previewRows ?? rows.map(toPreviewRow)).map((row) => {
  const sourceFileName = row.sourceFileName ?? row.normalized?.sourceFileName ?? "Onbekend bestand";
  return applyProfileVatMappingsToRow(row, profileBySourceFile.get(sourceFileName));
});
const groups = groupBy(previewRows, (row) => row.sourceFileName ?? row.normalized?.sourceFileName ?? "Onbekend bestand");
const unknownVatRows = previewRows.filter(
  (row) => Array.isArray(row.normalized?.prices) && row.normalized.prices.some((price) => price.vatMode === "unknown")
);
const blockedUnknownVatRows = unknownVatRows.filter((row) => {
  const sourceFileName = row.sourceFileName ?? row.normalized?.sourceFileName ?? "Onbekend bestand";
  const profile = profileBySourceFile.get(sourceFileName);

  return !(profile?.allowUnknownVatMode ?? false);
});
const result = {
  tenantSlug,
  convexUrl,
  sourceFiles: groups.size,
  rows: previewRows.length,
  productRows: rows.length,
  batches: [],
};

if (!allowUnknownVatMode && !noCommit && (unresolvedProfileMappings.length > 0 || blockedUnknownVatRows.length > 0)) {
  const samples = unresolvedProfileMappings.slice(0, 12).map((row) => ({
    profileName: row.profileName,
    sourceColumnName: row.sourceColumnName,
    detectedPriceType: row.detectedPriceType,
    detectedUnit: row.detectedUnit,
    suggestedVatMode: row.suggestedVatMode,
    confidence: row.confidence,
  }));
  const rowSamples = blockedUnknownVatRows.slice(0, 5).map((row) => ({
    sourceFileName: row.sourceFileName ?? row.normalized?.sourceFileName,
    sourceSheetName: row.sourceSheetName ?? row.normalized?.sourceSheetName,
    rowNumber: row.rowNumber ?? row.normalized?.sourceRowNumber,
  }));

  throw new Error(
    `This import contains unresolved vatMode mappings (${unresolvedProfileMappings.length} profile columns, ${blockedUnknownVatRows.length} blocked preview rows). ` +
      `Set profile price columns to inclusive/exclusive or explicitly allow unknown per profile. Samples: ${JSON.stringify(samples)} Row samples: ${JSON.stringify(rowSamples)}`
  );
}

for (const [sourceFileName, sourceRows] of groups.entries()) {
  const firstNormalizedRow = sourceRows.find((row) => row.normalized)?.normalized ?? {};
  const matchedProfile = profileBySourceFile.get(sourceFileName);
  const batchAllowUnknownVatMode = allowUnknownVatMode || (matchedProfile?.allowUnknownVatMode ?? false);
  let batchId;

  try {
    batchId = await client.mutation(api.catalogImport.createPreviewBatch, {
      tenantSlug,
      actor,
      fileName: sourceFileName,
      fileType: fileTypeFor(sourceFileName),
      sourceFileName,
      sourcePath: firstNormalizedRow.sourcePath,
      fileHash: firstNormalizedRow.fileHash,
      supplierName: firstNormalizedRow.supplierName,
      allowUnknownVatMode: batchAllowUnknownVatMode,
      createdByExternalUserId: "dev-catalog-import",
    });

    let insertedRows = 0;
    for (const rowsChunk of chunk(sourceRows.map(toPreviewRow), 100)) {
      const appendResult = await client.mutation(api.catalogImport.appendPreviewRows, {
        tenantSlug,
        actor,
        batchId,
        rows: rowsChunk,
      });
      insertedRows += appendResult.insertedRows ?? rowsChunk.length;
    }

    await client.mutation(api.catalogImport.savePreviewMapping, {
      tenantSlug,
      actor,
      batchId,
      allowUnknownVatMode: batchAllowUnknownVatMode,
      mapping: {
        mode: "generated-preview",
        requiresVatOverride: batchAllowUnknownVatMode,
        source: "docs/catalog-import-preview.json",
      },
    });

    const batchSummary = {
      sourceFileName,
      batchId: String(batchId),
      rows: sourceRows.length,
      productRows: sourceRows.filter((row) => row.rowKind === "product").length,
      insertedRows,
      committed: false,
      commitIterations: 0,
    };

    if (!noCommit) {
      while (true) {
        const commitResult = await client.mutation(api.catalogImport.commitPreviewBatchChunk, {
          tenantSlug,
          actor,
          batchId,
          allowUnknownVatMode: batchAllowUnknownVatMode,
          importedByExternalUserId: "dev-catalog-import",
          limit: 75,
        });

        batchSummary.commitIterations += 1;

        if (commitResult.failed) {
          throw new Error(commitResult.errorMessage ?? `Batch failed during import: ${sourceFileName}`);
        }

        if (commitResult.done) {
          batchSummary.committed = true;
          break;
        }
      }
    }

    result.batches.push(batchSummary);
    console.log(JSON.stringify(batchSummary, null, 2));
  } catch (error) {
    if (batchId) {
      await client.mutation(api.catalogImport.failPreviewBatch, {
        tenantSlug,
        actor,
        batchId,
        errorMessage: error instanceof Error ? error.message : "Unknown batch import failure",
      });
    }

    throw error;
  }
}

console.log(JSON.stringify({ done: true, ...result }, null, 2));
