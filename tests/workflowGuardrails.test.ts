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

describe("Workflow Mutation Guardrails & Security Policies", () => {
  const writeBlocks = allConvexWriteBlocks();
  const deleteBlocks = writeBlocks.filter(({ block }) => block.includes("ctx.db.delete("));
  const publicMutations = writeBlocks.filter(({ type }) => type === "mutation");

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
