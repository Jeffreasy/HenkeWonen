import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRoleForTenantId,
  requireQueryRole,
  requireQueryRoleForTenantId
} from "../authz";
import type { Id } from "../_generated/dataModel";

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
    throw new ConvexError(`Tenant not found: ${tenantSlug}`);
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
    actor: readActorValidator,
    status: v.optional(batchStatus)
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

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
    batchId: v.id("productImportBatches"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
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
      rows: rows.sort((a, b) => a.rijNummer - b.rijNummer)
    };
  }
});

export const createBatch = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    prijslijstId: v.optional(v.id("priceLists")),
    leverancierId: v.optional(v.id("suppliers")),
    importProfielId: v.optional(v.id("importProfiles")),
    bestandsnaam: v.string(),
    bestandsType: v.string(),
    bronPad: v.optional(v.string()),
    bestandHash: v.optional(v.string()),
    bronBestandsnaam: v.optional(v.string()),
    staBtwModusOnbekendToe: v.optional(v.boolean()),
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
      prijslijstId: args.prijslijstId,
      leverancierId: args.leverancierId,
      importProfielId: args.importProfielId,
      bestandsnaam: args.bestandsnaam,
      bestandsType: args.bestandsType,
      bronBestandsnaam: args.bronBestandsnaam ?? args.bestandsnaam,
      bronPad: args.bronPad,
      bestandHash: args.bestandHash,
      status: "uploaded",
      totaalRijen: 0,
      voorbeeldRijen: 0,
      productRijen: 0,
      geldigeRijen: 0,
      waarschuwingRijen: 0,
      foutRijen: 0,
      genegeerdeRijen: 0,
      geimporteerdeProducten: 0,
      bijgewerkteProducten: 0,
      overgeslagenProducten: 0,
      geimporteerdePrijzen: 0,
      overgeslagenPrijzen: 0,
      dubbeleProductMatches: 0,
      nulPrijsRijen: 0,
      onbekendeBtwModusRijen: 0,
      productenZonderLeverancierCode: 0,
      weesPrijsRegels: 0,
      dubbeleBronSleutels: 0,
      staBtwModusOnbekendToe: args.staBtwModusOnbekendToe ?? false,
      reconciliatie: {},
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const addPreviewRow = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    batchId: v.id("productImportBatches"),
    bronBestandsnaam: v.optional(v.string()),
    bronBladNaam: v.optional(v.string()),
    rijNummer: v.number(),
    rijHash: v.optional(v.string()),
    importSleutel: v.optional(v.string()),
    bronSleutel: v.optional(v.string()),
    ruweData: v.any(),
    genormaliseerd: v.optional(v.any()),
    status: rowStatus,
    rijSoort: rowKind,
    sectieLabel: v.optional(v.string()),
    waarschuwingen: v.array(v.string()),
    fouten: v.array(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const batch = await ctx.db.get(args.batchId);

    if (!batch || batch.tenantId !== args.tenantId) {
      throw new ConvexError("Import batch not found");
    }

    const now = Date.now();
    const rowId = await ctx.db.insert("productImportRows", {
      tenantId: args.tenantId,
      batchId: args.batchId,
      bronBestandsnaam: args.bronBestandsnaam,
      bronBladNaam: args.bronBladNaam,
      rijNummer: args.rijNummer,
      rijHash: args.rijHash,
      importSleutel: args.importSleutel,
      bronSleutel: args.bronSleutel,
      ruweData: args.ruweData,
      genormaliseerd: args.genormaliseerd,
      status: args.status,
      rijSoort: args.rijSoort,
      sectieLabel: args.sectieLabel,
      waarschuwingen: args.waarschuwingen,
      fouten: args.fouten,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    await ctx.db.patch(args.batchId, {
      totaalRijen: batch.totaalRijen + 1,
      voorbeeldRijen: (batch.voorbeeldRijen ?? batch.totaalRijen) + 1,
      geldigeRijen: batch.geldigeRijen + (args.status === "valid" ? 1 : 0),
      waarschuwingRijen: batch.waarschuwingRijen + (args.status === "warning" ? 1 : 0),
      foutRijen: batch.foutRijen + (args.status === "error" ? 1 : 0),
      status:
        args.fouten.length > 0 || args.waarschuwingen.length > 0
          ? "needs_mapping"
          : "ready_to_import",
      gewijzigdOp: now
    });

    return rowId;
  }
});

export const listProfiles = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

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
    leverancierNaam: v.string(),
    leverancierId: v.optional(v.id("suppliers")),
    categorieId: v.optional(v.id("categories")),
    naam: v.string(),
    bestandPatroon: v.optional(v.string()),
    bladPatroon: v.optional(v.string()),
    verwachteBestandsextensie: v.optional(v.union(v.literal(".xlsx"), v.literal(".xls"))),
    ondersteuntXlsx: v.boolean(),
    ondersteuntXls: v.boolean(),
    bladMapping: v.optional(v.any()),
    koprijStrategie: v.optional(v.any()),
    sectierijStrategie: v.optional(v.any()),
    productSleutelStrategie: v.optional(v.any()),
    kolomMappings: v.optional(v.any()),
    prijskolomMappings: v.optional(v.any()),
    btwModusPerPrijskolom: v.optional(v.any()),
    eenheidPerPrijskolom: v.optional(v.any()),
    prijsSoortPerPrijskolom: v.optional(v.any()),
    dubbelenStrategie: v.optional(v.any()),
    nulPrijsStrategie: v.optional(v.any()),
    mapping: v.any(),
    notities: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const now = Date.now();
    const existing = await ctx.db
      .query("importProfiles")
      .withIndex("by_supplier", (q) =>
        q.eq("tenantId", args.tenantId).eq("leverancierNaam", args.leverancierNaam)
      )
      .filter((q) => q.eq(q.field("naam"), args.naam))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        bestandPatroon: args.bestandPatroon,
        bladPatroon: args.bladPatroon,
        leverancierId: args.leverancierId,
        categorieId: args.categorieId,
        verwachteBestandsextensie: args.verwachteBestandsextensie,
        ondersteuntXlsx: args.ondersteuntXlsx,
        ondersteuntXls: args.ondersteuntXls,
        bladMapping: args.bladMapping,
        koprijStrategie: args.koprijStrategie,
        sectierijStrategie: args.sectierijStrategie,
        productSleutelStrategie: args.productSleutelStrategie,
        kolomMappings: args.kolomMappings,
        prijskolomMappings: args.prijskolomMappings,
        btwModusPerPrijskolom: args.btwModusPerPrijskolom,
        eenheidPerPrijskolom: args.eenheidPerPrijskolom,
        prijsSoortPerPrijskolom: args.prijsSoortPerPrijskolom,
        dubbelenStrategie: args.dubbelenStrategie,
        nulPrijsStrategie: args.nulPrijsStrategie,
        mapping: args.mapping,
        notities: args.notities,
        status: "active",
        gewijzigdOp: now
      });

      return existing._id;
    }

    return await ctx.db.insert("importProfiles", {
      tenantId: args.tenantId,
      leverancierId: args.leverancierId,
      categorieId: args.categorieId,
      leverancierNaam: args.leverancierNaam,
      naam: args.naam,
      bestandPatroon: args.bestandPatroon,
      bladPatroon: args.bladPatroon,
      verwachteBestandsextensie: args.verwachteBestandsextensie,
      ondersteuntXlsx: args.ondersteuntXlsx,
      ondersteuntXls: args.ondersteuntXls,
      bladMapping: args.bladMapping,
      koprijStrategie: args.koprijStrategie,
      sectierijStrategie: args.sectierijStrategie,
      productSleutelStrategie: args.productSleutelStrategie,
      kolomMappings: args.kolomMappings,
      prijskolomMappings: args.prijskolomMappings,
      btwModusPerPrijskolom: args.btwModusPerPrijskolom,
      eenheidPerPrijskolom: args.eenheidPerPrijskolom,
      prijsSoortPerPrijskolom: args.prijsSoortPerPrijskolom,
      dubbelenStrategie: args.dubbelenStrategie,
      nulPrijsStrategie: args.nulPrijsStrategie,
      mapping: args.mapping,
      notities: args.notities,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const listBatchesForPortal = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
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
    actor: readActorValidator,
    rowLimit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
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
      throw new ConvexError("Import batch not found");
    }

    if (batch.status === "importing") {
      throw new ConvexError("Een prijslijst die nu verwerkt wordt kan niet worden aangepast.");
    }

    const now = Date.now();
    const patch =
      args.status === "archived"
        ? {
            status: args.status,
            archivedFromStatus: batch.status === "archived" ? batch.gearchiveerdVanafStatus : batch.status,
            archivedAt: batch.gearchiveerdOp ?? now,
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
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
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
      throw new ConvexError("Import profile not found");
    }

    await ctx.db.patch(profile._id, {
      status: args.status,
      gewijzigdOp: Date.now()
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
      throw new ConvexError("Import batch not found");
    }

    await ctx.db.patch(args.batchId, {
      mapping: args.mapping,
      status: "ready_to_import",
      gewijzigdOp: Date.now()
    });

    return args.batchId;
  }
});
