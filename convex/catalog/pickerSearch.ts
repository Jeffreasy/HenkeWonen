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
import type { PortalProduct } from "../../src/lib/portalTypes";
import { readActorValidator, requireQueryRole } from "../authz";
import {
  cleanProductDisplayName,
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
    // V2-catalogus gebruikt "PVC" en "Tapijt & Vinyl" als subcategorie;
    // de overige namen blijven staan voor oudere datasets.
    "PVC",
    "PVC Vloeren",
    "PVC Dryback",
    "Palletcollectie PVC",
    "Tapijt",
    "Tapijt & Vinyl",
    "Vinyl",
    "Karpetten",
    "Ondervloer",
    "Egaline",
    "Lijm"
  ],
  plinths: ["Plinten"],
  wallpaper: ["Behang"],
  wall_panels: ["Wandpanelen", "Akoestische Panelen", "Badkamer"],
  curtains: ["Gordijnen", "Gordijnstoffen", "Rolgordijnen", "Jaloezieën"],
  rails: ["Roedes/Railsen"],
  stairs: ["Traprenovatie"],
  other: []
};

const SEARCH_INDEX_TAKE = 150;
const CATEGORY_SCAN_TAKE = 400;

type ProductStatus = "draft" | "active" | "inactive" | "archived";

function normalizedStatus(status?: ProductStatus): ProductStatus {
  return status ?? "active";
}

function matchesHaystack(
  product: Doc<"products">,
  categoryName: string,
  supplierName: string,
  search: string
) {
  const haystack = [
    product.naam,
    displayProductName(product, categoryName, supplierName),
    product.artikelnummer,
    product.leverancierCode,
    product.commercieleCode,
    product.ean,
    product.kleurnaam,
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
    productGroep: v.optional(measurementProductGroup),
    categorieId: v.optional(v.id("categories")),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    // Cursor voor het bladeren (oneindig scrollen). null/leeg = eerste pagina.
    cursor: v.optional(v.union(v.string(), v.null()))
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

    // Data-driven filter: categorieën waarvan de beheerde `productGroep` matcht met
    // de hint (beheer bestuurt dit via /instellingen/categorieen), AANGEVULD met de
    // hardgecodeerde naam-map. Unie i.p.v. of/of: na een (her)import bestaan er
    // categorieën zonder productGroep-veld naast oudere mét — beide moeten meedoen,
    // anders verdwijnen nieuwe categorieën uit de werksoort-tab. "other" = geen filter.
    let allowedCategoryIds: Array<Doc<"categories">["_id"]> | null = null;
    if (args.productGroep && args.productGroep !== "other") {
      const fallbackNames = new Set(PRODUCT_GROUP_CATEGORIES[args.productGroep] ?? []);
      const matched = categories
        .filter(
          (category) =>
            category.productGroep === args.productGroep ||
            (category.productGroep === undefined && fallbackNames.has(category.naam))
        )
        .map((category) => category._id);
      if (matched.length > 0) {
        allowedCategoryIds = matched;
      }
    }

    // Expliciete categoriekeuze uit het categorie-menu van de picker: filter strak op die ene
    // categorie (mits die bij deze tenant hoort). Wint van de grovere productgroep-hint en
    // combineert gewoon met de zoekterm. Onbekende id → genegeerd (valt terug op het overige filter).
    if (args.categorieId && categoryById.has(String(args.categorieId))) {
      allowedCategoryIds = [args.categorieId];
    }

    const now = Date.now();

    async function toPortalProduct(product: Doc<"products">): Promise<PortalProduct> {
      const prices = await ctx.db
        .query("productPrices")
        .withIndex("by_product", (q) =>
          q.eq("tenantId", tenant._id).eq("productId", product._id as Id<"products">)
        )
        .collect();
      const preferredPrice = selectCustomerFacingPrice(
        prices.map((price) => ({
          id: String(price._id),
          priceType: price.prijsSoort,
          priceUnit: price.prijsEenheid,
          amount: price.bedrag,
          vatRate: price.btwTarief,
          vatMode: price.btwModus,
          validFrom: price.geldigVanaf,
          updatedAt: price.gewijzigdOp,
          creationTime: price._creationTime
        })),
        now
      );
      const categoryName = categoryById.get(String(product.categorieId))?.naam ?? "Overig";
      const supplierName = product.leverancierId
        ? (supplierById.get(String(product.leverancierId))?.naam ?? "Onbekend")
        : "Onbekend";

      return {
        id: String(product._id),
        tenantId: tenant.slug,
        category: categoryName,
        supplier: supplierName,
        displaySupplierName: displaySupplierName(supplierName),
        artikelnummer: product.artikelnummer,
        leverancierCode: product.leverancierCode,
        commercieleCode: product.commercieleCode,
        leverancierProductGroep: product.leverancierProductGroep,
        naam: product.naam,
        weergaveNaam: cleanProductDisplayName(product, categoryName, supplierName),
        kleurnaam: product.kleurnaam,
        productSoort: product.productSoort,
        commercialNames: visibleCommercialNames(product, categoryName),
        eenheid: product.eenheid,
        breedteMm: product.breedteMm,
        pakinhoudM2: product.pakinhoudM2,
        stuksPerPak: product.stuksPerPak,
        pakkenPerPallet: product.pakkenPerPallet,
        palletAantal: product.palletAantal,
        vrachtwagenAantal: product.vrachtwagenAantal,
        bundelGrootte: product.bundelGrootte,
        prijsExBtw: preferredPrice?.unitPriceExVat ?? 0,
        prijsEenheid: preferredPrice?.priceUnit,
        btwTarief: preferredPrice?.vatRate ?? 21,
        status: normalizedStatus(product.status)
      };
    }

    const singleCategoryId =
      allowedCategoryIds && allowedCategoryIds.length === 1 ? allowedCategoryIds[0] : null;

    // ── Bladeren zonder zoekterm, op de hele catalogus of één categorie: cursor-paginering,
    //    alfabetisch op naam. Zo bereik je ÁLLE producten (niet alleen de eerste pagina),
    //    ook met 10.000+ in de catalogus. Meetgroepen met meerdere categorieën en zoeken
    //    vallen hier bewust buiten (die versmallen al genoeg → top-N hieronder).
    if (!search && (allowedCategoryIds === null || singleCategoryId)) {
      const page = singleCategoryId
        ? await ctx.db
            .query("products")
            .withIndex("by_category_status_naam", (q) =>
              q
                .eq("tenantId", tenant._id)
                .eq("categorieId", singleCategoryId)
                .eq("status", "active")
            )
            .paginate({ numItems: limit, cursor: args.cursor ?? null })
        : await ctx.db
            .query("products")
            .withIndex("by_status_naam", (q) =>
              q.eq("tenantId", tenant._id).eq("status", "active")
            )
            .paginate({ numItems: limit, cursor: args.cursor ?? null });

      const visible = page.page.filter((product) => {
        const categoryName = categoryById.get(String(product.categorieId))?.naam ?? "Overig";
        return !pilotHiddenReason(product, categoryName);
      });

      const items = await Promise.all(visible.map((product) => toPortalProduct(product)));
      return { items, isDone: page.isDone, nextCursor: page.isDone ? null : page.continueCursor };
    }

    // ── Zoeken, of een meetgroep met meerdere categorieën bladeren: top-N (geen paginering). ──
    const candidates = new Map<string, Doc<"products">>();

    function consider(product: Doc<"products">) {
      if (candidates.has(String(product._id))) {
        return;
      }

      if (normalizedStatus(product.status) !== "active") {
        return;
      }

      const category = categoryById.get(String(product.categorieId));
      const categoryName = category?.naam ?? "Overig";

      if (
        allowedCategoryIds &&
        !allowedCategoryIds.some((id) => String(id) === String(product.categorieId))
      ) {
        return;
      }

      if (pilotHiddenReason(product, categoryName)) {
        return;
      }

      const supplierName = product.leverancierId
        ? (supplierById.get(String(product.leverancierId))?.naam ?? "")
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
          q.search("naam", search).eq("tenantId", tenant._id)
        )
        .take(SEARCH_INDEX_TAKE);

      for (const product of byName) {
        consider(product);
      }

      // 2. Aanvullend per categorie scannen zodat ook kleur-, artikelnummer- en
      //    leveranciersmatches gevonden worden (die staan niet in de naam-index).
      //    Zonder productgroep-hint — bv. de ruimte-centrische toewijs-picker die elk
      //    product toelaat — scannen we ALLE categorieën; anders zou zoeken op
      //    merk/kleur/leverancier (bv. "Floorlife", "Moduleo") niets vinden.
      const searchScanCategoryIds =
        allowedCategoryIds ?? categories.map((category) => category._id);
      for (const categoryId of searchScanCategoryIds) {
        if (candidates.size >= limit * 3) {
          break;
        }

        const page = await ctx.db
          .query("products")
          .withIndex("by_category_status", (q) =>
            q.eq("tenantId", tenant._id).eq("categorieId", categoryId).eq("status", "active")
          )
          .take(CATEGORY_SCAN_TAKE);

        for (const product of page) {
          consider(product);
        }
      }
    } else {
      // Meetgroep met meerdere categorieën bladeren (bv. inmeten "hele werksoort"): per
      // categorie top-N vullen. Eén categorie of de hele catalogus is hierboven al afgevangen
      // door de pagineer-tak.
      for (const categoryId of allowedCategoryIds ?? []) {
        if (candidates.size >= limit * 2) {
          break;
        }

        const page = await ctx.db
          .query("products")
          .withIndex("by_category_status", (q) =>
            q.eq("tenantId", tenant._id).eq("categorieId", categoryId).eq("status", "active")
          )
          .take(limit);

        for (const product of page) {
          consider(product);
        }
      }
    }

    const selected = [...candidates.values()]
      .sort((left, right) => {
        const leftCategory = categoryById.get(String(left.categorieId))?.naam ?? "";
        const rightCategory = categoryById.get(String(right.categorieId))?.naam ?? "";
        return `${leftCategory} ${left.naam}`.localeCompare(`${rightCategory} ${right.naam}`, "nl");
      })
      .slice(0, limit);

    const items = await Promise.all(selected.map((product) => toPortalProduct(product)));

    return { items, isDone: true, nextCursor: null };
  }
});

/**
 * Categorieën voor het categorie-menu van de productkiezer. Data-driven: dezelfde
 * catalogus-categorieën als /instellingen/categorieen, mét hun productgroep zodat het menu
 * ze per werksoort kan groeperen. Bewust viewer+ (elke portalgebruiker mag de picker openen),
 * anders dan de admin-only beheerlijst. Alleen actieve categorieën, op beheer-sortering.
 */
export const pickerCategories = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    const active = categories
      .filter((category) => (category.status ?? "active") === "active")
      // Pilot-verborgen categorieën (PVC Click) horen niet in het menu — anders kies je een
      // categorie die in de picker leeg blijkt.
      .filter((category) => !pilotHiddenReason({ naam: category.naam }, category.naam))
      .sort((left, right) => left.sortOrder - right.sortOrder);

    // Alleen categorieën met minstens één actief product tonen — lege categorieën
    // (bv. Horren, Verlichting) horen niet in het keuzemenu. Eén indexed .first() per
    // categorie is goedkoop.
    const result: Array<{
      id: string;
      name: string;
      productGroep: string | null;
      sortOrder: number;
    }> = [];

    for (const category of active) {
      const firstProduct = await ctx.db
        .query("products")
        .withIndex("by_category_status", (q) =>
          q.eq("tenantId", tenant._id).eq("categorieId", category._id).eq("status", "active")
        )
        .first();

      if (firstProduct) {
        result.push({
          id: String(category._id),
          name: category.naam,
          productGroep: category.productGroep ?? null,
          sortOrder: category.sortOrder
        });
      }
    }

    return result;
  }
});
