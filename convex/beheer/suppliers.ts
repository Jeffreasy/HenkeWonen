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
import {
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
    actor: readActorValidator,
    status: v.optional(productListStatus)
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

    if (args.status) {
      return await ctx.db
        .query("suppliers")
        .withIndex("by_product_list_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("prijslijstStatus", args.status!)
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
    naam: v.string(),
    contactpersoon: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
    prijslijstStatus: productListStatus
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const now = Date.now();

    return await ctx.db.insert("suppliers", {
      tenantId: args.tenantId,
      naam: args.naam,
      contactpersoon: args.contactpersoon,
      email: args.email,
      telefoon: args.telefoon,
      notities: args.notities,
      prijslijstStatus: args.prijslijstStatus,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const updateProductListStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    leverancierId: v.id("suppliers"),
    prijslijstStatus: productListStatus
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const supplier = await ctx.db.get(args.leverancierId);

    if (!supplier || supplier.tenantId !== args.tenantId) {
      throw new ConvexError("Supplier not found");
    }

    await ctx.db.patch(args.leverancierId, {
      prijslijstStatus: args.prijslijstStatus,
      gewijzigdOp: Date.now()
    });

    return args.leverancierId;
  }
});

export const listSuppliers = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
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
            .withIndex("by_supplier_status", (q: any) =>
              q.eq("tenantId", tenant._id).eq("leverancierId", supplier._id).eq("status", "active")
            )
            .take(1000),
          ctx.db
            .query("productImportBatches")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("leverancierId", supplier._id)
            )
            .order("desc")
            .collect(),
          ctx.db
            .query("priceLists")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("leverancierId", supplier._id)
            )
            .collect()
        ]);

        const importProfileCount = profiles.filter(
          (profile: Doc<"importProfiles">) =>
            profile.status === "active" &&
            (String(profile.leverancierId ?? "") === String(supplier._id) ||
              profile.leverancierNaam === supplier.naam)
        ).length;
        const latestBatch = batches[0];
        const sourceFileNames = Array.from(
          new Set(
            [
              ...priceLists.map((priceList: Doc<"priceLists">) => priceList.bronBestandsnaam),
              ...batches.map(
                (batch: Doc<"productImportBatches">) => batch.bronBestandsnaam ?? batch.bestandsnaam
              )
            ].filter(Boolean)
          )
        ).sort((left, right) => left.localeCompare(right, "nl"));

        supplierMetrics.set(String(supplier._id), {
          activeProductCount: products.length,
          importProfileCount,
          importBatchCount: batches.length,
          sourceFileCount: sourceFileNames.length,
          sourceFileNames,
          latestImportStatus: latestBatch?.status,
          latestImportAt: latestBatch?.vastgelegdOp ?? latestBatch?.geimporteerdOp ?? latestBatch?.aangemaaktOp
        });
      })
    );

    return suppliers
      .sort((left: Doc<"suppliers">, right: Doc<"suppliers">) =>
        left.naam.localeCompare(right.naam, "nl")
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
    naam: v.string(),
    contactpersoon: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
    prijslijstStatus: v.optional(productListStatus),
    laatsteContactOp: v.optional(v.number()),
    verwachtOp: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const existing = await findSupplierByName(ctx, tenant._id, args.naam);

    if (existing) {
      return existing._id;
    }

    const now = Date.now();

    return await ctx.db.insert("suppliers", {
      tenantId: tenant._id,
      naam: args.naam,
      contactpersoon: args.contactpersoon,
      email: args.email,
      telefoon: args.telefoon,
      notities: args.notities,
      status: "active",
      prijslijstStatus: args.prijslijstStatus ?? "unknown",
      laatsteContactOp: args.laatsteContactOp,
      verwachtOp: args.verwachtOp,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const updateSupplier = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    leverancierId: v.string(),
    naam: v.string(),
    contactpersoon: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
    prijslijstStatus: v.optional(productListStatus),
    laatsteContactOp: v.optional(v.number()),
    verwachtOp: v.optional(v.number()),
    status: v.optional(supplierStatus)
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const supplier = await ctx.db.get(args.leverancierId as Id<"suppliers">);

    if (!supplier || supplier.tenantId !== tenant._id) {
      throw new ConvexError("Supplier not found");
    }

    const patch: Partial<Doc<"suppliers">> = {
      naam: args.naam,
      gewijzigdOp: Date.now()
    };

    if (hasArg(args, "contactpersoon")) patch.contactpersoon = args.contactpersoon;
    if (hasArg(args, "email")) patch.email = args.email;
    if (hasArg(args, "telefoon")) patch.telefoon = args.telefoon;
    if (hasArg(args, "notities")) patch.notities = args.notities;
    if (args.prijslijstStatus !== undefined) patch.prijslijstStatus = args.prijslijstStatus;
    if (hasArg(args, "laatsteContactOp")) patch.laatsteContactOp = args.laatsteContactOp;
    if (hasArg(args, "verwachtOp")) patch.verwachtOp = args.verwachtOp;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(supplier._id, patch);

    return supplier._id;
  }
});

export const updateSupplierProductListStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    leverancierId: v.string(),
    prijslijstStatus: productListStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const supplier = await ctx.db.get(args.leverancierId as Id<"suppliers">);

    if (!supplier || supplier.tenantId !== tenant._id) {
      throw new ConvexError("Supplier not found");
    }

    await ctx.db.patch(supplier._id, {
      prijslijstStatus: args.prijslijstStatus,
      gewijzigdOp: Date.now()
    });

    return supplier._id;
  }
});
