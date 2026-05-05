export type CustomerStatus = "lead" | "active" | "inactive" | "archived";
export type CustomerType = "private" | "business";

export type PortalCustomer = {
  id: string;
  tenantId: string;
  type: CustomerType;
  displayName: string;
  email?: string;
  phone?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  notes?: string;
  status: CustomerStatus;
  createdAt: number;
  updatedAt: number;
};

export type ProjectStatus =
  | "lead"
  | "quote_draft"
  | "quote_sent"
  | "quote_accepted"
  | "quote_rejected"
  | "measurement_planned"
  | "execution_planned"
  | "ordering"
  | "in_progress"
  | "invoiced"
  | "paid"
  | "closed"
  | "cancelled";

export type PortalRoom = {
  id: string;
  projectId: string;
  name: string;
  floor?: string;
  widthCm?: number;
  lengthCm?: number;
  areaM2?: number;
  perimeterMeter?: number;
  notes?: string;
  sortOrder: number;
};

export type PortalProject = {
  id: string;
  tenantId: string;
  customerId: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  measurementDate?: number;
  executionDate?: number;
  internalNotes?: string;
  customerNotes?: string;
  acceptedAt?: number;
  measurementPlannedAt?: number;
  executionPlannedAt?: number;
  orderedAt?: number;
  invoicedAt?: number;
  paidAt?: number;
  closedAt?: number;
  rooms: PortalRoom[];
  createdByExternalUserId?: string;
  createdAt: number;
  updatedAt: number;
};

export type MeasurementStatus = "draft" | "measured" | "reviewed" | "converted_to_quote";

export type MeasurementProductGroup =
  | "flooring"
  | "plinths"
  | "wallpaper"
  | "wall_panels"
  | "curtains"
  | "rails"
  | "stairs"
  | "other";

export type MeasurementCalculationType =
  | "area"
  | "perimeter"
  | "rolls"
  | "panels"
  | "stairs"
  | "manual";

export type QuotePreparationStatus = "draft" | "ready_for_quote" | "converted";

export type PortalMeasurement = {
  id: string;
  tenantId: string;
  projectId: string;
  customerId: string;
  status: MeasurementStatus;
  measurementDate?: number;
  measuredBy?: string;
  notes?: string;
  createdByExternalUserId?: string;
  createdAt: number;
  updatedAt: number;
};

export type PortalMeasurementRoom = {
  id: string;
  tenantId: string;
  measurementId: string;
  projectRoomId?: string;
  name: string;
  floor?: string;
  widthM?: number;
  lengthM?: number;
  heightM?: number;
  areaM2?: number;
  perimeterM?: number;
  notes?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type PortalMeasurementLine = {
  id: string;
  tenantId: string;
  measurementId: string;
  roomId?: string;
  productGroup: MeasurementProductGroup;
  calculationType: MeasurementCalculationType;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  wastePercent?: number;
  quantity: number;
  unit: string;
  notes?: string;
  quoteLineType: QuoteLineType;
  quotePreparationStatus: QuotePreparationStatus;
  convertedQuoteId?: string;
  convertedQuoteLineId?: string;
  createdAt: number;
  updatedAt: number;
};

export type PortalWasteProfile = {
  id: string;
  tenantId: string;
  productGroup: MeasurementProductGroup;
  name: string;
  defaultWastePercent: number;
  description?: string;
  status: "active" | "inactive";
  createdAt: number;
  updatedAt: number;
};

export type PortalProjectMeasurementData = {
  measurement: PortalMeasurement | null;
  rooms: PortalMeasurementRoom[];
  lines: PortalMeasurementLine[];
  wasteProfiles: PortalWasteProfile[];
};

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

export type QuoteLineType =
  | "product"
  | "service"
  | "labor"
  | "material"
  | "discount"
  | "text"
  | "manual";

export type PortalQuoteLine = {
  id: string;
  quoteId: string;
  projectRoomId?: string;
  lineType: QuoteLineType;
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPriceExVat: number;
  vatRate: number;
  discountExVat?: number;
  lineTotalExVat: number;
  lineVatTotal: number;
  lineTotalIncVat: number;
  sortOrder: number;
  metadata?: Record<string, unknown>;
};

export type PortalQuote = {
  id: string;
  tenantId: string;
  projectId: string;
  customerId: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  validUntil?: number;
  introText?: string;
  closingText?: string;
  terms?: string[];
  paymentTerms?: string[];
  subtotalExVat: number;
  vatTotal: number;
  totalIncVat: number;
  lines: PortalQuoteLine[];
  createdByExternalUserId?: string;
  createdAt: number;
  updatedAt: number;
};

export type ProductListStatus =
  | "unknown"
  | "requested"
  | "received"
  | "download_available"
  | "not_available"
  | "manual_only";

export type PortalSupplier = {
  id: string;
  tenantId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  productListStatus: ProductListStatus;
  status?: "active" | "inactive" | "archived";
  notes?: string;
  lastContactAt?: number;
  expectedAt?: number;
  activeProductCount?: number;
  importProfileCount?: number;
  importBatchCount?: number;
  sourceFileCount?: number;
  sourceFileNames?: string[];
  latestImportStatus?: string;
  latestImportAt?: number;
  updatedAt: number;
};

export type ProductPriceType =
  | "purchase"
  | "net_purchase"
  | "retail"
  | "advice_retail"
  | "commission"
  | "pallet"
  | "trailer"
  | "roll"
  | "cut_length"
  | "package"
  | "step"
  | "manual";

export type PriceUnit =
  | "m2"
  | "m1"
  | "meter"
  | "piece"
  | "package"
  | "pack"
  | "roll"
  | "pallet"
  | "trailer"
  | "step"
  | "liter"
  | "kg"
  | "custom";

export type VatMode = "exclusive" | "inclusive" | "unknown";

export type ProductUnit =
  | "piece"
  | "m2"
  | "m1"
  | "meter"
  | "roll"
  | "package"
  | "pack"
  | "pallet"
  | "trailer"
  | "step"
  | "liter"
  | "kg"
  | "hour"
  | "stairs"
  | "custom";

export type ProductKind =
  | "click"
  | "dryback"
  | "src"
  | "panel"
  | "tile"
  | "carpet"
  | "vinyl"
  | "curtain"
  | "fabric"
  | "curtain_fabric"
  | "vitrage"
  | "roman_blind_fabric"
  | "panel_curtain_fabric"
  | "mat"
  | "rug"
  | "blind"
  | "plisse"
  | "jaloezie"
  | "duette"
  | "rail"
  | "wallpaper"
  | "underlay"
  | "adhesive"
  | "plinth"
  | "other";

export type CommercialName = {
  brandName: string;
  collectionName?: string;
  colorName?: string;
  displayName: string;
};

export type PortalProduct = {
  id: string;
  tenantId: string;
  category: string;
  supplier: string;
  brand?: string;
  collection?: string;
  articleNumber?: string;
  supplierCode?: string;
  commercialCode?: string;
  supplierProductGroup?: string;
  name: string;
  colorName?: string;
  productKind?: ProductKind;
  commercialNames?: CommercialName[];
  unit: ProductUnit;
  packageContentM2?: number;
  piecesPerPackage?: number;
  packagesPerPallet?: number;
  salesUnit?: string;
  purchaseUnit?: string;
  orderUnit?: string;
  minimumOrderQuantity?: number;
  orderMultiple?: number;
  palletQuantity?: number;
  trailerQuantity?: number;
  bundleSize?: number;
  priceExVat: number;
  vatRate: number;
  status: "draft" | "active" | "inactive" | "archived";
};

export type ImportWarning = {
  rowNumber: number;
  message: string;
  severity: "warning" | "error";
};

export type ProductImportBatch = {
  id: string;
  tenantId: string;
  fileName: string;
  supplierName: string;
  status:
    | "uploaded"
    | "analyzing"
    | "needs_mapping"
    | "ready_to_import"
    | "importing"
    | "imported"
    | "failed"
    | "archived";
  archivedFromStatus?:
    | "uploaded"
    | "analyzing"
    | "needs_mapping"
    | "ready_to_import"
    | "importing"
    | "imported"
    | "failed";
  archivedAt?: number;
  archivedByExternalUserId?: string;
  sourcePath?: string;
  fileHash?: string;
  profileName?: string;
  totalRows: number;
  previewRows: number;
  productRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  ignoredRows: number;
  importedProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  importedPrices: number;
  skippedPrices: number;
  duplicateProductMatches: number;
  zeroPriceRows: number;
  unknownVatModeRows: number;
  productsWithoutSupplierCode: number;
  orphanPriceRules: number;
  duplicateSourceKeys: number;
  allowUnknownVatMode: boolean;
  importedAt?: number;
  committedAt?: number;
  failedAt?: number;
  errorMessage?: string;
  reconciliation?: Record<string, unknown>;
  warnings: ImportWarning[];
  createdAt: number;
  updatedAt: number;
};

export type ProductImportRowKind =
  | "header"
  | "section"
  | "product"
  | "empty"
  | "warning"
  | "error"
  | "ignored";

export type ProductImportRowStatus = "valid" | "warning" | "error" | "ignored" | "imported";

export type ProductImportRow = {
  id: string;
  sourceFileName?: string;
  sourceSheetName?: string;
  rowNumber: number;
  importKey?: string;
  sourceKey?: string;
  rowKind: ProductImportRowKind;
  status: ProductImportRowStatus;
  sectionLabel?: string;
  normalized?: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  importedProductId?: string;
  importedPriceIds: string[];
};

export type NormalizedProductImportRow = {
  sourceFile: string;
  sourceSheet: string;
  sourceRowNumber: number;
  rowKind: ProductImportRowKind;
  supplierName: string;
  brandName?: string;
  collectionName?: string;
  sectionLabel?: string;
  productName: string;
  colorName?: string;
  articleNumber?: string;
  supplierCode?: string;
  commercialCode?: string;
  supplierProductGroup?: string;
  sku?: string;
  ean?: string;
  category:
    | "pvc"
    | "tapijt"
    | "vinyl"
    | "karpetten"
    | "gordijnen"
    | "raambekleding"
    | "wandpanelen"
    | "douchepanelen"
    | "tegels"
    | "plinten"
    | "lijm"
    | "kit"
    | "egaline"
    | "entreematten"
    | "traprenovatie"
    | "behang"
    | "roedes_railsen"
    | "horren"
    | "overig";
  productKind?: ProductKind;
  widthMm?: number;
  lengthMm?: number;
  thicknessMm?: number;
  wearLayerMm?: number;
  packageContentM2?: number;
  piecesPerPackage?: number;
  packagesPerPallet?: number;
  salesUnit?: string;
  purchaseUnit?: string;
  orderUnit?: string;
  minimumOrderQuantity?: number;
  orderMultiple?: number;
  palletQuantity?: number;
  trailerQuantity?: number;
  bundleSize?: number;
  commercialNames?: CommercialName[];
  attributes?: Record<string, unknown>;
  prices: Array<{
    priceType: ProductPriceType;
    priceUnit: PriceUnit;
    amount: number;
    vatRate: number;
    vatMode: VatMode;
    sourceColumnName: string;
    sourceValue?: string;
  }>;
};

export type PortalCustomerContact = {
  id: string;
  tenantId: string;
  customerId: string;
  type: "note" | "call" | "email" | "visit" | "loaned_item" | "agreement";
  title: string;
  description?: string;
  loanedItemName?: string;
  expectedReturnDate?: number;
  returnedAt?: number;
  visibleToCustomer: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PortalWorkflowEvent = {
  id: string;
  tenantId: string;
  projectId: string;
  type:
    | "customer_contact"
    | "quote_created"
    | "measurement_requested"
    | "measurement_planned"
    | "quote_sent"
    | "quote_accepted"
    | "thank_you_letter_sent"
    | "execution_planned"
    | "supplier_order_created"
    | "invoice_created"
    | "payment_reminder_sent"
    | "payment_received"
    | "bookkeeper_export_sent"
    | "closed";
  title: string;
  description?: string;
  visibleToCustomer: boolean;
  createdAt: number;
};

export type QuoteTemplateSection = {
  key: string;
  title: string;
  description?: string;
  sortOrder: number;
};

export type QuoteTemplateLine = {
  sectionKey?: string;
  lineType: QuoteLineType;
  title: string;
  unit: string;
  description?: string;
  defaultQuantity?: number;
  sortOrder: number;
  optional?: boolean;
  defaultEnabled?: boolean;
  categoryHint?: string;
  productKindHint?: string;
};

export type QuoteTemplate = {
  id: string;
  tenantId: string;
  name: string;
  type: "default" | "flooring" | "curtains" | "wall_panels" | "custom";
  status?: "active" | "inactive";
  introText?: string;
  closingText?: string;
  sections?: QuoteTemplateSection[];
  defaultTerms: string[];
  paymentTerms?: string[];
  defaultLines: QuoteTemplateLine[];
};

export type FieldWorkspaceBucket = "today" | "measure" | "quote" | "followUp";

export type FieldWorkspaceCard = {
  id: string;
  href: string;
  bucket: FieldWorkspaceBucket;
  nextAction: string;
  visitAt?: number;
  address?: string;
  phone?: string;
  email?: string;
  updatedAt: number;
  project: PortalProject;
  customer: PortalCustomer | null;
  latestQuote: Omit<PortalQuote, "lines"> | null;
  measurement: {
    id: string;
    status: MeasurementStatus;
    measurementDate?: number;
    updatedAt: number;
  } | null;
};

export type FieldServiceWorkspaceResult = {
  today: FieldWorkspaceCard[];
  measure: FieldWorkspaceCard[];
  quote: FieldWorkspaceCard[];
  followUp: FieldWorkspaceCard[];
  counts: Record<FieldWorkspaceBucket, number>;
};

export type FieldProjectWorkspaceResult = {
  project: PortalProject;
  customer: PortalCustomer | null;
  quotes: PortalQuote[];
  templates: QuoteTemplate[];
  visit: {
    status: string;
    visitAt?: number;
    measurementStatus?: MeasurementStatus;
  };
};

export type ImportProfile = {
  id: string;
  supplierName: string;
  name: string;
  expectedFileExtension?: ".xlsx" | ".xls";
  filePattern?: string;
  sheetPattern?: string;
  supportsXlsx: boolean;
  supportsXls: boolean;
  priceColumnMappings?: Array<{
    header?: string;
    sourceColumnName?: string;
    sourceColumnIndex?: number;
    priceType?: ProductPriceType | string;
    priceUnit?: PriceUnit | string;
    vatMode?: VatMode;
  }>;
  vatModeByPriceColumn?: Record<string, VatMode>;
  unitByPriceColumn?: Record<string, string>;
  priceTypeByPriceColumn?: Record<string, string>;
  allowUnknownVatMode?: boolean;
  vatModeReview?: Record<string, unknown>;
  vatModeUpdatedByExternalUserId?: string;
  vatModeUpdatedAt?: number;
  duplicateStrategy?: Record<string, unknown>;
  zeroPriceStrategy?: Record<string, unknown>;
  mapping: Record<string, unknown>;
  status: "active" | "inactive";
  updatedAt: number;
};
