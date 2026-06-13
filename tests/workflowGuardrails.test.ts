import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exportedMutationBlock(relativePath: string, name: string) {
  const source = read(relativePath);
  const start = source.indexOf(`export const ${name} = mutation({`);
  expect(start).not.toBe(-1);
  const end = source.indexOf("\n});", start);
  expect(end).not.toBe(-1);
  return source.slice(start, end + 4);
}

function exportedQueryBlock(relativePath: string, name: string) {
  const source = read(relativePath);
  const start = source.indexOf(`export const ${name} = query({`);
  expect(start).not.toBe(-1);
  const end = source.indexOf("\n});", start);
  expect(end).not.toBe(-1);
  return source.slice(start, end + 4);
}

function allConvexWriteBlocks() {
  const convexDir = path.join(root, "convex");
  const blocks: Array<{ file: string, name: string, type: string, block: string }> = [];

  function walk(dir: string) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (file !== "_generated" && !file.startsWith(".")) {
          walk(fullPath);
        }
      } else if (file.endsWith(".ts") && !file.startsWith("_")) {
        const relativePath = path.relative(root, fullPath).replace(/\\/g, "/");
        const source = fs.readFileSync(fullPath, "utf8");
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
    }
  }

  walk(convexDir);
  return blocks;
}

function allConvexQueryBlocks() {
  const convexDir = path.join(root, "convex");
  const blocks: Array<{ file: string, name: string, block: string }> = [];

  function walk(dir: string) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (file !== "_generated" && !file.startsWith(".")) {
          walk(fullPath);
        }
      } else if (file.endsWith(".ts") && !file.startsWith("_")) {
        const relativePath = path.relative(root, fullPath).replace(/\\/g, "/");
        const source = fs.readFileSync(fullPath, "utf8");
        const exportPattern = /export const (\w+) = query\(\{/g;
        let match;

        while ((match = exportPattern.exec(source))) {
          const name = match[1];
          const start = match.index;
          const end = source.indexOf("\n});", start);
          const block = end === -1 ? source.slice(start) : source.slice(start, end + 4);

          blocks.push({
            file: relativePath,
            name,
            block
          });
        }
      }
    }
  }

  walk(convexDir);
  return blocks;
}

describe("Workflow Mutation Guardrails & Security Policies", () => {
  const writeBlocks = allConvexWriteBlocks();
  const queryBlocks = allConvexQueryBlocks();
  const deleteBlocks = writeBlocks.filter(({ block }) => block.includes("ctx.db.delete("));
  const publicMutations = writeBlocks.filter(({ type }) => type === "mutation");

  it("should enforce actor authorization on all public queries", () => {
    for (const { block } of queryBlocks) {
      expect(block).toContain("actor: readActorValidator");
      expect(block).toMatch(/requireQueryRole(?:ForTenantId)?\(/);
    }
  });

  it("should enforce authentication or explicit tooling gates on all public mutations", () => {
    for (const { block } of publicMutations) {
      const actorSecured =
        block.includes("actor: mutationActorValidator") &&
        (block.includes("requireMutationRole") || block.includes("requireMutationRoleForTenantId"));
      const syncSecured = block.includes("syncToken: v.string()") && block.includes("requireSyncToken");
      const toolingSecured = block.includes("requireConvexToolingEnabled");

      expect(actorSecured || syncSecured || toolingSecured).toBe(true);
    }
  });

  it("should restrict hard database deletes to the whitelisted set of operations", () => {
    expect(deleteBlocks.map(({ file, name }) => `${file}:${name}`).sort()).toEqual([
      "convex/catalog/import.ts:deleteProductsByCategoryChunk",
      "convex/catalog/import.ts:deleteProductsBySupplierChunk",
      "convex/catalog/import.ts:resetCatalogChunk",
      "convex/catalog/maintenance.ts:deletePseudoPriceRowsChunk",
      "convex/catalog/maintenance.ts:deleteDocumentsByIdChunk",
      "convex/projecten/measurements.ts:deleteMeasurementLine",
      "convex/projecten/measurements.ts:deleteMeasurementRoom",
      "convex/projecten/core.ts:deleteProjectRoom",
      "convex/offertes/core.ts:deleteQuoteLine"
    ].sort());
  });

  it("should secure deleteQuoteLine with proper tenant and draft checks", () => {
    const deleteQuoteLine = exportedMutationBlock("convex/offertes/core.ts", "deleteQuoteLine");
    expect(deleteQuoteLine).toContain("line.tenantId !== tenant._id");
    expect(deleteQuoteLine).toContain('quote.status !== "draft"');
    expect(deleteQuoteLine).toContain("await ctx.db.delete(line._id);");
    expect(deleteQuoteLine).toContain("await recalculateQuote(ctx, tenant._id, line.quoteId);");
  });

  it("should restrict quote modifications to draft quotes", () => {
    for (const mutationName of ["addQuoteLine", "updateQuote", "updateQuoteLine", "updateQuoteTerms"]) {
      const block = exportedMutationBlock("convex/offertes/core.ts", mutationName);
      expect(block).toContain('quote.status !== "draft"');
    }
    const legacyAddQuoteLine = exportedMutationBlock("convex/offertes/core.ts", "addLine");
    expect(legacyAddQuoteLine).toContain('quote.status !== "draft"');
  });

  it("should not accept a project quote workflow without an actual quote", () => {
    const block = exportedMutationBlock("convex/projecten/core.ts", "processProjectAction");

    expect(block).toContain('args.action === "quote_accepted"');
    expect(block).toContain("Maak eerst een offerte aan voordat je akkoord verwerkt.");
    expect(block).toContain("Er is geen actieve offerte om akkoord te verwerken.");
    expect(block).toContain("latestAcceptedQuoteForProject");
    expect(block).toContain("Maak of accepteer eerst een offerte voordat je een factuur aanmaakt.");
  });

  it("should keep project invoice creation idempotent per accepted quote", () => {
    const processProjectAction = exportedMutationBlock("convex/projecten/core.ts", "processProjectAction");
    const createInvoiceFromQuote = exportedMutationBlock("convex/facturen/core.ts", "createInvoiceFromQuote");
    const portalUtils = read("convex/portalUtils.ts");
    const schema = read("convex/schema.ts");

    expect(portalUtils).toContain("export async function existingInvoiceForQuote");
    expect(portalUtils).toContain("export async function nextInvoiceNumber");
    expect(portalUtils).toContain("export async function completeInvoiceWorkflow");
    expect(portalUtils).toContain("invoiceSequenceYear");
    expect(schema).toContain("invoiceSequenceValue: v.optional(v.number())");
    expect(createInvoiceFromQuote).toContain("existingInvoiceForQuote(ctx, tenant._id, quoteId)");
    expect(createInvoiceFromQuote).toContain("completeInvoiceWorkflow(ctx, tenant._id, project");
    expect(createInvoiceFromQuote).toContain('status: "sent"');
    expect(processProjectAction).toContain("existingInvoiceForQuote(ctx, tenant._id, latestAcceptedQuote._id)");
    expect(processProjectAction).toContain("completeInvoiceWorkflow(ctx, tenant._id, project, invoiceDueAt");
    expect(processProjectAction).toContain('args.action !== "invoice_created"');
    expect(processProjectAction).toContain("if (!existingInvoice)");
    expect(processProjectAction).toContain("existingInvoice?.dueDate ?? args.invoiceDueAt");
  });

  it("should surface execution appointments and accepted quotes in the field workspace", () => {
    const fieldServiceSource = read("convex/projecten/fieldService.ts");
    const portalUtils = read("convex/portalUtils.ts");

    expect(fieldServiceSource).toContain('project.status === "execution_planned"');
    expect(fieldServiceSource).toContain("project.executionDate ?? project.measurementDate");
    expect(fieldServiceSource).toContain('quote.status === "accepted"');
    expect(fieldServiceSource).not.toContain('["lead", "quote_accepted", "measurement_planned"]');
    expect(portalUtils).toContain('quote.status === "accepted"');
    expect(portalUtils).toContain("project.executionDate ?? project.measurementDate");
    expect(portalUtils).not.toContain('["lead", "quote_accepted", "measurement_planned"]');
  });

  it("should keep accepted quotes out of the measurement dashboard bucket", () => {
    const dashboardSource = read("convex/portal.ts");

    expect(dashboardSource).toContain('project.status === "measurement_planned"');
    expect(dashboardSource).toContain('title: "Akkoord opvolgen"');
    expect(dashboardSource).toContain('project.status === "quote_accepted"');
    expect(dashboardSource).toContain("openTaskProjectIds");
  });

  it("should open creation modals directly from dossier action cards", () => {
    const dossierActions = read("src/components/dossiers/DossierActions.tsx");
    const dossierTabs = read("src/components/dossiers/DossierTabs.astro");
    const dossierWorkspace = read("src/components/dossiers/DossierWorkspace.tsx");
    const dossierSearchPanel = read("src/components/dossiers/DossierSearchPanel.tsx");
    const dossierPage = read("src/pages/portal/dossiers/index.astro");
    const customerPage = read("src/pages/portal/klanten/index.astro");
    const projectPage = read("src/pages/portal/projecten/index.astro");
    const customerForm = read("src/components/customers/CustomerForm.tsx");
    const customerList = read("src/components/customers/CustomerList.tsx");
    const customerWorkspace = read("src/components/customers/CustomerWorkspace.tsx");
    const projectForm = read("src/components/projects/ProjectForm.tsx");
    const createQuoteForm = read("src/components/quotes/CreateQuoteForm.tsx");
    const quoteWorkspace = read("src/components/quotes/QuoteWorkspace.tsx");

    expect(dossierActions).toContain('href="/portal/klanten?open=nieuw"');
    expect(dossierActions).toContain('href="/portal/projecten?open=nieuw"');
    expect(dossierActions).toContain('className="card dossier-action-card"');
    expect(dossierWorkspace.indexOf("<DossierActions")).toBeLessThan(dossierWorkspace.indexOf("<DossierStats"));
    expect(dossierTabs).toContain('href: "/portal/klanten"');
    expect(dossierTabs).toContain('href: "/portal/projecten"');
    expect(dossierPage).toContain('<DossierTabs active="overview" />');
    expect(customerPage).toContain('<DossierTabs active="customers" />');
    expect(projectPage).toContain('<DossierTabs active="projects" />');
    expect(customerForm).toContain("postalCode?: string");
    expect(customerForm).toContain('htmlFor="customer-postal-code"');
    expect(customerForm).toContain("street: street.trim() || undefined");
    expect(dossierSearchPanel).toContain("PaginationControls");
    expect(dossierSearchPanel).toContain("const pageSize = 25");
    expect(customerList).toContain("PaginationControls");
    expect(customerList).toContain("const pageSize = 25");
    expect(customerWorkspace).toContain("window.location.assign(`/portal/klanten/${String(customerId)}`)");
    expect(projectForm).toContain('className="form-grid"');
    expect(projectForm).not.toContain('className="panel form-grid"');
    expect(createQuoteForm).toContain('className="form-grid"');
    expect(createQuoteForm).not.toContain('className="panel"');
    expect(quoteWorkspace).toContain("shouldOpenNewQuoteModal");
    expect(quoteWorkspace).toContain('get("open") === "nieuw"');
    expect(quoteWorkspace).toContain("window.location.assign(`/portal/offertes/${newQuoteId}`)");
    expect(quoteWorkspace).toContain("invoicePaymentTermDays(selectedCustomer)");
  });

  it("should show the customer quote version in a modal instead of inline on the quote page", () => {
    const quoteBuilder = read("src/components/quotes/QuoteBuilder.tsx");
    const quoteDocumentPreview = read("src/components/quotes/QuoteDocumentPreview.tsx");

    expect(quoteBuilder).toContain("isCustomerVersionModalOpen");
    expect(quoteBuilder).toContain("setIsCustomerVersionModalOpen(true)");
    expect(quoteBuilder).toContain('<FormModal');
    expect(quoteBuilder).toContain('size="xl"');
    expect(quoteBuilder).toContain("Klantversie openen");
    expect(quoteDocumentPreview).toContain('className="no-print"');
    expect(quoteDocumentPreview).toContain('quote-document-cover print-page-break-avoid no-print');
    expect(quoteDocumentPreview).toContain('quote-document-review-warning no-print');
  });

  it("should open the field intake in a modal instead of inline on the field workspace", () => {
    const fieldServiceWorkspace = read("src/components/field/FieldServiceWorkspace.tsx");
    const fieldIntakeForm = read("src/components/field/FieldIntakeForm.tsx");
    const featureStyles = read("src/styles/layers/04-features-field.css");

    expect(fieldServiceWorkspace).toContain('get("open") === "nieuw"');
    expect(fieldServiceWorkspace).toContain("<FormModal");
    expect(fieldServiceWorkspace).toContain('size="lg"');
    expect(fieldServiceWorkspace).toContain("setIsIntakeOpen(true)");
    expect(fieldServiceWorkspace).not.toContain("setIsIntakeOpen((current) => !current)");
    expect(fieldIntakeForm).toContain('className="field-intake-form"');
    expect(fieldIntakeForm).not.toContain("field-intake-panel");
    expect(fieldIntakeForm).not.toContain("SectionHeader");
    expect(featureStyles).not.toContain(".field-intake-panel");
  });

  it("should keep mobile modals above quick actions and touch-scrollable", () => {
    const overlayStyles = read("src/styles/layers/07-overlays.css");
    const responsiveStyles = read("src/styles/layers/16-responsive.css");
    const componentStyles = read("src/styles/layers/06-ui-components.css");

    expect(overlayStyles).toContain(".form-modal-backdrop");
    expect(overlayStyles).toContain("z-index: 1450");
    expect(overlayStyles).toContain("touch-action: pan-y");
    expect(overlayStyles).toContain("-webkit-overflow-scrolling: touch");
    expect(overlayStyles).toContain(".quick-action-fab-container");
    expect(overlayStyles).toContain("z-index: 1400");
    expect(componentStyles).toContain(".confirm-dialog-backdrop");
    expect(componentStyles).toContain("z-index: 1460");
    expect(responsiveStyles).toContain("height: min(90dvh");
    expect(responsiveStyles).toContain("env(safe-area-inset-bottom");
  });

  it("should keep the customer contact modal professional and complete", () => {
    const addContactForm = read("src/components/customers/AddContactForm.tsx");
    const customerDetail = read("src/components/customers/CustomerDetail.tsx");
    const customerInfoPanel = read("src/components/customers/CustomerInfoPanel.tsx");
    const featureStyles = read("src/styles/layers/13-features-projects.css");
    const responsiveStyles = read("src/styles/layers/16-responsive.css");

    expect(customerDetail).toContain('size="md"');
    expect(customerDetail).toContain("description: values.description");
    expect(customerDetail).toContain("expectedReturnDate: values.expectedReturnDate");
    expect(addContactForm).toContain("contact-moment-form");
    expect(addContactForm).toContain("<Select");
    expect(addContactForm).toContain("dateInputToTimestamp");
    expect(addContactForm).toContain("expectedReturnDate");
    expect(addContactForm).toContain("Textarea");
    expect(addContactForm).not.toContain("responsive-form-row");
    expect(customerInfoPanel).toContain("customer-info-copy-value");
    expect(customerInfoPanel).toContain("customer-info-value-text");
    expect(featureStyles).toContain(".contact-form-grid");
    expect(responsiveStyles).toContain(".contact-form-footer .ui-button");
  });

  it("should enforce child check constraints before deleting a project room", () => {
    const deleteProjectRoom = exportedMutationBlock("convex/projecten/core.ts", "deleteProjectRoom");
    expect(deleteProjectRoom).toContain('query("measurementRooms")');
    expect(deleteProjectRoom).toContain('query("quoteLines")');
    expect(deleteProjectRoom).toContain("measurementRoom || quoteLine");
    expect(deleteProjectRoom).toContain("await ctx.db.delete(room._id);");
  });

  it("should check child constraints before deleting a measurement room", () => {
    const deleteMeasurementRoom = exportedMutationBlock("convex/projecten/measurements.ts", "deleteMeasurementRoom");
    expect(deleteMeasurementRoom).toContain('query("measurementLines")');
    expect(deleteMeasurementRoom).toContain("if (line)");
    expect(deleteMeasurementRoom).toContain("await ctx.db.delete(room._id);");
  });

  it("should check child constraints before deleting a measurement line", () => {
    const deleteMeasurementLine = exportedMutationBlock("convex/projecten/measurements.ts", "deleteMeasurementLine");
    expect(deleteMeasurementLine).toContain('line.quotePreparationStatus === "converted"');
    expect(deleteMeasurementLine).toContain("line.convertedQuoteId");
    expect(deleteMeasurementLine).toContain("line.convertedQuoteLineId");
    expect(deleteMeasurementLine).toContain("await ctx.db.delete(line._id);");
  });

  it("should guard resetCatalogChunk to require literal confirmation and admin role", () => {
    const resetCatalogChunk = exportedMutationBlock("convex/catalog/import.ts", "resetCatalogChunk");
    expect(resetCatalogChunk).toContain('confirm: v.literal("RESET_IMPORTED_CATALOG")');
    expect(resetCatalogChunk).toContain("actor: mutationActorValidator");
    expect(resetCatalogChunk).toContain('["admin"]');
    expect(resetCatalogChunk).toContain('"productPrices"');
    expect(resetCatalogChunk).toContain('"products"');
    expect(resetCatalogChunk).not.toContain('"customers"');
    expect(resetCatalogChunk).not.toContain('"projects"');
    expect(resetCatalogChunk).not.toContain('"quotes"');
  });

  it("should guard deleteProductsByCategoryChunk to require literal confirmation and admin role", () => {
    const deleteProductsByCategoryChunk = exportedMutationBlock(
      "convex/catalog/import.ts",
      "deleteProductsByCategoryChunk"
    );
    expect(deleteProductsByCategoryChunk).toContain('confirm: v.literal("DELETE_PRODUCTS_BY_CATEGORY")');
    expect(deleteProductsByCategoryChunk).toContain("actor: mutationActorValidator");
    expect(deleteProductsByCategoryChunk).toContain('["admin"]');
  });

  it("should guard the price maintenance mutations with literal confirmation and admin role", () => {
    const repairVatModes = exportedMutationBlock("convex/catalog/maintenance.ts", "repairPriceVatModesChunk");
    expect(repairVatModes).toContain('confirm: v.literal("REPAIR_PRICE_VAT_MODES")');
    expect(repairVatModes).toContain("actor: mutationActorValidator");
    expect(repairVatModes).toContain('["admin"]');
    expect(repairVatModes).not.toContain("ctx.db.delete(");

    const stripNames = exportedMutationBlock("convex/catalog/maintenance.ts", "stripLeakedFilenameFromNamesChunk");
    expect(stripNames).toContain('confirm: v.literal("STRIP_LEAKED_FILENAME")');
    expect(stripNames).toContain("actor: mutationActorValidator");
    expect(stripNames).toContain('["admin"]');
    expect(stripNames).not.toContain("ctx.db.delete(");

    const deletePseudoRows = exportedMutationBlock("convex/catalog/maintenance.ts", "deletePseudoPriceRowsChunk");
    expect(deletePseudoRows).toContain('confirm: v.literal("DELETE_PSEUDO_PRICE_ROWS")');
    expect(deletePseudoRows).toContain("actor: mutationActorValidator");
    expect(deletePseudoRows).toContain('["admin"]');
    expect(deletePseudoRows).toContain('"productPrices"');
    expect(deletePseudoRows).not.toContain('"products"');
  });

  it("should secure deleteDocumentsByIdChunk with confirm, admin role and tenant scope", () => {
    const deleteById = exportedMutationBlock("convex/catalog/maintenance.ts", "deleteDocumentsByIdChunk");
    expect(deleteById).toContain('confirm: v.literal("DELETE_ORPHAN_RECORDS")');
    expect(deleteById).toContain("actor: mutationActorValidator");
    expect(deleteById).toContain('["admin"]');
    expect(deleteById).toContain("doc.tenantId !== tenant._id");
    expect(deleteById).toContain("args.dryRun ?? true");
  });

  it("should keep the indicative price rule customer-safe", () => {
    const pricingRules = read("convex/catalog/pricingRules.ts");
    expect(pricingRules).toContain('new Set(["advice_retail", "retail"])');
    expect(pricingRules).not.toContain("purchase");
    expect(pricingRules).toContain('row.vatMode === "exclusive" || row.vatMode === "inclusive"');

    const pricingQuery = exportedQueryBlock("convex/catalog/pricing.ts", "getIndicativePrice");
    expect(pricingQuery).toContain("actor: readActorValidator");
    expect(pricingQuery).toContain("pilotHiddenReason");
    expect(pricingQuery).not.toContain('"viewer"');
  });

  it("should guard deleteProductsBySupplierChunk to require literal confirmation and admin role", () => {
    const deleteProductsBySupplierChunk = exportedMutationBlock(
      "convex/catalog/import.ts",
      "deleteProductsBySupplierChunk"
    );
    expect(deleteProductsBySupplierChunk).toContain('confirm: v.literal("DELETE_PRODUCTS_BY_SUPPLIER")');
    expect(deleteProductsBySupplierChunk).toContain("actor: mutationActorValidator");
    expect(deleteProductsBySupplierChunk).toContain('["admin"]');
  });

  it("should format catalog status query parameters correctly", () => {
    const catalogStats = exportedQueryBlock("convex/catalog/import.ts", "getCatalogImportStats");
    expect(catalogStats).toContain("summaryOnly: v.optional(v.boolean())");
    expect(catalogStats).toContain('source: "summary_only"');
    expect(catalogStats).toContain('source: "catalog_documents"');
  });

  it("should use slug-scoped invoice action mutations for portal invoices", () => {
    const updateInvoiceStatus = exportedMutationBlock("convex/facturen/core.ts", "updateInvoiceStatus");
    const markInvoicePaid = exportedMutationBlock("convex/facturen/core.ts", "markInvoicePaid");
    const invoiceDetail = read("src/components/invoices/InvoiceDetail.tsx");

    expect(updateInvoiceStatus).toContain("tenantSlug: v.string()");
    expect(markInvoicePaid).toContain("tenantSlug: v.string()");
    expect(invoiceDetail).toContain("tenantSlug: session.tenantId");
    expect(invoiceDetail).not.toContain("tenantId: detail.invoice.tenantId as any");
  });

  it("should define required search indexes on catalog tables", () => {
    const schemaSource = read("convex/schema.ts");
    expect(schemaSource).toContain('index("by_category_status", ["tenantId", "categoryId", "status"])');
    expect(schemaSource).toContain('index("by_supplier_status", ["tenantId", "supplierId", "status"])');
  });

  it("should enforce production confirmation flags on all catalog cleanups", () => {
    for (const cleanupScript of [
      "tools/cleanup_catalog.mjs"
    ]) {
      const script = read(cleanupScript);
      expect(script).toContain("productionConfirmFlag");
      expect(script).toContain("requireAuthzSecret: true");
      expect(script).toContain("confirm:");
    }
  });

  it("should enforce destructive confirmation flags on resetCatalog", () => {
    const resetCatalogImportScript = read("tools/reset_catalog_import.mjs");
    expect(resetCatalogImportScript).toContain("--confirm-reset-imported-catalog");
    expect(resetCatalogImportScript).toContain("Catalog reset is destructive");
    expect(resetCatalogImportScript).toContain("createToolMutationActor");
    expect(resetCatalogImportScript).toContain("actor");
  });

  it("should configure ALLOW_DEV_AUTHZ_TOKENS check on authz helpers", () => {
    const authzSource = read("convex/authz.ts");
    expect(authzSource).toContain("ALLOW_DEV_AUTHZ_TOKENS");
    expect(authzSource).toContain("allowsDevAuthzTokens()");
  });
});
