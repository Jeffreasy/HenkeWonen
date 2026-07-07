import { internalMutation, mutation, query } from "../_generated/server";
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

const measurementProductGroup = v.union(
  v.literal("flooring"),
  v.literal("plinths"),
  v.literal("wallpaper"),
  v.literal("wall_panels"),
  v.literal("curtains"),
  v.literal("rails"),
  v.literal("stairs"),
  v.literal("other")
);

/**
 * Omgekeerde naam→productgroep-map, uitsluitend voor de eenmalige backfill van
 * bestaande categorieën (zie backfillCategoryProductGroups). Spiegelt de vroegere
 * hardgecodeerde PRODUCT_GROUP_TO_CATEGORIES; na de migratie is `categories.productGroep`
 * de bron van waarheid.
 */
const CATEGORY_NAME_TO_GROUP: Record<string, string> = {
  "PVC Vloeren": "flooring",
  "PVC Dryback": "flooring",
  "Palletcollectie PVC": "flooring",
  Tapijt: "flooring",
  Vinyl: "flooring",
  Karpetten: "flooring",
  Ondervloer: "flooring",
  Egaline: "flooring",
  Lijm: "flooring",
  Plinten: "plinths",
  Behang: "wallpaper",
  Wandpanelen: "wall_panels",
  Gordijnen: "curtains",
  "Roedes/Railsen": "rails",
  Traprenovatie: "stairs"
};

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
    productGroep: v.optional(measurementProductGroup),
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
        productGroep: args.productGroep,
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
      productGroep: args.productGroep,
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
        productGroep: category.productGroep,
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
    productGroep: v.optional(measurementProductGroup),
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
        productGroep: args.productGroep,
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
        productGroep: args.productGroep,
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
      productGroep: args.productGroep,
      sortOrder: args.sortOrder,
      status: args.status,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

/**
 * Eenmalige migratie: vult `productGroep` op bestaande categorieën die er nog
 * geen hebben, op basis van de categorienaam (CATEGORY_NAME_TO_GROUP). Idempotent
 * — categorieën met een reeds gezette productgroep blijven ongemoeid.
 *
 * Draaien op productie (per tenant):
 *   npx convex run beheer/categories:backfillCategoryProductGroups '{"tenantSlug":"<slug>"}'
 */
export const backfillCategoryProductGroups = internalMutation({
  args: { tenantSlug: v.string() },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      throw new ConvexError("Tenant niet gevonden.");
    }

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const now = Date.now();
    let updated = 0;
    const unmatched: string[] = [];

    for (const category of categories) {
      if (category.productGroep) {
        continue;
      }
      const group = CATEGORY_NAME_TO_GROUP[category.naam];
      if (!group) {
        unmatched.push(category.naam);
        continue;
      }
      await ctx.db.patch(category._id, {
        productGroep: group as Doc<"categories">["productGroep"],
        gewijzigdOp: now
      });
      updated += 1;
    }

    return { total: categories.length, updated, unmatched };
  }
});
