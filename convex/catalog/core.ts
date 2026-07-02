import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRole,
  requireMutationRoleForTenantId,
  requireQueryRole,
  requireQueryRoleForTenantId
} from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import type { PortalProduct } from "../../src/lib/portalTypes";
import {
  cleanProductDisplayName,
  displayProductName,
  displaySupplierName,
  pilotHiddenReason,
  visibleCommercialNames
} from "./pilot";
import { selectCustomerFacingPrice } from "./pricingRules";

const productStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("inactive"),
  v.literal("archived")
);
type ProductStatus = "draft" | "active" | "inactive" | "archived";

function normalizedProductStatus(status?: ProductStatus): ProductStatus {
  return status ?? "active";
}

function hasArg<T extends object>(args: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(args, key);
}

const unit = v.union(
  v.literal("piece"),
  v.literal("m2"),
  v.literal("m1"),
  v.literal("meter"),
  v.literal("roll"),
  v.literal("package"),
  v.literal("pack"),
  v.literal("pallet"),
  v.literal("trailer"),
  v.literal("step"),
  v.literal("liter"),
  v.literal("kg"),
  v.literal("hour"),
  v.literal("stairs"),
  v.literal("custom")
);

const priceUnit = v.union(
  v.literal("m2"),
  v.literal("m1"),
  v.literal("meter"),
  v.literal("piece"),
  v.literal("package"),
  v.literal("pack"),
  v.literal("roll"),
  v.literal("pallet"),
  v.literal("trailer"),
  v.literal("step"),
  v.literal("liter"),
  v.literal("kg"),
  v.literal("custom")
);

const priceType = v.union(
  v.literal("purchase"),
  v.literal("net_purchase"),
  v.literal("retail"),
  v.literal("advice_retail"),
  v.literal("commission"),
  v.literal("pallet"),
  v.literal("trailer"),
  v.literal("roll"),
  v.literal("cut_length"),
  v.literal("package"),
  v.literal("step"),
  v.literal("manual")
);

const vatMode = v.union(
  v.literal("exclusive"),
  v.literal("inclusive"),
  v.literal("unknown")
);

const productKind = v.optional(
  v.union(
    v.literal("click"),
    v.literal("dryback"),
    v.literal("src"),
    v.literal("panel"),
    v.literal("tile"),
    v.literal("carpet"),
    v.literal("vinyl"),
    v.literal("curtain"),
    v.literal("fabric"),
    v.literal("curtain_fabric"),
    v.literal("vitrage"),
    v.literal("roman_blind_fabric"),
    v.literal("panel_curtain_fabric"),
    v.literal("mat"),
    v.literal("rug"),
    v.literal("blind"),
    v.literal("plisse"),
    v.literal("jaloezie"),
    v.literal("duette"),
    v.literal("rail"),
    v.literal("wallpaper"),
    v.literal("underlay"),
    v.literal("adhesive"),
    v.literal("plinth"),
    v.literal("other")
  )
);

// De vroegere pricePriority-fallback (advies → pallet → commissie → inkoop)
// is vervangen door de klantveilige keuzeregel in pricingRules.ts: alleen
// advies-/verkoopprijzen met besliste btw-modus, nooit inkoop- of staffelprijzen.

export const listProducts = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator,
    status: v.optional(productStatus),
    categorieId: v.optional(v.id("categories"))
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

    if (args.categorieId) {
      return await ctx.db
        .query("products")
        .withIndex("by_category", (q) =>
          q.eq("tenantId", args.tenantId).eq("categorieId", args.categorieId!)
        )
        .collect();
    }

    if (args.status && args.status !== "active") {
      return await ctx.db
        .query("products")
        .withIndex("by_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", args.status!)
        )
        .collect();
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    if (args.status === "active") {
      return products.filter((product) => normalizedProductStatus(product.status) === "active");
    }

    return products;
  }
});

export const getProductCount = query({
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

    let count = 0;
    let scanned = 0;

    for await (const product of ctx.db
      .query("products")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
    ) {
      if (scanned >= MAX_PRODUCT_STAT_SCAN) {
        break;
      }

      scanned += 1;
      if (normalizedProductStatus(product.status) === "active") {
        count += 1;
      }
    }

    return count;
  }
});

const categoryOrder = [
  "PVC Vloeren",
  "PVC Click",
  "PVC Dryback",
  "Palletcollectie PVC",
  "Traprenovatie",
  "Tapijt",
  "Vinyl",
  "Gordijnen",
  "Raambekleding",
  "Wandpanelen",
  "Douchepanelen",
  "Tegels",
  "Entreematten",
  "Plinten",
  "Lijm",
  "Kit",
  "Egaline",
  "Ondervloer",
  "Behang",
  "Roedes/Railsen",
  "Karpetten",
  "Horren",
  "Verlichting",
  "Winkelvoorraad",
  "Overig"
];

type ProductDoc = Doc<"products">;
type CategoryDoc = Doc<"categories">;
type SupplierDoc = Doc<"suppliers">;

const MAX_PRODUCT_STAT_SCAN = 50000;
const CATEGORY_STAT_COUNT_LIMIT = 250;

function productMatchesPortalFilters({
  product,
  categoryName,
  supplierName,
  requestedStatus,
  includePilotHidden,
  search,
  categoryFilter,
  allowedCategoryNames
}: {
  product: ProductDoc;
  categoryName: string;
  supplierName: string;
  requestedStatus: ProductStatus;
  includePilotHidden: boolean;
  search: string;
  categoryFilter: string;
  allowedCategoryNames: Set<string> | null;
}) {
  if (normalizedProductStatus(product.status) !== requestedStatus) {
    return false;
  }

  if (!includePilotHidden && pilotHiddenReason(product, categoryName)) {
    return false;
  }

  if (categoryFilter && categoryName !== categoryFilter) {
    return false;
  }

  // Multi-categorie filter (productGroup-gebaseerd)
  if (allowedCategoryNames && !allowedCategoryNames.has(categoryName)) {
    return false;
  }

  if (!search) {
    return true;
  }

  const customerName = displayProductName(product, categoryName, supplierName);
  const customerSupplierName = displaySupplierName(supplierName);
  const labels = visibleCommercialNames(product, categoryName)
    ?.map((name) => name.weergaveNaam)
    .join(" ");
  const haystack = [
    product.naam,
    customerName,
    product.artikelnummer,
    product.leverancierCode,
    product.commercieleCode,
    product.leverancierProductGroep,
    product.ean,
    product.kleurnaam,
    supplierName,
    customerSupplierName,
    categoryName,
    labels
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

/**
 * Lichte telquery voor de categorie-dropdown.
 * Gebruikt de category/status-index per categorie zodat grote productdocs niet
 * in één brede tenant-scan hoeven te worden gelezen.
 */
export const listCategoryStats = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    status: v.optional(productStatus)
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

    const requestedStatus = args.status ?? "active";
    const counts = new Map<string, { count: number; truncated: boolean }>();
    let scanned = 0;
    let truncated = false;

    for (const category of categories) {
      const products = await ctx.db
        .query("products")
        .withIndex("by_category_status", (q) =>
          q.eq("tenantId", tenant._id).eq("categorieId", category._id).eq("status", requestedStatus)
        )
        .take(CATEGORY_STAT_COUNT_LIMIT + 1);
      const categoryTruncated = products.length > CATEGORY_STAT_COUNT_LIMIT;
      const count = Math.min(products.length, CATEGORY_STAT_COUNT_LIMIT);

      scanned += products.length;
      if (categoryTruncated) {
        truncated = true;
      }

      if (count > 0) {
        counts.set(category.naam, { count, truncated: categoryTruncated });
      }
    }

    const result = [...counts.entries()]
      .map(([name, value]) => ({ name, count: value.count, truncated: value.truncated }))
      .sort((a, b) => {
        const ai = categoryOrder.indexOf(a.name);
        const bi = categoryOrder.indexOf(b.name);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.name.localeCompare(b.name, "nl");
      });

    return { categories: result, scanned, truncated };
  }
});

export const listProductsForPortal = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    categories: v.optional(v.array(v.string())), // meerdere categorieën (productGroup-filter)
    status: v.optional(productStatus),
    includePilotHidden: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    // Categorieën en leveranciers zijn kleine tabellen — altijd veilig om te collecten
    const [categories, suppliers] = await Promise.all([
      ctx.db
        .query("categories")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
    ]);

    // Bepaal categoriefilter vóór het laden van producten
    const categoryFilter = args.category && args.category !== "Alle" ? args.category : "";
    const targetCategory = categoryFilter
      ? categories.find((c) => c.naam === categoryFilter) ?? null
      : null;
    const pageSize = Math.min(Math.max(args.limit ?? 300, 25), 500);
    const limit = pageSize;

    if (categoryFilter && !targetCategory) {
      return {
        items: [],
        total: 0,
        limit,
        categories: [] as { name: string; count: number }[],
        isDone: true,
        continueCursor: "",
        scannedProducts: 0
      };
    }

    const categoryById = new Map<string, CategoryDoc>(
      categories.map((category) => [String(category._id), category])
    );
    const supplierById = new Map<string, SupplierDoc>(
      suppliers.map((supplier) => [String(supplier._id), supplier])
    );
    const requestedStatus = args.status ?? "active";
    const includePilotHidden = args.includePilotHidden ?? false;
    const search = (args.search ?? "").trim().toLowerCase();
    const selected: ProductDoc[] = [];
    const cursor = args.cursor ?? null;
    // Multi-categorie filter op basis van productGroup-mapping
    const allowedCategoryNames: Set<string> | null =
      args.categories && args.categories.length > 0
        ? new Set(args.categories)
        : null;
    const paginated = targetCategory
      ? await ctx.db
          .query("products")
          .withIndex("by_category_status", (q) =>
            q.eq("tenantId", tenant._id).eq("categorieId", targetCategory._id).eq("status", requestedStatus)
          )
          .paginate({ numItems: pageSize, cursor })
      : await ctx.db
          .query("products")
          .withIndex("by_status", (q) =>
            q.eq("tenantId", tenant._id).eq("status", requestedStatus)
          )
          .paginate({ numItems: pageSize, cursor });
    const scannedProducts = paginated.page.length;
    const isDone = paginated.isDone;
    const continueCursor = paginated.continueCursor;

    for (const product of paginated.page) {
      const categoryName = categoryById.get(String(product.categorieId))?.naam ?? "Overig";
      const supplierName = product.leverancierId
        ? supplierById.get(String(product.leverancierId))?.naam ?? ""
        : "";

      if (
        productMatchesPortalFilters({
          product,
          categoryName,
          supplierName,
          requestedStatus,
          includePilotHidden,
          search,
          categoryFilter,
          allowedCategoryNames
        })
      ) {
        selected.push(product);
      }

      if (selected.length >= pageSize) {
        break;
      }
    }
    selected.sort((left, right) => {
      const leftCategory = categoryById.get(String(left.categorieId))?.naam ?? "";
      const rightCategory = categoryById.get(String(right.categorieId))?.naam ?? "";
      return `${leftCategory} ${left.naam}`.localeCompare(`${rightCategory} ${right.naam}`, "nl");
    });

    const now = Date.now();
    const items = await Promise.all(
      selected.map(async (product): Promise<PortalProduct> => {
        const prices = await ctx.db
          .query("productPrices")
          .withIndex("by_product", (q) =>
            q.eq("tenantId", tenant._id).eq("productId", product._id)
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
          ? supplierById.get(String(product.leverancierId))?.naam ?? "Onbekend"
          : "Onbekend";
        const hiddenReason = pilotHiddenReason(product, categoryName);

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
          pakinhoudM2: product.pakinhoudM2,
          stuksPerPak: product.stuksPerPak,
          pakkenPerPallet: product.pakkenPerPallet,
          palletAantal: product.palletAantal,
          vrachtwagenAantal: product.vrachtwagenAantal,
          bundelGrootte: product.bundelGrootte,
          prijsExBtw: preferredPrice?.unitPriceExVat ?? 0,
          btwTarief: preferredPrice?.vatRate ?? 21,
          pilotHiddenReason: args.includePilotHidden ? hiddenReason : undefined,
          status: normalizedProductStatus(product.status)
        };
      })
    );

    return {
      items,
      total: items.length,
      limit,
      // Categorie-tellingen komen via de aparte listCategoryStats query
      categories: [] as { name: string; count: number }[],
      isDone,
      continueCursor,
      scannedProducts
    };
  }
});

export const updateProductForPortal = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    productId: v.string(),
    naam: v.string(),
    artikelnummer: v.optional(v.string()),
    leverancierCode: v.optional(v.string()),
    commercieleCode: v.optional(v.string()),
    kleurnaam: v.optional(v.string()),
    leverancierProductGroep: v.optional(v.string()),
    pakinhoudM2: v.optional(v.number()),
    stuksPerPak: v.optional(v.number()),
    status: productStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const product = await ctx.db.get(args.productId as Id<"products">);

    if (!product || product.tenantId !== tenant._id) {
      throw new ConvexError("Product niet gevonden.");
    }

    const patch: Partial<Doc<"products">> = {
      naam: args.naam,
      status: args.status,
      gewijzigdOp: Date.now()
    };

    if (hasArg(args, "artikelnummer")) patch.artikelnummer = args.artikelnummer;
    if (hasArg(args, "leverancierCode")) patch.leverancierCode = args.leverancierCode;
    if (hasArg(args, "commercieleCode")) patch.commercieleCode = args.commercieleCode;
    if (hasArg(args, "kleurnaam")) patch.kleurnaam = args.kleurnaam;
    if (hasArg(args, "leverancierProductGroep")) {
      patch.leverancierProductGroep = args.leverancierProductGroep;
    }
    if (hasArg(args, "pakinhoudM2")) patch.pakinhoudM2 = args.pakinhoudM2;
    if (hasArg(args, "stuksPerPak")) patch.stuksPerPak = args.stuksPerPak;

    await ctx.db.patch(product._id, patch);

    return product._id;
  }
});

export const listCollections = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator,
    leverancierId: v.optional(v.id("suppliers"))
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

    if (args.leverancierId) {
      return await ctx.db
        .query("productCollections")
        .withIndex("by_supplier", (q) =>
          q.eq("tenantId", args.tenantId).eq("leverancierId", args.leverancierId!)
        )
        .collect();
    }

    return await ctx.db
      .query("productCollections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});

export const createProduct = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    categorieId: v.id("categories"),
    leverancierId: v.optional(v.id("suppliers")),
    merkId: v.optional(v.id("brands")),
    collectieId: v.optional(v.id("productCollections")),
    importSleutel: v.optional(v.string()),
    artikelnummer: v.optional(v.string()),
    ean: v.optional(v.string()),
    sku: v.optional(v.string()),
    leverancierCode: v.optional(v.string()),
    commercieleCode: v.optional(v.string()),
    leverancierProductGroep: v.optional(v.string()),
    naam: v.string(),
    kleurnaam: v.optional(v.string()),
    omschrijving: v.optional(v.string()),
    productSoort: productKind,
    commercialNames: v.optional(
      v.array(
        v.object({
          merknaam: v.string(),
          collectieNaam: v.optional(v.string()),
          kleurnaam: v.optional(v.string()),
          weergaveNaam: v.string()
        })
      )
    ),
    eenheid: unit,
    breedteMm: v.optional(v.number()),
    lengteMm: v.optional(v.number()),
    dikteMm: v.optional(v.number()),
    slijtlaagMm: v.optional(v.number()),
    pakinhoudM2: v.optional(v.number()),
    stuksPerPak: v.optional(v.number()),
    pakkenPerPallet: v.optional(v.number()),
    verkoopEenheid: v.optional(v.string()),
    inkoopEenheid: v.optional(v.string()),
    bestelEenheid: v.optional(v.string()),
    minimumBestelAantal: v.optional(v.number()),
    bestelVeelvoud: v.optional(v.number()),
    palletAantal: v.optional(v.number()),
    vrachtwagenAantal: v.optional(v.number()),
    bundelGrootte: v.optional(v.number()),
    attributen: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const category = await ctx.db.get(args.categorieId);

    if (!category || category.tenantId !== args.tenantId) {
      throw new ConvexError("Productgroep niet gevonden.");
    }

    if (args.leverancierId) {
      const supplier = await ctx.db.get(args.leverancierId);

      if (!supplier || supplier.tenantId !== args.tenantId) {
        throw new ConvexError("Leverancier niet gevonden.");
      }
    }

    if (args.importSleutel) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_import_key", (q) =>
          q.eq("tenantId", args.tenantId).eq("importSleutel", args.importSleutel)
        )
        .first();

      if (existing) {
        return existing._id;
      }
    }

    if (args.artikelnummer && args.leverancierId) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_article_number", (q) =>
          q
            .eq("tenantId", args.tenantId)
            .eq("leverancierId", args.leverancierId)
            .eq("artikelnummer", args.artikelnummer)
        )
        .first();

      if (existing) {
        return existing._id;
      }
    }

    const now = Date.now();

    return await ctx.db.insert("products", {
      tenantId: args.tenantId,
      categorieId: args.categorieId,
      leverancierId: args.leverancierId,
      merkId: args.merkId,
      collectieId: args.collectieId,
      importSleutel: args.importSleutel,
      artikelnummer: args.artikelnummer,
      ean: args.ean,
      sku: args.sku,
      leverancierCode: args.leverancierCode,
      commercieleCode: args.commercieleCode,
      leverancierProductGroep: args.leverancierProductGroep,
      naam: args.naam,
      kleurnaam: args.kleurnaam,
      omschrijving: args.omschrijving,
      productAard:
        args.productSoort === "curtain" ||
        args.productSoort === "fabric" ||
        args.productSoort === "curtain_fabric" ||
        args.productSoort === "vitrage" ||
        args.productSoort === "roman_blind_fabric" ||
        args.productSoort === "panel_curtain_fabric"
          ? "made_to_measure"
          : "standard",
      productSoort: args.productSoort,
      commercialNames: args.commercialNames,
      eenheid: args.eenheid,
      breedteMm: args.breedteMm,
      lengteMm: args.lengteMm,
      dikteMm: args.dikteMm,
      slijtlaagMm: args.slijtlaagMm,
      pakinhoudM2: args.pakinhoudM2,
      stuksPerPak: args.stuksPerPak,
      pakkenPerPallet: args.pakkenPerPallet,
      verkoopEenheid: args.verkoopEenheid,
      inkoopEenheid: args.inkoopEenheid,
      bestelEenheid: args.bestelEenheid,
      minimumBestelAantal: args.minimumBestelAantal,
      bestelVeelvoud: args.bestelVeelvoud,
      palletAantal: args.palletAantal,
      vrachtwagenAantal: args.vrachtwagenAantal,
      bundelGrootte: args.bundelGrootte,
      attributen: args.attributen,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const addPrice = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    productId: v.id("products"),
    prijslijstId: v.optional(v.id("priceLists")),
    bronSleutel: v.optional(v.string()),
    prijsSoort: priceType,
    prijsEenheid: priceUnit,
    bedrag: v.number(),
    btwTarief: v.number(),
    btwModus: vatMode,
    currency: v.optional(v.string()),
    geldigVanaf: v.optional(v.number()),
    geldigTot: v.optional(v.number()),
    bronBestandsnaam: v.optional(v.string()),
    bronBladNaam: v.optional(v.string()),
    bronKolomNaam: v.optional(v.string()),
    bronKolomIndex: v.optional(v.number()),
    bronRijNummer: v.optional(v.number()),
    bronWaarde: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const product = await ctx.db.get(args.productId);

    if (!product || product.tenantId !== args.tenantId) {
      throw new ConvexError("Product niet gevonden.");
    }

    const now = Date.now();

    if (args.bronSleutel) {
      // Dedup alleen binnen hetzelfde product: sourceKey is niet product-uniek, dus een
      // blinde .first()+patch zou een bestaande prijs naar een ander product verhangen
      // (zelfde fix als de import-pijplijn in catalog/import.ts).
      const sourceKeyMatches = await ctx.db
        .query("productPrices")
        .withIndex("by_source_key", (q) =>
          q.eq("tenantId", args.tenantId).eq("bronSleutel", args.bronSleutel)
        )
        .collect();
      const existing = sourceKeyMatches.find((row) => row.productId === args.productId);

      if (existing) {
        await ctx.db.patch(existing._id, {
          productId: args.productId,
          prijslijstId: args.prijslijstId,
          prijsSoort: args.prijsSoort,
          prijsEenheid: args.prijsEenheid,
          bedrag: args.bedrag,
          btwTarief: args.btwTarief,
          btwModus: args.btwModus,
          currency: args.currency ?? "EUR",
          geldigVanaf: args.geldigVanaf,
          geldigTot: args.geldigTot,
          bronBestandsnaam: args.bronBestandsnaam,
          bronBladNaam: args.bronBladNaam,
          bronKolomNaam: args.bronKolomNaam,
          bronKolomIndex: args.bronKolomIndex,
          bronRijNummer: args.bronRijNummer,
          bronWaarde: args.bronWaarde,
          gewijzigdOp: now
        });

        return existing._id;
      }
    }

    return await ctx.db.insert("productPrices", {
      tenantId: args.tenantId,
      productId: args.productId,
      prijslijstId: args.prijslijstId,
      bronSleutel: args.bronSleutel,
      prijsSoort: args.prijsSoort,
      prijsEenheid: args.prijsEenheid,
      bedrag: args.bedrag,
      btwTarief: args.btwTarief,
      btwModus: args.btwModus,
      currency: args.currency ?? "EUR",
      geldigVanaf: args.geldigVanaf,
      geldigTot: args.geldigTot,
      bronBestandsnaam: args.bronBestandsnaam,
      bronBladNaam: args.bronBladNaam,
      bronKolomNaam: args.bronKolomNaam,
      bronKolomIndex: args.bronKolomIndex,
      bronRijNummer: args.bronRijNummer,
      bronWaarde: args.bronWaarde,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});
