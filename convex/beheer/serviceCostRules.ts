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
import { serviceRuleCalculationType, activeStatus } from "../portalUtils";

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
    tenantId: v.id("tenants"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

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
    categorieId: v.optional(v.id("categories")),
    naam: v.string(),
    omschrijving: v.optional(v.string()),
    berekeningType: calculationType,
    prijsExBtw: v.number(),
    btwTarief: v.number(),
    minQuantity: v.optional(v.number()),
    maxQuantity: v.optional(v.number()),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const now = Date.now();

    return await ctx.db.insert("serviceCostRules", {
      tenantId: args.tenantId,
      categorieId: args.categorieId,
      naam: args.naam,
      omschrijving: args.omschrijving,
      berekeningType: args.berekeningType,
      prijsExBtw: args.prijsExBtw,
      btwTarief: args.btwTarief,
      minQuantity: args.minQuantity,
      maxQuantity: args.maxQuantity,
      metadata: args.metadata,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const listServiceRules = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const rules = await ctx.db
      .query("serviceCostRules")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return rules
      .sort((left: Doc<"serviceCostRules">, right: Doc<"serviceCostRules">) =>
        left.naam.localeCompare(right.naam, "nl")
      )
      .map((rule: Doc<"serviceCostRules">) => ({
        id: String(rule._id),
        tenantId: tenant.slug,
        name: rule.naam,
        description: rule.omschrijving,
        calculationType: rule.berekeningType,
        priceExVat: rule.prijsExBtw,
        vatRate: rule.btwTarief,
        status: rule.status
      }));
  }
});

export const upsertServiceRule = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    ruleId: v.optional(v.string()),
    naam: v.string(),
    omschrijving: v.optional(v.string()),
    berekeningType: serviceRuleCalculationType,
    prijsExBtw: v.number(),
    btwTarief: v.number(),
    status: activeStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const now = Date.now();

    if (args.ruleId) {
      const rule = await ctx.db.get(args.ruleId as Id<"serviceCostRules">);

      if (!rule || rule.tenantId !== tenant._id) {
        throw new ConvexError("Service rule not found");
      }

      await ctx.db.patch(rule._id, {
        naam: args.naam,
        omschrijving: args.omschrijving,
        berekeningType: args.berekeningType,
        prijsExBtw: args.prijsExBtw,
        btwTarief: args.btwTarief,
        status: args.status,
        gewijzigdOp: now
      });

      return rule._id;
    }

    return await ctx.db.insert("serviceCostRules", {
      tenantId: tenant._id,
      naam: args.naam,
      omschrijving: args.omschrijving,
      berekeningType: args.berekeningType,
      prijsExBtw: args.prijsExBtw,
      btwTarief: args.btwTarief,
      status: args.status,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});
