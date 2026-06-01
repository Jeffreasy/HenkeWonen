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

function exportedQueryBlock(relativePath, name) {
  const source = read(relativePath);
  const start = source.indexOf(`export const ${name} = query({`);

  assert.notEqual(start, -1, `${relativePath} should export query ${name}`);

  const end = source.indexOf("\n});", start);

  assert.notEqual(end, -1, `${relativePath}:${name} should have a closing query block`);

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
    "convex/catalogImport.ts:deleteProductsByCategoryChunk",
    "convex/catalogImport.ts:deleteProductsBySupplierChunk",
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

const deleteProductsByCategoryChunk = exportedMutationBlock(
  "convex/catalogImport.ts",
  "deleteProductsByCategoryChunk"
);
assert.ok(deleteProductsByCategoryChunk.includes('confirm: v.literal("DELETE_PRODUCTS_BY_CATEGORY")'));
assert.ok(deleteProductsByCategoryChunk.includes("actor: mutationActorValidator"));
assert.ok(deleteProductsByCategoryChunk.includes('["admin"]'));

const deleteProductsBySupplierChunk = exportedMutationBlock(
  "convex/catalogImport.ts",
  "deleteProductsBySupplierChunk"
);
assert.ok(deleteProductsBySupplierChunk.includes('confirm: v.literal("DELETE_PRODUCTS_BY_SUPPLIER")'));
assert.ok(deleteProductsBySupplierChunk.includes("actor: mutationActorValidator"));
assert.ok(deleteProductsBySupplierChunk.includes('["admin"]'));

const catalogStats = exportedQueryBlock("convex/catalogImport.ts", "getCatalogImportStats");
assert.ok(catalogStats.includes("summaryOnly: v.optional(v.boolean())"));
assert.ok(catalogStats.includes('source: "summary_only"'));
assert.ok(catalogStats.includes('source: "catalog_documents"'));

const schemaSource = read("convex/schema.ts");
assert.ok(schemaSource.includes('index("by_category_status", ["tenantId", "categoryId", "status"])'));
assert.ok(schemaSource.includes('index("by_supplier_status", ["tenantId", "supplierId", "status"])'));

for (const cleanupScript of [
  "tools/cleanup_pvc_click.mjs",
  "tools/cleanup_raambekleding.mjs",
  "tools/cleanup_roots_supplier.mjs"
]) {
  const script = read(cleanupScript);
  assert.ok(script.includes("productionConfirmFlag"), `${cleanupScript} should require explicit prod confirm`);
  assert.ok(script.includes("requireAuthzSecret: true"), `${cleanupScript} should require authz secret in prod`);
  assert.ok(script.includes("confirm:"), `${cleanupScript} should pass server-side delete confirm`);
}

const resetCatalogImportScript = read("tools/reset_catalog_import.mjs");
assert.ok(resetCatalogImportScript.includes("--confirm-reset-imported-catalog"));
assert.ok(resetCatalogImportScript.includes("Catalog reset is destructive"));
assert.ok(resetCatalogImportScript.includes("createToolMutationActor"));
assert.ok(resetCatalogImportScript.includes("actor"));

const authzSource = read("convex/authz.ts");
assert.ok(authzSource.includes("ALLOW_DEV_AUTHZ_TOKENS"));
assert.ok(authzSource.includes("allowsDevAuthzTokens()"));

const markMeasurementLineConverted = exportedMutationBlock(
  "convex/measurements.ts",
  "markMeasurementLineConverted"
);
assert.ok(markMeasurementLineConverted.includes('line.quotePreparationStatus !== "ready_for_quote"'));
assert.ok(markMeasurementLineConverted.includes('quotePreparationStatus: "converted"'));
assert.ok(markMeasurementLineConverted.includes("convertedQuoteId: args.quoteId"));
assert.ok(markMeasurementLineConverted.includes("convertedQuoteLineId: args.quoteLineId"));
assert.ok(markMeasurementLineConverted.includes("touchMeasurement"));

const importMeasurementLinesToQuote = exportedMutationBlock(
  "convex/portal.ts",
  "importMeasurementLinesToQuote"
);
assert.ok(importMeasurementLinesToQuote.includes("actor: mutationActorValidator"));
assert.ok(importMeasurementLinesToQuote.includes("requireMutationRole"));
assert.ok(importMeasurementLinesToQuote.includes('quote.status !== "draft"'));
assert.ok(importMeasurementLinesToQuote.includes('line.quotePreparationStatus !== "ready_for_quote"'));
assert.ok(importMeasurementLinesToQuote.includes("ctx.db.insert(\"quoteLines\""));
assert.ok(importMeasurementLinesToQuote.includes("unitPriceExVat: 0"));
assert.ok(importMeasurementLinesToQuote.includes("vatRate: 0"));
assert.ok(importMeasurementLinesToQuote.includes("quotePreparationStatus: \"converted\""));
assert.ok(importMeasurementLinesToQuote.includes("convertedQuoteId: quote._id"));
assert.ok(importMeasurementLinesToQuote.includes("convertedQuoteLineId: quoteLineId"));
assert.ok(importMeasurementLinesToQuote.includes("recalculateQuote"));
assert.ok(importMeasurementLinesToQuote.includes("touchedMeasurementIds"));

const listReadyForQuote = read("convex/measurements.ts");
assert.ok(listReadyForQuote.includes('line.quotePreparationStatus !== "ready_for_quote"'));

const portalCatalog = read("convex/catalog.ts");
assert.ok(portalCatalog.includes("includePilotHidden"));
assert.ok(portalCatalog.includes("pilotHiddenReason"));
assert.ok(portalCatalog.includes("displayProductName"));
assert.ok(portalCatalog.includes("displaySupplierName"));

const updateQuoteStatus = exportedMutationBlock("convex/portal.ts", "updateQuoteStatus");
assert.ok(updateQuoteStatus.includes("sentAt"));
assert.ok(updateQuoteStatus.includes("validUntil"));
assert.ok(updateQuoteStatus.includes("addCalendarDays(now, 30)"));
assert.ok(updateQuoteStatus.includes('"quote_follow_up"'));
assert.ok(updateQuoteStatus.includes("addCalendarDays(now, 18)"));
assert.ok(updateQuoteStatus.includes('"confirmation_payment"'));
assert.ok(updateQuoteStatus.includes('"execution_call"'));

const processProjectAction = exportedMutationBlock("convex/portal.ts", "processProjectAction");
assert.ok(processProjectAction.includes("invoiceDueAt"));
assert.ok(processProjectAction.includes('"invoice_payment"'));
assert.ok(processProjectAction.includes("invoicePaymentTermDays"));
assert.ok(processProjectAction.includes("addCalendarDays(now, invoiceTermDays)"));

const startOrPlanMeasurement = exportedMutationBlock("convex/portal.ts", "startOrPlanMeasurement");
assert.ok(startOrPlanMeasurement.includes('ctx.db.insert("measurements"'));
assert.ok(startOrPlanMeasurement.includes("latestMeasurementForProject"));
assert.ok(startOrPlanMeasurement.includes("hasProjectEvent"));
assert.ok(startOrPlanMeasurement.includes('projectPatch.measurementPlannedAt = undefined'));
assert.ok(startOrPlanMeasurement.includes('"Inmeting gestart"'));

const fieldVisitTimestamp = read("convex/portal.ts").match(
  /function fieldVisitTimestamp[\s\S]*?^}/m
)?.[0] ?? "";
assert.ok(fieldVisitTimestamp.includes("project.measurementDate ?? measurement?.measurementDate"));
assert.equal(fieldVisitTimestamp.includes("project.measurementPlannedAt"), false);

const addPortalQuoteLine = exportedMutationBlock("convex/portal.ts", "addQuoteLine");
const updatePortalQuoteLine = exportedMutationBlock("convex/portal.ts", "updateQuoteLine");
assert.ok(addPortalQuoteLine.includes("validateQuoteLineProduct"));
assert.ok(updatePortalQuoteLine.includes("validateQuoteLineProduct"));

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
  "startOrPlanMeasurement",
  "updateProjectStatus",
  "processProjectAction",
  "updateProjectTaskStatus",
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

const createMeasurementForProject = exportedMutationBlock("convex/measurements.ts", "createForProject");
assert.ok(createMeasurementForProject.includes("const existing = await ctx.db"));
assert.ok(createMeasurementForProject.includes("return existing._id"));

const updateMeasurementRoom = exportedMutationBlock("convex/measurements.ts", "updateMeasurementRoom");
for (const field of ["floor", "widthM", "lengthM", "heightM", "areaM2", "perimeterM", "notes"]) {
  assert.ok(
    updateMeasurementRoom.includes(`hasArg(args, "${field}")`),
    `updateMeasurementRoom should only patch ${field} when explicitly provided`
  );
}

for (const mutationName of [
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

  assert.ok(block.includes("touchMeasurement"), `${mutationName} should touch parent measurement`);
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
assert.ok(measurementLinePicker.includes("api.portal.importMeasurementLinesToQuote"));
assert.equal(measurementLinePicker.includes("markMeasurementLineConverted"), false);
assert.equal(measurementLinePicker.includes("onAddLine(quoteLine)"), false);

const authProxy = read("src/pages/api/auth/[...path].ts");
const authCookies = read("src/lib/auth/laventeCareCookies.ts");
const middleware = read("src/middleware.ts");

assert.ok(authProxy.includes("applyLaventeCareSetCookies"));
assert.ok(authProxy.includes("applyLaventeCareJsonTokenCookies"));
assert.ok(authProxy.includes("clearLaventeCareCookies"));
assert.ok(authProxy.includes("parseJsonBody"));
assert.ok(authProxy.includes("stripSensitiveAuthFields"));
assert.ok(authProxy.includes('"access_token"'));
assert.ok(authProxy.includes('"accessToken"'));
assert.ok(authProxy.includes('"refresh_token"'));
assert.ok(authProxy.includes('"refreshToken"'));
assert.ok(authProxy.includes('"pre_auth_token"'));
assert.ok(authProxy.includes('"preAuthToken"'));
assert.equal(authProxy.includes('"Path=/"'), false);
assert.equal(authProxy.includes("response.headers.append(\"set-cookie\""), false);
assert.ok(authCookies.includes("AstroCookies"));
assert.ok(authCookies.includes("accessToken"));
assert.ok(authCookies.includes("refreshToken"));
assert.ok(authCookies.includes("applyLaventeCareJsonTokenCookies"));
assert.ok(authCookies.includes("cookies.set"));
assert.ok(authCookies.includes("cookies.delete"));
assert.ok(authCookies.includes("path: parsed.path"));
assert.ok(authCookies.includes('"/api/auth"'));
assert.ok(authCookies.includes('"/api/v1/auth"'));
assert.ok(authCookies.includes("firstCookieValue"));
const authSession = read("src/lib/auth/laventeCareSession.ts");
assert.ok(authSession.includes("authTokenFromRequest"));
assert.ok(authSession.includes("headers.authorization"));
assert.ok(authSession.includes("sessionPayloadCandidates"));
assert.ok(authSession.includes("safePayloadShape"));
assert.ok(authSession.includes("LaventeCare /auth/me payload kon niet naar portalsessie worden vertaald."));
assert.ok(authSession.includes("roleAliases"));
assert.ok(authSession.includes("beheerder"));
assert.ok(authSession.includes("medewerker"));
assert.ok(middleware.includes("refreshLaventeCareSession"));

console.log("Workflow mutation guardrail tests passed.");
