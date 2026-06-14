/**
 * Richtprijs-lookup voor de inmeetmodule.
 *
 * Smalle query die voor één product een klantgerichte richtprijs teruggeeft.
 * Bewust GEEN hergebruik van pricePriority uit catalog/core.ts: die valt terug
 * op inkoopprijzen en negeert vatMode. Hier geldt: alleen advice_retail/retail,
 * btw genormaliseerd, en bij twijfel géén prijs (zie pricingRules.ts).
 */
import { query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { readActorValidator, requireQueryRole } from "../authz";
import { cleanProductDisplayName, pilotHiddenReason } from "./pilot";
import { buildMatrixSelection, lookupMatrixPrice, selectIndicativePrice } from "./pricingRules";

export const getIndicativePrice = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    productId: v.id("products"),
    measurementUnit: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const product = await ctx.db.get(args.productId);

    if (!product || product.tenantId !== tenant._id) {
      throw new ConvexError("Product niet gevonden.");
    }

    const category = await ctx.db.get(product.categoryId);
    const categoryName = category?.name ?? "Overig";

    if (pilotHiddenReason(product, categoryName)) {
      throw new ConvexError("Dit product is in de pilot niet beschikbaar.");
    }

    const supplier = product.supplierId ? await ctx.db.get(product.supplierId) : null;

    // Geen richtprijs voor niet-actieve producten (draft/inactive/archived): die zijn
    // niet verkoopbaar en mogen geen indicatieve verkoopprijs opleveren.
    if (product.status !== "active") {
      return {
        productId: String(product._id),
        productName: cleanProductDisplayName(product, categoryName, supplier?.name),
        indicative: null
      };
    }

    const prices = await ctx.db
      .query("productPrices")
      .withIndex("by_product", (q) => q.eq("tenantId", tenant._id).eq("productId", product._id))
      .collect();

    const selection = selectIndicativePrice(
      prices.map((price) => ({
        id: String(price._id),
        priceType: price.priceType,
        priceUnit: price.priceUnit,
        amount: price.amount,
        vatRate: price.vatRate,
        vatMode: price.vatMode,
        validFrom: price.validFrom,
        updatedAt: price.updatedAt,
        creationTime: price._creationTime
      })),
      { packageContentM2: product.packageContentM2 },
      args.measurementUnit,
      Date.now()
    );

    // Alleen afgeleide klantgerichte velden teruggeven — nooit ruwe inkoopdata.
    return {
      productId: String(product._id),
      productName: cleanProductDisplayName(product, categoryName, supplier?.name),
      indicative: selection
        ? {
            unitPriceExVat: selection.unitPriceExVat,
            unitPriceIncVat: selection.unitPriceIncVat,
            vatRate: selection.vatRate,
            priceType: selection.priceType,
            priceUnit: selection.priceUnit,
            vatModeUsed: selection.vatModeUsed,
            validFrom: selection.validFrom,
            conversionApplied: selection.conversionApplied
          }
        : null
    };
  }
});

/**
 * Beschikbare raambekleding-matrices voor de inmeet-tab: distinct (type=bronBlad, prijsgroep).
 * Voedt de twee dropdowns; geen prijzen, dus geen btw-/pilot-gevoeligheid.
 */
export const listMatrixOptions = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    productToolSleutel: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const matrices = await ctx.db
      .query("priceMatrices")
      .withIndex("by_tool", (q) =>
        q.eq("tenantId", tenant._id).eq("productToolSleutel", args.productToolSleutel)
      )
      .collect();

    const types = [...new Set(matrices.map((m) => m.bronBlad ?? "").filter(Boolean))].sort();
    const priceGroups = [...new Set(matrices.map((m) => m.prijsgroep))].sort();
    const combinations = matrices.map((m) => ({
      bronBlad: m.bronBlad ?? null,
      prijsgroep: m.prijsgroep
    }));

    return { types, priceGroups, combinations };
  }
});

/**
 * Matrix-richtprijs voor raambekleding: kies (tool, prijsgroep, type) + breedte×hoogte → richtprijs.
 * Loopt NIET via een catalogusproduct. Dezelfde vorm/afronding als getIndicativePrice
 * (ex 4 dec, incl uit ex 2 dec, btwModus "unknown" → geen prijs). Buiten matrixbereik → offerte op maat.
 */
export const getMatrixIndicativePrice = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    productToolSleutel: v.string(),
    prijsgroep: v.string(),
    bronBlad: v.optional(v.string()),
    breedteCm: v.number(),
    hoogteCm: v.number()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const candidates = await ctx.db
      .query("priceMatrices")
      .withIndex("by_tool_group", (q) =>
        q
          .eq("tenantId", tenant._id)
          .eq("productToolSleutel", args.productToolSleutel)
          .eq("prijsgroep", args.prijsgroep)
      )
      .collect();

    const matrix =
      args.bronBlad !== undefined
        ? candidates.find((c) => (c.bronBlad ?? null) === args.bronBlad)
        : candidates[0];

    if (!matrix) {
      return { indicative: null, outOfRange: false, reason: "matrix_not_found" as const };
    }

    const hit = lookupMatrixPrice(
      matrix.breedteAs,
      matrix.hoogteAs,
      matrix.prijzen,
      args.breedteCm,
      args.hoogteCm
    );

    if (hit == null) {
      // Buiten matrixbereik → "offerte op maat", geen richtprijs.
      return { indicative: null, outOfRange: true, reason: "out_of_range" as const };
    }

    const selection = buildMatrixSelection(hit.amount, matrix.btwModus);

    if (!selection) {
      return { indicative: null, outOfRange: false, reason: "vat_unknown" as const };
    }

    return {
      indicative: {
        unitPriceExVat: selection.unitPriceExVat,
        unitPriceIncVat: selection.unitPriceIncVat,
        vatRate: selection.vatRate,
        priceType: "advice_retail" as const,
        priceUnit: "piece" as const,
        vatModeUsed: selection.vatModeUsed,
        prijsgroep: matrix.prijsgroep,
        bronBlad: matrix.bronBlad ?? null,
        matchedWidthCm: hit.matchedWidthCm,
        matchedHeightCm: hit.matchedHeightCm
      },
      outOfRange: false,
      reason: "ok" as const
    };
  }
});
