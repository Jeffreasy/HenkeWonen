import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor, withToolActor } from "./authz_actor.mjs";
import {
  hasFlag,
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
const commitLimitRaw =
  optionValue(toolEnv.args, "--commit-limit") ?? process.env.CATALOG_IMPORT_COMMIT_LIMIT ?? "25";
const commitLimitNumber = Number(commitLimitRaw);

if (!Number.isFinite(commitLimitNumber)) {
  throw new Error("--commit-limit moet een getal zijn.");
}

const commitLimit = Math.min(Math.max(Math.trunc(commitLimitNumber), 1), 100);

const allowUnknownVatMode = hasFlag(toolEnv.args, "--allow-unknown-vat");
const noCommit = hasFlag(toolEnv.args, "--no-commit");

requireCatalogToolTarget(toolEnv, {
  operation: "catalogus batch-import",
  mutates: true,
  requireAuthzSecret: toolEnv.target === "production",
  productionConfirmFlag: "--confirm-production-catalog-import",
  allowUnknownVatMode,
  disallowProductionAllowUnknown: true
});

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

function normalizePriceColumnKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\u20ac/g, "eur")
    .replace(/m\u00b2/g, "m2")
    .replace(/m\u00b9/g, "m1")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizePriceColumnFamilyKey(value) {
  return normalizePriceColumnKey(String(value ?? "").replace(/\([^)]*\)/g, ""));
}

function currentColumnVatMode(profile, price) {
  const sourceColumnName = price.sourceColumnName;
  const normalizedSourceColumnName = normalizePriceColumnKey(sourceColumnName);
  const normalizedSourceFamilyName = normalizePriceColumnFamilyKey(sourceColumnName);
  const column = profilePriceColumns(profile).find((item) => {
    const header = item.header ?? item.sourceColumnName;

    return (
      header === sourceColumnName ||
      normalizePriceColumnKey(header) === normalizedSourceColumnName ||
      normalizePriceColumnFamilyKey(header) === normalizedSourceFamilyName
    );
  });
  const vatModeByPriceColumn = profile.vatModeByPriceColumn ?? {};
  const directVatMode = sourceColumnName ? vatModeByPriceColumn[sourceColumnName] : undefined;
  const normalizedVatMode = Object.entries(vatModeByPriceColumn).find(
    ([header]) => normalizePriceColumnKey(header) === normalizedSourceColumnName
  )?.[1];

  return column?.vatMode ?? directVatMode ?? normalizedVatMode ?? "unknown";
}

function isNonPriceReferencePrice(price) {
  const normalizedColumnName = normalizePriceColumnKey(price?.sourceColumnName);

  return (
    price?.vatMode === "unknown" &&
    price?.priceType === "manual" &&
    (normalizedColumnName.startsWith("codeprix") || normalizedColumnName === "unitedevente")
  );
}

function stripNonPriceReferencePrices(row) {
  const normalized = row.normalized;

  if (!normalized || !Array.isArray(normalized.prices)) {
    return row;
  }

  const prices = normalized.prices.filter((price) => !isNonPriceReferencePrice(price));

  if (prices.length === normalized.prices.length) {
    return row;
  }

  const stillHasUnknownVatMode = prices.some((price) => price.vatMode === "unknown");
  const warnings = stillHasUnknownVatMode
    ? row.warnings ?? []
    : (row.warnings ?? []).filter((warning) => warning !== "Btw-modus onbekend voor een of meer prijskolommen.");

  return {
    ...row,
    warnings,
    normalized: {
      ...normalized,
      prices,
    },
  };
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
    const mappedVatMode = price.sourceColumnName ? currentColumnVatMode(profile, price) : "unknown";

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

const convexUrl = toolEnv.convexUrl;
const client = new ConvexHttpClient(convexUrl);
const defaultTenantSlug = toolEnv.tenantSlug;
const initialVatReview = await client.query(api.catalog.review.vatMappingReview, {
  ...withToolActor(defaultTenantSlug, { tenantSlug: defaultTenantSlug }),
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
const tenantSlug = payload.tenantSlug ?? toolEnv.tenantSlug;

if (tenantSlug !== toolEnv.tenantSlug) {
  throw new Error(
    `Preview tenantSlug=${tenantSlug} komt niet overeen met gekozen tenant=${toolEnv.tenantSlug}.`
  );
}

const actor = createToolMutationActor(tenantSlug);
const vatReview =
  tenantSlug === defaultTenantSlug
    ? initialVatReview
    : await client.query(
        api.catalog.review.vatMappingReview,
        withToolActor(tenantSlug, { tenantSlug })
      );
const profiles = await client.query(
  api.catalog.imports.listProfilesForPortal,
  withToolActor(tenantSlug, { tenantSlug })
);
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
  return applyProfileVatMappingsToRow(
    stripNonPriceReferencePrices(row),
    profileBySourceFile.get(sourceFileName)
  );
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
  ...targetSummary(toolEnv),
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
    batchId = await client.mutation(api.catalog.import.createPreviewBatch, {
      tenantSlug,
      actor,
      bestandsnaam: sourceFileName,
      bestandsType: fileTypeFor(sourceFileName),
      bronBestandsnaam: sourceFileName,
      bronPad: firstNormalizedRow.sourcePath,
      bestandHash: firstNormalizedRow.fileHash,
      leverancierNaam: firstNormalizedRow.supplierName,
      staBtwModusOnbekendToe: batchAllowUnknownVatMode,
      createdByExternalUserId: "dev-catalog-import",
    });

    let insertedRows = 0;
    for (const rowsChunk of chunk(sourceRows.map(toPreviewRow), 100)) {
      const appendResult = await client.mutation(api.catalog.import.appendPreviewRows, {
        tenantSlug,
        actor,
        batchId,
        rows: rowsChunk,
      });
      insertedRows += appendResult.insertedRows ?? rowsChunk.length;
    }

    await client.mutation(api.catalog.import.savePreviewMapping, {
      tenantSlug,
      actor,
      batchId,
      staBtwModusOnbekendToe: batchAllowUnknownVatMode,
      mapping: {
        mode: "generated-preview",
        requiresVatOverride: batchAllowUnknownVatMode,
        source: "docs/generated/catalog-import-preview.json",
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
        const commitResult = await client.mutation(api.catalog.import.commitPreviewBatchChunk, {
          tenantSlug,
          actor,
          batchId,
          staBtwModusOnbekendToe: batchAllowUnknownVatMode,
          importedByExternalUserId: "dev-catalog-import",
          limit: commitLimit,
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
      await client.mutation(api.catalog.import.failPreviewBatch, {
        tenantSlug,
        actor,
        batchId,
        foutmelding: error instanceof Error ? error.message : "Unknown batch import failure",
      });
    }

    throw error;
  }
}

console.log(JSON.stringify({ done: true, ...result }, null, 2));
