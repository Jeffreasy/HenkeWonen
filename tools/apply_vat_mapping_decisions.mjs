import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const shouldApply = toolEnv.args.flags.has("--apply");
const dateStamp = optionValue(toolEnv.args, "--date-stamp") ?? new Date().toISOString().slice(0, 10);
const defaultDecisionPath = resolve(
  root,
  "docs/release-readiness/vat-mapping/vat-mapping-decisions.json"
);
const legacyDecisionPath = resolve(root, "docs/vat-mapping-decisions.json");
const decisionPath = resolve(
  root,
  optionValue(toolEnv.args, "--decisions-file") ??
    (existsSync(defaultDecisionPath) ? defaultDecisionPath : legacyDecisionPath)
);
const resultPath = resolve(
  root,
  optionValue(toolEnv.args, "--result-file") ??
    `docs/release-readiness/vat-mapping/vat-mapping-apply-result-${dateStamp}.md`
);
const tenantSlug = toolEnv.tenantSlug;

requireCatalogToolTarget(toolEnv, {
  operation: "btw-mapping apply",
  mutates: shouldApply,
  requireAuthzSecret: shouldApply && toolEnv.target === "production",
  productionConfirmFlag: "--confirm-production-vat-apply"
});

function tableRow(values) {
  return `| ${values.map((value) => String(value ?? "-").replaceAll("|", "\\|")).join(" | ")} |`;
}

function validateDecision(decision) {
  const errors = [];

  if (!decision || typeof decision !== "object") {
    return ["Beslissing is geen object."];
  }

  if (!decision.importProfileId && !decision.profileId) {
    errors.push("importProfileId ontbreekt.");
  }

  if (typeof decision.sourceColumnIndex !== "number") {
    errors.push("sourceColumnIndex ontbreekt of is geen number.");
  }

  if (!["inclusive", "exclusive", "unknown"].includes(decision.vatMode)) {
    errors.push("vatMode moet inclusive, exclusive of unknown zijn.");
  }

  if (decision.vatMode === "unknown" && decision.explicitAllowUnknown !== true) {
    errors.push("unknown is alleen toegestaan met explicitAllowUnknown=true.");
  }

  return errors;
}

function findMapping(rows, decision) {
  const profileId = decision.importProfileId ?? decision.profileId;

  return rows.find((row) => {
    const sameProfile = row.profileId === profileId;
    const sameIndex = row.sourceColumnIndex === decision.sourceColumnIndex;
    const sameName =
      !decision.sourceColumnName || row.sourceColumnName === decision.sourceColumnName;

    return sameProfile && sameIndex && sameName;
  });
}

function buildReport({ before, after, dryRun, applied, failed, skipped }) {
  const lines = [
    `# Btw-mapping apply-resultaat - ${dateStamp}`,
    "",
    dryRun
      ? "Dit was een dry-run. Er zijn geen wijzigingen opgeslagen."
      : "De onderstaande beslissingen zijn toegepast in Convex.",
    "",
    "## Samenvatting",
    "",
    `- Dry-run: ${dryRun ? "ja" : "nee"}`,
    `- Target: ${toolEnv.target}`,
    `- Convex URL: ${toolEnv.convexUrl}`,
    `- Beslisbestand: ${decisionPath}`,
    `- Beslissingen toegepast: ${applied.length}`,
    `- Beslissingen overgeslagen: ${skipped.length}`,
    `- Beslissingen mislukt: ${failed.length}`,
    `- Unresolved voor apply: ${before.unresolvedColumns}`,
    `- Unresolved na apply: ${after?.unresolvedColumns ?? before.unresolvedColumns}`,
    "",
    "## Toegepast",
    "",
    tableRow(["Profiel", "Bronkolom", "Index", "VatMode", "Notitie"]),
    "| --- | --- | ---: | --- | --- |",
    ...applied.map((item) =>
      tableRow([
        item.profileName,
        item.sourceColumnName,
        item.sourceColumnIndex,
        item.vatMode,
        item.reviewNote ?? "-"
      ])
    ),
    "",
    "## Overgeslagen",
    "",
    skipped.length === 0
      ? "Geen beslissingen overgeslagen."
      : tableRow(["Profiel", "Bronkolom", "Reden"]),
    skipped.length === 0 ? "" : "| --- | --- | --- |",
    ...skipped.map((item) => tableRow([item.profileName ?? "-", item.sourceColumnName ?? "-", item.reason])),
    "",
    "## Fouten",
    "",
    failed.length === 0 ? "Geen fouten." : tableRow(["Beslissing", "Fout"]),
    failed.length === 0 ? "" : "| --- | --- | --- |",
    ...failed.map((item) => tableRow([JSON.stringify(item.decision), item.error])),
    ""
  ];

  return lines.join("\n");
}

const actor = createToolMutationActor(tenantSlug);

if (!existsSync(decisionPath)) {
  mkdirSync(dirname(decisionPath), { recursive: true });
  writeFileSync(
    decisionPath,
    "[]\n",
    "utf8"
  );
  console.log(
    JSON.stringify(
      {
        createdTemplate: "docs/release-readiness/vat-mapping/vat-mapping-decisions.json",
        path: decisionPath,
        message: "Vul dit bestand met expliciete beslissingen en draai het script opnieuw. Het bestand is bewust leeg aangemaakt zodat een dry-run niet per ongeluk faalt op voorbeeldwaarden."
      },
      null,
      2
    )
  );
  process.exit(0);
}

const convexUrl = toolEnv.convexUrl;

const decisions = JSON.parse(readFileSync(decisionPath, "utf8"));

if (!Array.isArray(decisions)) {
  throw new Error(`${decisionPath} moet een array bevatten.`);
}

const client = new ConvexHttpClient(convexUrl);
const before = await client.query(api.catalogReview.vatMappingReview, { tenantSlug });
const failed = [];
const skipped = [];
const applied = [];

for (const decision of decisions) {
  const validationErrors = validateDecision(decision);

  if (validationErrors.length > 0) {
    failed.push({ decision, error: validationErrors.join(" ") });
    continue;
  }

  const mapping = findMapping(before.rows, decision);

  if (!mapping) {
    failed.push({ decision, error: "Mapping bestaat niet in huidige Convex review." });
    continue;
  }

  if (mapping.currentVatMode !== "unknown" && decision.overwrite !== true) {
    skipped.push({
      profileName: mapping.profileName,
      sourceColumnName: mapping.sourceColumnName,
      reason: `Mapping heeft al vatMode=${mapping.currentVatMode}; gebruik overwrite=true om bewust te overschrijven.`
    });
    continue;
  }

  if (!shouldApply) {
    applied.push({
      profileName: mapping.profileName,
      sourceColumnName: mapping.sourceColumnName,
      sourceColumnIndex: mapping.sourceColumnIndex,
      vatMode: decision.vatMode,
      reviewNote: decision.reviewNote,
      dryRun: true
    });
    continue;
  }

  if (decision.vatMode === "unknown") {
    await client.mutation(api.catalogReview.setProfileAllowUnknownVatMode, {
      tenantSlug,
      actor,
      profileId: mapping.profileId,
      allowUnknownVatMode: true,
      updatedByExternalUserId: "vat-mapping-apply-script"
    });
  }

  await client.mutation(api.catalogReview.updateProfileVatMode, {
    tenantSlug,
    actor,
    profileId: mapping.profileId,
    sourceColumnName: mapping.sourceColumnName,
    sourceColumnIndex: mapping.sourceColumnIndex,
    vatMode: decision.vatMode,
    updatedByExternalUserId: "vat-mapping-apply-script"
  });

  applied.push({
    profileName: mapping.profileName,
    sourceColumnName: mapping.sourceColumnName,
    sourceColumnIndex: mapping.sourceColumnIndex,
    vatMode: decision.vatMode,
    reviewNote: decision.reviewNote,
    dryRun: false
  });
}

const after = shouldApply
  ? await client.query(api.catalogReview.vatMappingReview, { tenantSlug })
  : null;

mkdirSync(dirname(resultPath), { recursive: true });
writeFileSync(
  resultPath,
  buildReport({
    before,
    after,
    dryRun: !shouldApply,
    applied,
    failed,
    skipped
  }),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      dryRun: !shouldApply,
      ...targetSummary(toolEnv),
      decisionCount: decisions.length,
      applied: applied.length,
      skipped: skipped.length,
      failed: failed.length,
      unresolvedBefore: before.unresolvedColumns,
      unresolvedAfter: after?.unresolvedColumns ?? before.unresolvedColumns,
      decisionPath,
      result: resultPath
    },
    null,
    2
  )
);

if (failed.length > 0) {
  process.exitCode = 1;
}
