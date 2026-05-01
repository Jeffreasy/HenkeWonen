import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const lineType = v.union(
  v.literal("product"),
  v.literal("service"),
  v.literal("labor"),
  v.literal("material"),
  v.literal("discount"),
  v.literal("text"),
  v.literal("manual")
);

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateLineTotals(
  quantity: number,
  unitPriceExVat: number,
  vatRate: number,
  discountExVat?: number
) {
  const grossExVat = quantity * unitPriceExVat;
  const lineTotalExVat = roundMoney(grossExVat - (discountExVat ?? 0));
  const lineVatTotal = roundMoney(lineTotalExVat * (vatRate / 100));
  const lineTotalIncVat = roundMoney(lineTotalExVat + lineVatTotal);

  return {
    lineTotalExVat,
    lineVatTotal,
    lineTotalIncVat
  };
}

export const list = query({
  args: {
    tenantId: v.id("tenants")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quotes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  }
});

export const get = query({
  args: {
    tenantId: v.id("tenants"),
    quoteId: v.id("quotes")
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);

    if (!quote || quote.tenantId !== args.tenantId) {
      return null;
    }

    const lines = await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) =>
        q.eq("tenantId", args.tenantId).eq("quoteId", args.quoteId)
      )
      .collect();

    return {
      quote,
      lines: lines.sort((a, b) => a.sortOrder - b.sortOrder)
    };
  }
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    customerId: v.id("customers"),
    title: v.string(),
    introText: v.optional(v.string()),
    closingText: v.optional(v.string()),
    terms: v.optional(v.array(v.string())),
    paymentTerms: v.optional(v.array(v.string())),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    const customer = await ctx.db.get(args.customerId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
    }

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new Error("Customer not found");
    }

    const now = Date.now();
    const quoteNumber = `OFF-${new Date(now).getFullYear()}-${now}`;

    const quoteId = await ctx.db.insert("quotes", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      customerId: args.customerId,
      quoteNumber,
      title: args.title,
      status: "draft",
      introText: args.introText,
      closingText: args.closingText,
      terms: args.terms,
      paymentTerms: args.paymentTerms,
      subtotalExVat: 0,
      vatTotal: 0,
      totalIncVat: 0,
      createdByExternalUserId: args.createdByExternalUserId,
      createdAt: now,
      updatedAt: now
    });

    await ctx.db.patch(args.projectId, {
      status: "quote_draft",
      updatedAt: now
    });

    return quoteId;
  }
});

export const addLine = mutation({
  args: {
    tenantId: v.id("tenants"),
    quoteId: v.id("quotes"),
    projectRoomId: v.optional(v.id("projectRooms")),
    productId: v.optional(v.id("products")),
    serviceCostRuleId: v.optional(v.id("serviceCostRules")),
    lineType,
    title: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    unitPriceExVat: v.number(),
    vatRate: v.number(),
    discountExVat: v.optional(v.number()),
    sortOrder: v.number(),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);

    if (!quote || quote.tenantId !== args.tenantId) {
      throw new Error("Quote not found");
    }

    const totals =
      args.lineType === "text"
        ? { lineTotalExVat: 0, lineVatTotal: 0, lineTotalIncVat: 0 }
        : calculateLineTotals(
            args.quantity,
            args.unitPriceExVat,
            args.vatRate,
            args.discountExVat
          );
    const now = Date.now();

    const lineId = await ctx.db.insert("quoteLines", {
      tenantId: args.tenantId,
      quoteId: args.quoteId,
      projectRoomId: args.projectRoomId,
      productId: args.productId,
      serviceCostRuleId: args.serviceCostRuleId,
      lineType: args.lineType,
      title: args.title,
      description: args.description,
      quantity: args.quantity,
      unit: args.unit,
      unitPriceExVat: args.unitPriceExVat,
      vatRate: args.vatRate,
      discountExVat: args.discountExVat,
      lineTotalExVat: totals.lineTotalExVat,
      lineVatTotal: totals.lineVatTotal,
      lineTotalIncVat: totals.lineTotalIncVat,
      sortOrder: args.sortOrder,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now
    });

    await recalculateQuote(ctx, args.tenantId, args.quoteId);

    return lineId;
  }
});

export const recalculate = mutation({
  args: {
    tenantId: v.id("tenants"),
    quoteId: v.id("quotes")
  },
  handler: async (ctx, args) => {
    await recalculateQuote(ctx, args.tenantId, args.quoteId);
    return args.quoteId;
  }
});

async function recalculateQuote(ctx: any, tenantId: any, quoteId: any) {
  const quote = await ctx.db.get(quoteId);

  if (!quote || quote.tenantId !== tenantId) {
    throw new Error("Quote not found");
  }

  const lines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", tenantId).eq("quoteId", quoteId))
    .collect();

  const subtotalExVat = roundMoney(
    lines.reduce((sum: number, line: any) => sum + line.lineTotalExVat, 0)
  );
  const vatTotal = roundMoney(
    lines.reduce((sum: number, line: any) => sum + line.lineVatTotal, 0)
  );
  const totalIncVat = roundMoney(subtotalExVat + vatTotal);

  await ctx.db.patch(quoteId, {
    subtotalExVat,
    vatTotal,
    totalIncVat,
    updatedAt: Date.now()
  });
}
