import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import {
  loadCatalogToolEnv,
  optionValue,
  requireCatalogToolTarget,
  targetSummary
} from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });
const tenantSlug = toolEnv.tenantSlug;
const dateStamp = optionValue(toolEnv.args, "--date-stamp") ?? new Date().toISOString().slice(0, 10);
const outputDir = resolve(root, "docs/release-readiness/vat-mapping");

requireCatalogToolTarget(toolEnv, {
  operation: "btw-mapping export",
  mutates: false
});

function normalizeText(value) {
  return String(value ?? "").toLowerCase();
}

function explicitVatDecision(sourceColumnName) {
  const normalized = normalizeText(sourceColumnName);

  if (
    normalized.includes("incl. btw") ||
    normalized.includes("incl btw") ||
    normalized.includes("inclusief btw")
  ) {
    return {
      suggestedVatMode: "inclusive",
      confidence: "high",
      needsHumanReview: false,
      reason: "Kolomnaam noemt expliciet inclusief btw."
    };
  }

  if (
    normalized.includes("excl. btw") ||
    normalized.includes("excl btw") ||
    normalized.includes("exclusief btw")
  ) {
    return {
      suggestedVatMode: "exclusive",
      confidence: "high",
      needsHumanReview: false,
      reason: "Kolomnaam noemt expliciet exclusief btw."
    };
  }

  return null;
}

function decisionFor(row) {
  const explicit = explicitVatDecision(row.sourceColumnName);

  if (explicit) {
    return explicit;
  }

  if (row.detectedPriceType === "advice_retail" || row.detectedPriceType === "retail") {
    return {
      suggestedVatMode: "inclusive",
      confidence: "medium",
      needsHumanReview: true,
      reason:
        "Advies-/consumentenprijs zonder expliciete btw-aanduiding. Henke Wonen rekent klantgericht inclusief btw, maar dit vraagt menselijke bevestiging per bron."
    };
  }

  if (
    ["purchase", "net_purchase", "commission", "pallet", "trailer"].includes(
      row.detectedPriceType
    )
  ) {
    return {
      suggestedVatMode: "exclusive",
      confidence: row.detectedPriceType === "purchase" || row.detectedPriceType === "net_purchase"
        ? "medium"
        : "low",
      needsHumanReview: true,
      reason:
        "Leveranciers-, inkoop-, netto-, commissie-, pallet- en trailerprijzen worden niet automatisch definitief gezet zonder bronbevestiging."
    };
  }

  if (["roll", "cut_length", "package", "step"].includes(row.detectedPriceType)) {
    return {
      suggestedVatMode: "unknown",
      confidence: "low",
      needsHumanReview: true,
      reason:
        "Prijscontext is afhankelijk van verkoop/inkoopbron. Menselijke beslissing nodig."
    };
  }

  return {
    suggestedVatMode: row.suggestedVatMode ?? "unknown",
    confidence: row.confidence ?? "low",
    needsHumanReview: true,
    reason: row.reason ?? "Geen expliciete btw-aanduiding gevonden."
  };
}

function escapeCell(value) {
  return String(value ?? "-").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function tableRow(values) {
  return `| ${values.map(escapeCell).join(" | ")} |`;
}

function reviewed(row) {
  return Boolean(row.reviewedAt || row.reviewStatus === "reviewed");
}

function enrichRows(rows) {
  return rows.map((row) => {
    const decision = decisionFor(row);
    return {
      ...row,
      businessSuggestedVatMode: decision.suggestedVatMode,
      businessConfidence: decision.confidence,
      needsHumanReview: decision.needsHumanReview,
      businessReason: decision.reason,
      reviewed: reviewed(row),
      isUnresolved: row.currentVatMode === "unknown" && !row.allowUnknownVatMode,
      canAutoApply:
        row.currentVatMode === "unknown" &&
        !row.allowUnknownVatMode &&
        decision.confidence === "high" &&
        !decision.needsHumanReview
    };
  });
}

function buildCurrentStateMarkdown(review, readiness, rows) {
  const highConfidence = rows.filter((row) => row.canAutoApply);
  const humanRows = rows.filter((row) => row.isUnresolved && !row.canAutoApply);
  const lines = [
    `# Btw-mapping huidige stand - ${dateStamp}`,
    "",
    "Deze export toont de actuele btw-mapping review uit Convex. Alleen kolommen met expliciete `incl. btw` of `excl. btw` in de bronkolom krijgen high-confidence automatische besluitvorming.",
    "",
    "## Samenvatting",
    "",
    `- Importprofielen: ${review.totalProfiles}`,
    `- Prijskolommen totaal: ${review.totalPriceColumns}`,
    `- Resolved: ${review.resolvedColumns}`,
    `- Unresolved: ${review.unresolvedColumns}`,
    `- Onbekende btw-modus toegestaan: ${review.allowUnknownColumns}`,
    `- Productie-importstatus: ${readiness.productionImportStatus === "READY" ? "READY" : "BLOCKED"}`,
    `- Open duplicate-EAN waarschuwingen: ${readiness.duplicateEanIssues.open}`,
    "",
    "## Automatisch toepasbaar met hoge zekerheid",
    "",
    highConfidence.length === 0
      ? "Geen open mappings met expliciete incl./excl. btw in de bronkolom gevonden."
      : tableRow([
          "Profiel",
          "Leverancier",
          "Categorie",
          "Bronkolom",
          "Kolomindex",
          "Huidig",
          "Voorstel",
          "Reden"
        ]),
    highConfidence.length === 0
      ? ""
      : "| --- | --- | --- | --- | ---: | --- | --- | --- |",
    ...highConfidence.map((row) =>
      tableRow([
        row.profileName,
        row.supplier,
        row.category,
        row.sourceColumnName,
        row.sourceColumnIndex,
        row.currentVatMode,
        row.businessSuggestedVatMode,
        row.businessReason
      ])
    ),
    "",
    "## Alle prijskolom-mappings",
    "",
    tableRow([
      "Profiel",
      "Leverancier",
      "Categorie",
      "Bronbestand",
      "Bronkolom",
      "Index",
      "Prijstype",
      "Eenheid",
      "Huidig",
      "Voorstel",
      "Confidence",
      "Review",
      "Reden"
    ]),
    "| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) =>
      tableRow([
        row.profileName,
        row.supplier,
        row.category,
        row.sourceFileNamePattern,
        row.sourceColumnName,
        row.sourceColumnIndex,
        row.detectedPriceType,
        row.detectedUnit,
        row.currentVatMode,
        row.businessSuggestedVatMode,
        row.businessConfidence,
        row.reviewed ? "beoordeeld" : "open",
        row.businessReason
      ])
    ),
    "",
    "## Open menselijke beslissingen",
    "",
    humanRows.length === 0
      ? "Er zijn geen open menselijke beslissingen meer."
      : `${humanRows.length} mappings blijven open voor menselijke beslissing. Zie ook \`docs/release-readiness/vat-mapping/vat-mapping-human-decision-table-${dateStamp}.md\`.`,
    ""
  ];

  return lines.filter((line) => line !== undefined).join("\n");
}

function buildHumanDecisionMarkdown(rows) {
  const humanRows = rows.filter((row) => row.isUnresolved && !row.canAutoApply);
  const lines = [
    `# Btw-mapping menselijke beslistabel - ${dateStamp}`,
    "",
    "Vul per open mapping de kolom `Beslissing` met `inclusive`, `exclusive` of `terugvragen aan leverancier`. Gebruik deze tabel niet voor stille bulkbeslissingen.",
    "",
    tableRow([
      "Profiel",
      "Leverancier",
      "Categorie",
      "Bronkolom",
      "Prijstype",
      "Eenheid",
      "Voorstel",
      "Confidence",
      "Advies",
      "Beslissing"
    ]),
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...humanRows.map((row) =>
      tableRow([
        row.profileName,
        row.supplier,
        row.category,
        row.sourceColumnName,
        row.detectedPriceType,
        row.detectedUnit,
        row.businessSuggestedVatMode,
        row.businessConfidence,
        row.businessReason,
        "inclusive / exclusive / terugvragen aan leverancier"
      ])
    ),
    ""
  ];

  return lines.join("\n");
}

const convexUrl = toolEnv.convexUrl;
const client = new ConvexHttpClient(convexUrl);
const review = await client.query(api.catalogReview.vatMappingReview, { tenantSlug });
const readiness = await client.query(api.catalogReview.productionReadiness, { tenantSlug });
const rows = enrichRows(review.rows);
const currentState = {
  tenantSlug,
  target: targetSummary(toolEnv),
  exportedAt: new Date().toISOString(),
  summary: {
    totalProfiles: review.totalProfiles,
    totalPriceColumns: review.totalPriceColumns,
    resolvedColumns: review.resolvedColumns,
    unresolvedColumns: review.unresolvedColumns,
    allowUnknownColumns: review.allowUnknownColumns,
    productionImportStatus: readiness.productionImportStatus,
    duplicateEanOpenIssues: readiness.duplicateEanIssues.open,
    highConfidenceAutoApplicable: rows.filter((row) => row.canAutoApply).length,
    humanDecisionRequired: rows.filter((row) => row.isUnresolved && !row.canAutoApply).length
  },
  rows
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  resolve(outputDir, `vat-mapping-current-state-${dateStamp}.json`),
  `${JSON.stringify(currentState, null, 2)}\n`,
  "utf8"
);
writeFileSync(
  resolve(outputDir, `vat-mapping-current-state-${dateStamp}.md`),
  buildCurrentStateMarkdown(review, readiness, rows),
  "utf8"
);
writeFileSync(
  resolve(outputDir, `vat-mapping-human-decision-table-${dateStamp}.md`),
  buildHumanDecisionMarkdown(rows),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      tenantSlug,
      convexUrl,
      ...targetSummary(toolEnv),
      ...currentState.summary,
      currentState: `docs/release-readiness/vat-mapping/vat-mapping-current-state-${dateStamp}.md`,
      currentStateJson: `docs/release-readiness/vat-mapping/vat-mapping-current-state-${dateStamp}.json`,
      humanDecisionTable: `docs/release-readiness/vat-mapping/vat-mapping-human-decision-table-${dateStamp}.md`
    },
    null,
    2
  )
);
