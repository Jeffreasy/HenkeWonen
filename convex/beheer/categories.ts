import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRoleForTenantId,
  requireMutationRole,
  requireQueryRole,
  requireQueryRoleForTenantId
} from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import { activeStatus } from "../portalUtils";

export const list = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

    return await ctx.db
      .query("categories")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    naam: v.string(),
    slug: v.string(),
    bovenliggendeCategorieId: v.optional(v.id("categories")),
    sortOrder: v.number()
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const now = Date.now();
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("tenantId", args.tenantId).eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        naam: args.naam,
        bovenliggendeCategorieId: args.bovenliggendeCategorieId,
        sortOrder: args.sortOrder,
        status: "active",
        gewijzigdOp: now
      });

      return existing._id;
    }

    return await ctx.db.insert("categories", {
      tenantId: args.tenantId,
      naam: args.naam,
      slug: args.slug,
      bovenliggendeCategorieId: args.bovenliggendeCategorieId,
      sortOrder: args.sortOrder,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const listCategories = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return categories
      .sort((left: Doc<"categories">, right: Doc<"categories">) => left.sortOrder - right.sortOrder)
      .map((category: Doc<"categories">) => ({
        id: String(category._id),
        tenantId: tenant.slug,
        name: category.naam,
        slug: category.slug,
        sortOrder: category.sortOrder,
        status: category.status
      }));
  }
});

export const upsertCategory = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    categorieId: v.optional(v.string()),
    naam: v.string(),
    slug: v.string(),
    sortOrder: v.number(),
    status: activeStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const now = Date.now();

    if (args.categorieId) {
      const category = await ctx.db.get(args.categorieId as Id<"categories">);

      if (!category || category.tenantId !== tenant._id) {
        throw new ConvexError("Productgroep niet gevonden.");
      }

      await ctx.db.patch(category._id, {
        naam: args.naam,
        slug: args.slug,
        sortOrder: args.sortOrder,
        status: args.status,
        gewijzigdOp: now
      });

      return category._id;
    }

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q: any) => q.eq("tenantId", tenant._id).eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        naam: args.naam,
        sortOrder: args.sortOrder,
        status: args.status,
        gewijzigdOp: now
      });

      return existing._id;
    }

    return await ctx.db.insert("categories", {
      tenantId: tenant._id,
      naam: args.naam,
      slug: args.slug,
      sortOrder: args.sortOrder,
      status: args.status,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});
