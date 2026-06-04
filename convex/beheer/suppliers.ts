import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRoleForTenantId, requireMutationRole } from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import {
  requireTenant,
  toSupplier,
  findSupplierByName,
  supplierStatus,
  hasArg
} from "../portalUtils";

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
    actor: mutationActorValidator,
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    productListStatus: productListStatus
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
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
    actor: mutationActorValidator,
    supplierId: v.id("suppliers"),
    productListStatus
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
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

export const listSuppliers = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    const profiles = await ctx.db
      .query("importProfiles")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    const supplierMetrics = new Map<string, {
      activeProductCount: number;
      importProfileCount: number;
      importBatchCount: number;
      sourceFileCount: number;
      sourceFileNames: string[];
      latestImportStatus?: string;
      latestImportAt?: number;
    }>();

    await Promise.all(
      suppliers.map(async (supplier: Doc<"suppliers">) => {
        const [products, batches, priceLists] = await Promise.all([
          ctx.db
            .query("products")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
            )
            .collect(),
          ctx.db
            .query("productImportBatches")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
            )
            .order("desc")
            .collect(),
          ctx.db
            .query("priceLists")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
            )
            .collect()
        ]);

        const importProfileCount = profiles.filter(
          (profile: Doc<"importProfiles">) =>
            profile.status === "active" &&
            (String(profile.supplierId ?? "") === String(supplier._id) ||
              profile.supplierName === supplier.name)
        ).length;
        const latestBatch = batches[0];
        const sourceFileNames = Array.from(
          new Set(
            [
              ...priceLists.map((priceList: Doc<"priceLists">) => priceList.sourceFileName),
              ...batches.map(
                (batch: Doc<"productImportBatches">) => batch.sourceFileName ?? batch.fileName
              )
            ].filter(Boolean)
          )
        ).sort((left, right) => left.localeCompare(right, "nl"));

        supplierMetrics.set(String(supplier._id), {
          activeProductCount: products.filter((product: Doc<"products">) => product.status === "active")
            .length,
          importProfileCount,
          importBatchCount: batches.length,
          sourceFileCount: sourceFileNames.length,
          sourceFileNames,
          latestImportStatus: latestBatch?.status,
          latestImportAt: latestBatch?.committedAt ?? latestBatch?.importedAt ?? latestBatch?.createdAt
        });
      })
    );

    return suppliers
      .sort((left: Doc<"suppliers">, right: Doc<"suppliers">) =>
        left.name.localeCompare(right.name, "nl")
      )
      .map((supplier: Doc<"suppliers">) =>
        toSupplier(tenant.slug, supplier, supplierMetrics.get(String(supplier._id)))
      );
  }
});

export const createSupplier = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    productListStatus: v.optional(productListStatus),
    lastContactAt: v.optional(v.number()),
    expectedAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const existing = await findSupplierByName(ctx, tenant._id, args.name);

    if (existing) {
      return existing._id;
    }

    const now = Date.now();

    return await ctx.db.insert("suppliers", {
      tenantId: tenant._id,
      name: args.name,
      contactName: args.contactName,
      email: args.email,
      phone: args.phone,
      notes: args.notes,
      status: "active",
      productListStatus: args.productListStatus ?? "unknown",
      lastContactAt: args.lastContactAt,
      expectedAt: args.expectedAt,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateSupplier = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    supplierId: v.string(),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    productListStatus: v.optional(productListStatus),
    lastContactAt: v.optional(v.number()),
    expectedAt: v.optional(v.number()),
    status: v.optional(supplierStatus)
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const supplier = await ctx.db.get(args.supplierId as Id<"suppliers">);

    if (!supplier || supplier.tenantId !== tenant._id) {
      throw new Error("Supplier not found");
    }

    const patch: Partial<Doc<"suppliers">> = {
      name: args.name,
      updatedAt: Date.now()
    };

    if (hasArg(args, "contactName")) patch.contactName = args.contactName;
    if (hasArg(args, "email")) patch.email = args.email;
    if (hasArg(args, "phone")) patch.phone = args.phone;
    if (hasArg(args, "notes")) patch.notes = args.notes;
    if (args.productListStatus !== undefined) patch.productListStatus = args.productListStatus;
    if (hasArg(args, "lastContactAt")) patch.lastContactAt = args.lastContactAt;
    if (hasArg(args, "expectedAt")) patch.expectedAt = args.expectedAt;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(supplier._id, patch);

    return supplier._id;
  }
});

export const updateSupplierProductListStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    supplierId: v.string(),
    productListStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const supplier = await ctx.db.get(args.supplierId as Id<"suppliers">);

    if (!supplier || supplier.tenantId !== tenant._id) {
      throw new Error("Supplier not found");
    }

    await ctx.db.patch(supplier._id, {
      productListStatus: args.productListStatus,
      updatedAt: Date.now()
    });

    return supplier._id;
  }
});
