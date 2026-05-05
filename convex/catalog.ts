import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRole, requireMutationRoleForTenantId } from "./authz";
import type { Doc, Id } from "./_generated/dataModel";

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

const pricePriority = [
  "advice_retail",
  "retail",
  "pallet",
  "commission",
  "net_purchase",
  "purchase",
  "manual"
];

export const listProducts = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(productStatus),
    categoryId: v.optional(v.id("categories"))
  },
  handler: async (ctx, args) => {
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
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      return 0;
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();

    return products.filter((product) => normalizedProductStatus(product.status) === "active").length;
  }
});

export const listProductsForPortal = query({
  args: {
    tenantSlug: v.string(),
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(productStatus),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      return {
        items: [],
        total: 0,
        limit: args.limit ?? 300,
        categories: []
      };
    }

    const [categories, suppliers, products] = await Promise.all([
      ctx.db
        .query("categories")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("products")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect()
    ]);

    const categoryById = new Map(categories.map((category) => [String(category._id), category]));
    const supplierById = new Map(suppliers.map((supplier) => [String(supplier._id), supplier]));
    const requestedStatus = args.status ?? "active";
    const activeProducts = products.filter(
      (product) => normalizedProductStatus(product.status) === requestedStatus
    );
    const categoryCounts = new Map<string, number>();
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
      "Winkelvoorraad",
      "Overig"
    ];

    for (const product of activeProducts) {
      const categoryName = categoryById.get(String(product.categoryId))?.name ?? "Overig";
      categoryCounts.set(categoryName, (categoryCounts.get(categoryName) ?? 0) + 1);
    }

    const categoryFilters = [...categoryCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => {
        const leftIndex = categoryOrder.indexOf(left.name);
        const rightIndex = categoryOrder.indexOf(right.name);
        return (
          (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex) ||
          left.name.localeCompare(right.name, "nl")
        );
      });
    const search = (args.search ?? "").trim().toLowerCase();
    const categoryFilter = args.category && args.category !== "Alle" ? args.category : "";
    const filtered = activeProducts
      .filter((product) => {
        const categoryName = categoryById.get(String(product.categoryId))?.name ?? "Overig";

        if (categoryFilter && categoryName !== categoryFilter) {
          return false;
        }

        if (!search) {
          return true;
        }

        const supplierName = product.supplierId
          ? supplierById.get(String(product.supplierId))?.name
          : "";
        const labels = product.commercialNames
          ?.map((name) => name.displayName)
          .join(" ");
        const haystack = [
          product.name,
          product.articleNumber,
          product.supplierCode,
          product.commercialCode,
          product.supplierProductGroup,
          product.ean,
          product.colorName,
          supplierName,
          categoryName,
          labels
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      })
      .sort((left, right) => {
        const leftCategory = categoryById.get(String(left.categoryId))?.name ?? "";
        const rightCategory = categoryById.get(String(right.categoryId))?.name ?? "";
        return `${leftCategory} ${left.name}`.localeCompare(`${rightCategory} ${right.name}`, "nl");
      });

    const limit = Math.min(Math.max(args.limit ?? 300, 25), 2000);
    const selected = filtered.slice(0, limit);
    const items = [];

    for (const product of selected) {
      const prices = await ctx.db
        .query("productPrices")
        .withIndex("by_product", (q) =>
          q.eq("tenantId", tenant._id).eq("productId", product._id)
        )
        .collect();
      const preferredPrice = prices.sort((left, right) => {
        const leftPriority = pricePriority.indexOf(left.priceType);
        const rightPriority = pricePriority.indexOf(right.priceType);
        return (
          (leftPriority === -1 ? 999 : leftPriority) -
            (rightPriority === -1 ? 999 : rightPriority) ||
          right.updatedAt - left.updatedAt
        );
      })[0];
      const categoryName = categoryById.get(String(product.categoryId))?.name ?? "Overig";
      const supplierName = product.supplierId
        ? supplierById.get(String(product.supplierId))?.name ?? "Onbekend"
        : "Onbekend";

      items.push({
        id: String(product._id),
        tenantId: tenant.slug,
        category: categoryName,
        supplier: supplierName,
        articleNumber: product.articleNumber,
        supplierCode: product.supplierCode,
        commercialCode: product.commercialCode,
        supplierProductGroup: product.supplierProductGroup,
        name: product.name,
        colorName: product.colorName,
        productKind: product.productKind,
        commercialNames: product.commercialNames,
        unit: product.unit,
        packageContentM2: product.packageContentM2,
        piecesPerPackage: product.piecesPerPackage,
        packagesPerPallet: product.packagesPerPallet,
        palletQuantity: product.palletQuantity,
        trailerQuantity: product.trailerQuantity,
        bundleSize: product.bundleSize,
        priceExVat: preferredPrice?.amount ?? 0,
        vatRate: preferredPrice?.vatRate ?? 21,
        status: normalizedProductStatus(product.status)
      });
    }

    return {
      items,
      total: filtered.length,
      limit,
      categories: categoryFilters
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
    supplierId: v.optional(v.id("suppliers"))
  },
  handler: async (ctx, args) => {
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
