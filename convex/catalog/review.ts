import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, readActorValidator, requireMutationRole, requireQueryRole } from "../authz";

const vatMode = v.union(v.literal("inclusive"), v.literal("exclusive"), v.literal("unknown"));
const duplicateEanDecision = v.union(
  v.literal("keep_separate"),
  v.literal("merge_later"),
  v.literal("source_error"),
  v.literal("accepted_duplicate"),
  v.literal("resolved")
);
const duplicateEanSyncProduct = v.object({
  importKey: v.optional(v.string()),
  productName: v.string(),
  articleNumber: v.optional(v.string()),
  supplierCode: v.optional(v.string()),
  sourceFileName: v.optional(v.string()),
  sourceSheetName: v.optional(v.string()),
  sourceRowNumber: v.optional(v.number())
});
const duplicateEanSyncGroup = v.object({
  supplierName: v.string(),
  ean: v.string(),
  products: v.array(duplicateEanSyncProduct)
});

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
  const columns = Array.isArray(profile.priceColumnMappings) ? profile.priceColumnMappings : [];
  const vatByColumn = profile.vatModeByPriceColumn ?? {};
  const unitByColumn = profile.unitByPriceColumn ?? {};
  const typeByColumn = profile.priceTypeByPriceColumn ?? {};

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
  const review = profile.vatModeReview ?? {};
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
  const priceColumnMappings = Array.isArray(profile.priceColumnMappings)
    ? profile.priceColumnMappings.map((column: any, index: number) =>
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
      .sort((left: any, right: any) => left.name.localeCompare(right.name, "nl"))
      .flatMap((profile: any) =>
        priceColumns(profile).map((column: any) => {
          const suggestion = suggestedVatMode(column.sourceColumnName, column.detectedPriceType);
          const currentVatMode =
            column.currentVatMode === "inclusive" || column.currentVatMode === "exclusive"
              ? column.currentVatMode
              : "unknown";

          return {
            profileId: idString(profile._id),
            profileName: profile.name,
            supplier: profile.supplierName,
            supplierId: profile.supplierId ? idString(profile.supplierId) : undefined,
            category:
              categoryById.get(idString(profile.categoryId))?.name ??
              (typeof profile.mapping?.category === "string"
                ? profile.mapping.category
                : profile.mapping?.categoryFromSectionOrName
                  ? "Uit bron/sectie"
                  : "Onbekend"),
            categoryId: profile.categoryId ? idString(profile.categoryId) : undefined,
            sourceFileNamePattern: profile.filePattern,
            sourceSheetNamePattern: profile.sheetPattern,
            sourceColumnName: column.sourceColumnName,
            sourceColumnIndex: column.sourceColumnIndex,
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
              (currentVatMode === "unknown" && !(profile.allowUnknownVatMode ?? false)) ||
              (suggestion.confidence === "high" &&
                currentVatMode !== "unknown" &&
                currentVatMode !== suggestion.suggestedVatMode),
            allowUnknownVatMode: profile.allowUnknownVatMode ?? false,
            reason: suggestion.reason,
            updatedByExternalUserId: profile.vatModeUpdatedByExternalUserId,
            updatedAt: profile.vatModeUpdatedAt,
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
    sourceColumnName: v.string(),
    sourceColumnIndex: v.number(),
    vatMode,
    updatedByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const profile: any = await ctx.db.get(args.profileId as any);

    if (!profile || profile.tenantId !== tenant._id) {
      throw new Error("Import profile not found");
    }

    const now = Date.now();
    const updateColumn = (column: any, index: number) => {
      const header = label(column.header ?? column.sourceColumnName, `Kolom ${index + 1}`);
      const sourceColumnIndex =
        typeof column.sourceColumnIndex === "number" ? column.sourceColumnIndex : index;
      // Match op de stabiele kolomINDEX (de autoritatieve kolomsleutel). De vorige losse
      // OR op naam kon bij dubbele/hergebruikte kolomnamen de verkeerde btw-kolom
      // overschrijven; de index identificeert de kolom eenduidig.
      const matches = sourceColumnIndex === args.sourceColumnIndex;

      return matches
        ? {
            ...column,
            header,
            sourceColumnIndex,
            vatMode: args.vatMode
          }
        : column;
    };
    const priceColumnMappings = Array.isArray(profile.priceColumnMappings)
      ? profile.priceColumnMappings.map(updateColumn)
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
      ...(profile.vatModeByPriceColumn ?? {}),
      [args.sourceColumnName]: args.vatMode
    };
    const vatModeReview = {
      ...(profile.vatModeReview ?? {}),
      [args.sourceColumnName]: {
        sourceColumnIndex: args.sourceColumnIndex,
        vatMode: args.vatMode,
        updatedByExternalUserId: externalUserId,
        updatedAt: now,
        reviewedByExternalUserId: externalUserId,
        reviewedAt: now,
        reviewStatus: "reviewed"
      }
    };

    await ctx.db.patch(profile._id, {
      priceColumnMappings,
      vatModeByPriceColumn,
      mapping,
      vatModeReview,
      vatModeUpdatedByExternalUserId: externalUserId,
      vatModeUpdatedAt: now,
      updatedAt: now
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
        sourceColumnName: v.string(),
        sourceColumnIndex: v.number()
      })
    ),
    vatMode,
    updatedByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const profile: any = await ctx.db.get(args.profileId as any);

    if (!profile || profile.tenantId !== tenant._id) {
      throw new Error("Import profile not found");
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
        vatMode: args.vatMode
      };
    };
    const patched = patchSelectedColumns(profile, args.columns, patchColumn);
    const vatModeByPriceColumn = {
      ...(profile.vatModeByPriceColumn ?? {})
    };
    const vatModeReview = {
      ...(profile.vatModeReview ?? {})
    };

    for (const column of args.columns) {
      vatModeByPriceColumn[column.sourceColumnName] = args.vatMode;
      vatModeReview[column.sourceColumnName] = {
        ...(vatModeReview[column.sourceColumnName] ?? {}),
        sourceColumnIndex: column.sourceColumnIndex,
        vatMode: args.vatMode,
        updatedByExternalUserId: externalUserId,
        updatedAt: now,
        reviewedByExternalUserId: externalUserId,
        reviewedAt: now,
        reviewStatus: "reviewed"
      };
    }

    await ctx.db.patch(profile._id, {
      priceColumnMappings: patched.priceColumnMappings,
      vatModeByPriceColumn,
      mapping: patched.mapping,
      vatModeReview,
      vatModeUpdatedByExternalUserId: externalUserId,
      vatModeUpdatedAt: now,
      updatedAt: now
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
        sourceColumnName: v.string(),
        sourceColumnIndex: v.number()
      })
    ),
    reviewedByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const profile: any = await ctx.db.get(args.profileId as any);

    if (!profile || profile.tenantId !== tenant._id) {
      throw new Error("Import profile not found");
    }

    const now = Date.now();
    const vatModeReview = {
      ...(profile.vatModeReview ?? {})
    };

    for (const column of args.columns) {
      const currentVatMode =
        profile.vatModeByPriceColumn?.[column.sourceColumnName] ??
        reviewForColumn(profile, column.sourceColumnName, column.sourceColumnIndex)?.vatMode ??
        "unknown";

      vatModeReview[column.sourceColumnName] = {
        ...(vatModeReview[column.sourceColumnName] ?? {}),
        sourceColumnIndex: column.sourceColumnIndex,
        vatMode: currentVatMode,
        reviewedByExternalUserId: externalUserId,
        reviewedAt: now,
        reviewStatus: "reviewed"
      };
    }

    await ctx.db.patch(profile._id, {
      vatModeReview,
      vatModeUpdatedByExternalUserId: externalUserId,
      vatModeUpdatedAt: now,
      updatedAt: now
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
    allowUnknownVatMode: v.boolean(),
    updatedByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const profile: any = await ctx.db.get(args.profileId as any);

    if (!profile || profile.tenantId !== tenant._id) {
      throw new Error("Import profile not found");
    }

    const now = Date.now();
    await ctx.db.patch(profile._id, {
      allowUnknownVatMode: args.allowUnknownVatMode,
      vatModeUpdatedByExternalUserId: externalUserId,
      vatModeUpdatedAt: now,
      updatedAt: now
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

    for (const issue of issues.filter((item: any) => item.issueType === "duplicate_ean")) {
      const metadata = issue.metadata ?? {};
      const supplier = issue.supplierId ? supplierById.get(idString(issue.supplierId)) : undefined;
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
        supplierId: issue.supplierId ? idString(issue.supplierId) : undefined,
        supplier: metadata.supplierName ?? supplier?.name ?? "Onbekend",
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
        severity: issue?.severity ?? "warning",
        recommendation,
        reason,
        issueStatus: issue?.status ?? "open",
        issueId: idString(issue._id),
        notes: issue?.notes,
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
    notes: v.optional(v.string()),
    reviewedByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const issue: any = await ctx.db.get(args.issueId as any);

    if (!issue || issue.tenantId !== tenant._id || issue.issueType !== "duplicate_ean") {
      throw new Error("Duplicate EAN issue not found");
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
      notes: args.notes,
      metadata: {
        ...(issue.metadata ?? {}),
        reviewDecision: args.decision,
        reviewedByExternalUserId: externalUserId,
        reviewedAt: now
      },
      updatedAt: now
    });

    return issue._id;
  }
});

async function supplierByName(ctx: any, tenantId: any, supplierName: string) {
  return await ctx.db
    .query("suppliers")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("name"), supplierName))
    .first();
}

async function productForDuplicateInput(ctx: any, tenantId: any, supplierId: any, product: any) {
  const importKey = optionalText(product.importKey);

  if (importKey) {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_import_key", (q: any) => q.eq("tenantId", tenantId).eq("importKey", importKey))
      .first();

    if (existing) {
      return existing;
    }
  }

  const articleNumber = optionalText(product.articleNumber);
  if (articleNumber) {
    return await ctx.db
      .query("products")
      .withIndex("by_article_number", (q: any) =>
        q.eq("tenantId", tenantId).eq("supplierId", supplierId).eq("articleNumber", articleNumber)
      )
      .first();
  }

  return null;
}

export const syncDuplicateEanIssues = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    groups: v.optional(v.array(duplicateEanSyncGroup)),
    syncRunId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);

    if (!args.groups) {
      return {
        created: 0,
        updated: 0,
        skipped: 0,
        requiresPreviewSync: true,
        message:
          "Duplicate-EAN sync is batch-gebaseerd. Gebruik tools/sync_duplicate_ean_issues_from_preview.mjs."
      };
    }

    const now = Date.now();
    const syncRunId = args.syncRunId ?? `duplicate-ean-${now}`;
    const supplierCache = new Map<string, any>();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const group of args.groups) {
      if (!hasText(group.ean) || !hasText(group.supplierName) || group.products.length <= 1) {
        skipped += 1;
        continue;
      }

      const supplierName = group.supplierName.trim();
      let supplier = supplierCache.get(supplierName);

      if (supplier === undefined) {
        supplier = await supplierByName(ctx, tenant._id, supplierName);
        supplierCache.set(supplierName, supplier ?? null);
      }

      if (!supplier) {
        skipped += 1;
        continue;
      }

      const productRows = [];
      for (const product of group.products) {
        const existingProduct = await productForDuplicateInput(ctx, tenant._id, supplier._id, product);

        if (!existingProduct) {
          continue;
        }

        productRows.push(compactObject({
          productId: existingProduct._id,
          articleNumber: optionalText(product.articleNumber ?? existingProduct.articleNumber),
          supplierCode: optionalText(product.supplierCode ?? existingProduct.supplierCode),
          productName: label(product.productName ?? existingProduct.name, "Onbekend product"),
          sourceFileNames: uniqueTexts([product.sourceFileName]),
          sourceSheetNames: uniqueTexts([product.sourceSheetName]),
          sourceRowNumber: product.sourceRowNumber
        }));
      }

      if (productRows.length <= 1) {
        skipped += 1;
        continue;
      }

      const productIds = productRows.map((product: any) => product.productId);
      const articleNumbers = uniqueTexts(productRows.map((product: any) => product.articleNumber));
      const supplierCodes = uniqueTexts(productRows.map((product: any) => product.supplierCode));
      const productNames = productRows.map((product: any) => product.productName);
      const uniqueNames = new Set(productNames);
      const uniqueArticles = new Set(articleNumbers);
      const recommendation =
        uniqueNames.size === 1 && uniqueArticles.size <= 1 ? "merge" : "needs human review";
      const metadata = {
        supplierName,
        ean: group.ean.trim(),
        articleNumbers,
        supplierCodes,
        productNames,
        sourceFileNames: uniqueTexts(productRows.flatMap((product: any) => product.sourceFileNames)),
        sourceSheetNames: uniqueTexts(productRows.flatMap((product: any) => product.sourceSheetNames)),
        recommendation,
        syncRunId,
        syncedAt: now,
        products: productRows.map((product: any) =>
          compactObject({
            productId: idString(product.productId),
            articleNumber: product.articleNumber,
            supplierCode: product.supplierCode,
            productName: product.productName,
            sourceFileNames: product.sourceFileNames,
            sourceSheetNames: product.sourceSheetNames,
            sourceRowNumber: product.sourceRowNumber
          })
        )
      };
      const existing = await ctx.db
        .query("catalogDataIssues")
        .withIndex("by_supplier_ean", (q: any) =>
          q.eq("tenantId", tenant._id).eq("supplierId", supplier._id).eq("ean", group.ean.trim())
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          status: existing.status === "resolved" ? ("open" as const) : existing.status,
          productIds,
          metadata: {
            ...(existing.metadata ?? {}),
            ...metadata
          },
          updatedAt: now
        });
        updated += 1;
      } else {
        await ctx.db.insert("catalogDataIssues", {
          tenantId: tenant._id,
          issueType: "duplicate_ean" as const,
          severity: "warning" as const,
          status: "open" as const,
          supplierId: supplier._id,
          ean: group.ean.trim(),
          productIds,
          metadata,
          createdAt: now,
          updatedAt: now
        });
        created += 1;
      }
    }

    return {
      created,
      updated,
      skipped,
      syncRunId
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
    const issues = await ctx.db
      .query("catalogDataIssues")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();
    const now = Date.now();
    let resolvedStale = 0;
    let active = 0;

    for (const issue of issues.filter((item: any) => item.issueType === "duplicate_ean")) {
      if (issue.metadata?.syncRunId === args.syncRunId) {
        active += 1;
        continue;
      }

      if (issue.status !== "resolved") {
        await ctx.db.patch(issue._id, {
          status: "resolved" as const,
          metadata: {
            ...(issue.metadata ?? {}),
            staleAfterSyncRunId: args.syncRunId,
            staleResolvedAt: now
          },
          updatedAt: now
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
      totalRows: summary.totalRows + (batch.totalRows ?? 0),
      previewRows: summary.previewRows + (batch.previewRows ?? batch.totalRows ?? 0),
      productRows: summary.productRows + (batch.productRows ?? 0),
      priceRules: summary.priceRules + (batch.importedPrices ?? 0),
      warningRows: summary.warningRows + (batch.warningRows ?? 0),
      errorRows: summary.errorRows + (batch.errorRows ?? 0),
      unknownVatModeRows: summary.unknownVatModeRows + (batch.unknownVatModeRows ?? 0),
      startedAt: Math.min(summary.startedAt, batch.createdAt ?? Number.MAX_SAFE_INTEGER),
      finishedAt: Math.max(summary.finishedAt, batch.committedAt ?? batch.updatedAt ?? 0)
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
    .sort((left, right) => (left.createdAt ?? 0) - (right.createdAt ?? 0));
  const groups: any[][] = [];

  for (const batch of importedBatches) {
    const latestGroup = groups.at(-1);
    const latestBatch = latestGroup?.at(-1);

    if (!latestGroup || (batch.createdAt ?? 0) - (latestBatch?.createdAt ?? 0) > 120000) {
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
          q.eq("tenantId", tenant._id).eq("issueType", "duplicate_ean").eq("status", "open")
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
        allowUnknownVatMode: profile.allowUnknownVatMode ?? false
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
