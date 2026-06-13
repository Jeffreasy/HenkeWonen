/**
 * Richtprijs-lookup voor de inmeetmodule.
 *
 * Smalle query die voor één product een klantgerichte richtprijs teruggeeft.
 * Bewust GEEN hergebruik van pricePriority uit catalog/core.ts: die valt terug
 * op inkoopprijzen en negeert vatMode. Hier geldt: alleen advice_retail/retail,
 * btw genormaliseerd, en bij twijfel géén prijs (zie pricingRules.ts).
 */
import { query } from "../_generated/server";
import { v } from "convex/values";
import { readActorValidator, requireQueryRole } from "../authz";
import { cleanProductDisplayName, pilotHiddenReason } from "./pilot";
import { selectIndicativePrice } from "./pricingRules";

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
      throw new Error("Product niet gevonden.");
    }

    const category = await ctx.db.get(product.categoryId);
    const categoryName = category?.name ?? "Overig";

    if (pilotHiddenReason(product, categoryName)) {
      throw new Error("Dit product is in de pilot niet beschikbaar.");
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
