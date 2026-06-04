import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRoleForTenantId, requireMutationRole } from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import { requireTenant, serviceRuleCalculationType, activeStatus } from "../portalUtils";

const calculationType = v.union(
  v.literal("fixed"),
  v.literal("per_m2"),
  v.literal("per_meter"),
  v.literal("per_roll"),
  v.literal("per_side"),
  v.literal("per_staircase"),
  v.literal("manual")
);

export const list = query({
  args: {
    tenantId: v.id("tenants")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("serviceCostRules")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    categoryId: v.optional(v.id("categories")),
    name: v.string(),
    description: v.optional(v.string()),
    calculationType,
    priceExVat: v.number(),
    vatRate: v.number(),
    minQuantity: v.optional(v.number()),
    maxQuantity: v.optional(v.number()),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const now = Date.now();

    return await ctx.db.insert("serviceCostRules", {
      tenantId: args.tenantId,
      categoryId: args.categoryId,
      name: args.name,
      description: args.description,
      calculationType: args.calculationType,
      priceExVat: args.priceExVat,
      vatRate: args.vatRate,
      minQuantity: args.minQuantity,
      maxQuantity: args.maxQuantity,
      metadata: args.metadata,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const listServiceRules = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const rules = await ctx.db
      .query("serviceCostRules")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return rules
      .sort((left: Doc<"serviceCostRules">, right: Doc<"serviceCostRules">) =>
        left.name.localeCompare(right.name, "nl")
      )
      .map((rule: Doc<"serviceCostRules">) => ({
        id: String(rule._id),
        tenantId: tenant.slug,
        name: rule.name,
        description: rule.description,
        calculationType: rule.calculationType,
        priceExVat: rule.priceExVat,
        vatRate: rule.vatRate,
        status: rule.status
      }));
  }
});

export const upsertServiceRule = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    ruleId: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    calculationType: serviceRuleCalculationType,
    priceExVat: v.number(),
    vatRate: v.number(),
    status: activeStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const now = Date.now();

    if (args.ruleId) {
      const rule = await ctx.db.get(args.ruleId as Id<"serviceCostRules">);

      if (!rule || rule.tenantId !== tenant._id) {
        throw new Error("Service rule not found");
      }

      await ctx.db.patch(rule._id, {
        name: args.name,
        description: args.description,
        calculationType: args.calculationType,
        priceExVat: args.priceExVat,
        vatRate: args.vatRate,
        status: args.status,
        updatedAt: now
      });

      return rule._id;
    }

    return await ctx.db.insert("serviceCostRules", {
      tenantId: tenant._id,
      name: args.name,
      description: args.description,
      calculationType: args.calculationType,
      priceExVat: args.priceExVat,
      vatRate: args.vatRate,
      status: args.status,
      createdAt: now,
      updatedAt: now
    });
  }
});
