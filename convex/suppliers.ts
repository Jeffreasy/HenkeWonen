import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const productListStatus = v.union(
  v.literal("unknown"),
  v.literal("requested"),
  v.literal("received"),
  v.literal("download_available"),
  v.literal("not_available"),
  v.literal("manual_only")
);

export const list = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(productListStatus)
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("suppliers")
        .withIndex("by_product_list_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("productListStatus", args.status!)
        )
        .collect();
    }

    return await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    productListStatus: productListStatus
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("suppliers", {
      tenantId: args.tenantId,
      name: args.name,
      contactName: args.contactName,
      email: args.email,
      phone: args.phone,
      notes: args.notes,
      productListStatus: args.productListStatus,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateProductListStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    supplierId: v.id("suppliers"),
    productListStatus
  },
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get(args.supplierId);

    if (!supplier || supplier.tenantId !== args.tenantId) {
      throw new Error("Supplier not found");
    }

    await ctx.db.patch(args.supplierId, {
      productListStatus: args.productListStatus,
      updatedAt: Date.now()
    });

    return args.supplierId;
  }
});
