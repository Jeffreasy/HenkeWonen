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
  sleutel: v.string(),
  titel: v.string(),
  omschrijving: v.optional(v.string()),
  sortOrder: v.number()
});

const templateLine = v.object({
  sectieSleutel: v.optional(v.string()),
  regelType: lineType,
  titel: v.string(),
  eenheid: v.string(),
  omschrijving: v.optional(v.string()),
  standaardAantal: v.optional(v.number()),
  sortOrder: v.number(),
  optioneel: v.optional(v.boolean()),
  standaardIngeschakeld: v.optional(v.boolean()),
  categorieHint: v.optional(v.string()),
  productSoortHint: v.optional(v.string())
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
    naam: v.string(),
    type: templateType,
    inleidingTekst: v.optional(v.string()),
    afsluitTekst: v.optional(v.string()),
    secties: v.optional(v.array(section)),
    standaardVoorwaarden: v.array(v.string()),
    betalingsvoorwaarden: v.optional(v.array(v.string())),
    standaardRegels: v.array(templateLine)
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const now = Date.now();
    const existing = await ctx.db
      .query("quoteTemplates")
      .withIndex("by_type", (q) => q.eq("tenantId", args.tenantId).eq("type", args.type))
      .filter((q) => q.eq(q.field("naam"), args.naam))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        inleidingTekst: args.inleidingTekst,
        afsluitTekst: args.afsluitTekst,
        secties: args.secties,
        standaardVoorwaarden: args.standaardVoorwaarden,
        betalingsvoorwaarden: args.betalingsvoorwaarden,
        standaardRegels: args.standaardRegels,
        status: "active",
        gewijzigdOp: now
      });

      return existing._id;
    }

    return await ctx.db.insert("quoteTemplates", {
      tenantId: args.tenantId,
      naam: args.naam,
      type: args.type,
      inleidingTekst: args.inleidingTekst,
      afsluitTekst: args.afsluitTekst,
      secties: args.secties,
      standaardVoorwaarden: args.standaardVoorwaarden,
      betalingsvoorwaarden: args.betalingsvoorwaarden,
      standaardRegels: args.standaardRegels,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
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
      naam: template.naam,
      type: template.type,
      status: template.status,
      inleidingTekst: template.inleidingTekst,
      afsluitTekst: template.afsluitTekst,
      secties: template.secties ?? [],
      standaardVoorwaarden: template.standaardVoorwaarden,
      betalingsvoorwaarden: template.betalingsvoorwaarden ?? [],
      standaardRegels: template.standaardRegels
    }));
  }
});

export const updateQuoteTemplateContent = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    templateId: v.string(),
    standaardVoorwaarden: v.array(v.string()),
    betalingsvoorwaarden: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const template = await ctx.db.get(args.templateId as Id<"quoteTemplates">);

    if (!template || template.tenantId !== tenant._id) {
      throw new ConvexError("Quote template not found");
    }

    await ctx.db.patch(template._id, {
      standaardVoorwaarden: args.standaardVoorwaarden,
      betalingsvoorwaarden: args.betalingsvoorwaarden ?? [],
      gewijzigdOp: Date.now()
    });

    return template._id;
  }
});

