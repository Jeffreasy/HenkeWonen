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


const templateType = v.union(
  v.literal("default"),
  v.literal("flooring"),
  v.literal("curtains"),
  v.literal("wall_panels"),
  v.literal("custom")
);

const lineType = v.union(
  v.literal("product"),
  v.literal("service"),
  v.literal("labor"),
  v.literal("material"),
  v.literal("discount"),
  v.literal("text"),
  v.literal("manual")
);

const section = v.object({
  key: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  sortOrder: v.number()
});

const templateLine = v.object({
  sectionKey: v.optional(v.string()),
  lineType,
  title: v.string(),
  unit: v.string(),
  description: v.optional(v.string()),
  defaultQuantity: v.optional(v.number()),
  sortOrder: v.number(),
  optional: v.optional(v.boolean()),
  defaultEnabled: v.optional(v.boolean()),
  categoryHint: v.optional(v.string()),
  productKindHint: v.optional(v.string())
});

export const list = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator,
    type: v.optional(templateType)
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

    if (args.type) {
      return await ctx.db
        .query("quoteTemplates")
        .withIndex("by_type", (q) =>
          q.eq("tenantId", args.tenantId).eq("type", args.type!)
        )
        .collect();
    }

    return await ctx.db
      .query("quoteTemplates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});

export const upsert = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    name: v.string(),
    type: templateType,
    introText: v.optional(v.string()),
    closingText: v.optional(v.string()),
    sections: v.optional(v.array(section)),
    defaultTerms: v.array(v.string()),
    paymentTerms: v.optional(v.array(v.string())),
    defaultLines: v.array(templateLine)
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const now = Date.now();
    const existing = await ctx.db
      .query("quoteTemplates")
      .withIndex("by_type", (q) => q.eq("tenantId", args.tenantId).eq("type", args.type))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        introText: args.introText,
        closingText: args.closingText,
        sections: args.sections,
        defaultTerms: args.defaultTerms,
        paymentTerms: args.paymentTerms,
        defaultLines: args.defaultLines,
        status: "active",
        updatedAt: now
      });

      return existing._id;
    }

    return await ctx.db.insert("quoteTemplates", {
      tenantId: args.tenantId,
      name: args.name,
      type: args.type,
      introText: args.introText,
      closingText: args.closingText,
      sections: args.sections,
      defaultTerms: args.defaultTerms,
      paymentTerms: args.paymentTerms,
      defaultLines: args.defaultLines,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const listQuoteTemplates = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const templates = await ctx.db
      .query("quoteTemplates")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return templates.map((template: Doc<"quoteTemplates">) => ({
      id: String(template._id),
      tenantId: tenant.slug,
      name: template.name,
      type: template.type,
      status: template.status,
      introText: template.introText,
      closingText: template.closingText,
      sections: template.sections ?? [],
      defaultTerms: template.defaultTerms,
      paymentTerms: template.paymentTerms ?? [],
      defaultLines: template.defaultLines
    }));
  }
});

export const updateQuoteTemplateContent = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    templateId: v.string(),
    defaultTerms: v.array(v.string()),
    paymentTerms: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const template = await ctx.db.get(args.templateId as Id<"quoteTemplates">);

    if (!template || template.tenantId !== tenant._id) {
      throw new ConvexError("Quote template not found");
    }

    await ctx.db.patch(template._id, {
      defaultTerms: args.defaultTerms,
      paymentTerms: args.paymentTerms ?? [],
      updatedAt: Date.now()
    });

    return template._id;
  }
});

