// Canonieke veldnaam-rename-map voor de NL-migratie (Fase 2). Bron van waarheid voor de codemod
// (tools/rename_nl_fields.mjs) én de datamigratie (convex/.../renameFieldsChunk).
//
// BESLISSINGEN (eigenaar, 2026-06-14):
//  - Volg de DATA-conventie: stammen vertalen; loanwords/technisch blijven Engels
//    (type, code-suffix, status, label, email, slug, ean, sku, currency, metadata, mapping, batch).
//  - tenantId + externalUserId (+ alle *ByExternalUserId) BLIJVEN. *Id-suffix blijft; stam vertaalt
//    waar betekenisvol (customerId->klantId), maar technische stammen blijven (projectId/productId/quoteId/batchId).
//  - productKind->productSoort, productType->productAard (botsing ontdubbeld).
//  - Compounds met "Type": stam vertalen, "Type" behouden (calculationType->berekeningType, lineType->regelType).
//  - priceMatrices + calculatorRules zijn AL Nederlands -> niet in de map.
//
// REGELS VOOR DE CODEMOD (key-only + positionele strings; nooit substring/regex):
//  - Hernoem identifiers/object-keys die EXACT in fieldMap staan.
//  - Hernoem string-literals ALLEEN in veld-referentie-posities: 2e+ elementen van .index(naam, [...]),
//    searchField, filterFields-elementen, en het 1e arg van q.eq()/q.field()/q.search().
//  - Raak NOOIT aan: tabelnamen (v.id/query/insert/get/Doc/Id), index-NAMEN (1e arg .index/.withIndex),
//    en enum-WAARDEN (v.literal-args en === "..."-vergelijkingen). Deze staan simpelweg niet in fieldMap
//    en zitten niet in een veld-referentie-positie, dus blijven vanzelf ongemoeid.

/** Velden die er vertaalbaar uitzien maar BEWUST Engels blijven (documentatie + veiligheidscheck). */
export const keepFields = [
  "tenantId",
  "externalUserId",
  "createdByExternalUserId",
  "archivedByExternalUserId",
  "importedByExternalUserId",
  "vatModeUpdatedByExternalUserId",
  "projectId",
  "productId",
  "productIds",
  "quoteId",
  "batchId",
  "type", // standalone discriminator-veld -> loanword, blijft
  "status",
  "label",
  "email",
  "slug",
  "sku",
  "ean",
  "currency",
  "year",
  "sortOrder",
  "metadata",
  "mapping",
  "role"
];

/**
 * GEVAARLIJKE generieke veldnamen: ze bestaan als schemaveld ÉN als alomtegenwoordige
 * JS/React-identifier (key={} props, Object.entries, lokale vars). NOOIT blind hernoemen —
 * alleen type-bewust (rename-symbol op de schema-/portalTypes-property), nooit een tekstuele sweep.
 */
export const dangerousGenericFields = [
  "key", "name", "type", "unit", "result", "input", "amount", "status", "title",
  "notes", "errors", "warnings", "sections", "terms", "optional", "quantity", "label", "raw"
];

/**
 * Old -> New veldnaam-map. Alleen veldnamen (en hun veld-referentie-strings) worden hernoemd.
 * Gegroepeerd per thema; commentaar = herkomst (glossary = plan/DATA, anders consistente aanvulling).
 */
export const fieldMap = {
  // ── Generiek ──────────────────────────────────────────────────────────────
  name: "naam",
  description: "omschrijving",
  notes: "notities",
  title: "titel",
  createdAt: "aangemaaktOp",
  updatedAt: "gewijzigdOp",
  phone: "telefoon",
  validFrom: "geldigVanaf",
  validUntil: "geldigTot",

  // ── Klant ─────────────────────────────────────────────────────────────────
  customerId: "klantId",
  customerNumber: "klantnummer",
  displayName: "weergaveNaam",
  firstName: "voornaam",
  lastName: "achternaam",
  companyName: "bedrijfsnaam",
  street: "straat",
  houseNumber: "huisnummer",
  postalCode: "postcode",
  city: "plaats",
  country: "land",
  loanedItemName: "uitgeleendItemNaam",
  expectedReturnDate: "verwachteRetourdatum",
  returnedAt: "geretourneerdOp",
  visibleToCustomer: "zichtbaarVoorKlant",

  // ── Categorie / leverancier / merk / collectie ──────────────────────────────
  parentCategoryId: "bovenliggendeCategorieId",
  categoryId: "categorieId",
  supplierId: "leverancierId",
  supplierName: "leverancierNaam",
  contactName: "contactpersoon",
  productListStatus: "prijslijstStatus",
  lastContactAt: "laatsteContactOp",
  expectedAt: "verwachtOp",
  brandId: "merkId",
  collectionId: "collectieId",

  // ── Product + commercialNames-subobject ─────────────────────────────────────
  articleNumber: "artikelnummer",
  supplierCode: "leverancierCode",
  commercialCode: "commercieleCode",
  colorName: "kleurnaam",
  productKind: "productSoort",
  productType: "productAard",
  supplierProductGroup: "leverancierProductGroep",
  wearLayerMm: "slijtlaagMm",
  packageContentM2: "pakinhoudM2",
  piecesPerPackage: "stuksPerPak",
  packagesPerPallet: "pakkenPerPallet",
  widthMm: "breedteMm",
  lengthMm: "lengteMm",
  thicknessMm: "dikteMm",
  salesUnit: "verkoopEenheid",
  purchaseUnit: "inkoopEenheid",
  orderUnit: "bestelEenheid",
  minimumOrderQuantity: "minimumBestelAantal",
  orderMultiple: "bestelVeelvoud",
  palletQuantity: "palletAantal",
  trailerQuantity: "vrachtwagenAantal",
  bundleSize: "bundelGrootte",
  attributes: "attributen",
  brandName: "merknaam", // commercialNames-subkey
  collectionName: "collectieNaam", // commercialNames-subkey

  // ── Prijslijst / productPrices / import-bron ────────────────────────────────
  priceListId: "prijslijstId",
  sourceKey: "bronSleutel",
  sourceFileName: "bronBestandsnaam",
  sourceSheetName: "bronBladNaam",
  sourceColumnName: "bronKolomNaam",
  sourceColumnIndex: "bronKolomIndex",
  sourceRowNumber: "bronRijNummer",
  sourceValue: "bronWaarde",
  sourcePath: "bronPad",
  priceType: "prijsSoort",
  priceUnit: "prijsEenheid",
  amount: "bedrag",
  vatRate: "btwTarief",
  vatMode: "btwModus",
  priceExVat: "prijsExBtw",
  fileName: "bestandsnaam",
  fileType: "bestandsType",
  fileHash: "bestandHash",
  rowNumber: "rijNummer",
  rowHash: "rijHash",
  raw: "ruweData",
  normalized: "genormaliseerd",
  rowKind: "rijSoort",
  sectionLabel: "sectieLabel",
  warnings: "waarschuwingen",
  errors: "fouten",
  importKey: "importSleutel",
  importedProductId: "geimporteerdProductId",
  importedPriceIds: "geimporteerdePrijsIds",
  importedAt: "geimporteerdOp",

  // ── Import-batch statistiek ─────────────────────────────────────────────────
  importProfileId: "importProfielId",
  archivedFromStatus: "gearchiveerdVanafStatus",
  archivedAt: "gearchiveerdOp",
  totalRows: "totaalRijen",
  previewRows: "voorbeeldRijen",
  productRows: "productRijen",
  validRows: "geldigeRijen",
  warningRows: "waarschuwingRijen",
  errorRows: "foutRijen",
  ignoredRows: "genegeerdeRijen",
  importedProducts: "geimporteerdeProducten",
  updatedProducts: "bijgewerkteProducten",
  skippedProducts: "overgeslagenProducten",
  importedPrices: "geimporteerdePrijzen",
  skippedPrices: "overgeslagenPrijzen",
  duplicateProductMatches: "dubbeleProductMatches",
  zeroPriceRows: "nulPrijsRijen",
  unknownVatModeRows: "onbekendeBtwModusRijen",
  productsWithoutSupplierCode: "productenZonderLeverancierCode",
  orphanPriceRules: "weesPrijsRegels",
  duplicateSourceKeys: "dubbeleBronSleutels",
  allowUnknownVatMode: "staBtwModusOnbekendToe",
  reconciliation: "reconciliatie",
  committedAt: "vastgelegdOp",
  failedAt: "misluktOp",
  errorMessage: "foutmelding",

  // ── importProfiles ──────────────────────────────────────────────────────────
  filePattern: "bestandPatroon",
  sheetPattern: "bladPatroon",
  expectedFileExtension: "verwachteBestandsextensie",
  supportsXlsx: "ondersteuntXlsx",
  supportsXls: "ondersteuntXls",
  sheetMapping: "bladMapping",
  headerRowStrategy: "koprijStrategie",
  sectionRowStrategy: "sectierijStrategie",
  productKeyStrategy: "productSleutelStrategie",
  columnMappings: "kolomMappings",
  priceColumnMappings: "prijskolomMappings",
  vatModeByPriceColumn: "btwModusPerPrijskolom",
  unitByPriceColumn: "eenheidPerPrijskolom",
  priceTypeByPriceColumn: "prijsSoortPerPrijskolom",
  vatModeReview: "btwModusReview",
  vatModeUpdatedAt: "btwModusGewijzigdOp",
  duplicateStrategy: "dubbelenStrategie",
  zeroPriceStrategy: "nulPrijsStrategie",

  // ── catalogDataIssues ───────────────────────────────────────────────────────
  issueType: "kwestieSoort",
  severity: "ernst",

  // ── Projecten / inmeten ─────────────────────────────────────────────────────
  projectNumber: "projectnummer",
  preferredExecutionDate: "gewensteUitvoerdatum",
  measurementDate: "inmeetdatum",
  executionDate: "uitvoerdatum",
  internalNotes: "interneNotities",
  customerNotes: "klantNotities",
  acceptedAt: "geaccepteerdOp",
  measurementPlannedAt: "inmeetGeplandOp",
  executionPlannedAt: "uitvoerGeplandOp",
  orderedAt: "besteldOp",
  invoicedAt: "gefactureerdOp",
  paidAt: "betaaldOp",
  closedAt: "afgeslotenOp",
  floor: "verdieping",
  widthCm: "breedteCm",
  lengthCm: "lengteCm",
  heightCm: "hoogteCm",
  areaM2: "oppervlakteM2",
  perimeterMeter: "omtrekMeter",
  measurementId: "inmetingId",
  measuredBy: "gemetenDoor",
  projectRoomId: "projectRuimteId",
  widthM: "breedteM",
  lengthM: "lengteM",
  heightM: "hoogteM",
  perimeterM: "omtrekM",
  roomId: "ruimteId",
  productGroup: "productGroep",
  calculationType: "berekeningType",
  input: "invoer",
  result: "resultaat",
  wastePercent: "snijverliesPct",
  quantity: "aantal",
  unit: "eenheid",
  productName: "productNaam",
  indicativeUnitPriceExVat: "indicatieveEenheidsprijsExBtw",
  indicativeVatRate: "indicatiefBtwTarief",
  indicativePriceUnit: "indicatievePrijsEenheid",
  indicativePriceType: "indicatievePrijsSoort",
  indicativeCapturedAt: "indicatiefVastgelegdOp",
  convertedQuoteId: "geconverteerdeOfferteId",
  convertedQuoteLineId: "geconverteerdeOfferteregelId",
  defaultWastePercent: "standaardSnijverliesPct",

  // ── Offerte / offerteregel / template ───────────────────────────────────────
  // (quoteId blijft Engels — zie keepFields)
  quoteNumber: "offertenummer",
  sentAt: "verzondenOp",
  introText: "inleidingTekst",
  closingText: "afsluitTekst",
  terms: "voorwaarden",
  paymentTerms: "betalingsvoorwaarden",
  subtotalExVat: "subtotaalExBtw",
  vatTotal: "btwTotaal",
  totalIncVat: "totaalInclBtw",
  rejectedAt: "afgewezenOp",
  serviceCostRuleId: "werktariefRegelId",
  lineType: "regelType",
  quoteLineType: "offerteRegelType",
  unitPriceExVat: "eenheidsprijsExBtw",
  discountExVat: "kortingExBtw",
  lineTotalExVat: "regelTotaalExBtw",
  lineVatTotal: "regelBtwTotaal",
  lineTotalIncVat: "regelTotaalInclBtw",
  sections: "secties",
  defaultTerms: "standaardVoorwaarden",
  defaultLines: "standaardRegels",
  sectionKey: "sectieSleutel",
  defaultQuantity: "standaardAantal",
  optional: "optioneel",
  defaultEnabled: "standaardIngeschakeld",
  categoryHint: "categorieHint",
  productKindHint: "productSoortHint",

  // ── Workflow / taken / order / factuur / tijdlijn ───────────────────────────
  dueAt: "vervaltOp",
  completedAt: "voltooidOp",
  dismissedAt: "afgewezenOp",
  orderNumber: "bestelnummer",
  expectedDeliveryAt: "verwachteLeverdatumOp",
  receivedAt: "ontvangenOp",
  invoiceNumber: "factuurnummer",
  invoiceDate: "factuurdatum",
  dueDate: "vervaldatum",
  paidAmount: "betaaldBedrag",
  reminderSentAt: "herinneringVerzondenOp",

  // ── Quote-template subobject 'key' / measurements 'input/result' al hierboven ─
  key: "sleutel" // alleen het template-section-subveld 'key'
};

/** Tabelnamen (NOOIT hernoemen). */
export const tableNames = [
  "tenants", "users", "customers", "customerContacts", "categories", "suppliers", "brands",
  "productCollections", "products", "priceLists", "productPrices", "productImportBatches",
  "productImportRows", "priceMatrices", "calculatorRules", "importProfiles", "catalogDataIssues",
  "supplierOrders", "serviceCostRules", "projects", "projectRooms", "measurements",
  "measurementRooms", "measurementLines", "wasteProfiles", "quotes", "quoteLines",
  "quoteTemplates", "projectWorkflowEvents", "projectTasks", "invoices", "timelineEvents"
];

/** Tabellen die al Nederlands zijn -> codemod slaat hun veld-definities over (referenties elders wel meenemen). */
export const alreadyDutchTables = ["priceMatrices", "calculatorRules"];
