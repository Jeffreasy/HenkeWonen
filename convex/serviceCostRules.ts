import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRoleForTenantId } from "./authz";

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
