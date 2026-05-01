import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const decisionPath = resolve(root, "docs/vat-mapping-decisions.json");
const resultPath = resolve(root, "docs/vat-mapping-apply-result-2026-04-30.md");
const tenantSlug = "henke-wonen";
const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");

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
    "# Btw-mapping apply-resultaat - 2026-04-30",
    "",
    dryRun
      ? "Dit was een dry-run. Er zijn geen wijzigingen opgeslagen."
      : "De onderstaande beslissingen zijn toegepast in Convex.",
    "",
    "## Samenvatting",
    "",
    `- Dry-run: ${dryRun ? "ja" : "nee"}`,
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

loadEnv(envPath);

if (!existsSync(decisionPath)) {
  writeFileSync(
    decisionPath,
    "[]\n",
    "utf8"
  );
  console.log(
    JSON.stringify(
      {
        createdTemplate: "docs/vat-mapping-decisions.json",
        message: "Vul dit bestand met expliciete beslissingen en draai het script opnieuw. Het bestand is bewust leeg aangemaakt zodat een dry-run niet per ongeluk faalt op voorbeeldwaarden."
      },
      null,
      2
    )
  );
  process.exit(0);
}

const convexUrl = process.env.PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("PUBLIC_CONVEX_URL ontbreekt. Controleer .env.local.");
}

const decisions = JSON.parse(readFileSync(decisionPath, "utf8"));

if (!Array.isArray(decisions)) {
  throw new Error("docs/vat-mapping-decisions.json moet een array bevatten.");
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
      profileId: mapping.profileId,
      allowUnknownVatMode: true,
      updatedByExternalUserId: "vat-mapping-apply-script"
    });
  }

  await client.mutation(api.catalogReview.updateProfileVatMode, {
    tenantSlug,
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
      decisionCount: decisions.length,
      applied: applied.length,
      skipped: skipped.length,
      failed: failed.length,
      unresolvedBefore: before.unresolvedColumns,
      unresolvedAfter: after?.unresolvedColumns ?? before.unresolvedColumns,
      result: "docs/vat-mapping-apply-result-2026-04-30.md"
    },
    null,
    2
  )
);

if (failed.length > 0) {
  process.exitCode = 1;
}
