import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireSyncToken, roleValidator, workspaceModeValidator } from "./authz";

export const list = query({
  args: {
    tenantId: v.id("tenants")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});

export const ensureUser = mutation({
  args: {
    tenantId: v.id("tenants"),
    externalUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: roleValidator,
    workspaceMode: v.optional(workspaceModeValidator),
    syncToken: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);

    if (!tenant) {
      throw new Error("Tenant niet gevonden");
    }

    await requireSyncToken(args.syncToken, tenant.slug, args.externalUserId);

    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_external_user", (q) => q.eq("externalUserId", args.externalUserId))
      .first();

    if (existing) {
      if (existing.tenantId !== args.tenantId) {
        throw new Error("User exists in another tenant");
      }

      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        role: args.role,
        workspaceMode: args.workspaceMode ?? "general",
        updatedAt: now
      });

      return existing._id;
    }

    return await ctx.db.insert("users", {
      tenantId: args.tenantId,
      externalUserId: args.externalUserId,
      email: args.email,
      name: args.name,
      role: args.role,
      workspaceMode: args.workspaceMode ?? "general",
      createdAt: now,
      updatedAt: now
    });
  }
});
