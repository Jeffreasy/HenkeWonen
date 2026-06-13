/**
 * Productzoeker voor de product-pickers (inmeting + offertebouwer).
 *
 * Bestaansreden: listProductsForPortal scant per aanroep maar één pagina van
 * de hele productentabel en filtert dáárna pas op categorie/zoekterm — met
 * ~25.000 producten levert dat in een picker vrijwel altijd nul resultaten op.
 * Deze query zoekt gericht: via de search-index op naam én via de
 * categorie-indexen van de productgroep, zodat browsen en zoeken allebei
 * daadwerkelijk producten opleveren.
 *
 * De productgroep→categorie-mapping staat hier server-side zodat het filter
 * niet client-side te omzeilen is. Prijzen lopen via de klantveilige
 * keuzeregel (nooit inkoop-/staffelprijzen, btw genormaliseerd).
 */
import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { readActorValidator, requireQueryRole } from "../authz";
import {
  displayProductName,
  displaySupplierName,
  pilotHiddenReason,
  visibleCommercialNames
} from "./pilot";
import { selectCustomerFacingPrice } from "./pricingRules";

const measurementProductGroup = v.union(
  v.literal("flooring"),
  v.literal("plinths"),
  v.literal("wallpaper"),
  v.literal("wall_panels"),
  v.literal("curtains"),
  v.literal("rails"),
  v.literal("stairs"),
  v.literal("other")
);

/** Zelfde mapping als src/lib/quotes/measurementCatalogMapping.ts, maar server-side afgedwongen. */
const PRODUCT_GROUP_CATEGORIES: Record<string, string[]> = {
  flooring: [
    "PVC Vloeren",
    "PVC Dryback",
    "Palletcollectie PVC",
    "Tapijt",
    "Vinyl",
    "Karpetten",
    "Ondervloer",
    "Egaline",
    "Lijm"
  ],
  plinths: ["Plinten"],
  wallpaper: ["Behang"],
  wall_panels: ["Wandpanelen"],
  curtains: ["Gordijnen"],
  rails: ["Roedes/Railsen"],
  stairs: ["Traprenovatie"],
  other: []
};

const SEARCH_INDEX_TAKE = 150;
const CATEGORY_SCAN_TAKE = 400;

function normalizedStatus(status?: string) {
  return status ?? "active";
}

function matchesHaystack(
  product: Doc<"products">,
  categoryName: string,
  supplierName: string,
  search: string
) {
  const haystack = [
    product.name,
    displayProductName(product, categoryName, supplierName),
    product.articleNumber,
    product.supplierCode,
    product.commercialCode,
    product.ean,
    product.colorName,
    supplierName,
    displaySupplierName(supplierName),
    categoryName
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

export const searchPickerProducts = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    productGroup: v.optional(measurementProductGroup),
    search: v.optional(v.string()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    const limit = Math.min(Math.max(args.limit ?? 30, 10), 100);
    const search = (args.search ?? "").trim().toLowerCase();

    const [categories, suppliers] = await Promise.all([
      ctx.db
        .query("categories")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect()
    ]);
    const categoryById = new Map(categories.map((category) => [String(category._id), category]));
    const supplierById = new Map(suppliers.map((supplier) => [String(supplier._id), supplier]));

    const allowedCategoryNames =
      args.productGroup && PRODUCT_GROUP_CATEGORIES[args.productGroup]?.length
        ? PRODUCT_GROUP_CATEGORIES[args.productGroup]
        : null;
    const allowedCategoryIds = allowedCategoryNames
      ? categories
          .filter((category) => allowedCategoryNames.includes(category.name))
          .map((category) => category._id)
      : null;

    const candidates = new Map<string, Doc<"products">>();

    function consider(product: Doc<"products">) {
      if (candidates.has(String(product._id))) {
        return;
      }

      if (normalizedStatus(product.status) !== "active") {
        return;
      }

      const category = categoryById.get(String(product.categoryId));
      const categoryName = category?.name ?? "Overig";

      if (
        allowedCategoryIds &&
        !allowedCategoryIds.some((id) => String(id) === String(product.categoryId))
      ) {
        return;
      }

      if (pilotHiddenReason(product, categoryName)) {
        return;
      }

      const supplierName = product.supplierId
        ? supplierById.get(String(product.supplierId))?.name ?? ""
        : "";

      if (search && !matchesHaystack(product, categoryName, supplierName, search)) {
        return;
      }

      candidates.set(String(product._id), product);
    }

    if (search) {
      // 1. Relevantie-zoektocht op naam via de search-index.
      const byName = await ctx.db
        .query("products")
        .withSearchIndex("search_products", (q) =>
          q.search("name", search).eq("tenantId", tenant._id)
        )
        .take(SEARCH_INDEX_TAKE);

      for (const product of byName) {
        consider(product);
      }

      // 2. Aanvullend per toegestane categorie scannen zodat ook kleur-,
      //    artikelnummer- en leveranciersmatches gevonden worden.
      if (allowedCategoryIds) {
        for (const categoryId of allowedCategoryIds) {
          if (candidates.size >= limit * 3) {
            break;
          }

          const page = await ctx.db
            .query("products")
            .withIndex("by_category_status", (q) =>
              q.eq("tenantId", tenant._id).eq("categoryId", categoryId).eq("status", "active")
            )
            .take(CATEGORY_SCAN_TAKE);

          for (const product of page) {
            consider(product);
          }
        }
      }
    } else if (allowedCategoryIds) {
      // Browsen zonder zoekterm: per categorie van de productgroep vullen.
      for (const categoryId of allowedCategoryIds) {
        if (candidates.size >= limit * 2) {
          break;
        }

        const page = await ctx.db
          .query("products")
          .withIndex("by_category_status", (q) =>
            q.eq("tenantId", tenant._id).eq("categoryId", categoryId).eq("status", "active")
          )
          .take(limit);

        for (const product of page) {
          consider(product);
        }
      }
    } else {
      // Geen groep en geen zoekterm: eerste pagina actieve producten.
      const page = await ctx.db
        .query("products")
        .withIndex("by_status", (q) => q.eq("tenantId", tenant._id).eq("status", "active"))
        .take(limit);

      for (const product of page) {
        consider(product);
      }
    }

    const now = Date.now();
    const selected = [...candidates.values()]
      .sort((left, right) => {
        const leftCategory = categoryById.get(String(left.categoryId))?.name ?? "";
        const rightCategory = categoryById.get(String(right.categoryId))?.name ?? "";
        return `${leftCategory} ${left.name}`.localeCompare(`${rightCategory} ${right.name}`, "nl");
      })
      .slice(0, limit);

    const items = await Promise.all(
      selected.map(async (product) => {
        const prices = await ctx.db
          .query("productPrices")
          .withIndex("by_product", (q) =>
            q.eq("tenantId", tenant._id).eq("productId", product._id as Id<"products">)
          )
          .collect();
        const preferredPrice = selectCustomerFacingPrice(
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
          now
        );
        const categoryName = categoryById.get(String(product.categoryId))?.name ?? "Overig";
        const supplierName = product.supplierId
          ? supplierById.get(String(product.supplierId))?.name ?? "Onbekend"
          : "Onbekend";

        return {
          id: String(product._id),
          tenantId: tenant.slug,
          category: categoryName,
          supplier: supplierName,
          displaySupplierName: displaySupplierName(supplierName),
          articleNumber: product.articleNumber,
          supplierCode: product.supplierCode,
          commercialCode: product.commercialCode,
          supplierProductGroup: product.supplierProductGroup,
          name: product.name,
          displayName: displayProductName(product, categoryName, supplierName),
          colorName: product.colorName,
          productKind: product.productKind,
          commercialNames: visibleCommercialNames(product, categoryName),
          unit: product.unit,
          packageContentM2: product.packageContentM2,
          piecesPerPackage: product.piecesPerPackage,
          packagesPerPallet: product.packagesPerPallet,
          palletQuantity: product.palletQuantity,
          trailerQuantity: product.trailerQuantity,
          bundleSize: product.bundleSize,
          priceExVat: preferredPrice?.unitPriceExVat ?? 0,
          vatRate: preferredPrice?.vatRate ?? 21,
          status: normalizedStatus(product.status)
        };
      })
    );

    return { items, total: items.length, limit };
  }
});
