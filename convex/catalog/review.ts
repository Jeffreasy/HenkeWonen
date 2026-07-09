import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutationActorValidator, readActorValidator, requireMutationRole, requireQueryRole } from "../authz";
import { toAsciiFieldKey } from "./priceColumnKey";

const vatMode = v.union(v.literal("inclusive"), v.literal("exclusive"), v.literal("unknown"));
const duplicateEanDecision = v.union(
  v.literal("keep_separate"),
  v.literal("merge_later"),
  v.literal("source_error"),
  v.literal("accepted_duplicate"),
  v.literal("resolved")
);
function idString(value: unknown): string {
  return String(value ?? "");
}

function label(value: unknown, fallback = "Onbekend"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function uniqueTexts(values: unknown[]): string[] {
  return [...new Set(values.filter(hasText).map((value) => String(value).trim()))];
}

function compactObject<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
}

function priceColumns(profile: any) {
  const columns = Array.isArray(profile.prijskolomMappings) ? profile.prijskolomMappings : [];
  const vatByColumn = profile.btwModusPerPrijskolom ?? {};
  const unitByColumn = profile.eenheidPerPrijskolom ?? {};
  const typeByColumn = profile.prijsSoortPerPrijskolom ?? {};

  return columns.map((column: any, index: number) => {
    const sourceColumnName = label(column.header ?? column.sourceColumnName, `Kolom ${index + 1}`);
    const mappedPriceType = label(column.priceType ?? typeByColumn[sourceColumnName], "");
    const mappedUnit = label(column.priceUnit ?? unitByColumn[sourceColumnName], "");
    return {
      sourceColumnName,
      sourceColumnIndex: typeof column.sourceColumnIndex === "number" ? column.sourceColumnIndex : index,
      detectedPriceType:
        mappedPriceType && mappedPriceType !== "manual"
          ? mappedPriceType
          : inferPriceType(sourceColumnName),
      detectedUnit: mappedUnit && mappedUnit !== "custom" ? mappedUnit : inferUnit(sourceColumnName),
      currentVatMode: label(column.vatMode ?? vatByColumn[sourceColumnName], "unknown")
    };
  });
}

function reviewForColumn(profile: any, sourceColumnName: string, sourceColumnIndex: number) {
  const review = profile.btwModusReview ?? {};
  const directReview = review[sourceColumnName];

  if (directReview) {
    return directReview;
  }

  return Object.values(review).find(
    (entry: any) => entry?.sourceColumnIndex === sourceColumnIndex
  ) as any;
}

function columnMatches(column: any, index: number, selectedColumns: any[]) {
  const header = label(column.header ?? column.sourceColumnName, `Kolom ${index + 1}`);
  const sourceColumnIndex =
    typeof column.sourceColumnIndex === "number" ? column.sourceColumnIndex : index;

  return selectedColumns.some(
    (selected) =>
      selected.sourceColumnName === header && selected.sourceColumnIndex === sourceColumnIndex
  );
}

function patchSelectedColumns(profile: any, selectedColumns: any[], patchColumn: (column: any, index: number) => any) {
  const priceColumnMappings = Array.isArray(profile.prijskolomMappings)
    ? profile.prijskolomMappings.map((column: any, index: number) =>
        columnMatches(column, index, selectedColumns) ? patchColumn(column, index) : column
      )
    : [];
  const mapping = {
    ...(profile.mapping ?? {}),
    priceColumns: Array.isArray(profile.mapping?.priceColumns)
      ? profile.mapping.priceColumns.map((column: any, index: number) => {
          const normalizedColumn = typeof column === "string" ? { header: column } : column;
          return columnMatches(normalizedColumn, index, selectedColumns)
            ? patchColumn(normalizedColumn, index)
            : column;
        })
      : profile.mapping?.priceColumns
  };

  return {
    priceColumnMappings,
    mapping
  };
}

function inferPriceType(sourceColumnName: string) {
  const normalized = sourceColumnName.toLowerCase();

  if (normalized.includes("netto")) return "net_purchase";
  if (normalized.includes("inkoop")) return "purchase";
  if (normalized.includes("pallet")) return "pallet";
  if (normalized.includes("trailer")) return "trailer";
  if (normalized.includes("commissie") || normalized.includes("commisie")) return "commission";
  if (normalized.includes("rolprijs")) return "roll";
  if (normalized.includes("coupage")) return "cut_length";
  if (normalized.includes("advies") || normalized.includes("consumer")) return "advice_retail";
  if (normalized.includes("trede")) return "step";
  if (normalized.includes("verpakking") || normalized.includes("pak")) return "package";

  return "manual";
}

function inferUnit(sourceColumnName: string) {
  const normalized = sourceColumnName.toLowerCase();

  if (normalized.includes("m²") || normalized.includes("m2")) return "m2";
  if (normalized.includes("m¹") || normalized.includes("m1")) return "m1";
  if (normalized.includes("meter") || normalized.includes("lengte")) return "meter";
  if (normalized.includes("pak")) return "pack";
  if (normalized.includes("verpakking")) return "package";
  if (normalized.includes("rol")) return "roll";
  if (normalized.includes("pallet")) return "pallet";
  if (normalized.includes("trailer")) return "trailer";
  if (normalized.includes("trede")) return "step";
  if (normalized.includes("stuk") || normalized.includes("stuks")) return "piece";
  if (normalized.includes("liter")) return "liter";
  if (normalized.includes("kilo") || normalized.includes("kg")) return "kg";

  return "custom";
}

function suggestedVatMode(sourceColumnName: string, priceType: string) {
  const normalized = sourceColumnName.toLowerCase();

  if (
    normalized.includes("incl. btw") ||
    normalized.includes("incl btw") ||
    normalized.includes("inclusief btw")
  ) {
    return {
      suggestedVatMode: "inclusive",
      confidence: "high",
      needsReview: false,
      reason: "Kolomnaam noemt expliciet inclusief btw."
    };
  }

  if (
    normalized.includes("excl. btw") ||
    normalized.includes("excl btw") ||
    normalized.includes("exclusief btw")
  ) {
    return {
      suggestedVatMode: "exclusive",
      confidence: "high",
      needsReview: false,
      reason: "Kolomnaam noemt expliciet exclusief btw."
    };
  }

  if (
    priceType === "purchase" ||
    priceType === "net_purchase" ||
    priceType === "pallet" ||
    priceType === "commission" ||
    priceType === "trailer"
  ) {
    return {
      suggestedVatMode: "unknown",
      confidence: priceType === "purchase" || priceType === "net_purchase" ? "medium" : "low",
      needsReview: true,
      reason:
        "Inkoop-, netto-, pallet-, commissie- en trailerprijzen worden niet automatisch definitief gezet zonder expliciete bronaanwijzing."
    };
  }

  if (priceType === "advice_retail" || sourceColumnName.toLowerCase().includes("advies")) {
    return {
      suggestedVatMode: "unknown",
      confidence: "low",
      needsReview: true,
      reason:
        "Adviesverkoopprijs zonder expliciete incl/excl btw aanduiding; menselijke mapping nodig."
    };
  }

  return {
    suggestedVatMode: "unknown",
    confidence: "low",
    needsReview: true,
    reason: "Geen expliciete btw-aanduiding in kolomnaam of profielmapping."
  };
}

export const vatMappingReview = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const [profiles, categories] = await Promise.all([
      ctx.db
        .query("importProfiles")
        .withIndex("by_status", (q: any) => q.eq("tenantId", tenant._id).eq("status", "active"))
        .collect(),
      ctx.db
        .query("categories")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect()
    ]);
    const categoryById = new Map(categories.map((category: any) => [idString(category._id), category]));

    const rows = profiles
      .slice()
      .sort((left: any, right: any) => left.naam.localeCompare(right.naam, "nl"))
      .flatMap((profile: any) =>
        priceColumns(profile).map((column: any) => {
          const suggestion = suggestedVatMode(column.sourceColumnName, column.detectedPriceType);
          const currentVatMode =
            column.currentVatMode === "inclusive" || column.currentVatMode === "exclusive"
              ? column.currentVatMode
              : "unknown";

          return {
            profileId: idString(profile._id),
            profileName: profile.naam,
            supplier: profile.leverancierNaam,
            supplierId: profile.leverancierId ? idString(profile.leverancierId) : undefined,
            category:
              categoryById.get(idString(profile.categorieId))?.naam ??
              (typeof profile.mapping?.category === "string"
                ? profile.mapping.category
                : profile.mapping?.categoryFromSectionOrName
                  ? "Uit bron/sectie"
                  : "Onbekend"),
            categoryId: profile.categorieId ? idString(profile.categorieId) : undefined,
            sourceFileNamePattern: profile.bestandPatroon,
            sourceSheetNamePattern: profile.bladPatroon,
            sourceColumnName: column.sourceColumnName,
            sourceColumnIndex: column.bronKolomIndex,
            detectedPriceType: column.detectedPriceType,
            detectedUnit: column.detectedUnit,
            currentVatMode,
            suggestedVatMode: suggestion.suggestedVatMode,
            confidence: suggestion.confidence,
            reviewStatus: reviewForColumn(
              profile,
              column.sourceColumnName,
              column.sourceColumnIndex
            )?.reviewStatus,
            needsReview:
              (currentVatMode === "unknown" && !(profile.staBtwModusOnbekendToe ?? false)) ||
              (suggestion.confidence === "high" &&
                currentVatMode !== "unknown" &&
                currentVatMode !== suggestion.suggestedVatMode),
            allowUnknownVatMode: profile.staBtwModusOnbekendToe ?? false,
            reason: suggestion.reason,
            updatedByExternalUserId: profile.vatModeUpdatedByExternalUserId,
            updatedAt: profile.btwModusGewijzigdOp,
            reviewedByExternalUserId: reviewForColumn(
              profile,
              column.sourceColumnName,
              column.sourceColumnIndex
            )?.reviewedByExternalUserId,
            reviewedAt: reviewForColumn(profile, column.sourceColumnName, column.sourceColumnIndex)
              ?.reviewedAt
          };
        })
      );

    return {
      tenantSlug: tenant.slug,
      totalProfiles: profiles.length,
      totalPriceColumns: rows.length,
      resolvedColumns: rows.filter((row: any) => row.currentVatMode !== "unknown").length,
      unresolvedColumns: rows.filter(
        (row: any) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode
      ).length,
      allowUnknownColumns: rows.filter(
        (row: any) => row.currentVatMode === "unknown" && row.allowUnknownVatMode
      ).length,
      rows
    };
  }
});

export const updateProfileVatMode = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    profileId: v.string(),
    bronKolomNaam: v.string(),
    bronKolomIndex: v.number(),
    btwModus: vatMode,
    updatedByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const profile: Doc<"importProfiles"> | null = await ctx.db.get(
      args.profileId as Id<"importProfiles">
    );

    if (!profile || profile.tenantId !== tenant._id) {
      throw new ConvexError("Importprofiel niet gevonden.");
    }

    const now = Date.now();
    const updateColumn = (column: any, index: number) => {
      const header = label(column.header ?? column.sourceColumnName, `Kolom ${index + 1}`);
      const sourceColumnIndex =
        typeof column.sourceColumnIndex === "number" ? column.sourceColumnIndex : index;
      // Match op de stabiele kolomINDEX (de autoritatieve kolomsleutel). De vorige losse
      // OR op naam kon bij dubbele/hergebruikte kolomnamen de verkeerde btw-kolom
      // overschrijven; de index identificeert de kolom eenduidig.
      const matches = sourceColumnIndex === args.bronKolomIndex;

      return matches
        ? {
            ...column,
            header,
            sourceColumnIndex,
            vatMode: args.btwModus
          }
        : column;
    };
    const priceColumnMappings = Array.isArray(profile.prijskolomMappings)
      ? profile.prijskolomMappings.map(updateColumn)
      : [];
    const mapping = {
      ...(profile.mapping ?? {}),
      priceColumns: Array.isArray(profile.mapping?.priceColumns)
        ? profile.mapping.priceColumns.map((column: any, index: number) =>
            typeof column === "string"
              ? updateColumn({ header: column }, index)
              : updateColumn(column, index)
          )
        : profile.mapping?.priceColumns
    };
    const vatModeByPriceColumn = {
      ...(profile.btwModusPerPrijskolom ?? {}),
      [toAsciiFieldKey(args.bronKolomNaam)]: args.btwModus
    };
    const vatModeReview = {
      ...(profile.btwModusReview ?? {}),
      [toAsciiFieldKey(args.bronKolomNaam)]: {
        sourceColumnIndex: args.bronKolomIndex,
        vatMode: args.btwModus,
        updatedByExternalUserId: externalUserId,
        updatedAt: now,
        reviewedByExternalUserId: externalUserId,
        reviewedAt: now,
        reviewStatus: "reviewed"
      }
    };

    await ctx.db.patch(profile._id, {
      prijskolomMappings: priceColumnMappings,
      btwModusPerPrijskolom: vatModeByPriceColumn,
      mapping,
      btwModusReview: vatModeReview,
      vatModeUpdatedByExternalUserId: externalUserId,
      btwModusGewijzigdOp: now,
      gewijzigdOp: now
    });

    return profile._id;
  }
});

export const bulkUpdateProfileVatModes = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    profileId: v.string(),
    columns: v.array(
      v.object({
        bronKolomNaam: v.string(),
        bronKolomIndex: v.number()
      })
    ),
    btwModus: vatMode,
    updatedByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const profile: Doc<"importProfiles"> | null = await ctx.db.get(
      args.profileId as Id<"importProfiles">
    );

    if (!profile || profile.tenantId !== tenant._id) {
      throw new ConvexError("Importprofiel niet gevonden.");
    }

    const now = Date.now();
    const patchColumn = (column: any, index: number) => {
      const header = label(column.header ?? column.sourceColumnName, `Kolom ${index + 1}`);
      const sourceColumnIndex =
        typeof column.sourceColumnIndex === "number" ? column.sourceColumnIndex : index;

      return {
        ...column,
        header,
        sourceColumnIndex,
        vatMode: args.btwModus
      };
    };
    const patched = patchSelectedColumns(profile, args.columns, patchColumn);
    const vatModeByPriceColumn = {
      ...(profile.btwModusPerPrijskolom ?? {})
    };
    const vatModeReview = {
      ...(profile.btwModusReview ?? {})
    };

    for (const column of args.columns) {
      const columnKey = toAsciiFieldKey(column.bronKolomNaam);
      vatModeByPriceColumn[columnKey] = args.btwModus;
      vatModeReview[columnKey] = {
        ...(vatModeReview[columnKey] ?? {}),
        sourceColumnIndex: column.bronKolomIndex,
        vatMode: args.btwModus,
        updatedByExternalUserId: externalUserId,
        updatedAt: now,
        reviewedByExternalUserId: externalUserId,
        reviewedAt: now,
        reviewStatus: "reviewed"
      };
    }

    await ctx.db.patch(profile._id, {
      prijskolomMappings: patched.priceColumnMappings,
      btwModusPerPrijskolom: vatModeByPriceColumn,
      mapping: patched.mapping,
      btwModusReview: vatModeReview,
      vatModeUpdatedByExternalUserId: externalUserId,
      btwModusGewijzigdOp: now,
      gewijzigdOp: now
    });

    return {
      profileId: profile._id,
      updatedColumns: args.columns.length
    };
  }
});

export const markProfileVatColumnsReviewed = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    profileId: v.string(),
    columns: v.array(
      v.object({
        bronKolomNaam: v.string(),
        bronKolomIndex: v.number()
      })
    ),
    reviewedByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const profile: Doc<"importProfiles"> | null = await ctx.db.get(
      args.profileId as Id<"importProfiles">
    );

    if (!profile || profile.tenantId !== tenant._id) {
      throw new ConvexError("Importprofiel niet gevonden.");
    }

    const now = Date.now();
    const vatModeReview = {
      ...(profile.btwModusReview ?? {})
    };

    for (const column of args.columns) {
      const columnKey = toAsciiFieldKey(column.bronKolomNaam);
      const currentVatMode =
        profile.btwModusPerPrijskolom?.[columnKey] ??
        reviewForColumn(profile, column.bronKolomNaam, column.bronKolomIndex)?.vatMode ??
        "unknown";

      vatModeReview[columnKey] = {
        ...(vatModeReview[columnKey] ?? {}),
        sourceColumnIndex: column.bronKolomIndex,
        vatMode: currentVatMode,
        reviewedByExternalUserId: externalUserId,
        reviewedAt: now,
        reviewStatus: "reviewed"
      };
    }

    await ctx.db.patch(profile._id, {
      btwModusReview: vatModeReview,
      vatModeUpdatedByExternalUserId: externalUserId,
      btwModusGewijzigdOp: now,
      gewijzigdOp: now
    });

    return {
      profileId: profile._id,
      reviewedColumns: args.columns.length
    };
  }
});

export const setProfileAllowUnknownVatMode = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    profileId: v.string(),
    staBtwModusOnbekendToe: v.boolean(),
    updatedByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const profile: Doc<"importProfiles"> | null = await ctx.db.get(
      args.profileId as Id<"importProfiles">
    );

    if (!profile || profile.tenantId !== tenant._id) {
      throw new ConvexError("Importprofiel niet gevonden.");
    }

    const now = Date.now();
    await ctx.db.patch(profile._id, {
      staBtwModusOnbekendToe: args.staBtwModusOnbekendToe,
      vatModeUpdatedByExternalUserId: externalUserId,
      btwModusGewijzigdOp: now,
      gewijzigdOp: now
    });

    return profile._id;
  }
});

export const duplicateEanReview = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const [suppliers, issues] = await Promise.all([
      ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("catalogDataIssues")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect()
    ]);
    const supplierById = new Map(suppliers.map((supplier: any) => [idString(supplier._id), supplier]));
    const duplicateGroups = [];

    for (const issue of issues.filter((item: any) => item.kwestieSoort === "duplicate_ean")) {
      const metadata = issue.metadata ?? {};
      const supplier = issue.leverancierId ? supplierById.get(idString(issue.leverancierId)) : undefined;
      const productsFromMetadata = Array.isArray(metadata.products) ? metadata.products : [];
      const productRows =
        productsFromMetadata.length > 0
          ? productsFromMetadata.map((product: any, index: number) => ({
              productId: idString(product.productId ?? issue.productIds?.[index]),
              articleNumber: optionalText(product.articleNumber),
              supplierCode: optionalText(product.supplierCode),
              productName: label(product.productName, "Onbekend product"),
              sourceFileNames: Array.isArray(product.sourceFileNames)
                ? uniqueTexts(product.sourceFileNames)
                : uniqueTexts([product.sourceFileName]),
              sourceSheetNames: Array.isArray(product.sourceSheetNames)
                ? uniqueTexts(product.sourceSheetNames)
                : uniqueTexts([product.sourceSheetName]),
              priceCount: typeof product.priceCount === "number" ? product.priceCount : 0
            }))
          : (issue.productIds ?? []).map((productId: any, index: number) => ({
              productId: idString(productId),
              articleNumber: metadata.articleNumbers?.[index],
              supplierCode: metadata.supplierCodes?.[index],
              productName: label(metadata.productNames?.[index], "Onbekend product"),
              sourceFileNames: [],
              sourceSheetNames: [],
              priceCount: 0
            }));

      if (productRows.length <= 1) {
        continue;
      }

      const uniqueNames = new Set(productRows.map((product: any) => product.productName));
      const uniqueArticles = new Set(
        productRows.map((product: any) => product.articleNumber).filter(Boolean)
      );
      const recommendation =
        metadata.recommendation ??
        (uniqueNames.size === 1 && uniqueArticles.size <= 1 ? "merge" : "needs human review");
      const reason =
        recommendation === "merge"
          ? "Productnamen en artikelnummers lijken gelijk; controleer of dit echte dubbele records zijn."
          : "Zelfde EAN komt voor bij verschillende artikelnummers/productnamen; EAN alleen als ondersteunend signaal gebruiken.";

      duplicateGroups.push({
        supplierId: issue.leverancierId ? idString(issue.leverancierId) : undefined,
        supplier: metadata.supplierName ?? supplier?.naam ?? "Onbekend",
        ean: issue.ean ?? metadata.ean ?? "-",
        productIds: productRows.map((product: any) => product.productId),
        articleNumbers: productRows.map((product: any) => product.articleNumber).filter(Boolean),
        supplierCodes: productRows.map((product: any) => product.supplierCode).filter(Boolean),
        productNames: productRows.map((product: any) => product.productName),
        sourceFileNames: [...new Set(productRows.flatMap((product: any) => product.sourceFileNames))],
        sourceSheetNames: [...new Set(productRows.flatMap((product: any) => product.sourceSheetNames))],
        priceCounts: Object.fromEntries(
          productRows.map((product: any) => [product.productId, product.priceCount])
        ),
        products: productRows,
        issueType: "duplicate_ean",
        severity: issue?.ernst ?? "warning",
        recommendation,
        reason,
        issueStatus: issue?.status ?? "open",
        issueId: idString(issue._id),
        notes: issue?.notities,
        reviewDecision: issue?.metadata?.reviewDecision,
        reviewedByExternalUserId: issue?.metadata?.reviewedByExternalUserId,
        reviewedAt: issue?.metadata?.reviewedAt
      });
    }

    duplicateGroups.sort(
      (left, right) => left.supplier.localeCompare(right.supplier, "nl") || left.ean.localeCompare(right.ean)
    );

    return {
      tenantSlug: tenant.slug,
      duplicateGroupCount: duplicateGroups.length,
      duplicateProductCount: duplicateGroups.reduce((sum, group) => sum + group.productIds.length, 0),
      groups: duplicateGroups
    };
  }
});

export const updateDuplicateEanIssueReview = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    issueId: v.string(),
    decision: duplicateEanDecision,
    notities: v.optional(v.string()),
    reviewedByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const issue: Doc<"catalogDataIssues"> | null = await ctx.db.get(
      args.issueId as Id<"catalogDataIssues">
    );

    if (!issue || issue.tenantId !== tenant._id || issue.kwestieSoort !== "duplicate_ean") {
      throw new ConvexError("Dubbele-EAN-melding niet gevonden.");
    }

    const status =
      args.decision === "resolved"
        ? "resolved"
        : args.decision === "accepted_duplicate"
          ? "accepted"
          : "reviewed";
    const now = Date.now();

    await ctx.db.patch(issue._id, {
      status,
      notities: args.notities,
      metadata: {
        ...(issue.metadata ?? {}),
        reviewDecision: args.decision,
        reviewedByExternalUserId: externalUserId,
        reviewedAt: now
      },
      gewijzigdOp: now
    });

    return issue._id;
  }
});

/**
 * Bulkbeslissing over alle OPEN dubbele-EAN-signalen — bv. "gescheiden
 * houden" over de hele linie, zodat 1.800+ groepen niet één voor één hoeven.
 * Zelfde vastlegging als de losse beoordeling (beslissing, wie, wanneer).
 * Chunked: max ~500 per aanroep; de UI herhaalt tot isDone.
 */
export const bulkReviewOpenDuplicateEanIssues = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    decision: duplicateEanDecision,
    notities: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const batch = await ctx.db
      .query("catalogDataIssues")
      .withIndex("by_type_status", (q: any) =>
        q.eq("tenantId", tenant._id).eq("kwestieSoort", "duplicate_ean").eq("status", "open")
      )
      .take(500);

    const status =
      args.decision === "resolved"
        ? ("resolved" as const)
        : args.decision === "accepted_duplicate"
          ? ("accepted" as const)
          : ("reviewed" as const);
    const now = Date.now();

    for (const issue of batch) {
      await ctx.db.patch(issue._id, {
        status,
        // Bestaande losse notities niet overschrijven met leegte.
        ...(args.notities !== undefined ? { notities: args.notities } : {}),
        metadata: {
          ...(issue.metadata ?? {}),
          reviewDecision: args.decision,
          reviewedByExternalUserId: externalUserId,
          reviewedAt: now,
          bulkReviewed: true
        },
        gewijzigdOp: now
      });
    }

    return {
      patched: batch.length,
      // Er kunnen meer open signalen zijn dan deze batch; de UI herhaalt dan.
      isDone: batch.length < 500
    };
  }
});

/**
 * Scant de LIVE catalogus op dubbele EAN's binnen één leverancier en legt ze
 * vast als catalogDataIssues. Eén leverancier per aanroep (Convex-leeslimiet:
 * de grootste leverancier heeft ~7.000 producten); de UI loopt met
 * supplierCursor door alle leveranciers en sluit af met
 * finalizeDuplicateEanIssueSync zodat verdwenen signalen op "opgelost" gaan.
 *
 * Verving de oude preview-gebaseerde sync: die leunde op productImportRows en
 * artikelnummers uit de oude importflow, die de V2-import allebei niet meer
 * aanmaakt (V2-producten hebben een sku).
 */
export const syncDuplicateEanIssues = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    syncRunId: v.string(),
    /** Leveranciersnaam van de vorige ronde; weglaten = eerste leverancier. */
    supplierCursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const suppliers = (
      await ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect()
    ).sort((left: any, right: any) => left.naam.localeCompare(right.naam, "nl"));

    const startIndex = args.supplierCursor
      ? suppliers.findIndex((supplier: any) => supplier.naam === args.supplierCursor) + 1
      : 0;
    const supplier = suppliers[startIndex];

    if (!supplier) {
      return {
        isDone: true,
        nextCursor: null,
        supplierNaam: null,
        supplierIndex: suppliers.length,
        supplierCount: suppliers.length,
        productCount: 0,
        duplicateGroupCount: 0,
        created: 0,
        updated: 0,
        syncRunId: args.syncRunId
      };
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_supplier_status", (q: any) =>
        q.eq("tenantId", tenant._id).eq("leverancierId", supplier._id).eq("status", "active")
      )
      .collect();

    const byEan = new Map<string, any[]>();
    for (const product of products) {
      const ean = optionalText(product.ean);
      if (!ean) {
        continue;
      }
      const rows = byEan.get(ean) ?? [];
      rows.push(product);
      byEan.set(ean, rows);
    }

    const now = Date.now();
    let created = 0;
    let updated = 0;
    let duplicateGroupCount = 0;

    for (const [ean, rows] of byEan) {
      if (rows.length <= 1) {
        continue;
      }
      duplicateGroupCount += 1;

      const productRows = rows.map((product: any) =>
        compactObject({
          productId: idString(product._id),
          articleNumber: optionalText(product.artikelnummer ?? product.sku),
          supplierCode: optionalText(product.leverancierCode),
          productName: label(product.naam, "Onbekend product"),
          sourceFileNames: [] as string[],
          sourceSheetNames: [] as string[]
        })
      );
      const productIds = rows.map((product: any) => product._id);
      const articleNumbers = uniqueTexts(productRows.map((product: any) => product.articleNumber));
      const supplierCodes = uniqueTexts(productRows.map((product: any) => product.supplierCode));
      const productNames = productRows.map((product: any) => product.productName);
      const uniqueNames = new Set(productNames);
      const recommendation =
        uniqueNames.size === 1 && articleNumbers.length <= 1 ? "merge" : "needs human review";
      const metadata = {
        supplierName: supplier.naam,
        ean,
        articleNumbers,
        supplierCodes,
        productNames,
        sourceFileNames: [] as string[],
        sourceSheetNames: [] as string[],
        recommendation,
        syncRunId: args.syncRunId,
        syncedAt: now,
        products: productRows
      };

      const existing = await ctx.db
        .query("catalogDataIssues")
        .withIndex("by_supplier_ean", (q: any) =>
          q.eq("tenantId", tenant._id).eq("leverancierId", supplier._id).eq("ean", ean)
        )
        .first();

      if (existing) {
        // Eerdere beslissingen (beoordeeld/toegestaan/opgelost) blijven staan
        // zolang de groep uit dezelfde producten bestaat; pas als de
        // samenstelling wijzigt vraagt het signaal opnieuw om beoordeling.
        const existingIds = new Set((existing.productIds ?? []).map(idString));
        const sameComposition =
          existingIds.size === productIds.length &&
          productIds.every((id: any) => existingIds.has(idString(id)));

        await ctx.db.patch(existing._id, {
          status: sameComposition ? existing.status : ("open" as const),
          productIds,
          metadata: {
            ...(existing.metadata ?? {}),
            ...metadata
          },
          gewijzigdOp: now
        });
        updated += 1;
      } else {
        await ctx.db.insert("catalogDataIssues", {
          tenantId: tenant._id,
          kwestieSoort: "duplicate_ean" as const,
          ernst: "warning" as const,
          status: "open" as const,
          leverancierId: supplier._id,
          ean,
          productIds,
          metadata,
          aangemaaktOp: now,
          gewijzigdOp: now
        });
        created += 1;
      }
    }

    return {
      isDone: startIndex >= suppliers.length - 1,
      nextCursor: supplier.naam,
      supplierNaam: supplier.naam,
      supplierIndex: startIndex + 1,
      supplierCount: suppliers.length,
      productCount: products.length,
      duplicateGroupCount,
      created,
      updated,
      syncRunId: args.syncRunId
    };
  }
});

export const finalizeDuplicateEanIssueSync = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    syncRunId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    // Alleen niet-opgeloste duplicate-EAN-issues lezen (geïndexeerd): een
    // tenant-brede scan groeit mee met de issuetabel en is hier niet nodig.
    const activeStatuses = ["open", "reviewed", "accepted"] as const;
    const now = Date.now();
    let resolvedStale = 0;
    let active = 0;

    for (const status of activeStatuses) {
      const issues = await ctx.db
        .query("catalogDataIssues")
        .withIndex("by_type_status", (q: any) =>
          q.eq("tenantId", tenant._id).eq("kwestieSoort", "duplicate_ean").eq("status", status)
        )
        .collect();

      for (const issue of issues) {
        if (issue.metadata?.syncRunId === args.syncRunId) {
          active += 1;
          continue;
        }

        await ctx.db.patch(issue._id, {
          status: "resolved" as const,
          metadata: {
            ...(issue.metadata ?? {}),
            staleAfterSyncRunId: args.syncRunId,
            staleResolvedAt: now
          },
          gewijzigdOp: now
        });
        resolvedStale += 1;
      }
    }

    return {
      active,
      resolvedStale,
      syncRunId: args.syncRunId
    };
  }
});

function summarizeBatchRun(rows: any[]) {
  return rows.reduce(
    (summary, batch) => ({
      sourceFiles: summary.sourceFiles + 1,
      totalRows: summary.totalRows + (batch.totaalRijen ?? 0),
      previewRows: summary.previewRows + (batch.voorbeeldRijen ?? batch.totaalRijen ?? 0),
      productRows: summary.productRows + (batch.productRijen ?? 0),
      priceRules: summary.priceRules + (batch.geimporteerdePrijzen ?? 0),
      warningRows: summary.warningRows + (batch.waarschuwingRijen ?? 0),
      errorRows: summary.errorRows + (batch.foutRijen ?? 0),
      unknownVatModeRows: summary.unknownVatModeRows + (batch.onbekendeBtwModusRijen ?? 0),
      startedAt: Math.min(summary.startedAt, batch.aangemaaktOp ?? Number.MAX_SAFE_INTEGER),
      finishedAt: Math.max(summary.finishedAt, batch.vastgelegdOp ?? batch.gewijzigdOp ?? 0)
    }),
    {
      sourceFiles: 0,
      totalRows: 0,
      previewRows: 0,
      productRows: 0,
      priceRules: 0,
      warningRows: 0,
      errorRows: 0,
      unknownVatModeRows: 0,
      startedAt: Number.MAX_SAFE_INTEGER,
      finishedAt: 0
    }
  );
}

function latestCompleteImportRun(batches: any[]) {
  const importedBatches = batches
    .filter((batch) => batch.status === "imported")
    .sort((left, right) => (left.aangemaaktOp ?? 0) - (right.aangemaaktOp ?? 0));
  const groups: any[][] = [];

  for (const batch of importedBatches) {
    const latestGroup = groups.at(-1);
    const latestBatch = latestGroup?.at(-1);

    if (!latestGroup || (batch.aangemaaktOp ?? 0) - (latestBatch?.aangemaaktOp ?? 0) > 120000) {
      groups.push([batch]);
    } else {
      latestGroup.push(batch);
    }
  }

  return groups
    .map((group) => summarizeBatchRun(group))
    .sort(
      (left, right) =>
        right.priceRules - left.priceRules ||
        right.previewRows - left.previewRows ||
        right.finishedAt - left.finishedAt
    )[0];
}

export const productionReadiness = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const [profiles, duplicateOpenIssues, batches] = await Promise.all([
      ctx.db
        .query("importProfiles")
        .withIndex("by_status", (q: any) => q.eq("tenantId", tenant._id).eq("status", "active"))
        .collect(),
      ctx.db
        .query("catalogDataIssues")
        .withIndex("by_type_status", (q: any) =>
          q.eq("tenantId", tenant._id).eq("kwestieSoort", "duplicate_ean").eq("status", "open")
        )
        .collect(),
      ctx.db
        .query("productImportBatches")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect()
    ]);
    const rows = profiles.flatMap((profile: any) =>
      priceColumns(profile).map((column: any) => ({
        profileId: idString(profile._id),
        currentVatMode:
          column.currentVatMode === "inclusive" || column.currentVatMode === "exclusive"
            ? column.currentVatMode
            : "unknown",
        allowUnknownVatMode: profile.staBtwModusOnbekendToe ?? false
      }))
    );
    const unresolvedVatMappings = rows.filter(
      (row: any) => row.currentVatMode === "unknown" && !row.allowUnknownVatMode
    ).length;
    const latestRun = latestCompleteImportRun(batches) ?? {
      sourceFiles: 0,
      totalRows: 0,
      previewRows: 0,
      productRows: 0,
      priceRules: 0,
      warningRows: 0,
      errorRows: 0,
      unknownVatModeRows: 0,
      startedAt: undefined,
      finishedAt: undefined
    };

    return {
      tenantSlug: tenant.slug,
      vatMappings: {
        total: rows.length,
        unresolved: unresolvedVatMappings,
        resolved: rows.filter((row: any) => row.currentVatMode !== "unknown").length,
        allowUnknown: rows.filter(
          (row: any) => row.currentVatMode === "unknown" && row.allowUnknownVatMode
        ).length
      },
      duplicateEanIssues: {
        open: duplicateOpenIssues.length
      },
      latestImportRun: latestRun,
      productionImportStatus: unresolvedVatMappings === 0 ? "READY" : "BLOCKED"
    };
  }
});
