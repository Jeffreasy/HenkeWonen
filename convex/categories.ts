import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    tenantId: v.id("tenants")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    slug: v.string(),
    parentCategoryId: v.optional(v.id("categories")),
    sortOrder: v.number()
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("tenantId", args.tenantId).eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        parentCategoryId: args.parentCategoryId,
        sortOrder: args.sortOrder,
        status: "active",
        updatedAt: now
      });

      return existing._id;
    }

    return await ctx.db.insert("categories", {
      tenantId: args.tenantId,
      name: args.name,
      slug: args.slug,
      parentCategoryId: args.parentCategoryId,
      sortOrder: args.sortOrder,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
  }
});
