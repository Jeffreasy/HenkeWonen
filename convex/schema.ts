/**
 * Convex database schema — Henke Wonen Portal
 *
 * Tabel-overzicht:
 * ┌─────────────────────────┬──────────────────────────────────────────────────────┐
 * │ Tabel                   │ Beschrijving                                         │
 * ├─────────────────────────┼──────────────────────────────────────────────────────┤
 * │ tenants                 │ Multi-tenant root — elke installatie is een tenant    │
 * │ users                   │ Portaalgebruikers gekoppeld aan een tenant            │
 * │ customers               │ Klantdossiers (privé + zakelijk)                     │
 * │ customerContacts        │ Contactmomenten per klant (bezoek, afspraak, leen)   │
 * │ dossierAttachments      │ Dossierstukken per klant/project (plattegrond, foto) │
 * │ categories              │ Productindeling (boomstructuur met parentCategoryId)  │
 * │ suppliers               │ Leveranciers + prijslijststatus                      │
 * │ brands                  │ Merken, gekoppeld aan supplier + categorie            │
 * │ productCollections      │ Collecties per merk/leverancier                      │
 * │ products                │ Catalogusproducten met uitgebreide productattributen  │
 * │ priceLists              │ Leveranciersdocumenten (Excel, CSV) als bron          │
 * │ productPrices           │ Individuele prijsregels per product + priceType       │
 * │ productImportBatches    │ Import-runs met statistieken en status                │
 * │ productImportRows       │ Individuele rijen per import-batch                    │
 * │ priceMatrices           │ Breedte×hoogte-prijsmatrices (raambekleding)          │
 * │ calculatorRules         │ Marge-delers + placeholder-bedrijfsregels per tool    │
 * │ importProfiles          │ Herbruikbare import-configuraties per leverancier     │
 * │ catalogDataIssues       │ Datakwaliteitsissues voor catalogusreview             │
 * │ supplierOrders          │ Leveranciersbestellingen per project                  │
 * │ supplierOrderLines      │ Bestelregels per leveranciersbestelling               │
 * │ serviceCostRules        │ Vaste werktarieven (per m², per meter, etc.)          │
 * │ projects                │ Klantprojecten met volledige statusmachine            │
 * │ projectRooms            │ Ruimtes per project voor inmeting en offerte          │
 * │ measurements            │ Inmeetbezoeken (buitendienst)                        │
 * │ measurementRooms        │ Gemeten ruimtes per inmeetbezoek                     │
 * │ measurementLines        │ Calculatielijnen per ruimte (vloer, gordijn, etc.)    │
 * │ wasteProfiles           │ Materialeverliesnormen per productgroep               │
 * │ quotes                  │ Offertes met totalen en status                       │
 * │ quoteLines              │ Offerteregels (product, dienst, tekst, korting)       │
 * │ quoteTemplates          │ Herbruikbare offertetemplates met standaardteksten    │
 * │ projectWorkflowEvents   │ Audit trail van projectstatusovergangen               │
 * │ projectTasks            │ Opvolgingstaken per project (workflow-triggers)       │
 * │ invoices                │ Facturen gekoppeld aan project + quote                │
 * │ timelineEvents          │ Tijdlijnitems over projecten en klantdossiers         │
 * └─────────────────────────┴──────────────────────────────────────────────────────┘
 *
 * Alle tabellen bevatten `tenantId` als eerste veld — queries filteren altijd hierop.
 * Timestamps zijn Unix milliseconden (`v.number()`).
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** Gebruikersrollen — viewer < user < editor < admin */
const role = v.union(
  v.literal("viewer"),
  v.literal("user"),
  v.literal("editor"),
  v.literal("admin")
);

/** Portaalwerkplek: "general" = winkel/kantoor, "field" = buitendienst */
const workspaceMode = v.union(v.literal("general"), v.literal("field"));

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

/**
 * BTW-modus per prijskolom.
 * `unknown` = nog niet beoordeeld — blokkeert productie-import.
 */
const vatMode = v.union(v.literal("exclusive"), v.literal("inclusive"), v.literal("unknown"));

/** Type offerteregel — bepaalt hoe de regel gepresenteerd en berekend wordt */
const quoteLineType = v.union(
  v.literal("product"),
  v.literal("service"),
  v.literal("labor"),
  v.literal("material"),
  v.literal("discount"),
  v.literal("text"),
  v.literal("manual")
);

/** Status van een inmeetbezoek — doorloopt draft → measured → reviewed → converted_to_quote */
const measurementStatus = v.union(
  v.literal("draft"),
  v.literal("measured"),
  v.literal("reviewed"),
  v.literal("converted_to_quote")
);

/** Productgroep per inmeetlijn — bepaalt welke calculator (flooring, wallpaper, etc.) gebruikt wordt */
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
  v.literal("matrix"),
  v.literal("manual")
);

const quotePreparationStatus = v.union(
  v.literal("draft"),
  v.literal("ready_for_quote"),
  v.literal("converted")
);

const projectTaskType = v.union(
  v.literal("quote_follow_up"),
  v.literal("confirmation_payment"),
  v.literal("execution_call"),
  v.literal("invoice_payment")
);

const projectTaskStatus = v.union(v.literal("open"), v.literal("done"), v.literal("dismissed"));

/**
 * Soort calculator-regel (marge-deler of placeholder-bedrijfsregel) — enum-waarden blijven Engels
 * (data-identifiers, overgenomen uit de prijslijst-formules in HenkeWonenDATA).
 */
const calculatorRuleType = v.union(
  v.literal("commission_divisor"),
  v.literal("pallet_divisor"),
  v.literal("trailer_divisor"),
  v.literal("coupage_divisor"),
  v.literal("roll_divisor"),
  v.literal("markup_factor"),
  v.literal("waste_pct"),
  v.literal("labor_surcharge"),
  v.literal("fullness"),
  v.literal("hem_cm"),
  v.literal("side_hem_cm"),
  v.literal("confectie_per_unit"),
  v.literal("consumption_kg_m2_mm"),
  v.literal("pack_kg"),
  v.literal("min_max"),
  v.literal("dependency")
);

export default defineSchema({
  tenants: defineTable({
    slug: v.string(),
    naam: v.string(),
    status: statusActive,
    invoiceSequenceYear: v.optional(v.number()),
    invoiceSequenceValue: v.optional(v.number()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  users: defineTable({
    tenantId: v.id("tenants"),
    externalUserId: v.string(),
    email: v.string(),
    naam: v.optional(v.string()),
    role,
    workspaceMode: v.optional(workspaceMode),
    // Of deze gebruiker als monteur in de week-agenda verschijnt. Zodra er minstens één
    // gebruiker expliciet op true staat, toont de agenda alleen die (whitelist); zolang
    // niemand is aangevinkt valt 'ie terug op alle niet-viewers (backward-compatible).
    toonInAgenda: v.optional(v.boolean()),
    // Optionele weergavenaam-override voor de agenda/teamlijst (bv. "Winkel" voor Simone).
    // Los van het gesynchroniseerde `naam`-veld, zodat een auth-sync 'm niet overschrijft.
    agendaWeergaveNaam: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_external_user", ["externalUserId"]),

  customers: defineTable({
    tenantId: v.id("tenants"),
    klantnummer: v.optional(v.string()),
    type: v.union(v.literal("private"), v.literal("business")),
    weergaveNaam: v.string(),
    voornaam: v.optional(v.string()),
    achternaam: v.optional(v.string()),
    bedrijfsnaam: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    straat: v.optional(v.string()),
    huisnummer: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
    land: v.optional(v.string()),
    notities: v.optional(v.string()),
    status: v.union(
      v.literal("lead"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived")
    ),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["tenantId", "status"])
    .searchIndex("search_customer", {
      searchField: "weergaveNaam",
      filterFields: ["tenantId", "status"]
    }),

  customerContacts: defineTable({
    tenantId: v.id("tenants"),
    klantId: v.id("customers"),
    type: v.union(
      v.literal("note"),
      v.literal("call"),
      v.literal("email"),
      v.literal("visit"),
      v.literal("loaned_item"),
      v.literal("agreement")
    ),
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    uitgeleendItemNaam: v.optional(v.string()),
    verwachteRetourdatum: v.optional(v.number()),
    geretourneerdOp: v.optional(v.number()),
    zichtbaarVoorKlant: v.boolean(),
    createdByExternalUserId: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_customer", ["tenantId", "klantId"])
    .index("by_type", ["tenantId", "type"]),

  dossierAttachments: defineTable({
    tenantId: v.id("tenants"),
    klantId: v.id("customers"),
    projectId: v.optional(v.id("projects")),
    kind: v.union(
      v.literal("floor_plan"),
      v.literal("photo"),
      v.literal("legacy_excel_quote"),
      v.literal("physical_dossier"),
      v.literal("scan"),
      v.literal("other")
    ),
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    bestandsnaam: v.optional(v.string()),
    bestandstype: v.optional(v.string()),
    bestandsgrootteBytes: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdByExternalUserId: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_customer", ["tenantId", "klantId"])
    .index("by_project", ["tenantId", "projectId"]),

  categories: defineTable({
    tenantId: v.id("tenants"),
    naam: v.string(),
    slug: v.string(),
    bovenliggendeCategorieId: v.optional(v.id("categories")),
    sortOrder: v.number(),
    status: statusActive,
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_slug", ["tenantId", "slug"]),

  suppliers: defineTable({
    tenantId: v.id("tenants"),
    naam: v.string(),
    contactpersoon: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"))),
    prijslijstStatus: v.union(
      v.literal("unknown"),
      v.literal("requested"),
      v.literal("received"),
      v.literal("download_available"),
      v.literal("not_available"),
      v.literal("manual_only")
    ),
    laatsteContactOp: v.optional(v.number()),
    verwachtOp: v.optional(v.number()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["tenantId", "status"])
    .index("by_product_list_status", ["tenantId", "prijslijstStatus"])
    .searchIndex("search_supplier", {
      searchField: "naam",
      filterFields: ["tenantId", "prijslijstStatus"]
    }),

  brands: defineTable({
    tenantId: v.id("tenants"),
    leverancierId: v.optional(v.id("suppliers")),
    categorieId: v.optional(v.id("categories")),
    naam: v.string(),
    notities: v.optional(v.string()),
    status: statusActive,
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_supplier", ["tenantId", "leverancierId"])
    .index("by_category", ["tenantId", "categorieId"]),

  productCollections: defineTable({
    tenantId: v.id("tenants"),
    leverancierId: v.optional(v.id("suppliers")),
    merkId: v.optional(v.id("brands")),
    categorieId: v.optional(v.id("categories")),
    naam: v.string(),
    year: v.optional(v.number()),
    geldigVanaf: v.optional(v.number()),
    geldigTot: v.optional(v.number()),
    notities: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("archived")),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_supplier", ["tenantId", "leverancierId"])
    .index("by_category", ["tenantId", "categorieId"]),

  products: defineTable({
    tenantId: v.id("tenants"),
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
    productAard: v.union(
      v.literal("standard"),
      v.literal("with_variants"),
      v.literal("made_to_measure"),
      v.literal("service"),
      v.literal("manual")
    ),
    productSoort: v.optional(
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
    attributen: v.optional(v.any()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived")
    ),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_category", ["tenantId", "categorieId"])
    .index("by_category_status", ["tenantId", "categorieId", "status"])
    .index("by_supplier", ["tenantId", "leverancierId"])
    .index("by_supplier_status", ["tenantId", "leverancierId", "status"])
    .index("by_status", ["tenantId", "status"])
    .index("by_import_key", ["tenantId", "importSleutel"])
    .index("by_article_number", ["tenantId", "leverancierId", "artikelnummer"])
    .index("by_supplier_code", ["tenantId", "leverancierId", "leverancierCode"])
    .index("by_ean", ["tenantId", "ean"])
    .searchIndex("search_products", {
      searchField: "naam",
      filterFields: ["tenantId", "categorieId", "status"]
    }),

  priceLists: defineTable({
    tenantId: v.id("tenants"),
    leverancierId: v.optional(v.id("suppliers")),
    naam: v.string(),
    bronBestandsnaam: v.string(),
    bronBladNaam: v.optional(v.string()),
    year: v.optional(v.number()),
    geldigVanaf: v.optional(v.number()),
    geldigTot: v.optional(v.number()),
    status: v.union(
      v.literal("uploaded"),
      v.literal("mapped"),
      v.literal("previewed"),
      v.literal("imported"),
      v.literal("failed"),
      v.literal("archived")
    ),
    bronPad: v.optional(v.string()),
    bestandHash: v.optional(v.string()),
    notities: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_supplier", ["tenantId", "leverancierId"])
    .index("by_status", ["tenantId", "status"]),

  productPrices: defineTable({
    tenantId: v.id("tenants"),
    productId: v.id("products"),
    prijslijstId: v.optional(v.id("priceLists")),
    bronSleutel: v.optional(v.string()),
    prijsSoort: priceType,
    prijsEenheid: priceUnit,
    bedrag: v.number(),
    btwTarief: v.number(),
    btwModus: vatMode,
    currency: v.string(),
    geldigVanaf: v.optional(v.number()),
    geldigTot: v.optional(v.number()),
    bronBestandsnaam: v.optional(v.string()),
    bronBladNaam: v.optional(v.string()),
    bronKolomNaam: v.optional(v.string()),
    bronKolomIndex: v.optional(v.number()),
    bronRijNummer: v.optional(v.number()),
    bronWaarde: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_product", ["tenantId", "productId"])
    .index("by_source_key", ["tenantId", "bronSleutel"]),

  productImportBatches: defineTable({
    tenantId: v.id("tenants"),
    prijslijstId: v.optional(v.id("priceLists")),
    leverancierId: v.optional(v.id("suppliers")),
    importProfielId: v.optional(v.id("importProfiles")),
    bestandsnaam: v.string(),
    bestandsType: v.string(),
    bronBestandsnaam: v.optional(v.string()),
    bronPad: v.optional(v.string()),
    bestandHash: v.optional(v.string()),
    status: v.union(
      v.literal("uploaded"),
      v.literal("analyzing"),
      v.literal("needs_mapping"),
      v.literal("ready_to_import"),
      v.literal("importing"),
      v.literal("imported"),
      v.literal("failed"),
      v.literal("archived")
    ),
    gearchiveerdVanafStatus: v.optional(
      v.union(
        v.literal("uploaded"),
        v.literal("analyzing"),
        v.literal("needs_mapping"),
        v.literal("ready_to_import"),
        v.literal("importing"),
        v.literal("imported"),
        v.literal("failed")
      )
    ),
    gearchiveerdOp: v.optional(v.number()),
    archivedByExternalUserId: v.optional(v.string()),
    totaalRijen: v.number(),
    voorbeeldRijen: v.optional(v.number()),
    productRijen: v.optional(v.number()),
    geldigeRijen: v.number(),
    waarschuwingRijen: v.number(),
    foutRijen: v.number(),
    genegeerdeRijen: v.optional(v.number()),
    geimporteerdeProducten: v.optional(v.number()),
    bijgewerkteProducten: v.optional(v.number()),
    overgeslagenProducten: v.optional(v.number()),
    geimporteerdePrijzen: v.optional(v.number()),
    overgeslagenPrijzen: v.optional(v.number()),
    dubbeleProductMatches: v.optional(v.number()),
    nulPrijsRijen: v.optional(v.number()),
    onbekendeBtwModusRijen: v.optional(v.number()),
    productenZonderLeverancierCode: v.optional(v.number()),
    weesPrijsRegels: v.optional(v.number()),
    dubbeleBronSleutels: v.optional(v.number()),
    staBtwModusOnbekendToe: v.optional(v.boolean()),
    reconciliatie: v.optional(v.any()),
    mapping: v.optional(v.any()),
    createdByExternalUserId: v.optional(v.string()),
    importedByExternalUserId: v.optional(v.string()),
    geimporteerdOp: v.optional(v.number()),
    vastgelegdOp: v.optional(v.number()),
    misluktOp: v.optional(v.number()),
    foutmelding: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_supplier", ["tenantId", "leverancierId"])
    .index("by_status", ["tenantId", "status"]),

  productImportRows: defineTable({
    tenantId: v.id("tenants"),
    batchId: v.id("productImportBatches"),
    bronBestandsnaam: v.optional(v.string()),
    bronBladNaam: v.optional(v.string()),
    rijNummer: v.number(),
    rijHash: v.optional(v.string()),
    importSleutel: v.optional(v.string()),
    bronSleutel: v.optional(v.string()),
    ruweData: v.any(),
    genormaliseerd: v.optional(v.any()),
    status: v.union(
      v.literal("valid"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("ignored"),
      v.literal("imported")
    ),
    rijSoort: v.union(
      v.literal("header"),
      v.literal("section"),
      v.literal("product"),
      v.literal("empty"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("ignored")
    ),
    sectieLabel: v.optional(v.string()),
    waarschuwingen: v.array(v.string()),
    fouten: v.array(v.string()),
    geimporteerdProductId: v.optional(v.id("products")),
    geimporteerdePrijsIds: v.optional(v.array(v.id("productPrices"))),
    geimporteerdOp: v.optional(v.number()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_batch", ["tenantId", "batchId"])
    .index("by_status", ["tenantId", "batchId", "status"]),

  serviceCostRules: defineTable({
    tenantId: v.id("tenants"),
    categorieId: v.optional(v.id("categories")),
    naam: v.string(),
    omschrijving: v.optional(v.string()),
    berekeningType: v.union(
      v.literal("fixed"),
      v.literal("per_m2"),
      v.literal("per_meter"),
      v.literal("per_roll"),
      v.literal("per_side"),
      v.literal("per_staircase"),
      v.literal("manual")
    ),
    prijsExBtw: v.number(),
    btwTarief: v.number(),
    minQuantity: v.optional(v.number()),
    maxQuantity: v.optional(v.number()),
    metadata: v.optional(v.any()),
    status: statusActive,
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_category", ["tenantId", "categorieId"])
    .index("by_status", ["tenantId", "status"]),

  /**
   * Breedte×hoogte-prijsmatrices voor raambekleding (Duo, Geweven Hout, Horizontaal, Hout) —
   * geconsolideerd uit HenkeWonenDATA. NIEUWE tabel: Nederlandse veldnamen conform het
   * migratieplan (zo hoeft die straks niet opnieuw gemigreerd te worden). De enum-waarden van
   * `btwModus` blijven gedeeld met `productPrices` (validator `vatMode`).
   * `prijzen[hoogte-index][breedte-index]`; assen in cm, oplopend. De lookup rondt breedte/hoogte
   * omhoog naar de eerstvolgende maatklasse (zie src/lib/calculators/matrixCalculator.ts);
   * buiten bereik → "offerte op maat".
   */
  priceMatrices: defineTable({
    tenantId: v.id("tenants"),
    productToolSleutel: v.string(),
    prijsgroep: v.string(),
    bronBestand: v.optional(v.string()),
    bronBlad: v.optional(v.string()),
    breedteAs: v.array(v.number()),
    hoogteAs: v.array(v.number()),
    prijzen: v.array(v.array(v.number())),
    btwModus: vatMode,
    notities: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tool", ["tenantId", "productToolSleutel"])
    .index("by_tool_group", ["tenantId", "productToolSleutel", "prijsgroep"]),

  /**
   * Marge-delers/opslagen uit de prijslijst-formules (advies ÷ deler = pallet/commissie/coupage/
   * rolprijs) + placeholder-bedrijfsregels (snijverlies/arbeid/plooi/zoom/verbruik) — geconsolideerd
   * uit HenkeWonenDATA. NIEUWE tabel: Nederlandse veldnamen; `regelSoort`-enum-waarden blijven Engels.
   * `vereistKlantInput=true` markeert placeholders die met de eigenaar bevestigd moeten worden.
   */
  calculatorRules: defineTable({
    tenantId: v.id("tenants"),
    productToolSleutel: v.string(),
    regelSoort: calculatorRuleType,
    waarde: v.optional(v.number()),
    bronCel: v.optional(v.string()),
    notitie: v.optional(v.string()),
    vereistKlantInput: v.boolean(),
    status: statusActive,
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tool", ["tenantId", "productToolSleutel"])
    .index("by_tool_rule", ["tenantId", "productToolSleutel", "regelSoort"]),

  projects: defineTable({
    tenantId: v.id("tenants"),
    klantId: v.id("customers"),
    projectnummer: v.optional(v.string()),
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    // Directe verkoop: klant koopt een product zonder inmeten. Stuurt de "volgende
    // stap" naar de offerte i.p.v. inmeten zolang het project nog op "lead" staat.
    directeVerkoop: v.optional(v.boolean()),
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
    gewensteUitvoerdatum: v.optional(v.number()),
    inmeetdatum: v.optional(v.number()),
    uitvoerdatum: v.optional(v.number()),
    interneNotities: v.optional(v.string()),
    klantNotities: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string()),
    geaccepteerdOp: v.optional(v.number()),
    inmeetGeplandOp: v.optional(v.number()),
    uitvoerGeplandOp: v.optional(v.number()),
    besteldOp: v.optional(v.number()),
    gefactureerdOp: v.optional(v.number()),
    betaaldOp: v.optional(v.number()),
    afgeslotenOp: v.optional(v.number()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_customer", ["tenantId", "klantId"])
    .index("by_status", ["tenantId", "status"]),

  projectRooms: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    naam: v.string(),
    verdieping: v.optional(v.string()),
    breedteCm: v.optional(v.number()),
    lengteCm: v.optional(v.number()),
    hoogteCm: v.optional(v.number()),
    oppervlakteM2: v.optional(v.number()),
    omtrekMeter: v.optional(v.number()),
    notities: v.optional(v.string()),
    sortOrder: v.number(),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  }).index("by_project", ["tenantId", "projectId"]),

  measurements: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    klantId: v.id("customers"),
    status: measurementStatus,
    inmeetdatum: v.optional(v.number()),
    gemetenDoor: v.optional(v.string()),
    // Stabiele koppeling naar de monteur (users-tabel). gemetenDoor (naam) blijft
    // staan als leesbaar label + fallback voor oude rijen; userId is leidend voor
    // agenda/capaciteit zodat hernoemen of dubbele namen niets breken.
    gemetenDoorUserId: v.optional(v.id("users")),
    // Klusgrootte voor inmeet-capaciteit: "klein" (1-2 ramen / 1 ruimte) telt als
    // 1 plek, "volledig" (hele woning) als 2 — per inmeetdag is er ruimte voor 2.
    omvang: v.optional(v.union(v.literal("klein"), v.literal("volledig"))),
    notities: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_project", ["tenantId", "projectId"])
    .index("by_status", ["tenantId", "status"])
    .index("by_measurement_date", ["tenantId", "inmeetdatum"]),

  measurementRooms: defineTable({
    tenantId: v.id("tenants"),
    inmetingId: v.id("measurements"),
    // Ruimte-model A: elke inmeet-ruimte hoort verplicht bij één dossier-ruimte
    // (één ruimte-identiteit). De backfill (backfillMeasurementRoomLinksChunk) koppelde de
    // bestaande data; addMeasurementRoom zet de koppeling voortaan altijd (auto-promotie).
    projectRuimteId: v.id("projectRooms"),
    naam: v.string(),
    verdieping: v.optional(v.string()),
    breedteM: v.optional(v.number()),
    lengteM: v.optional(v.number()),
    hoogteM: v.optional(v.number()),
    oppervlakteM2: v.optional(v.number()),
    omtrekM: v.optional(v.number()),
    notities: v.optional(v.string()),
    sortOrder: v.number(),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_measurement", ["tenantId", "inmetingId"])
    .index("by_project_room", ["tenantId", "projectRuimteId"]),

  measurementLines: defineTable({
    tenantId: v.id("tenants"),
    inmetingId: v.id("measurements"),
    ruimteId: v.optional(v.id("measurementRooms")),
    productGroep: measurementProductGroup,
    berekeningType: measurementCalculationType,
    invoer: v.any(),
    resultaat: v.any(),
    snijverliesPct: v.optional(v.number()),
    aantal: v.number(),
    eenheid: v.string(),
    notities: v.optional(v.string()),
    offerteRegelType: quoteLineType,
    quotePreparationStatus,
    // True = hoeveelheid is handmatig aangepast; wordt dan NIET automatisch herrekend bij
    // een latere wijziging van de ruimtematen (krijgt in plaats daarvan een controle-seintje).
    handmatigAangepast: v.optional(v.boolean()),
    // Optionele productkeuze tijdens het inmeten + richtprijs-snapshot.
    // Snapshot = prijs op keuzemoment; de offerte blijft de plek voor de definitieve prijs.
    productId: v.optional(v.id("products")),
    productNaam: v.optional(v.string()),
    indicatieveEenheidsprijsExBtw: v.optional(v.number()),
    indicatiefBtwTarief: v.optional(v.number()),
    indicatievePrijsEenheid: v.optional(v.string()),
    indicatievePrijsSoort: v.optional(v.string()),
    indicatiefVastgelegdOp: v.optional(v.number()),
    geconverteerdeOfferteId: v.optional(v.id("quotes")),
    geconverteerdeOfferteregelId: v.optional(v.id("quoteLines")),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_measurement", ["tenantId", "inmetingId"])
    .index("by_room", ["tenantId", "ruimteId"])
    .index("by_product_group", ["tenantId", "productGroep"]),

  wasteProfiles: defineTable({
    tenantId: v.id("tenants"),
    productGroep: measurementProductGroup,
    naam: v.string(),
    standaardSnijverliesPct: v.number(),
    omschrijving: v.optional(v.string()),
    status: statusActive,
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_product_group", ["tenantId", "productGroep"])
    .index("by_status", ["tenantId", "status"]),

  quotes: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    klantId: v.id("customers"),
    offertenummer: v.string(),
    titel: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
    verzondenOp: v.optional(v.number()),
    geldigTot: v.optional(v.number()),
    inleidingTekst: v.optional(v.string()),
    afsluitTekst: v.optional(v.string()),
    voorwaarden: v.optional(v.array(v.string())),
    betalingsvoorwaarden: v.optional(v.array(v.string())),
    subtotaalExBtw: v.number(),
    btwTotaal: v.number(),
    totaalInclBtw: v.number(),
    geaccepteerdOp: v.optional(v.number()),
    afgewezenOp: v.optional(v.number()),
    createdByExternalUserId: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["tenantId", "projectId"])
    .index("by_customer", ["tenantId", "klantId"])
    .index("by_status", ["tenantId", "status"]),

  quoteLines: defineTable({
    tenantId: v.id("tenants"),
    quoteId: v.id("quotes"),
    projectRuimteId: v.optional(v.id("projectRooms")),
    productId: v.optional(v.id("products")),
    werktariefRegelId: v.optional(v.id("serviceCostRules")),
    regelType: v.union(
      v.literal("product"),
      v.literal("service"),
      v.literal("labor"),
      v.literal("material"),
      v.literal("discount"),
      v.literal("text"),
      v.literal("manual")
    ),
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    aantal: v.number(),
    eenheid: v.string(),
    eenheidsprijsExBtw: v.number(),
    btwTarief: v.number(),
    kortingExBtw: v.optional(v.number()),
    regelTotaalExBtw: v.number(),
    regelBtwTotaal: v.number(),
    regelTotaalInclBtw: v.number(),
    sortOrder: v.number(),
    metadata: v.optional(v.any()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_quote", ["tenantId", "quoteId"])
    .index("by_room", ["tenantId", "projectRuimteId"]),

  quoteTemplates: defineTable({
    tenantId: v.id("tenants"),
    naam: v.string(),
    type: v.union(
      v.literal("default"),
      v.literal("flooring"),
      v.literal("curtains"),
      v.literal("wall_panels"),
      v.literal("custom")
    ),
    inleidingTekst: v.optional(v.string()),
    afsluitTekst: v.optional(v.string()),
    secties: v.optional(
      v.array(
        v.object({
          sleutel: v.string(),
          titel: v.string(),
          omschrijving: v.optional(v.string()),
          sortOrder: v.number()
        })
      )
    ),
    standaardVoorwaarden: v.array(v.string()),
    betalingsvoorwaarden: v.optional(v.array(v.string())),
    standaardRegels: v.array(
      v.object({
        sectieSleutel: v.optional(v.string()),
        regelType: quoteLineType,
        titel: v.string(),
        eenheid: v.string(),
        omschrijving: v.optional(v.string()),
        standaardAantal: v.optional(v.number()),
        sortOrder: v.number(),
        optioneel: v.optional(v.boolean()),
        standaardIngeschakeld: v.optional(v.boolean()),
        categorieHint: v.optional(v.string()),
        productSoortHint: v.optional(v.string())
      })
    ),
    status: statusActive,
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
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
      // Afwijzing/verloop van een offerte: zonder dit event was een afgewezen
      // offerte onzichtbaar in de tijdlijn (stil dood einde tussen winkel en
      // buitendienst).
      v.literal("quote_rejected"),
      v.literal("thank_you_letter_sent"),
      v.literal("execution_planned"),
      v.literal("supplier_order_created"),
      v.literal("invoice_created"),
      v.literal("payment_reminder_sent"),
      v.literal("payment_received"),
      v.literal("bookkeeper_export_sent"),
      v.literal("closed")
    ),
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    zichtbaarVoorKlant: v.boolean(),
    createdByExternalUserId: v.optional(v.string()),
    aangemaaktOp: v.number()
  })
    .index("by_project", ["tenantId", "projectId"])
    .index("by_type", ["tenantId", "type"]),

  projectTasks: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    quoteId: v.optional(v.id("quotes")),
    type: projectTaskType,
    titel: v.string(),
    vervaltOp: v.number(),
    status: projectTaskStatus,
    voltooidOp: v.optional(v.number()),
    afgewezenOp: v.optional(v.number()),
    createdByExternalUserId: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_project", ["tenantId", "projectId"])
    .index("by_quote", ["tenantId", "quoteId"])
    .index("by_status", ["tenantId", "status"])
    .index("by_due_date", ["tenantId", "vervaltOp"]),

  importProfiles: defineTable({
    tenantId: v.id("tenants"),
    leverancierId: v.optional(v.id("suppliers")),
    categorieId: v.optional(v.id("categories")),
    leverancierNaam: v.string(),
    naam: v.string(),
    bestandPatroon: v.optional(v.string()),
    bladPatroon: v.optional(v.string()),
    verwachteBestandsextensie: v.optional(v.union(v.literal(".xlsx"), v.literal(".xls"))),
    ondersteuntXlsx: v.boolean(),
    ondersteuntXls: v.boolean(),
    bladMapping: v.optional(v.any()),
    koprijStrategie: v.optional(v.any()),
    sectierijStrategie: v.optional(v.any()),
    productSleutelStrategie: v.optional(v.any()),
    kolomMappings: v.optional(v.any()),
    prijskolomMappings: v.optional(v.any()),
    btwModusPerPrijskolom: v.optional(v.any()),
    eenheidPerPrijskolom: v.optional(v.any()),
    prijsSoortPerPrijskolom: v.optional(v.any()),
    staBtwModusOnbekendToe: v.optional(v.boolean()),
    btwModusReview: v.optional(v.any()),
    vatModeUpdatedByExternalUserId: v.optional(v.string()),
    btwModusGewijzigdOp: v.optional(v.number()),
    dubbelenStrategie: v.optional(v.any()),
    nulPrijsStrategie: v.optional(v.any()),
    mapping: v.any(),
    notities: v.optional(v.string()),
    status: statusActive,
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_supplier", ["tenantId", "leverancierNaam"])
    .index("by_status", ["tenantId", "status"]),

  catalogDataIssues: defineTable({
    tenantId: v.id("tenants"),
    kwestieSoort: v.union(v.literal("duplicate_ean")),
    ernst: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    status: v.union(
      v.literal("open"),
      v.literal("reviewed"),
      v.literal("accepted"),
      v.literal("resolved")
    ),
    leverancierId: v.optional(v.id("suppliers")),
    ean: v.optional(v.string()),
    productIds: v.array(v.id("products")),
    notities: v.optional(v.string()),
    metadata: v.optional(v.any()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_type_status", ["tenantId", "kwestieSoort", "status"])
    .index("by_supplier_ean", ["tenantId", "leverancierId", "ean"]),

  supplierOrders: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    quoteId: v.optional(v.id("quotes")),
    leverancierId: v.optional(v.id("suppliers")),
    bestelnummer: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("ordered"),
      v.literal("confirmed"),
      v.literal("partially_received"),
      v.literal("received"),
      v.literal("cancelled")
    ),
    besteldOp: v.optional(v.number()),
    verwachteLeverdatumOp: v.optional(v.number()),
    ontvangenOp: v.optional(v.number()),
    notities: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_project", ["tenantId", "projectId"])
    .index("by_supplier", ["tenantId", "leverancierId"])
    .index("by_status", ["tenantId", "status"]),

  supplierOrderLines: defineTable({
    tenantId: v.id("tenants"),
    bestellingId: v.id("supplierOrders"),
    productId: v.optional(v.id("products")),
    quoteLineId: v.optional(v.id("quoteLines")),
    projectRuimteId: v.optional(v.id("projectRooms")),
    omschrijving: v.string(),
    artikelnummer: v.optional(v.string()),
    leverancierCode: v.optional(v.string()),
    aantal: v.number(),
    eenheid: v.string(),
    inkoopPrijsExBtw: v.optional(v.number()),
    inkoopPrijsBron: v.optional(
      v.union(
        v.literal("net_purchase"),
        v.literal("purchase"),
        v.literal("manual"),
        v.literal("none")
      )
    ),
    regelTotaalExBtw: v.optional(v.number()),
    status: v.union(v.literal("ordered"), v.literal("received"), v.literal("cancelled")),
    notities: v.optional(v.string()),
    sortOrder: v.number(),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_order", ["tenantId", "bestellingId"])
    .index("by_quote_line", ["tenantId", "quoteLineId"]),

  invoices: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    klantId: v.id("customers"),
    quoteId: v.optional(v.id("quotes")),
    factuurnummer: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("partially_paid"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled")
    ),
    factuurdatum: v.number(),
    vervaldatum: v.number(),
    subtotaalExBtw: v.number(),
    btwTotaal: v.number(),
    totaalInclBtw: v.number(),
    betaaldBedrag: v.number(),
    betaaldOp: v.optional(v.number()),
    herinneringVerzondenOp: v.optional(v.number()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_project", ["tenantId", "projectId"])
    .index("by_customer", ["tenantId", "klantId"])
    .index("by_invoice_number", ["tenantId", "factuurnummer"])
    .index("by_status", ["tenantId", "status"])
    .index("by_due_date", ["tenantId", "vervaldatum"])
    // Geïndexeerde dedup/lookup van de factuur per offerte (existingInvoiceForQuote).
    .index("by_quote", ["tenantId", "quoteId"]),

  timelineEvents: defineTable({
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    klantId: v.optional(v.id("customers")),
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
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    zichtbaarVoorKlant: v.boolean(),
    createdByExternalUserId: v.optional(v.string()),
    aangemaaktOp: v.number()
  })
    .index("by_project", ["tenantId", "projectId"])
    .index("by_customer", ["tenantId", "klantId"])
    .index("by_type", ["tenantId", "type"]),

  // ── Agenda & beschikbaarheid (monteurs) ────────────────────────────────────
  // Terugkerende werktijden per monteur (gebruiker), per weekdag.
  // weekdag: 0 = maandag … 6 = zondag. Tijden in minuten sinds middernacht
  // (bv. 480 = 08:00, 1020 = 17:00).
  monteurWerktijden: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    weekdag: v.number(),
    startMinuut: v.number(),
    eindMinuut: v.number(),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_monteur", ["tenantId", "userId"]),

  // Afwezigheid/verlof/blokkade per monteur — onderbreekt de beschikbaarheid.
  // vanafDatum/totDatum: Unix-ms (dag-granulariteit bij heleDag, totDatum inclusief).
  // Bij een tijdvak (heleDag=false) gelden start-/eindMinuut binnen die dag(en).
  monteurAfwezigheid: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    type: v.union(
      v.literal("verlof"),
      v.literal("ziek"),
      v.literal("blokkade"),
      v.literal("overig")
    ),
    vanafDatum: v.number(),
    totDatum: v.number(),
    heleDag: v.boolean(),
    startMinuut: v.optional(v.number()),
    eindMinuut: v.optional(v.number()),
    reden: v.optional(v.string()),
    aangemaaktOp: v.number(),
    gewijzigdOp: v.number()
  })
    .index("by_tenant", ["tenantId"])
    .index("by_monteur", ["tenantId", "userId"])
    .index("by_periode", ["tenantId", "vanafDatum"])
});
