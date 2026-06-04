import { query } from "../_generated/server";
import { v } from "convex/values";

export const getMetadata = query({
  args: {
    tenantSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      return {
        suppliers: [],
        importProfiles: [],
      };
    }

    const [suppliers, importProfiles] = await Promise.all([
      ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("importProfiles")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
    ]);

    return {
      suppliers: suppliers.map((item) => ({ id: String(item._id), name: item.name })),
      importProfiles: importProfiles.map((item) => ({
        id: String(item._id),
        supplierName: item.supplierName,
        name: item.name,
        filePattern: item.filePattern ?? null,
        expectedFileExtension: item.expectedFileExtension ?? null,
        supportsXlsx: item.supportsXlsx,
        supportsXls: item.supportsXls,
        status: item.status,
      })),
    };
  },
});

export const getProductsPage = query({
  args: {
    tenantSlug: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      return {
        isDone: true,
        page: [],
        continueCursor: "",
      };
    }

    const result = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .paginate({ cursor: args.cursor, numItems: args.limit });

    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.map((item) => ({
        id: String(item._id),
        supplierId: item.supplierId ? String(item.supplierId) : null,
        articleNumber: item.articleNumber ?? null,
        name: item.name,
        status: item.status,
      })),
    };
  },
});

export const getProductPricesPage = query({
  args: {
    tenantSlug: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      return {
        isDone: true,
        page: [],
        continueCursor: "",
      };
    }

    const result = await ctx.db
      .query("productPrices")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .paginate({ cursor: args.cursor, numItems: args.limit });

    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.map((item) => ({
        id: String(item._id),
        productId: String(item.productId),
        sourceKey: item.sourceKey ?? null,
        sourceFileName: item.sourceFileName ?? null,
        sourceSheetName: item.sourceSheetName ?? null,
        sourceRowNumber: item.sourceRowNumber ?? null,
        sourceColumnIndex: item.sourceColumnIndex ?? null,
        sourceColumnName: item.sourceColumnName ?? null,
        sourceValue: item.sourceValue ?? null,
        amount: item.amount,
        priceType: item.priceType,
        vatMode: item.vatMode,
      })),
    };
  },
});
