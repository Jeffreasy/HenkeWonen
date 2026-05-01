import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    type: v.optional(templateType)
  },
  handler: async (ctx, args) => {
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
