import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { readActorValidator, requireQueryRole, requireSyncToken } from "../authz";

export const getBySlug = query({
  args: {
    slug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.slug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    return tenant;
  }
});

export const ensureTenant = mutation({
  args: {
    slug: v.string(),
    naam: v.string(),
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
        naam: args.naam,
        status: "active",
        gewijzigdOp: now
      });

      return existing._id;
    }

    return await ctx.db.insert("tenants", {
      slug: args.slug,
      naam: args.naam,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});
