import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exportedMutationBlock(relativePath, name) {
  const source = read(relativePath);
  const start = source.indexOf(`export const ${name} = mutation({`);

  assert.notEqual(start, -1, `${relativePath} should export mutation ${name}`);

  const end = source.indexOf("\n});", start);

  assert.notEqual(end, -1, `${relativePath}:${name} should have a closing mutation block`);

  return source.slice(start, end + 4);
}

function allConvexWriteBlocks() {
  const convexDir = path.join(root, "convex");
  const files = fs
    .readdirSync(convexDir)
    .filter((fileName) => fileName.endsWith(".ts") && !fileName.startsWith("_"));
  const blocks = [];

  for (const fileName of files) {
    const relativePath = `convex/${fileName}`;
    const source = read(relativePath);
    const exportPattern =
      /export const (\w+) = (mutation|action|internalMutation|internalAction)\(\{/g;
    let match;

    while ((match = exportPattern.exec(source))) {
      const name = match[1];
      const start = match.index;
      const end = source.indexOf("\n});", start);
      const block = end === -1 ? source.slice(start) : source.slice(start, end + 4);

      blocks.push({
        file: relativePath,
        name,
        type: match[2],
        block
      });
    }
  }

  return blocks;
}

const writeBlocks = allConvexWriteBlocks();
const deleteBlocks = writeBlocks.filter(({ block }) => block.includes("ctx.db.delete("));

assert.deepEqual(
  deleteBlocks.map(({ file, name }) => `${file}:${name}`).sort(),
  ["convex/catalogImport.ts:resetCatalogChunk", "convex/portal.ts:deleteQuoteLine"].sort(),
  "Only quote-line delete and explicit catalog reset should perform hard deletes"
);

const deleteQuoteLine = exportedMutationBlock("convex/portal.ts", "deleteQuoteLine");
assert.ok(deleteQuoteLine.includes("line.tenantId !== tenant._id"));
assert.ok(deleteQuoteLine.includes("await ctx.db.delete(line._id);"));
assert.ok(deleteQuoteLine.includes("await recalculateQuote(ctx, tenant._id, line.quoteId);"));

const resetCatalogChunk = exportedMutationBlock("convex/catalogImport.ts", "resetCatalogChunk");
assert.ok(resetCatalogChunk.includes('confirm: v.literal("RESET_IMPORTED_CATALOG")'));
assert.ok(resetCatalogChunk.includes('"productPrices"'));
assert.ok(resetCatalogChunk.includes('"products"'));
assert.ok(!resetCatalogChunk.includes('"customers"'));
assert.ok(!resetCatalogChunk.includes('"projects"'));
assert.ok(!resetCatalogChunk.includes('"quotes"'));

const resetCatalogImportScript = read("tools/reset_catalog_import.mjs");
assert.ok(resetCatalogImportScript.includes("--confirm-reset-imported-catalog"));
assert.ok(resetCatalogImportScript.includes("Catalog reset is destructive"));

const markMeasurementLineConverted = exportedMutationBlock(
  "convex/measurements.ts",
  "markMeasurementLineConverted"
);
assert.ok(markMeasurementLineConverted.includes('line.quotePreparationStatus !== "ready_for_quote"'));
assert.ok(markMeasurementLineConverted.includes('quotePreparationStatus: "converted"'));
assert.ok(markMeasurementLineConverted.includes("convertedQuoteId: args.quoteId"));
assert.ok(markMeasurementLineConverted.includes("convertedQuoteLineId: args.quoteLineId"));

const listReadyForQuote = read("convex/measurements.ts");
assert.ok(listReadyForQuote.includes('line.quotePreparationStatus !== "ready_for_quote"'));

const commitPreviewBatchChunk = exportedMutationBlock(
  "convex/catalogImport.ts",
  "commitPreviewBatchChunk"
);
assert.ok(commitPreviewBatchChunk.includes("batch.unknownVatModeRows"));
assert.ok(commitPreviewBatchChunk.includes("!allowUnknownVatMode"));
assert.ok(commitPreviewBatchChunk.includes("batch.errorRows"));
assert.ok(commitPreviewBatchChunk.includes("batch.duplicateSourceKeys"));

const duplicateEanReview = exportedMutationBlock(
  "convex/catalogReview.ts",
  "updateDuplicateEanIssueReview"
);
assert.ok(!duplicateEanReview.includes("ctx.db.delete("));
assert.ok(!duplicateEanReview.includes('ctx.db.insert("products"'));
assert.ok(!duplicateEanReview.includes('ctx.db.patch(product'));
assert.ok(duplicateEanReview.includes("reviewDecision"));

const syncDuplicateEanIssues = exportedMutationBlock(
  "convex/catalogReview.ts",
  "syncDuplicateEanIssues"
);
assert.ok(!syncDuplicateEanIssues.includes('ctx.db.insert("products"'));
assert.ok(!syncDuplicateEanIssues.includes('ctx.db.delete('));
assert.ok(syncDuplicateEanIssues.includes('ctx.db.insert("catalogDataIssues"'));

const catalogReviewSource = read("convex/catalogReview.ts");
assert.equal(/merge(Product|Duplicate|Ean)|combineProduct/i.test(catalogReviewSource), false);

const quoteTemplateContent = exportedMutationBlock("convex/portal.ts", "updateQuoteTemplateContent");
assert.ok(quoteTemplateContent.includes("ctx.db.patch(template._id"));
assert.ok(!quoteTemplateContent.includes('query("quotes")'));
assert.ok(!quoteTemplateContent.includes("ctx.db.patch(quote"));

const quoteDocumentPreview = read("src/components/quotes/QuoteDocumentPreview.tsx");
assert.ok(quoteDocumentPreview.includes("window.print()"));
assert.equal(/client\.mutation|api\./.test(quoteDocumentPreview), false);

const measurementLinePicker = read("src/components/quotes/MeasurementLinePicker.tsx");
assert.ok(measurementLinePicker.includes("setConfirmOpen(true)"));
assert.ok(measurementLinePicker.includes("Controleer prijs, product en btw"));
assert.ok(measurementLinePicker.includes("unitPriceExVat: 0"));
assert.ok(measurementLinePicker.includes("vatRate: 0"));

console.log("Workflow mutation guardrail tests passed.");
