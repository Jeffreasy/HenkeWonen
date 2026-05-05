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
const publicMutations = writeBlocks.filter(({ type }) => type === "mutation");

for (const { file, name, block } of publicMutations) {
  const actorSecured =
    block.includes("actor: mutationActorValidator") &&
    (block.includes("requireMutationRole") || block.includes("requireMutationRoleForTenantId"));
  const syncSecured = block.includes("syncToken: v.string()") && block.includes("requireSyncToken");
  const toolingSecured = block.includes("requireConvexToolingEnabled");

  assert.ok(
    actorSecured || syncSecured || toolingSecured,
    `${file}:${name} should require an actor, sync token, or explicit tooling gate`
  );
}

assert.deepEqual(
  deleteBlocks.map(({ file, name }) => `${file}:${name}`).sort(),
  [
    "convex/catalogImport.ts:resetCatalogChunk",
    "convex/measurements.ts:deleteMeasurementLine",
    "convex/measurements.ts:deleteMeasurementRoom",
    "convex/portal.ts:deleteProjectRoom",
    "convex/portal.ts:deleteQuoteLine"
  ].sort(),
  "Only guarded concept/correction deletes and explicit catalog reset should perform hard deletes"
);

const deleteQuoteLine = exportedMutationBlock("convex/portal.ts", "deleteQuoteLine");
assert.ok(deleteQuoteLine.includes("line.tenantId !== tenant._id"));
assert.ok(deleteQuoteLine.includes('quote.status !== "draft"'));
assert.ok(deleteQuoteLine.includes("await ctx.db.delete(line._id);"));
assert.ok(deleteQuoteLine.includes("await recalculateQuote(ctx, tenant._id, line.quoteId);"));

for (const mutationName of ["addQuoteLine", "updateQuote", "updateQuoteLine", "updateQuoteTerms"]) {
  const block = exportedMutationBlock("convex/portal.ts", mutationName);

  assert.ok(
    block.includes('quote.status !== "draft"'),
    `${mutationName} should only allow inhoudelijke wijzigingen aan conceptoffertes`
  );
}

const legacyAddQuoteLine = exportedMutationBlock("convex/quotes.ts", "addLine");
assert.ok(legacyAddQuoteLine.includes('quote.status !== "draft"'));

const deleteProjectRoom = exportedMutationBlock("convex/portal.ts", "deleteProjectRoom");
assert.ok(deleteProjectRoom.includes('query("measurementRooms")'));
assert.ok(deleteProjectRoom.includes('query("quoteLines")'));
assert.ok(deleteProjectRoom.includes("measurementRoom || quoteLine"));
assert.ok(deleteProjectRoom.includes("await ctx.db.delete(room._id);"));

const deleteMeasurementRoom = exportedMutationBlock("convex/measurements.ts", "deleteMeasurementRoom");
assert.ok(deleteMeasurementRoom.includes('query("measurementLines")'));
assert.ok(deleteMeasurementRoom.includes("if (line)"));
assert.ok(deleteMeasurementRoom.includes("await ctx.db.delete(room._id);"));

const deleteMeasurementLine = exportedMutationBlock("convex/measurements.ts", "deleteMeasurementLine");
assert.ok(deleteMeasurementLine.includes('line.quotePreparationStatus === "converted"'));
assert.ok(deleteMeasurementLine.includes("line.convertedQuoteId"));
assert.ok(deleteMeasurementLine.includes("line.convertedQuoteLineId"));
assert.ok(deleteMeasurementLine.includes("await ctx.db.delete(line._id);"));

const resetCatalogChunk = exportedMutationBlock("convex/catalogImport.ts", "resetCatalogChunk");
assert.ok(resetCatalogChunk.includes('confirm: v.literal("RESET_IMPORTED_CATALOG")'));
assert.ok(resetCatalogChunk.includes("actor: mutationActorValidator"));
assert.ok(resetCatalogChunk.includes('["admin"]'));
assert.ok(resetCatalogChunk.includes('"productPrices"'));
assert.ok(resetCatalogChunk.includes('"products"'));
assert.ok(!resetCatalogChunk.includes('"customers"'));
assert.ok(!resetCatalogChunk.includes('"projects"'));
assert.ok(!resetCatalogChunk.includes('"quotes"'));

const resetCatalogImportScript = read("tools/reset_catalog_import.mjs");
assert.ok(resetCatalogImportScript.includes("--confirm-reset-imported-catalog"));
assert.ok(resetCatalogImportScript.includes("Catalog reset is destructive"));
assert.ok(resetCatalogImportScript.includes("createToolMutationActor"));
assert.ok(resetCatalogImportScript.includes("actor"));

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
assert.ok(commitPreviewBatchChunk.includes("actor: mutationActorValidator"));
assert.ok(commitPreviewBatchChunk.includes("requireMutationRole"));

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
assert.ok(quoteTemplateContent.includes("actor: mutationActorValidator"));
assert.ok(quoteTemplateContent.includes('["admin"]'));

const securedPortalMutations = [
  "createCustomer",
  "createCustomerContact",
  "createProject",
  "addProjectRoom",
  "updateCustomer",
  "updateProject",
  "updateProjectRoom",
  "deleteProjectRoom",
  "updateProjectStatus",
  "processProjectAction",
  "createWorkflowEvent",
  "createQuote",
  "addQuoteLine",
  "deleteQuoteLine",
  "updateQuote",
  "updateQuoteLine",
  "updateQuoteStatus",
  "updateQuoteTerms",
  "createSupplier",
  "updateSupplier",
  "updateSupplierProductListStatus",
  "upsertCategory",
  "upsertServiceRule",
  "updateQuoteTemplateContent"
];

for (const mutationName of securedPortalMutations) {
  const block = exportedMutationBlock("convex/portal.ts", mutationName);

  assert.ok(block.includes("actor: mutationActorValidator"), `${mutationName} should require an actor`);
  assert.ok(block.includes("requireMutationRole"), `${mutationName} should check role`);
}

for (const [mutationName, fields] of [
  ["updateCustomer", ["email", "phone", "street", "houseNumber", "postalCode", "city", "notes"]],
  [
    "updateProject",
    [
      "description",
      "preferredExecutionDate",
      "measurementDate",
      "executionDate",
      "internalNotes",
      "customerNotes"
    ]
  ],
  ["updateQuote", ["validUntil", "introText", "closingText"]],
  ["updateSupplier", ["contactName", "email", "phone", "notes", "lastContactAt", "expectedAt"]]
]) {
  const block = exportedMutationBlock("convex/portal.ts", mutationName);

  for (const field of fields) {
    assert.ok(
      block.includes(`hasArg(args, "${field}")`),
      `${mutationName} should only patch ${field} when the field is explicitly provided`
    );
  }
}

for (const mutationName of [
  "createForProject",
  "updateMeasurement",
  "addMeasurementRoom",
  "updateMeasurementRoom",
  "deleteMeasurementRoom",
  "addMeasurementLine",
  "updateMeasurementLine",
  "deleteMeasurementLine",
  "updateMeasurementLineStatus",
  "markMeasurementLineConverted"
]) {
  const block = exportedMutationBlock("convex/measurements.ts", mutationName);

  assert.ok(block.includes("actor: mutationActorValidator"), `${mutationName} should require an actor`);
  assert.ok(block.includes("requireMutationRoleForTenantId"), `${mutationName} should check role`);
}

const updateMeasurement = exportedMutationBlock("convex/measurements.ts", "updateMeasurement");
assert.ok(updateMeasurement.includes('hasArg(args, "measurementDate")'));
assert.ok(updateMeasurement.includes('hasArg(args, "measuredBy")'));
assert.ok(updateMeasurement.includes('hasArg(args, "notes")'));

const updateMeasurementRoom = exportedMutationBlock("convex/measurements.ts", "updateMeasurementRoom");
for (const field of ["floor", "widthM", "lengthM", "heightM", "areaM2", "perimeterM", "notes"]) {
  assert.ok(
    updateMeasurementRoom.includes(`hasArg(args, "${field}")`),
    `updateMeasurementRoom should only patch ${field} when explicitly provided`
  );
}

const updateProductForPortal = exportedMutationBlock("convex/catalog.ts", "updateProductForPortal");
assert.ok(updateProductForPortal.includes("actor: mutationActorValidator"));
assert.ok(updateProductForPortal.includes("requireMutationRole"));
assert.ok(updateProductForPortal.includes('["admin"]'));

for (const field of [
  "articleNumber",
  "supplierCode",
  "commercialCode",
  "colorName",
  "supplierProductGroup",
  "packageContentM2",
  "piecesPerPackage"
]) {
  assert.ok(
    updateProductForPortal.includes(`hasArg(args, "${field}")`),
    `updateProductForPortal should only patch ${field} when explicitly provided`
  );
}

const quoteDocumentPreview = read("src/components/quotes/QuoteDocumentPreview.tsx");
assert.ok(quoteDocumentPreview.includes("window.print()"));
assert.equal(/client\.mutation|api\./.test(quoteDocumentPreview), false);

const quoteBuilder = read("src/components/quotes/QuoteBuilder.tsx");
assert.ok(quoteBuilder.includes("const canEditDraftLines = canEdit && quote.status === \"draft\""));
assert.ok(quoteBuilder.includes("if (!onUpdateTerms || !canEditDraftLines)"));
assert.ok(!quoteBuilder.includes("onUpdateTerms && canEdit ?"));
assert.ok(!quoteBuilder.includes("{canEdit ? measurementPicker : null}"));

const measurementLinePicker = read("src/components/quotes/MeasurementLinePicker.tsx");
assert.ok(measurementLinePicker.includes("setConfirmOpen(true)"));
assert.ok(measurementLinePicker.includes("Controleer prijs, product en btw"));
assert.ok(measurementLinePicker.includes("unitPriceExVat: 0"));
assert.ok(measurementLinePicker.includes("vatRate: 0"));

console.log("Workflow mutation guardrail tests passed.");
