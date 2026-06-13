/**
 * Onderhoudsmutaties voor de prijsdata (fase 0 van het richtprijs-plan,
 * docs/technisch/plan-richtprijs-inmeting-2026-06-13.md).
 *
 * 1. repairPriceVatModesChunk — zet vatMode van bestaande prijsregels om volgens
 *    een expliciete regel (standaard: unknown/inclusive → exclusive, conform het
 *    klantbesluit "alle leverancierslijsten zijn exclusief btw").
 * 2. deletePseudoPriceRowsChunk — verwijdert pseudo-prijsregels die uit de
 *    Texdecor-import zijn meegekomen ("Code prix" prijscodes en
 *    "Qté multiple d'achat" bestelveelvouden) — dit zijn geen prijzen.
 *
 * Beide zijn chunked (cursor-gebaseerd) om binnen de Convex-leeslimieten te
 * blijven, vereisen een admin-actor plus letterlijke bevestiging, en hebben een
 * dryRun-modus die alleen telt. updatedAt wordt bij reparatie bewust NIET
 * aangepast: dat veld weerspiegelt het importmoment en wordt gebruikt als
 * tie-break bij prijskeuze.
 *
 * Aansturing: tools/repair_price_data.mjs
 */
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRole,
  requireQueryRole
} from "../authz";

const vatModeValue = v.union(
  v.literal("exclusive"),
  v.literal("inclusive"),
  v.literal("unknown")
);

function normalizedText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

/** Pseudo-prijskolommen uit de Texdecor-bestanden (geen echte prijzen). */
function isPseudoPriceColumn(sourceColumnName?: string) {
  const name = normalizedText(sourceColumnName);

  if (!name) {
    return false;
  }

  return (
    name.startsWith("code prix") ||
    name.includes("qté multiple d'achat") ||
    name.includes("qte multiple d'achat") ||
    name.startsWith("unité de vente") ||
    name.startsWith("unite de vente")
  );
}

/**
 * Read-only audit van de producten van één leverancier: telling per
 * (categorie, productKind, unit) plus voorbeeld-attributes, om datafixes
 * (zoals de Texdecor-hercategorisatie) te onderbouwen. Chunked via cursor.
 */
export const supplierProductAudit = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    supplierName: v.string(),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const batchSize = Math.min(Math.max(args.batchSize ?? 500, 50), 1000);

    const supplier = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .filter((q: any) => q.eq(q.field("name"), args.supplierName))
      .first();

    if (!supplier) {
      return { supplierFound: false, isDone: true, continueCursor: "", groups: [], samples: [] };
    }

    const paginated = await ctx.db
      .query("products")
      .withIndex("by_supplier", (q: any) =>
        q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
      )
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    const categoryNames = new Map<string, string>();
    const groups: Record<string, number> = {};
    const samples: Array<Record<string, unknown>> = [];

    for (const product of paginated.page) {
      let categoryName = categoryNames.get(String(product.categoryId));

      if (!categoryName) {
        const category = await ctx.db.get(product.categoryId);
        categoryName = category?.name ?? "?";
        categoryNames.set(String(product.categoryId), categoryName);
      }

      const key = `${categoryName}|${product.productKind ?? "?"}|${product.unit}`;
      groups[key] = (groups[key] ?? 0) + 1;

      if (samples.length < 3) {
        samples.push({
          name: product.name,
          category: categoryName,
          productKind: product.productKind,
          unit: product.unit,
          articleNumber: product.articleNumber,
          attributes: product.attributes
        });
      }
    }

    return {
      supplierFound: true,
      scanned: paginated.page.length,
      groups: Object.entries(groups).map(([key, count]) => ({ key, count })),
      samples,
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});

export const repairPriceVatModesChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    confirm: v.literal("REPAIR_PRICE_VAT_MODES"),
    rule: v.object({
      fromModes: v.array(vatModeValue),
      toMode: v.union(v.literal("exclusive"), v.literal("inclusive")),
      priceTypes: v.optional(v.array(v.string())),
      sourceColumnNames: v.optional(v.array(v.string())),
      sourceFileNames: v.optional(v.array(v.string()))
    }),
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const batchSize = Math.min(Math.max(args.batchSize ?? 1000, 100), 2000);
    const dryRun = args.dryRun ?? true;
    const fromModes = new Set(args.rule.fromModes);
    const priceTypes = args.rule.priceTypes?.length ? new Set(args.rule.priceTypes) : null;
    const sourceColumnNames = args.rule.sourceColumnNames?.length
      ? new Set(args.rule.sourceColumnNames.map(normalizedText))
      : null;
    const sourceFileNames = args.rule.sourceFileNames?.length
      ? new Set(args.rule.sourceFileNames.map(normalizedText))
      : null;

    if (fromModes.has(args.rule.toMode)) {
      throw new Error("fromModes mag de doelmodus niet bevatten.");
    }

    const paginated = await ctx.db
      .query("productPrices")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let matched = 0;
    const breakdown: Record<string, number> = {};

    for (const price of paginated.page) {
      const mode = price.vatMode ?? "unknown";

      if (!fromModes.has(mode)) {
        continue;
      }

      if (priceTypes && !priceTypes.has(price.priceType)) {
        continue;
      }

      if (sourceColumnNames && !sourceColumnNames.has(normalizedText(price.sourceColumnName))) {
        continue;
      }

      if (sourceFileNames && !sourceFileNames.has(normalizedText(price.sourceFileName))) {
        continue;
      }

      matched += 1;
      const key = `${price.priceType}|${mode}|${price.sourceColumnName ?? "?"}`;
      breakdown[key] = (breakdown[key] ?? 0) + 1;

      if (!dryRun) {
        // Bewust geen updatedAt-patch: dat veld blijft het importmoment.
        await ctx.db.patch(price._id, { vatMode: args.rule.toMode });
      }
    }

    return {
      dryRun,
      scanned: paginated.page.length,
      matched,
      patched: dryRun ? 0 : matched,
      // Array i.p.v. record: kolomnamen kunnen tekens bevatten (bv. "€") die
      // Convex niet als veldnaam accepteert.
      breakdown: Object.entries(breakdown).map(([key, count]) => ({ key, count })),
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});

/**
 * Texdecor-supporttype → doelcategorie/-kind/-eenheid, identiek aan de
 * (gerepareerde) mapping in tools/build_catalog_import.py. Sleutels zijn
 * genormaliseerd (lowercase, enkele spaties).
 */
const TEXDECOR_SUPPORT_TARGETS: Record<
  string,
  { categoryName: string; productKind: string; unit: string }
> = {
  "papier peint": { categoryName: "Behang", productKind: "wallpaper", unit: "roll" },
  frise: { categoryName: "Behang", productKind: "wallpaper", unit: "roll" },
  stickers: { categoryName: "Behang", productKind: "wallpaper", unit: "roll" },
  tissus: { categoryName: "Gordijnen", productKind: "curtain_fabric", unit: "m1" },
  "panoramique tissu": { categoryName: "Gordijnen", productKind: "curtain_fabric", unit: "m1" },
  "panoramique papier peint": { categoryName: "Wandpanelen", productKind: "panel", unit: "piece" },
  "panoramique revêtement": { categoryName: "Wandpanelen", productKind: "panel", unit: "piece" },
  "revêtement": { categoryName: "Wandpanelen", productKind: "panel", unit: "piece" },
  affiche: { categoryName: "Wandpanelen", productKind: "panel", unit: "piece" }
};

/**
 * Hercategoriseert Texdecor-producten (Casadeco/Caselio/Casamance) die door de
 * dubbele-spatie-parserbug in "Overig" zijn beland, op basis van het in
 * attributes bewaarde "Nom Type support". Zet tegelijk de priceUnit van hun
 * adviesprijsregels van "custom" naar de juiste eenheid, zodat de
 * richtprijs-eenheidmatch werkt. Idempotent; toekomstige her-imports houden
 * dit in stand omdat de parser dezelfde mapping gebruikt.
 */
export const repairTexdecorCategoriesChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    confirm: v.literal("REPAIR_TEXDECOR_CATEGORIES"),
    supplierName: v.string(),
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const batchSize = Math.min(Math.max(args.batchSize ?? 200, 50), 400);
    const dryRun = args.dryRun ?? true;

    const supplier = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .filter((q: any) => q.eq(q.field("name"), args.supplierName))
      .first();

    if (!supplier) {
      return { supplierFound: false, dryRun, isDone: true, continueCursor: "", breakdown: [] };
    }

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();
    const categoryIdByName = new Map<string, any>(
      categories.map((category: any) => [category.name, category._id])
    );
    const categoryNameById = new Map<string, string>(
      categories.map((category: any) => [String(category._id), category.name])
    );

    const paginated = await ctx.db
      .query("products")
      .withIndex("by_supplier", (q: any) =>
        q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
      )
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let matched = 0;
    let productsPatched = 0;
    let priceRowsPatched = 0;
    const breakdown: Record<string, number> = {};

    for (const product of paginated.page) {
      const supportType = normalizedText(
        (product.attributes as Record<string, unknown> | undefined)?.["nom_type_support"] as
          | string
          | undefined
      );
      const target = TEXDECOR_SUPPORT_TARGETS[supportType];

      if (!target) {
        continue;
      }

      const targetCategoryId = categoryIdByName.get(target.categoryName);

      if (!targetCategoryId) {
        throw new Error(`Doelcategorie "${target.categoryName}" bestaat niet voor deze tenant.`);
      }

      const needsProductPatch =
        String(product.categoryId) !== String(targetCategoryId) ||
        product.productKind !== target.productKind ||
        product.unit !== target.unit;

      const advicePrices = await ctx.db
        .query("productPrices")
        .withIndex("by_product", (q: any) =>
          q.eq("tenantId", tenant._id).eq("productId", product._id)
        )
        .collect();
      const stalePriceRows = advicePrices.filter(
        (price: any) => price.priceType === "advice_retail" && price.priceUnit === "custom"
      );

      if (!needsProductPatch && stalePriceRows.length === 0) {
        continue;
      }

      matched += 1;
      const fromCategory = categoryNameById.get(String(product.categoryId)) ?? "?";
      const key = `${fromCategory} -> ${target.categoryName} (${supportType})`;
      breakdown[key] = (breakdown[key] ?? 0) + 1;

      if (dryRun) {
        priceRowsPatched += stalePriceRows.length;
        continue;
      }

      if (needsProductPatch) {
        await ctx.db.patch(product._id, {
          categoryId: targetCategoryId,
          productKind: target.productKind as any,
          unit: target.unit as any,
          updatedAt: Date.now()
        });
        productsPatched += 1;
      }

      for (const price of stalePriceRows) {
        // Bewust geen updatedAt-patch: dat veld blijft het importmoment.
        await ctx.db.patch(price._id, { priceUnit: target.unit as any });
        priceRowsPatched += 1;
      }
    }

    return {
      supplierFound: true,
      dryRun,
      scanned: paginated.page.length,
      matched,
      productsPatched,
      priceRowsPatched,
      breakdown: Object.entries(breakdown).map(([key, count]) => ({ key, count })),
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});

/**
 * Herstelt packageContentM2-waarden die door een komma-als-duizendtal-misser
 * in de bron (bv. "4,861" m² als 4861) duizend keer te groot zijn opgeslagen.
 * Pakinhoud is in werkelijkheid hooguit tientallen m²; waarden ≥ 100 worden
 * door 1000 gedeeld. Idempotent (gerepareerde waarden vallen onder de 100).
 */
export const repairPackageContentChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    confirm: v.literal("REPAIR_PACKAGE_CONTENT"),
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const batchSize = Math.min(Math.max(args.batchSize ?? 1000, 100), 2000);
    const dryRun = args.dryRun ?? true;

    const paginated = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let matched = 0;
    const breakdown: Record<string, number> = {};

    for (const product of paginated.page) {
      const value = product.packageContentM2;

      if (typeof value !== "number" || value < 100) {
        continue;
      }

      matched += 1;
      const key = `${value} -> ${value / 1000}`;
      breakdown[key] = (breakdown[key] ?? 0) + 1;

      if (!dryRun) {
        await ctx.db.patch(product._id, { packageContentM2: value / 1000 });
      }
    }

    return {
      dryRun,
      scanned: paginated.page.length,
      matched,
      patched: dryRun ? 0 : matched,
      breakdown: Object.entries(breakdown)
        .slice(0, 50)
        .map(([key, count]) => ({ key, count })),
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});

export const deletePseudoPriceRowsChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    confirm: v.literal("DELETE_PSEUDO_PRICE_ROWS"),
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const batchSize = Math.min(Math.max(args.batchSize ?? 1000, 100), 2000);
    const dryRun = args.dryRun ?? true;

    const paginated = await ctx.db
      .query("productPrices")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let matched = 0;
    const breakdown: Record<string, number> = {};

    for (const price of paginated.page) {
      if (!isPseudoPriceColumn(price.sourceColumnName)) {
        continue;
      }

      matched += 1;
      const key = price.sourceColumnName ?? "?";
      breakdown[key] = (breakdown[key] ?? 0) + 1;

      if (!dryRun) {
        await ctx.db.delete(price._id);
      }
    }

    return {
      dryRun,
      scanned: paginated.page.length,
      matched,
      deleted: dryRun ? 0 : matched,
      breakdown: Object.entries(breakdown).map(([key, count]) => ({ key, count })),
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});
