import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRoleForTenantId,
  requireQueryRole,
  requireQueryRoleForTenantId
} from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import type {
  ImportWarning,
  ProductImportBatch,
  ProductImportRow
} from "../../src/lib/portalTypes";

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
    throw new ConvexError(`Omgeving niet gevonden: ${tenantSlug}`);
  }

  return tenant;
}

function batchWarnings(batch: Doc<"productImportBatches">): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  if ((batch.onbekendeBtwModusRijen ?? 0) > 0) {
    warnings.push({
      rijNummer: 0,
      message: `${batch.onbekendeBtwModusRijen} prijsregels hebben vatMode=unknown.`,
      ernst: "warning"
    });
  }

  if ((batch.nulPrijsRijen ?? 0) > 0) {
    warnings.push({
      rijNummer: 0,
      message: `${batch.nulPrijsRijen} nulprijsregels zijn of worden overgeslagen.`,
      ernst: "warning"
    });
  }

  if ((batch.dubbeleBronSleutels ?? 0) > 0) {
    warnings.push({
      rijNummer: 0,
      message: `${batch.dubbeleBronSleutels} duplicate sourceKeys gevonden.`,
      ernst: "error"
    });
  }

  return warnings;
}

function toPortalBatch(
  tenantSlug: string,
  batch: Doc<"productImportBatches">,
  supplier?: Doc<"suppliers"> | null,
  profile?: Doc<"importProfiles"> | null
): ProductImportBatch {
  return {
    id: String(batch._id),
    tenantId: tenantSlug,
    bestandsnaam: batch.bestandsnaam,
    leverancierNaam: supplier?.naam ?? "Onbekend",
    status: batch.status,
    gearchiveerdVanafStatus: batch.gearchiveerdVanafStatus,
    gearchiveerdOp: batch.gearchiveerdOp,
    archivedByExternalUserId: batch.archivedByExternalUserId,
    bronPad: batch.bronPad,
    bestandHash: batch.bestandHash,
    profileName: profile?.naam,
    totaalRijen: batch.totaalRijen,
    voorbeeldRijen: batch.voorbeeldRijen ?? batch.totaalRijen,
    productRijen: batch.productRijen ?? 0,
    geldigeRijen: batch.geldigeRijen,
    waarschuwingRijen: batch.waarschuwingRijen,
    foutRijen: batch.foutRijen,
    genegeerdeRijen: batch.genegeerdeRijen ?? 0,
    geimporteerdeProducten: batch.geimporteerdeProducten ?? 0,
    bijgewerkteProducten: batch.bijgewerkteProducten ?? 0,
    overgeslagenProducten: batch.overgeslagenProducten ?? 0,
    geimporteerdePrijzen: batch.geimporteerdePrijzen ?? 0,
    overgeslagenPrijzen: batch.overgeslagenPrijzen ?? 0,
    dubbeleProductMatches: batch.dubbeleProductMatches ?? 0,
    nulPrijsRijen: batch.nulPrijsRijen ?? 0,
    onbekendeBtwModusRijen: batch.onbekendeBtwModusRijen ?? 0,
    productenZonderLeverancierCode: batch.productenZonderLeverancierCode ?? 0,
    weesPrijsRegels: batch.weesPrijsRegels ?? 0,
    dubbeleBronSleutels: batch.dubbeleBronSleutels ?? 0,
    staBtwModusOnbekendToe: batch.staBtwModusOnbekendToe ?? false,
    geimporteerdOp: batch.geimporteerdOp,
    vastgelegdOp: batch.vastgelegdOp,
    misluktOp: batch.misluktOp,
    foutmelding: batch.foutmelding,
    reconciliatie: batch.reconciliatie,
    waarschuwingen: batchWarnings(batch),
    aangemaaktOp: batch.aangemaaktOp,
    gewijzigdOp: batch.gewijzigdOp
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
      throw new ConvexError("Import niet gevonden.");
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
        batch.leverancierId ? supplierById.get(String(batch.leverancierId)) : undefined,
        batch.importProfielId ? profileById.get(String(batch.importProfielId)) : undefined
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
      batch.leverancierId ? ctx.db.get(batch.leverancierId as Id<"suppliers">) : null,
      batch.importProfielId ? ctx.db.get(batch.importProfielId as Id<"importProfiles">) : null,
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
        .sort((left: any, right: any) => left.rijNummer - right.rijNummer)
        .map((row: any): ProductImportRow => ({
          id: String(row._id),
          bronBestandsnaam: row.bronBestandsnaam,
          bronBladNaam: row.bronBladNaam,
          rijNummer: row.rijNummer,
          rijSoort: row.rijSoort,
          status: row.status,
          importSleutel: row.importSleutel,
          bronSleutel: row.bronSleutel,
          sectieLabel: row.sectieLabel,
          genormaliseerd: row.genormaliseerd,
          waarschuwingen: row.waarschuwingen,
          fouten: row.fouten,
          geimporteerdProductId: row.geimporteerdProductId ? String(row.geimporteerdProductId) : undefined,
          geimporteerdePrijsIds: row.geimporteerdePrijsIds?.map((id: any) => String(id)) ?? []
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
      throw new ConvexError("Import niet gevonden.");
    }

    if (batch.status === "importing") {
      throw new ConvexError("Een prijslijst die nu verwerkt wordt kan niet worden aangepast.");
    }

    const now = Date.now();
    const patch =
      args.status === "archived"
        ? {
            status: args.status,
            gearchiveerdVanafStatus:
              batch.status === "archived" ? batch.gearchiveerdVanafStatus : batch.status,
            gearchiveerdOp: batch.gearchiveerdOp ?? now,
            archivedByExternalUserId: batch.archivedByExternalUserId ?? externalUserId,
            gewijzigdOp: now
          }
        : {
            status: args.status,
            gearchiveerdVanafStatus: undefined,
            gearchiveerdOp: undefined,
            archivedByExternalUserId: undefined,
            gewijzigdOp: now
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
      .sort((left: Doc<"importProfiles">, right: Doc<"importProfiles">) =>
        left.naam.localeCompare(right.naam, "nl")
      )
      .map((profile: Doc<"importProfiles">) => ({
        id: String(profile._id),
        supplierName: profile.leverancierNaam,
        name: profile.naam,
        expectedFileExtension: profile.verwachteBestandsextensie,
        filePattern: profile.bestandPatroon,
        sheetPattern: profile.bladPatroon,
          supportsXlsx: profile.ondersteuntXlsx,
          supportsXls: profile.ondersteuntXls,
          priceColumnMappings: profile.prijskolomMappings,
          vatModeByPriceColumn: profile.btwModusPerPrijskolom,
          unitByPriceColumn: profile.eenheidPerPrijskolom,
          priceTypeByPriceColumn: profile.prijsSoortPerPrijskolom,
          allowUnknownVatMode: profile.staBtwModusOnbekendToe ?? false,
          vatModeReview: profile.btwModusReview,
          vatModeUpdatedByExternalUserId: profile.vatModeUpdatedByExternalUserId,
          vatModeUpdatedAt: profile.btwModusGewijzigdOp,
          duplicateStrategy: profile.dubbelenStrategie,
          zeroPriceStrategy: profile.nulPrijsStrategie,
        mapping: profile.mapping,
        status: profile.status,
        updatedAt: profile.gewijzigdOp
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
      throw new ConvexError("Importprofiel niet gevonden.");
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
      throw new ConvexError("Import niet gevonden.");
    }

    await ctx.db.patch(args.batchId, {
      mapping: args.mapping,
      status: "ready_to_import",
      gewijzigdOp: Date.now()
    });

    return args.batchId;
  }
});
