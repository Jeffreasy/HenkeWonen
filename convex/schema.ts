import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(
  v.literal("viewer"),
  v.literal("user"),
  v.literal("editor"),
  v.literal("admin")
);

const statusActive = v.union(v.literal("active"), v.literal("inactive"));

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

const vatMode = v.union(
  v.literal("exclusive"),
  v.literal("inclusive"),
  v.literal("unknown")
);

const quoteLineType = v.union(
  v.literal("product"),
  v.literal("service"),
  v.literal("labor"),
  v.literal("material"),
  v.literal("discount"),
  v.literal("text"),
  v.literal("manual")
);

const measurementStatus = v.union(
  v.literal("draft"),
  v.literal("measured"),
  v.literal("reviewed"),
  v.literal("converted_to_quote")
);

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

const measurementCalculationType = v.union(
  v.literal("area"),
  v.literal("perimeter"),
  v.literal("rolls"),
  v.literal("panels"),
  v.literal("stairs"),
  v.literal("manual")
);

const quotePreparationStatus = v.union(
  v.literal("draft"),
  v.literal("ready_for_quote"),
  v.literal("converted")
);

export default defineSchema({
  tenants: defineTable({
    slug: v.string(),
    name: v.string(),
    status: statusActive,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  users: defineTable({
    tenantId: v.id("tenants"),
    externalUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_external_user", ["externalUserId"])
    .index("by_email", ["email"]),

  customers: defineTable({
    tenantId: v.id("tenants"),
    customerNumber: v.optional(v.string()),
    type: v.union(v.literal("private"), v.literal("business")),
    displayName: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    companyName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    houseNumber: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("lead"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived")
    ),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["tenantId", "status"])
    .searchIndex("search_customer", {
      searchField: "displayName",
      filterFields: ["tenantId", "status"]
    }),

  customerContacts: defineTable({
    tenantId: v.id("tenants"),
    customerId: v.id("customers"),
    type: v.union(
      v.literal("note"),
      v.literal("call"),
      v.literal("email"),
      v.literal("visit"),
      v.literal("loaned_item"),
      v.literal("agreement")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    loanedItemName: v.optional(v.string()),
    expectedReturnDate: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    visibleToCustomer: v.boolean(),
    createdByExternalUserId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_customer", ["tenantId", "customerId"])
    .index("by_type", ["tenantId", "type"]),

  categories: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    slug: v.string(),
    parentCategoryId: v.optional(v.id("categories")),
    sortOrder: v.number(),
    status: statusActive,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_slug", ["tenantId", "slug"])
    .index("by_parent", ["tenantId", "parentCategoryId"]),

  suppliers: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    productListStatus: v.union(
      v.literal("unknown"),
      v.literal("requested"),
      v.literal("received"),
      v.literal("download_available"),
      v.literal("not_available"),
      v.literal("manual_only")
    ),
    lastContactAt: v.optional(v.number()),
    expectedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_product_list_status", ["tenantId", "productListStatus"])
    .searchIndex("search_supplier", {
      searchField: "name",
      filterFields: ["tenantId", "productListStatus"]
    }),

  brands: defineTable({
    tenantId: v.id("tenants"),
    supplierId: v.optional(v.id("suppliers")),
    categoryId: v.optional(v.id("categories")),
    name: v.string(),
    notes: v.optional(v.string()),
    status: statusActive,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_supplier", ["tenantId", "supplierId"])
    .index("by_category", ["tenantId", "categoryId"]),

  productCollections: defineTable({
    tenantId: v.id("tenants"),
    supplierId: v.optional(v.id("suppliers")),
    brandId: v.optional(v.id("brands")),
    categoryId: v.optional(v.id("categories")),
    name: v.string(),
    year: v.optional(v.number()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_supplier", ["tenantId", "supplierId"])
    .index("by_brand", ["tenantId", "brandId"])
    .index("by_category", ["tenantId", "categoryId"]),

  products: defineTable({
    tenantId: v.id("tenants"),
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
    productType: v.union(
      v.literal("standard"),
      v.literal("with_variants"),
      v.literal("made_to_measure"),
      v.literal("service"),
      v.literal("manual")
    ),
    productKind: v.optional(
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
    ),
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
    attributes: v.optional(v.any()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived")
    ),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_category", ["tenantId", "categoryId"])
    .index("by_supplier", ["tenantId", "supplierId"])
    .index("by_brand", ["tenantId", "brandId"])
    .index("by_collection", ["tenantId", "collectionId"])
    .index("by_status", ["tenantId", "status"])
    .index("by_import_key", ["tenantId", "importKey"])
    .index("by_article_number", ["tenantId", "supplierId", "articleNumber"])
    .index("by_supplier_code", ["tenantId", "supplierId", "supplierCode"])
    .index("by_ean", ["tenantId", "ean"])
    .searchIndex("search_products", {
      searchField: "name",
      filterFields: ["tenantId", "categoryId", "status"]
    }),

  priceLists: defineTable({
    tenantId: v.id("tenants"),
    supplierId: v.optional(v.id("suppliers")),
    name: v.string(),
    sourceFileName: v.string(),
    sourceSheetName: v.optional(v.string()),
    year: v.optional(v.number()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    status: v.union(
      v.literal("uploaded"),
      v.literal("mapped"),
      v.literal("previewed"),
      v.literal("imported"),
      v.literal("failed"),
      v.literal("archived")
    ),
    sourcePath: v.optional(v.string()),
    fileHash: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_supplier", ["tenantId", "supplierId"])
    .index("by_status", ["tenantId", "status"]),

  productPrices: defineTable({
    tenantId: v.id("tenants"),
    productId: v.id("products"),
    priceListId: v.optional(v.id("priceLists")),
    sourceKey: v.optional(v.string()),
    priceType,
    priceUnit,
    amount: v.number(),
    vatRate: v.number(),
    vatMode,
    currency: v.string(),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    sourceFileName: v.optional(v.string()),
    sourceSheetName: v.optional(v.string()),
    sourceColumnName: v.optional(v.string()),
    sourceColumnIndex: v.optional(v.number()),
    sourceRowNumber: v.optional(v.number()),
    sourceValue: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_product", ["tenantId", "productId"])
    .index("by_price_list", ["tenantId", "priceListId"])
    .index("by_source_key", ["tenantId", "sourceKey"])
    .index("by_source_file_column", ["tenantId", "sourceFileName", "sourceColumnIndex"])
    .index("by_price_type", ["tenantId", "priceType"]),

  productImportBatches: defineTable({
    tenantId: v.id("tenants"),
    priceListId: v.optional(v.id("priceLists")),
    supplierId: v.optional(v.id("suppliers")),
    importProfileId: v.optional(v.id("importProfiles")),
    fileName: v.string(),
    fileType: v.string(),
    sourceFileName: v.optional(v.string()),
    sourcePath: v.optional(v.string()),
    fileHash: v.optional(v.string()),
    status: v.union(
      v.literal("uploaded"),
      v.literal("analyzing"),
      v.literal("needs_mapping"),
      v.literal("ready_to_import"),
      v.literal("importing"),
      v.literal("imported"),
      v.literal("failed")
    ),
    totalRows: v.number(),
    previewRows: v.optional(v.number()),
    productRows: v.optional(v.number()),
    validRows: v.number(),
    warningRows: v.number(),
    errorRows: v.number(),
    ignoredRows: v.optional(v.number()),
    importedProducts: v.optional(v.number()),
    updatedProducts: v.optional(v.number()),
    skippedProducts: v.optional(v.number()),
    importedPrices: v.optional(v.number()),
    skippedPrices: v.optional(v.number()),
    duplicateProductMatches: v.optional(v.number()),
    zeroPriceRows: v.optional(v.number()),
    unknownVatModeRows: v.optional(v.number()),
    productsWithoutSupplierCode: v.optional(v.number()),
    orphanPriceRules: v.optional(v.number()),
    duplicateSourceKeys: v.optional(v.number()),
    allowUnknownVatMode: v.optional(v.boolean()),
    reconciliation: v.optional(v.any()),
    mapping: v.optional(v.any()),
    createdByExternalUserId: v.optional(v.string()),
    importedByExternalUserId: v.optional(v.string()),
    importedAt: v.optional(v.number()),
    committedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_supplier", ["tenantId", "supplierId"])
    .index("by_status", ["tenantId", "status"]),

  productImportRows: defineTable({
    tenantId: v.id("tenants"),
    batchId: v.id("productImportBatches"),
    sourceFileName: v.optional(v.string()),
    sourceSheetName: v.optional(v.string()),
    rowNumber: v.number(),
    rowHash: v.optional(v.string()),
    importKey: v.optional(v.string()),
    sourceKey: v.optional(v.string()),
    raw: v.any(),
    normalized: v.optional(v.any()),
    status: v.union(
      v.literal("valid"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("ignored"),
      v.literal("imported")
    ),
    rowKind: v.union(
      v.literal("header"),
      v.literal("section"),
      v.literal("product"),
      v.literal("empty"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("ignored")
    ),
    sectionLabel: v.optional(v.string()),
    warnings: v.array(v.string()),
    errors: v.array(v.string()),
    importedProductId: v.optional(v.id("products")),
    importedPriceIds: v.optional(v.array(v.id("productPrices"))),
    importedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_batch", ["tenantId", "batchId"])
    .index("by_row_kind", ["tenantId", "batchId", "rowKind"])
    .index("by_status", ["tenantId", "batchId", "status"]),

  serviceCostRules: defineTable({
    tenantId: v.id("tenants"),
    categoryId: v.optional(v.id("categories")),
    name: v.string(),
    description: v.optional(v.string()),
    calculationType: v.union(
      v.literal("fixed"),
      v.literal("per_m2"),
      v.literal("per_meter"),
      v.literal("per_roll"),
      v.literal("per_side"),
      v.literal("per_staircase"),
      v.literal("manual")
    ),
    priceExVat: v.number(),
    vatRate: v.number(),
    minQuantity: v.optional(v.number()),
    maxQuantity: v.optional(v.number()),
    metadata: v.optional(v.any()),
    status: statusActive,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_category", ["tenantId", "categoryId"])
    .index("by_status", ["tenantId", "status"]),

  projects: defineTable({
    tenantId: v.id("tenants"),
    customerId: v.id("customers"),
    projectNumber: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("lead"),
      v.literal("quote_draft"),
      v.literal("quote_sent"),
      v.literal("quote_accepted"),
      v.literal("quote_rejected"),
      v.literal("measurement_planned"),
      v.literal("execution_planned"),
      v.literal("ordering"),
      v.literal("in_progress"),
      v.literal("invoiced"),
      v.literal("paid"),
      v.literal("closed"),
      v.literal("cancelled")
    ),
    preferredExecutionDate: v.optional(v.number()),
    measurementDate: v.optional(v.number()),
    executionDate: v.optional(v.number()),
    internalNotes: v.optional(v.string()),
    customerNotes: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
    measurementPlannedAt: v.optional(v.number()),
    executionPlannedAt: v.optional(v.number()),
    orderedAt: v.optional(v.number()),
    invoicedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_customer", ["tenantId", "customerId"])
    .index("by_status", ["tenantId", "status"])
    .index("by_execution_date", ["tenantId", "executionDate"]),

  projectRooms: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    name: v.string(),
    floor: v.optional(v.string()),
    widthCm: v.optional(v.number()),
    lengthCm: v.optional(v.number()),
    heightCm: v.optional(v.number()),
    areaM2: v.optional(v.number()),
    perimeterMeter: v.optional(v.number()),
    notes: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_project", ["tenantId", "projectId"]),

  measurements: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    customerId: v.id("customers"),
    status: measurementStatus,
    measurementDate: v.optional(v.number()),
    measuredBy: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_project", ["tenantId", "projectId"])
    .index("by_status", ["tenantId", "status"])
    .index("by_measurement_date", ["tenantId", "measurementDate"]),

  measurementRooms: defineTable({
    tenantId: v.id("tenants"),
    measurementId: v.id("measurements"),
    projectRoomId: v.optional(v.id("projectRooms")),
    name: v.string(),
    floor: v.optional(v.string()),
    widthM: v.optional(v.number()),
    lengthM: v.optional(v.number()),
    heightM: v.optional(v.number()),
    areaM2: v.optional(v.number()),
    perimeterM: v.optional(v.number()),
    notes: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_measurement", ["tenantId", "measurementId"])
    .index("by_project_room", ["tenantId", "projectRoomId"]),

  measurementLines: defineTable({
    tenantId: v.id("tenants"),
    measurementId: v.id("measurements"),
    roomId: v.optional(v.id("measurementRooms")),
    productGroup: measurementProductGroup,
    calculationType: measurementCalculationType,
    input: v.any(),
    result: v.any(),
    wastePercent: v.optional(v.number()),
    quantity: v.number(),
    unit: v.string(),
    notes: v.optional(v.string()),
    quoteLineType,
    quotePreparationStatus,
    convertedQuoteId: v.optional(v.id("quotes")),
    convertedQuoteLineId: v.optional(v.id("quoteLines")),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_measurement", ["tenantId", "measurementId"])
    .index("by_room", ["tenantId", "roomId"])
    .index("by_quote_status", ["tenantId", "quotePreparationStatus"])
    .index("by_product_group", ["tenantId", "productGroup"]),

  wasteProfiles: defineTable({
    tenantId: v.id("tenants"),
    productGroup: measurementProductGroup,
    name: v.string(),
    defaultWastePercent: v.number(),
    description: v.optional(v.string()),
    status: statusActive,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_product_group", ["tenantId", "productGroup"])
    .index("by_status", ["tenantId", "status"]),

  quotes: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    customerId: v.id("customers"),
    quoteNumber: v.string(),
    title: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
    validUntil: v.optional(v.number()),
    introText: v.optional(v.string()),
    closingText: v.optional(v.string()),
    terms: v.optional(v.array(v.string())),
    paymentTerms: v.optional(v.array(v.string())),
    subtotalExVat: v.number(),
    vatTotal: v.number(),
    totalIncVat: v.number(),
    acceptedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    createdByExternalUserId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["tenantId", "projectId"])
    .index("by_customer", ["tenantId", "customerId"])
    .index("by_quote_number", ["tenantId", "quoteNumber"])
    .index("by_status", ["tenantId", "status"]),

  quoteLines: defineTable({
    tenantId: v.id("tenants"),
    quoteId: v.id("quotes"),
    projectRoomId: v.optional(v.id("projectRooms")),
    productId: v.optional(v.id("products")),
    serviceCostRuleId: v.optional(v.id("serviceCostRules")),
    lineType: v.union(
      v.literal("product"),
      v.literal("service"),
      v.literal("labor"),
      v.literal("material"),
      v.literal("discount"),
      v.literal("text"),
      v.literal("manual")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    unitPriceExVat: v.number(),
    vatRate: v.number(),
    discountExVat: v.optional(v.number()),
    lineTotalExVat: v.number(),
    lineVatTotal: v.number(),
    lineTotalIncVat: v.number(),
    sortOrder: v.number(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_quote", ["tenantId", "quoteId"])
    .index("by_room", ["tenantId", "projectRoomId"]),

  quoteTemplates: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    type: v.union(
      v.literal("default"),
      v.literal("flooring"),
      v.literal("curtains"),
      v.literal("wall_panels"),
      v.literal("custom")
    ),
    introText: v.optional(v.string()),
    closingText: v.optional(v.string()),
    sections: v.optional(
      v.array(
        v.object({
          key: v.string(),
          title: v.string(),
          description: v.optional(v.string()),
          sortOrder: v.number()
        })
      )
    ),
    defaultTerms: v.array(v.string()),
    paymentTerms: v.optional(v.array(v.string())),
    defaultLines: v.array(
      v.object({
        sectionKey: v.optional(v.string()),
        lineType: quoteLineType,
        title: v.string(),
        unit: v.string(),
        description: v.optional(v.string()),
        defaultQuantity: v.optional(v.number()),
        sortOrder: v.number(),
        optional: v.optional(v.boolean()),
        defaultEnabled: v.optional(v.boolean()),
        categoryHint: v.optional(v.string()),
        productKindHint: v.optional(v.string())
      })
    ),
    status: statusActive,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_type", ["tenantId", "type"])
    .index("by_status", ["tenantId", "status"]),

  projectWorkflowEvents: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    type: v.union(
      v.literal("customer_contact"),
      v.literal("quote_created"),
      v.literal("measurement_requested"),
      v.literal("measurement_planned"),
      v.literal("quote_sent"),
      v.literal("quote_accepted"),
      v.literal("thank_you_letter_sent"),
      v.literal("execution_planned"),
      v.literal("supplier_order_created"),
      v.literal("invoice_created"),
      v.literal("payment_reminder_sent"),
      v.literal("payment_received"),
      v.literal("bookkeeper_export_sent"),
      v.literal("closed")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    visibleToCustomer: v.boolean(),
    createdByExternalUserId: v.optional(v.string()),
    createdAt: v.number()
  })
    .index("by_project", ["tenantId", "projectId"])
    .index("by_type", ["tenantId", "type"]),

  importProfiles: defineTable({
    tenantId: v.id("tenants"),
    supplierId: v.optional(v.id("suppliers")),
    categoryId: v.optional(v.id("categories")),
    supplierName: v.string(),
    name: v.string(),
    filePattern: v.optional(v.string()),
    sheetPattern: v.optional(v.string()),
    expectedFileExtension: v.optional(v.union(v.literal(".xlsx"), v.literal(".xls"))),
    supportsXlsx: v.boolean(),
    supportsXls: v.boolean(),
    sheetMapping: v.optional(v.any()),
    headerRowStrategy: v.optional(v.any()),
    sectionRowStrategy: v.optional(v.any()),
    productKeyStrategy: v.optional(v.any()),
    columnMappings: v.optional(v.any()),
    priceColumnMappings: v.optional(v.any()),
    vatModeByPriceColumn: v.optional(v.any()),
    unitByPriceColumn: v.optional(v.any()),
    priceTypeByPriceColumn: v.optional(v.any()),
    allowUnknownVatMode: v.optional(v.boolean()),
    vatModeReview: v.optional(v.any()),
    vatModeUpdatedByExternalUserId: v.optional(v.string()),
    vatModeUpdatedAt: v.optional(v.number()),
    duplicateStrategy: v.optional(v.any()),
    zeroPriceStrategy: v.optional(v.any()),
    mapping: v.any(),
    notes: v.optional(v.string()),
    status: statusActive,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_supplier", ["tenantId", "supplierName"])
    .index("by_status", ["tenantId", "status"]),

  catalogDataIssues: defineTable({
    tenantId: v.id("tenants"),
    issueType: v.union(v.literal("duplicate_ean")),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    status: v.union(
      v.literal("open"),
      v.literal("reviewed"),
      v.literal("accepted"),
      v.literal("resolved")
    ),
    supplierId: v.optional(v.id("suppliers")),
    ean: v.optional(v.string()),
    productIds: v.array(v.id("products")),
    notes: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_type_status", ["tenantId", "issueType", "status"])
    .index("by_supplier_ean", ["tenantId", "supplierId", "ean"]),

  supplierOrders: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    supplierId: v.optional(v.id("suppliers")),
    orderNumber: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("ordered"),
      v.literal("confirmed"),
      v.literal("partially_received"),
      v.literal("received"),
      v.literal("cancelled")
    ),
    orderedAt: v.optional(v.number()),
    expectedDeliveryAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_project", ["tenantId", "projectId"])
    .index("by_supplier", ["tenantId", "supplierId"])
    .index("by_status", ["tenantId", "status"]),

  invoices: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    customerId: v.id("customers"),
    quoteId: v.optional(v.id("quotes")),
    invoiceNumber: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("partially_paid"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled")
    ),
    invoiceDate: v.number(),
    dueDate: v.number(),
    subtotalExVat: v.number(),
    vatTotal: v.number(),
    totalIncVat: v.number(),
    paidAmount: v.number(),
    paidAt: v.optional(v.number()),
    reminderSentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_project", ["tenantId", "projectId"])
    .index("by_customer", ["tenantId", "customerId"])
    .index("by_invoice_number", ["tenantId", "invoiceNumber"])
    .index("by_status", ["tenantId", "status"])
    .index("by_due_date", ["tenantId", "dueDate"]),

  timelineEvents: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    customerId: v.optional(v.id("customers")),
    type: v.union(
      v.literal("created"),
      v.literal("note"),
      v.literal("quote_sent"),
      v.literal("quote_accepted"),
      v.literal("quote_rejected"),
      v.literal("measurement_planned"),
      v.literal("execution_planned"),
      v.literal("supplier_ordered"),
      v.literal("invoice_sent"),
      v.literal("payment_received"),
      v.literal("closed")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    visibleToCustomer: v.boolean(),
    createdByExternalUserId: v.optional(v.string()),
    createdAt: v.number()
  })
    .index("by_project", ["tenantId", "projectId"])
    .index("by_customer", ["tenantId", "customerId"])
    .index("by_type", ["tenantId", "type"])
});
