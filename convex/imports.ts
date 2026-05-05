import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRoleForTenantId } from "./authz";
import type { Id } from "./_generated/dataModel";

const batchStatus = v.union(
  v.literal("uploaded"),
  v.literal("analyzing"),
  v.literal("needs_mapping"),
  v.literal("ready_to_import"),
  v.literal("importing"),
  v.literal("imported"),
  v.literal("failed"),
  v.literal("archived")
);

const rowStatus = v.union(
  v.literal("valid"),
  v.literal("warning"),
  v.literal("error"),
  v.literal("ignored"),
  v.literal("imported")
);

const rowKind = v.union(
  v.literal("header"),
  v.literal("section"),
  v.literal("product"),
  v.literal("empty"),
  v.literal("warning"),
  v.literal("error"),
  v.literal("ignored")
);

async function tenantBySlug(ctx: any, tenantSlug: string) {
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q: any) => q.eq("slug", tenantSlug))
    .first();

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }

  return tenant;
}

function batchWarnings(batch: any) {
  const warnings = [];

  if ((batch.unknownVatModeRows ?? 0) > 0) {
    warnings.push({
      rowNumber: 0,
      message: `${batch.unknownVatModeRows} prijsregels hebben vatMode=unknown.`,
      severity: "warning" as const
    });
  }

  if ((batch.zeroPriceRows ?? 0) > 0) {
    warnings.push({
      rowNumber: 0,
      message: `${batch.zeroPriceRows} nulprijsregels zijn of worden overgeslagen.`,
      severity: "warning" as const
    });
  }

  if ((batch.duplicateSourceKeys ?? 0) > 0) {
    warnings.push({
      rowNumber: 0,
      message: `${batch.duplicateSourceKeys} duplicate sourceKeys gevonden.`,
      severity: "error" as const
    });
  }

  return warnings;
}

function toPortalBatch(tenantSlug: string, batch: any, supplier?: any, profile?: any) {
  return {
    id: String(batch._id),
    tenantId: tenantSlug,
    fileName: batch.fileName,
    supplierName: supplier?.name ?? "Onbekend",
    status: batch.status,
    archivedFromStatus: batch.archivedFromStatus,
    archivedAt: batch.archivedAt,
    archivedByExternalUserId: batch.archivedByExternalUserId,
    sourcePath: batch.sourcePath,
    fileHash: batch.fileHash,
    profileName: profile?.name,
    totalRows: batch.totalRows,
    previewRows: batch.previewRows ?? batch.totalRows,
    productRows: batch.productRows ?? 0,
    validRows: batch.validRows,
    warningRows: batch.warningRows,
    errorRows: batch.errorRows,
    ignoredRows: batch.ignoredRows ?? 0,
    importedProducts: batch.importedProducts ?? 0,
    updatedProducts: batch.updatedProducts ?? 0,
    skippedProducts: batch.skippedProducts ?? 0,
    importedPrices: batch.importedPrices ?? 0,
    skippedPrices: batch.skippedPrices ?? 0,
    duplicateProductMatches: batch.duplicateProductMatches ?? 0,
    zeroPriceRows: batch.zeroPriceRows ?? 0,
    unknownVatModeRows: batch.unknownVatModeRows ?? 0,
    productsWithoutSupplierCode: batch.productsWithoutSupplierCode ?? 0,
    orphanPriceRules: batch.orphanPriceRules ?? 0,
    duplicateSourceKeys: batch.duplicateSourceKeys ?? 0,
    allowUnknownVatMode: batch.allowUnknownVatMode ?? false,
    importedAt: batch.importedAt,
    committedAt: batch.committedAt,
    failedAt: batch.failedAt,
    errorMessage: batch.errorMessage,
    reconciliation: batch.reconciliation,
    warnings: batchWarnings(batch),
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt
  };
}

export const listBatches = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(batchStatus)
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("productImportBatches")
        .withIndex("by_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("productImportBatches")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  }
});

export const getBatch = query({
  args: {
    tenantId: v.id("tenants"),
    batchId: v.id("productImportBatches")
  },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);

    if (!batch || batch.tenantId !== args.tenantId) {
      return null;
    }

    const rows = await ctx.db
      .query("productImportRows")
      .withIndex("by_batch", (q) =>
        q.eq("tenantId", args.tenantId).eq("batchId", args.batchId)
      )
      .collect();

    return {
      batch,
      rows: rows.sort((a, b) => a.rowNumber - b.rowNumber)
    };
  }
});

export const createBatch = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    priceListId: v.optional(v.id("priceLists")),
    supplierId: v.optional(v.id("suppliers")),
    importProfileId: v.optional(v.id("importProfiles")),
    fileName: v.string(),
    fileType: v.string(),
    sourcePath: v.optional(v.string()),
    fileHash: v.optional(v.string()),
    sourceFileName: v.optional(v.string()),
    allowUnknownVatMode: v.optional(v.boolean()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { externalUserId } = await requireMutationRoleForTenantId(
      ctx,
      args.tenantId,
      args.actor,
      ["admin"]
    );
    const now = Date.now();

    return await ctx.db.insert("productImportBatches", {
      tenantId: args.tenantId,
      priceListId: args.priceListId,
      supplierId: args.supplierId,
      importProfileId: args.importProfileId,
      fileName: args.fileName,
      fileType: args.fileType,
      sourceFileName: args.sourceFileName ?? args.fileName,
      sourcePath: args.sourcePath,
      fileHash: args.fileHash,
      status: "uploaded",
      totalRows: 0,
      previewRows: 0,
      productRows: 0,
      validRows: 0,
      warningRows: 0,
      errorRows: 0,
      ignoredRows: 0,
      importedProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      importedPrices: 0,
      skippedPrices: 0,
      duplicateProductMatches: 0,
      zeroPriceRows: 0,
      unknownVatModeRows: 0,
      productsWithoutSupplierCode: 0,
      orphanPriceRules: 0,
      duplicateSourceKeys: 0,
      allowUnknownVatMode: args.allowUnknownVatMode ?? false,
      reconciliation: {},
      createdByExternalUserId: externalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const addPreviewRow = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    batchId: v.id("productImportBatches"),
    sourceFileName: v.optional(v.string()),
    sourceSheetName: v.optional(v.string()),
    rowNumber: v.number(),
    rowHash: v.optional(v.string()),
    importKey: v.optional(v.string()),
    sourceKey: v.optional(v.string()),
    raw: v.any(),
    normalized: v.optional(v.any()),
    status: rowStatus,
    rowKind,
    sectionLabel: v.optional(v.string()),
    warnings: v.array(v.string()),
    errors: v.array(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const batch = await ctx.db.get(args.batchId);

    if (!batch || batch.tenantId !== args.tenantId) {
      throw new Error("Import batch not found");
    }

    const now = Date.now();
    const rowId = await ctx.db.insert("productImportRows", {
      tenantId: args.tenantId,
      batchId: args.batchId,
      sourceFileName: args.sourceFileName,
      sourceSheetName: args.sourceSheetName,
      rowNumber: args.rowNumber,
      rowHash: args.rowHash,
      importKey: args.importKey,
      sourceKey: args.sourceKey,
      raw: args.raw,
      normalized: args.normalized,
      status: args.status,
      rowKind: args.rowKind,
      sectionLabel: args.sectionLabel,
      warnings: args.warnings,
      errors: args.errors,
      createdAt: now,
      updatedAt: now
    });

    await ctx.db.patch(args.batchId, {
      totalRows: batch.totalRows + 1,
      previewRows: (batch.previewRows ?? batch.totalRows) + 1,
      validRows: batch.validRows + (args.status === "valid" ? 1 : 0),
      warningRows: batch.warningRows + (args.status === "warning" ? 1 : 0),
      errorRows: batch.errorRows + (args.status === "error" ? 1 : 0),
      status:
        args.errors.length > 0 || args.warnings.length > 0
          ? "needs_mapping"
          : "ready_to_import",
      updatedAt: now
    });

    return rowId;
  }
});

export const listProfiles = query({
  args: {
    tenantId: v.id("tenants")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("importProfiles")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});

export const upsertProfile = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    supplierName: v.string(),
    supplierId: v.optional(v.id("suppliers")),
    categoryId: v.optional(v.id("categories")),
    name: v.string(),
    filePattern: v.optional(v.string()),
    sheetPattern: v.optional(v.string()),
    expectedFileExtension: v.optional(v.union(v.literal(".xlsx"), v.literal(".xls"))),
    supportsXlsx: v.boolean(),
    supportsXls: v.boolean(),
    sheetMapping: v.optional(v.any()),
    headerRowStrategy: v.optional(v.any()),
    sectionRowStrategy: v.optional(v.any()),
    productKeyStrategy: v.optional(v.any()),
    columnMappings: v.optional(v.any()),
    priceColumnMappings: v.optional(v.any()),
    vatModeByPriceColumn: v.optional(v.any()),
    unitByPriceColumn: v.optional(v.any()),
    priceTypeByPriceColumn: v.optional(v.any()),
    duplicateStrategy: v.optional(v.any()),
    zeroPriceStrategy: v.optional(v.any()),
    mapping: v.any(),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const now = Date.now();
    const existing = await ctx.db
      .query("importProfiles")
      .withIndex("by_supplier", (q) =>
        q.eq("tenantId", args.tenantId).eq("supplierName", args.supplierName)
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        filePattern: args.filePattern,
        sheetPattern: args.sheetPattern,
        supplierId: args.supplierId,
        categoryId: args.categoryId,
        expectedFileExtension: args.expectedFileExtension,
        supportsXlsx: args.supportsXlsx,
        supportsXls: args.supportsXls,
        sheetMapping: args.sheetMapping,
        headerRowStrategy: args.headerRowStrategy,
        sectionRowStrategy: args.sectionRowStrategy,
        productKeyStrategy: args.productKeyStrategy,
        columnMappings: args.columnMappings,
        priceColumnMappings: args.priceColumnMappings,
        vatModeByPriceColumn: args.vatModeByPriceColumn,
        unitByPriceColumn: args.unitByPriceColumn,
        priceTypeByPriceColumn: args.priceTypeByPriceColumn,
        duplicateStrategy: args.duplicateStrategy,
        zeroPriceStrategy: args.zeroPriceStrategy,
        mapping: args.mapping,
        notes: args.notes,
        status: "active",
        updatedAt: now
      });

      return existing._id;
    }

    return await ctx.db.insert("importProfiles", {
      tenantId: args.tenantId,
      supplierId: args.supplierId,
      categoryId: args.categoryId,
      supplierName: args.supplierName,
      name: args.name,
      filePattern: args.filePattern,
      sheetPattern: args.sheetPattern,
      expectedFileExtension: args.expectedFileExtension,
      supportsXlsx: args.supportsXlsx,
      supportsXls: args.supportsXls,
      sheetMapping: args.sheetMapping,
      headerRowStrategy: args.headerRowStrategy,
      sectionRowStrategy: args.sectionRowStrategy,
      productKeyStrategy: args.productKeyStrategy,
      columnMappings: args.columnMappings,
      priceColumnMappings: args.priceColumnMappings,
      vatModeByPriceColumn: args.vatModeByPriceColumn,
      unitByPriceColumn: args.unitByPriceColumn,
      priceTypeByPriceColumn: args.priceTypeByPriceColumn,
      duplicateStrategy: args.duplicateStrategy,
      zeroPriceStrategy: args.zeroPriceStrategy,
      mapping: args.mapping,
      notes: args.notes,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const listBatchesForPortal = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    const [batches, suppliers, profiles] = await Promise.all([
      ctx.db
        .query("productImportBatches")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("importProfiles")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect()
    ]);
    const supplierById = new Map(suppliers.map((supplier: any) => [String(supplier._id), supplier]));
    const profileById = new Map(profiles.map((profile: any) => [String(profile._id), profile]));

    return batches.map((batch: any) =>
      toPortalBatch(
        tenant.slug,
        batch,
        batch.supplierId ? supplierById.get(String(batch.supplierId)) : undefined,
        batch.importProfileId ? profileById.get(String(batch.importProfileId)) : undefined
      )
    );
  }
});

export const getBatchForPortal = query({
  args: {
    tenantSlug: v.string(),
    batchId: v.string(),
    rowLimit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    const batch: any = await ctx.db.get(args.batchId as any);

    if (!batch || batch.tenantId !== tenant._id) {
      return null;
    }

    const [supplier, profile, rows] = await Promise.all([
      batch.supplierId ? ctx.db.get(batch.supplierId) : null,
      batch.importProfileId ? ctx.db.get(batch.importProfileId) : null,
      ctx.db
        .query("productImportRows")
        .withIndex("by_batch", (q: any) =>
          q.eq("tenantId", tenant._id).eq("batchId", batch._id)
        )
        .take(Math.min(Math.max(args.rowLimit ?? 200, 25), 1000))
    ]);

    return {
      batch: toPortalBatch(tenant.slug, batch, supplier, profile),
      rows: rows
        .sort((left: any, right: any) => left.rowNumber - right.rowNumber)
        .map((row: any) => ({
          id: String(row._id),
          sourceFileName: row.sourceFileName,
          sourceSheetName: row.sourceSheetName,
          rowNumber: row.rowNumber,
          rowKind: row.rowKind,
          status: row.status,
          importKey: row.importKey,
          sourceKey: row.sourceKey,
          sectionLabel: row.sectionLabel,
          normalized: row.normalized,
          warnings: row.warnings,
          errors: row.errors,
          importedProductId: row.importedProductId ? String(row.importedProductId) : undefined,
          importedPriceIds: row.importedPriceIds?.map((id: any) => String(id)) ?? []
        }))
    };
  }
});

export const updateBatchStatusForPortal = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    batchId: v.string(),
    status: batchStatus
  },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    const { externalUserId } = await requireMutationRoleForTenantId(ctx, tenant._id, args.actor, [
      "admin"
    ]);
    const batch = await ctx.db.get(args.batchId as Id<"productImportBatches">);

    if (!batch || batch.tenantId !== tenant._id) {
      throw new Error("Import batch not found");
    }

    if (batch.status === "importing") {
      throw new Error("Een prijslijst die nu verwerkt wordt kan niet worden aangepast.");
    }

    const now = Date.now();
    const patch =
      args.status === "archived"
        ? {
            status: args.status,
            archivedFromStatus: batch.status === "archived" ? batch.archivedFromStatus : batch.status,
            archivedAt: batch.archivedAt ?? now,
            archivedByExternalUserId: batch.archivedByExternalUserId ?? externalUserId,
            updatedAt: now
          }
        : {
            status: args.status,
            archivedFromStatus: undefined,
            archivedAt: undefined,
            archivedByExternalUserId: undefined,
            updatedAt: now
          };

    await ctx.db.patch(batch._id, patch);

    return batch._id;
  }
});

export const listProfilesForPortal = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    const profiles = await ctx.db
      .query("importProfiles")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return profiles
      .sort((left: any, right: any) => left.name.localeCompare(right.name, "nl"))
      .map((profile: any) => ({
        id: String(profile._id),
        supplierName: profile.supplierName,
        name: profile.name,
        expectedFileExtension: profile.expectedFileExtension,
        filePattern: profile.filePattern,
        sheetPattern: profile.sheetPattern,
          supportsXlsx: profile.supportsXlsx,
          supportsXls: profile.supportsXls,
          priceColumnMappings: profile.priceColumnMappings,
          vatModeByPriceColumn: profile.vatModeByPriceColumn,
          unitByPriceColumn: profile.unitByPriceColumn,
          priceTypeByPriceColumn: profile.priceTypeByPriceColumn,
          allowUnknownVatMode: profile.allowUnknownVatMode ?? false,
          vatModeReview: profile.vatModeReview,
          vatModeUpdatedByExternalUserId: profile.vatModeUpdatedByExternalUserId,
          vatModeUpdatedAt: profile.vatModeUpdatedAt,
          duplicateStrategy: profile.duplicateStrategy,
          zeroPriceStrategy: profile.zeroPriceStrategy,
        mapping: profile.mapping,
        status: profile.status,
        updatedAt: profile.updatedAt
      }));
  }
});

export const updateProfileStatusForPortal = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    profileId: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive"))
  },
  handler: async (ctx, args) => {
    const tenant = await tenantBySlug(ctx, args.tenantSlug);
    await requireMutationRoleForTenantId(ctx, tenant._id, args.actor, ["admin"]);
    const profile = await ctx.db.get(args.profileId as Id<"importProfiles">);

    if (!profile || profile.tenantId !== tenant._id) {
      throw new Error("Import profile not found");
    }

    await ctx.db.patch(profile._id, {
      status: args.status,
      updatedAt: Date.now()
    });

    return profile._id;
  }
});

export const saveMapping = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    batchId: v.id("productImportBatches"),
    mapping: v.any()
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const batch = await ctx.db.get(args.batchId);

    if (!batch || batch.tenantId !== args.tenantId) {
      throw new Error("Import batch not found");
    }

    await ctx.db.patch(args.batchId, {
      mapping: args.mapping,
      status: "ready_to_import",
      updatedAt: Date.now()
    });

    return args.batchId;
  }
});
