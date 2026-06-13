import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRole,
  requireMutationRoleForTenantId,
  requireQueryRole,
  requireQueryRoleForTenantId
} from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import {
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
    categoryId: v.optional(v.id("categories"))
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

    if (args.categoryId) {
      return await ctx.db
        .query("products")
        .withIndex("by_category", (q) =>
          q.eq("tenantId", args.tenantId).eq("categoryId", args.categoryId!)
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
    ?.map((name) => name.displayName)
    .join(" ");
  const haystack = [
    product.name,
    customerName,
    product.articleNumber,
    product.supplierCode,
    product.commercialCode,
    product.supplierProductGroup,
    product.ean,
    product.colorName,
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
          q.eq("tenantId", tenant._id).eq("categoryId", category._id).eq("status", requestedStatus)
        )
        .take(CATEGORY_STAT_COUNT_LIMIT + 1);
      const categoryTruncated = products.length > CATEGORY_STAT_COUNT_LIMIT;
      const count = Math.min(products.length, CATEGORY_STAT_COUNT_LIMIT);

      scanned += products.length;
      if (categoryTruncated) {
        truncated = true;
      }

      if (count > 0) {
        counts.set(category.name, { count, truncated: categoryTruncated });
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
      ? categories.find((c) => c.name === categoryFilter) ?? null
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
            q.eq("tenantId", tenant._id).eq("categoryId", targetCategory._id).eq("status", requestedStatus)
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
      const categoryName = categoryById.get(String(product.categoryId))?.name ?? "Overig";
      const supplierName = product.supplierId
        ? supplierById.get(String(product.supplierId))?.name ?? ""
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
      const leftCategory = categoryById.get(String(left.categoryId))?.name ?? "";
      const rightCategory = categoryById.get(String(right.categoryId))?.name ?? "";
      return `${leftCategory} ${left.name}`.localeCompare(`${rightCategory} ${right.name}`, "nl");
    });

    const now = Date.now();
    const items = await Promise.all(
      selected.map(async (product) => {
        const prices = await ctx.db
          .query("productPrices")
          .withIndex("by_product", (q) =>
            q.eq("tenantId", tenant._id).eq("productId", product._id)
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
        const hiddenReason = pilotHiddenReason(product, categoryName);

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
    name: v.string(),
    articleNumber: v.optional(v.string()),
    supplierCode: v.optional(v.string()),
    commercialCode: v.optional(v.string()),
    colorName: v.optional(v.string()),
    supplierProductGroup: v.optional(v.string()),
    packageContentM2: v.optional(v.number()),
    piecesPerPackage: v.optional(v.number()),
    status: productStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const product = await ctx.db.get(args.productId as Id<"products">);

    if (!product || product.tenantId !== tenant._id) {
      throw new Error("Product not found");
    }

    const patch: Partial<Doc<"products">> = {
      name: args.name,
      status: args.status,
      updatedAt: Date.now()
    };

    if (hasArg(args, "articleNumber")) patch.articleNumber = args.articleNumber;
    if (hasArg(args, "supplierCode")) patch.supplierCode = args.supplierCode;
    if (hasArg(args, "commercialCode")) patch.commercialCode = args.commercialCode;
    if (hasArg(args, "colorName")) patch.colorName = args.colorName;
    if (hasArg(args, "supplierProductGroup")) {
      patch.supplierProductGroup = args.supplierProductGroup;
    }
    if (hasArg(args, "packageContentM2")) patch.packageContentM2 = args.packageContentM2;
    if (hasArg(args, "piecesPerPackage")) patch.piecesPerPackage = args.piecesPerPackage;

    await ctx.db.patch(product._id, patch);

    return product._id;
  }
});

export const listCollections = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator,
    supplierId: v.optional(v.id("suppliers"))
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);

    if (args.supplierId) {
      return await ctx.db
        .query("productCollections")
        .withIndex("by_supplier", (q) =>
          q.eq("tenantId", args.tenantId).eq("supplierId", args.supplierId!)
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
    categoryId: v.id("categories"),
    supplierId: v.optional(v.id("suppliers")),
    brandId: v.optional(v.id("brands")),
    collectionId: v.optional(v.id("productCollections")),
    importKey: v.optional(v.string()),
    articleNumber: v.optional(v.string()),
    ean: v.optional(v.string()),
    sku: v.optional(v.string()),
    supplierCode: v.optional(v.string()),
    commercialCode: v.optional(v.string()),
    supplierProductGroup: v.optional(v.string()),
    name: v.string(),
    colorName: v.optional(v.string()),
    description: v.optional(v.string()),
    productKind,
    commercialNames: v.optional(
      v.array(
        v.object({
          brandName: v.string(),
          collectionName: v.optional(v.string()),
          colorName: v.optional(v.string()),
          displayName: v.string()
        })
      )
    ),
    unit,
    widthMm: v.optional(v.number()),
    lengthMm: v.optional(v.number()),
    thicknessMm: v.optional(v.number()),
    wearLayerMm: v.optional(v.number()),
    packageContentM2: v.optional(v.number()),
    piecesPerPackage: v.optional(v.number()),
    packagesPerPallet: v.optional(v.number()),
    salesUnit: v.optional(v.string()),
    purchaseUnit: v.optional(v.string()),
    orderUnit: v.optional(v.string()),
    minimumOrderQuantity: v.optional(v.number()),
    orderMultiple: v.optional(v.number()),
    palletQuantity: v.optional(v.number()),
    trailerQuantity: v.optional(v.number()),
    bundleSize: v.optional(v.number()),
    attributes: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const category = await ctx.db.get(args.categoryId);

    if (!category || category.tenantId !== args.tenantId) {
      throw new Error("Category not found");
    }

    if (args.supplierId) {
      const supplier = await ctx.db.get(args.supplierId);

      if (!supplier || supplier.tenantId !== args.tenantId) {
        throw new Error("Supplier not found");
      }
    }

    if (args.importKey) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_import_key", (q) =>
          q.eq("tenantId", args.tenantId).eq("importKey", args.importKey)
        )
        .first();

      if (existing) {
        return existing._id;
      }
    }

    if (args.articleNumber && args.supplierId) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_article_number", (q) =>
          q
            .eq("tenantId", args.tenantId)
            .eq("supplierId", args.supplierId)
            .eq("articleNumber", args.articleNumber)
        )
        .first();

      if (existing) {
        return existing._id;
      }
    }

    const now = Date.now();

    return await ctx.db.insert("products", {
      tenantId: args.tenantId,
      categoryId: args.categoryId,
      supplierId: args.supplierId,
      brandId: args.brandId,
      collectionId: args.collectionId,
      importKey: args.importKey,
      articleNumber: args.articleNumber,
      ean: args.ean,
      sku: args.sku,
      supplierCode: args.supplierCode,
      commercialCode: args.commercialCode,
      supplierProductGroup: args.supplierProductGroup,
      name: args.name,
      colorName: args.colorName,
      description: args.description,
      productType:
        args.productKind === "curtain" ||
        args.productKind === "fabric" ||
        args.productKind === "curtain_fabric" ||
        args.productKind === "vitrage" ||
        args.productKind === "roman_blind_fabric" ||
        args.productKind === "panel_curtain_fabric"
          ? "made_to_measure"
          : "standard",
      productKind: args.productKind,
      commercialNames: args.commercialNames,
      unit: args.unit,
      widthMm: args.widthMm,
      lengthMm: args.lengthMm,
      thicknessMm: args.thicknessMm,
      wearLayerMm: args.wearLayerMm,
      packageContentM2: args.packageContentM2,
      piecesPerPackage: args.piecesPerPackage,
      packagesPerPallet: args.packagesPerPallet,
      salesUnit: args.salesUnit,
      purchaseUnit: args.purchaseUnit,
      orderUnit: args.orderUnit,
      minimumOrderQuantity: args.minimumOrderQuantity,
      orderMultiple: args.orderMultiple,
      palletQuantity: args.palletQuantity,
      trailerQuantity: args.trailerQuantity,
      bundleSize: args.bundleSize,
      attributes: args.attributes,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const addPrice = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    productId: v.id("products"),
    priceListId: v.optional(v.id("priceLists")),
    sourceKey: v.optional(v.string()),
    priceType,
    priceUnit,
    amount: v.number(),
    vatRate: v.number(),
    vatMode,
    currency: v.optional(v.string()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    sourceFileName: v.optional(v.string()),
    sourceSheetName: v.optional(v.string()),
    sourceColumnName: v.optional(v.string()),
    sourceColumnIndex: v.optional(v.number()),
    sourceRowNumber: v.optional(v.number()),
    sourceValue: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const product = await ctx.db.get(args.productId);

    if (!product || product.tenantId !== args.tenantId) {
      throw new Error("Product not found");
    }

    const now = Date.now();

    if (args.sourceKey) {
      const existing = await ctx.db
        .query("productPrices")
        .withIndex("by_source_key", (q) =>
          q.eq("tenantId", args.tenantId).eq("sourceKey", args.sourceKey)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          productId: args.productId,
          priceListId: args.priceListId,
          priceType: args.priceType,
          priceUnit: args.priceUnit,
          amount: args.amount,
          vatRate: args.vatRate,
          vatMode: args.vatMode,
          currency: args.currency ?? "EUR",
          validFrom: args.validFrom,
          validUntil: args.validUntil,
          sourceFileName: args.sourceFileName,
          sourceSheetName: args.sourceSheetName,
          sourceColumnName: args.sourceColumnName,
          sourceColumnIndex: args.sourceColumnIndex,
          sourceRowNumber: args.sourceRowNumber,
          sourceValue: args.sourceValue,
          updatedAt: now
        });

        return existing._id;
      }
    }

    return await ctx.db.insert("productPrices", {
      tenantId: args.tenantId,
      productId: args.productId,
      priceListId: args.priceListId,
      sourceKey: args.sourceKey,
      priceType: args.priceType,
      priceUnit: args.priceUnit,
      amount: args.amount,
      vatRate: args.vatRate,
      vatMode: args.vatMode,
      currency: args.currency ?? "EUR",
      validFrom: args.validFrom,
      validUntil: args.validUntil,
      sourceFileName: args.sourceFileName,
      sourceSheetName: args.sourceSheetName,
      sourceColumnName: args.sourceColumnName,
      sourceColumnIndex: args.sourceColumnIndex,
      sourceRowNumber: args.sourceRowNumber,
      sourceValue: args.sourceValue,
      createdAt: now,
      updatedAt: now
    });
  }
});
