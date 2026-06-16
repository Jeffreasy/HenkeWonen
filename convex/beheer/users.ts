import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  readActorValidator,
  requireQueryRole,
  requireQueryRoleForTenantId,
  requireSyncToken,
  roleValidator,
  workspaceModeValidator
} from "../authz";

export const list = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

    return await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});

// Teamleden voor toewijzing (bv. monteur kiezen bij een inmeetbezoek inplannen).
// Anders dan `list` (admin-only, tenantId) is dit toegankelijk voor elke
// winkelmedewerker (user/editor/admin) en werkt het op tenantSlug, zodat de
// portal-client het net als andere portal-queries kan aanroepen.
export const listTeamMembers = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    return users
      .map((user) => ({
        id: String(user._id),
        naam: user.naam ?? user.email,
        email: user.email,
        role: user.role
      }))
      .sort((left, right) => left.naam.localeCompare(right.naam, "nl"));
  }
});

export const ensureUser = mutation({
  args: {
    tenantId: v.id("tenants"),
    externalUserId: v.string(),
    email: v.string(),
    naam: v.optional(v.string()),
    role: roleValidator,
    workspaceMode: v.optional(workspaceModeValidator),
    syncToken: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);

    if (!tenant) {
      throw new ConvexError("Tenant niet gevonden");
    }

    await requireSyncToken(args.syncToken, tenant.slug, args.externalUserId);

    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_external_user", (q) => q.eq("externalUserId", args.externalUserId))
      .first();

    if (existing) {
      if (existing.tenantId !== args.tenantId) {
        throw new ConvexError("User exists in another tenant");
      }

      await ctx.db.patch(existing._id, {
        email: args.email,
        naam: args.naam,
        role: args.role,
        ...(args.workspaceMode ? { workspaceMode: args.workspaceMode } : {}),
        gewijzigdOp: now
      });

      return existing._id;
    }

    return await ctx.db.insert("users", {
      tenantId: args.tenantId,
      externalUserId: args.externalUserId,
      email: args.email,
      naam: args.naam,
      role: args.role,
      workspaceMode: args.workspaceMode ?? "general",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});
