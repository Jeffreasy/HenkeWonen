import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireSyncToken } from "./authz";

export const getBySlug = query({
  args: {
    slug: v.string()
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  }
});

export const ensureTenant = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    syncToken: v.string()
  },
  handler: async (ctx, args) => {
    await requireSyncToken(args.syncToken, args.slug);

    const now = Date.now();
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        status: "active",
        updatedAt: now
      });

      return existing._id;
    }

    return await ctx.db.insert("tenants", {
      slug: args.slug,
      name: args.name,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
  }
});
