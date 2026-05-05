import { mutation } from "./_generated/server";
import { requireConvexToolingEnabled } from "./authz";

const categories = [
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

const suppliers = [
  "Headlam",
  "Interfloor",
  "Co-pro",
  "Ambiant",
  "EVC",
  "Floorlife",
  "vtwonen",
  "Roots"
];

const requestedSuppliers = [
  "Lifestyle",
  "Eco Line",
  "Nox",
  "Vadain",
  "Flex Colours",
  "Dib",
  "Douwes Dekker",
  "Hebeta",
  "Moduleo",
  "Casadeco",
  "Casamance",
  "Caselio",
  "Masureel",
  "Lamelio",
  "Uniluxe",
  "Busche",
  "Forest",
  "Qrail",
  "PPC"
];

type ServiceRuleSeed = {
  name: string;
  calculationType:
    | "fixed"
    | "per_m2"
    | "per_meter"
    | "per_roll"
    | "per_side"
    | "per_staircase"
    | "manual";
  priceExVat: number;
  vatRate: number;
  description: string;
};

const serviceCostRules: ServiceRuleSeed[] = [
  {
    name: "Dichte trap tapijt",
    calculationType: "fixed",
    priceExVat: 400,
    vatRate: 21,
    description: "Legkosten dichte trap tapijt"
  },
  {
    name: "Open trap tapijt",
    calculationType: "fixed",
    priceExVat: 500,
    vatRate: 21,
    description: "Legkosten open trap tapijt"
  },
  {
    name: "Ondertapijt",
    calculationType: "fixed",
    priceExVat: 250,
    vatRate: 21,
    description: "Ondertapijt vaste kosten"
  },
  {
    name: "PVC trap halve draai",
    calculationType: "fixed",
    priceExVat: 1795,
    vatRate: 21,
    description: "PVC trap halve draai"
  },
  {
    name: "PVC trap rechte trap",
    calculationType: "fixed",
    priceExVat: 1595,
    vatRate: 21,
    description: "PVC trap rechte trap"
  },
  {
    name: "PVC trap kwart draai",
    calculationType: "fixed",
    priceExVat: 1695,
    vatRate: 21,
    description: "PVC trap kwart draai"
  },
  {
    name: "Extra toeslag open trap",
    calculationType: "fixed",
    priceExVat: 100,
    vatRate: 21,
    description: "Toeslag voor open trap"
  },
  {
    name: "Vinyl trap",
    calculationType: "fixed",
    priceExVat: 450,
    vatRate: 21,
    description: "Vinyl trap legkosten"
  },
  {
    name: "Strippen",
    calculationType: "fixed",
    priceExVat: 150,
    vatRate: 21,
    description: "Strippen werkzaamheden"
  },
  {
    name: "Private Label Henke Wonen",
    calculationType: "per_m2",
    priceExVat: 28.95,
    vatRate: 21,
    description: "Private label vloer/product per m2"
  },
  {
    name: "Egaliseren m2",
    calculationType: "per_m2",
    priceExVat: 15.95,
    vatRate: 21,
    description: "Egaliseren per m2"
  },
  {
    name: "Egaliseren plavuizen m2",
    calculationType: "per_m2",
    priceExVat: 19.5,
    vatRate: 21,
    description: "Egaliseren plavuizen per m2"
  },
  {
    name: "Vloerverwarming dichtzetten",
    calculationType: "per_m2",
    priceExVat: 12.95,
    vatRate: 21,
    description: "Vloerverwarming dichtzetten per m2"
  },
  {
    name: "Legkosten rechte plank m2",
    calculationType: "per_m2",
    priceExVat: 17.5,
    vatRate: 21,
    description: "Legkosten rechte plank per m2"
  },
  {
    name: "Legkosten visgraat m2",
    calculationType: "per_m2",
    priceExVat: 22.5,
    vatRate: 21,
    description: "Legkosten visgraat per m2"
  },
  {
    name: "Legkosten visgraat met bies",
    calculationType: "per_m2",
    priceExVat: 35,
    vatRate: 21,
    description: "Legkosten visgraat met bies per m2"
  },
  {
    name: "PVC plakondervloer",
    calculationType: "per_m2",
    priceExVat: 22.95,
    vatRate: 21,
    description: "PVC plakondervloer per m2"
  },
  {
    name: "Behangen patroon per rol",
    calculationType: "per_roll",
    priceExVat: 65,
    vatRate: 21,
    description: "Behangen patroon per rol"
  },
  {
    name: "Behangen uni per rol",
    calculationType: "per_roll",
    priceExVat: 55,
    vatRate: 21,
    description: "Behangen uni per rol"
  }
];

const quoteTemplateSections = [
  {
    key: "vloeren",
    title: "Vloeren",
    description: "Ondervloer, egaliseren, vloerproduct en legwerk.",
    sortOrder: 1
  },
  {
    key: "plinten",
    title: "Plinten",
    description: "Plinten geleverd en geplaatst.",
    sortOrder: 2
  },
  {
    key: "raamdecoratie",
    title: "Gordijnen & raamdecoratie",
    description: "Gordijnen, rails, plissés, jaloezieën en duettes.",
    sortOrder: 3
  },
  {
    key: "traprenovatie",
    title: "Traprenovatie",
    description: "PVC traprenovatie inclusief kleur en stripkeuze.",
    sortOrder: 4
  },
  {
    key: "wandafwerking",
    title: "Wandafwerking",
    description: "Wandpanelen inclusief montagebenodigdheden.",
    sortOrder: 5
  },
  {
    key: "behang",
    title: "Behang",
    description: "Behang geleverd en aanbrengen behang als aparte arbeidsregel.",
    sortOrder: 6
  },
  {
    key: "voorwaarden",
    title: "Voorwaarden",
    description: "Standaard uitvoeringsvoorwaarden.",
    sortOrder: 7
  },
  {
    key: "facturering",
    title: "Facturering",
    description: "Betaling, aanbetaling en betaaltermijnen.",
    sortOrder: 8
  }
];

const quoteTerms = [
  "Prijzen zijn inclusief 21% btw.",
  "De te leggen ruimtes dienen volledig leeg te zijn bij aanvang van de werkzaamheden.",
  "De vloeren dienen droog en vrij van olie of vet te zijn.",
  "Temperatuur is minimaal 18 graden Celsius i.v.m. droging egalisatie en lijmproducten.",
  "Vensterbanken zijn leeg en de ramen zijn vrij. Ruimte minimaal 1 meter.",
  "Muren zijn behangklaar en vrij van spijkers, schroeven en pluggen.",
  "Water en stroom zijn beschikbaar.",
  "Parkeergelegenheid binnen 25 meter van de hoofdingang."
];

const paymentTerms = [
  "100% bij oplevering.",
  "Bij bedragen boven €10.000 wordt een aanbetaling gevraagd van 30%.",
  "Bij meubels wordt altijd een aanbetaling gevraagd van 50%.",
  "Contante betalingen tot €3.000 worden geaccepteerd, daarboven alleen overschrijving of pin.",
  "Bij pinbetaling wordt 2% toeslag over het gehele bedrag berekend.",
  "Bij overschrijving hanteert Henke Wonen een betalingstermijn van 8 dagen."
];

const quoteTemplateLines = [
  {
    sectionKey: "vloeren",
    lineType: "material",
    title: "Zwevende zelfklevende ondervloer t.b.v. PVC",
    description: "Ondervloer voor PVC, hoeveelheid per m² invullen.",
    unit: "m2",
    defaultQuantity: 1,
    sortOrder: 1,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Ondervloer",
    productKindHint: "underlay"
  },
  {
    sectionKey: "vloeren",
    lineType: "labor",
    title: "Primeren en egaliseren",
    description: "Voorbehandeling en egaliseren per m².",
    unit: "m2",
    defaultQuantity: 1,
    sortOrder: 2,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Egaline"
  },
  {
    sectionKey: "vloeren",
    lineType: "product",
    title: "PVC/tapijt/vinyl fabrikant, naam, kleur",
    description: "Vloerproduct inclusief fabrikant, collectie/naam en kleur.",
    unit: "m2",
    defaultQuantity: 1,
    sortOrder: 3,
    optional: true,
    defaultEnabled: false,
    categoryHint: "PVC Vloeren / Tapijt / Vinyl"
  },
  {
    sectionKey: "vloeren",
    lineType: "labor",
    title: "Legkosten PVC visgraat/rechte plank/tapijt/vinyl",
    description: "Legwerk als aparte arbeidsregel per m².",
    unit: "m2",
    defaultQuantity: 1,
    sortOrder: 4,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Werkzaamheden"
  },
  {
    sectionKey: "plinten",
    lineType: "product",
    title: "Plinten maat kleur geplaatst",
    description: "Plintmaat en kleur invullen; montage apart in tekst of prijs opnemen.",
    unit: "meter",
    defaultQuantity: 1,
    sortOrder: 5,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Plinten",
    productKindHint: "plinth"
  },
  {
    sectionKey: "raamdecoratie",
    lineType: "manual",
    title: "Gordijnen fabrikant, stof en kleur",
    description: "Maatwerkregel voor gordijnen, stofkwaliteit en kleur.",
    unit: "custom",
    defaultQuantity: 1,
    sortOrder: 6,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Gordijnen",
    productKindHint: "curtain_fabric"
  },
  {
    sectionKey: "raamdecoratie",
    lineType: "product",
    title: "Gordijnrails merk, kleur",
    description: "Rail/roede met merk, kleur en lengte.",
    unit: "meter",
    defaultQuantity: 1,
    sortOrder: 7,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Roedes/Railsen",
    productKindHint: "rail"
  },
  {
    sectionKey: "raamdecoratie",
    lineType: "manual",
    title: "Plissés fabrikant, kleur",
    description: "Maatwerkregel voor plissé raamdecoratie.",
    unit: "custom",
    defaultQuantity: 1,
    sortOrder: 8,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Raambekleding",
    productKindHint: "plisse"
  },
  {
    sectionKey: "raamdecoratie",
    lineType: "manual",
    title: "Houten/bamboe jaloezieën fabrikant, kleur",
    description: "Maatwerkregel voor houten of bamboe jaloezieën.",
    unit: "custom",
    defaultQuantity: 1,
    sortOrder: 9,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Raambekleding",
    productKindHint: "jaloezie"
  },
  {
    sectionKey: "raamdecoratie",
    lineType: "manual",
    title: "Duettes fabrikant, kleur",
    description: "Maatwerkregel voor duette raamdecoratie.",
    unit: "custom",
    defaultQuantity: 1,
    sortOrder: 10,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Raambekleding",
    productKindHint: "duette"
  },
  {
    sectionKey: "traprenovatie",
    lineType: "manual",
    title: "Traprenovatie PVC fabrikant, kleur, kleur strip",
    description: "Traprenovatie inclusief fabrikant, kleur en stripkleur.",
    unit: "stairs",
    defaultQuantity: 1,
    sortOrder: 11,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Traprenovatie"
  },
  {
    sectionKey: "wandafwerking",
    lineType: "product",
    title: "Wandpanelen merk, kleur",
    description: "Wandpanelen geplaatst inclusief benodigde lijm waar van toepassing.",
    unit: "m2",
    defaultQuantity: 1,
    sortOrder: 12,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Wandpanelen",
    productKindHint: "panel"
  },
  {
    sectionKey: "behang",
    lineType: "product",
    title: "Behang merk, kleur",
    description: "Behang geleverd; aantal rollen kan met de behangcalculator worden voorbereid.",
    unit: "roll",
    defaultQuantity: 1,
    sortOrder: 13,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Behang",
    productKindHint: "wallpaper"
  },
  {
    sectionKey: "behang",
    lineType: "labor",
    title: "Aanbrengen behang",
    description: "Arbeidsregel voor aanbrengen behang per rol.",
    unit: "roll",
    defaultQuantity: 1,
    sortOrder: 14,
    optional: true,
    defaultEnabled: false,
    categoryHint: "Behang"
  }
] as const;

const importProfiles = [
  {
    supplierName: "Interfloor",
    name: "Interfloor legacy artikeloverzicht",
    filePattern: "*Interfloor*.xls",
    sheetPattern: "*",
    supportsXlsx: false,
    supportsXls: true,
    mapping: {
      category: "tapijt",
      productKind: "carpet",
      codeColumns: ["Art.nr."],
      preserveLeadingDots: true,
      nameColumns: ["Omschrijving", "Kleurnummer", "Kleurindicatie"],
      dimensionColumns: ["Breedte"],
      priceColumns: [
        {
          header: "Adviesverkoop per m1",
          priceType: "advice_retail",
          priceUnit: "m1",
          vatMode: "unknown"
        }
      ]
    },
    notes: "Art.nr. altijd als string bewaren, ook waarden zoals .007609."
  },
  {
    supplierName: "Headlam",
    name: "Headlam gordijnstoffen Complete Collectie 2026",
    filePattern: "*Gordijnen*Headlam*.xlsx",
    sheetPattern: "Collectie Compleet",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "gordijnen",
      productKind: "curtain_fabric",
      productType: "made_to_measure",
      codeColumns: ["Supplier Code"],
      nameColumns: ["Quality", "Design"],
      brandColumns: ["Company"],
      priceColumns: [
        {
          header: "Consumer Price",
          priceType: "advice_retail",
          priceUnit: "m1",
          vatMode: "unknown"
        }
      ],
      attributeColumns: [
        "Width",
        "Type",
        "Kamerhoog",
        "Lining",
        "Pattern Length",
        "Weight",
        "Roman Blinds",
        "Pattern Width",
        "Material Style",
        "Washing Symbols",
        "Composition",
        "Suitable for Panel Curtains",
        "Full Length Curtains",
        "Mart Visser"
      ]
    },
    notes: "Made-to-measure fabric dataset met suitability flags en attributes."
  },
  {
    supplierName: "Floorlife",
    name: "Floorlife/Ambiant PVC 11-2025",
    filePattern: "*PVC*11-2025*.xlsx",
    sheetPattern: "Floorlife PVC *",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "pvc",
      productKindFromSheet: true,
      codeColumns: ["Artikelnummer", "EAN"],
      commercialNameColumns: [
        ["Ambiant Collectie", "Ambiant Kleur"],
        ["Floorlife Collectie", "Floorlife Kleur"]
      ],
      quantityColumns: ["Aantal pakker per pallet"],
      priceColumns: [
        { header: "Palletprijs EUR m2", priceType: "pallet", priceUnit: "m2", vatMode: "unknown" },
        { header: "Commissieprijs EUR m2", priceType: "commission", priceUnit: "m2", vatMode: "unknown" },
        { header: "Trailerprijs", priceType: "trailer", priceUnit: "m2", vatMode: "unknown" },
        { header: "Adviesverkoopprijs EUR m2", priceType: "advice_retail", priceUnit: "m2", vatMode: "unknown" }
      ]
    },
    notes: "PVC kan Ambiant en Floorlife commercialNames bevatten."
  },
  {
    supplierName: "EVC",
    name: "EVC PVC click dryback",
    filePattern: "*EVC*click*dryback*.xlsx",
    sheetPattern: "*",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "pvc",
      codeColumns: ["Artikelnummer"],
      commercialNameColumns: [
        ["Ambiant Collectie", "Ambiant Kleur"],
        ["Floorlife Collectie", "Floorlife Kleur"]
      ],
      quantityColumns: ["Aantal pakker per pallet"],
      priceColumns: ["Palletprijs EUR m2", "Commissieprijs EUR m2", "Adviesverkoopprijs EUR m2"]
    },
    notes: "Kleine PVC-set met dezelfde Ambiant/Floorlife aliasstructuur."
  },
  {
    supplierName: "vtwonen",
    name: "vtwonen PVC click dryback",
    filePattern: "*vtwonen*pvc*.xlsx",
    sheetPattern: "Prijslijst - vtwonen PVC *",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "pvc",
      codeColumns: ["Artikelnummer", "EAN code"],
      sectionRows: true,
      quantityColumns: ["Pakken per pallet"],
      priceColumns: ["Palletprijs EUR m2", "Commissieprijs EUR m2", "Adviesverkoopprijs EUR m2"]
    },
    notes: "Sectierijen door laten lopen naar collectie/subcategorie."
  },
  {
    supplierName: "vtwonen",
    name: "vtwonen karpetten 2024",
    filePattern: "*Karpetten*.xlsx",
    sheetPattern: "Blad1",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "karpetten",
      productKind: "rug",
      codeColumns: ["Artikelnummer"],
      nameColumns: ["Kwaliteit", "Afmeting (cm)"],
      priceColumns: [
        { header: "Inkoopprijs", priceType: "purchase", priceUnit: "piece", vatMode: "unknown" },
        { header: "Adviesverkoopprijs", priceType: "advice_retail", priceUnit: "piece", vatMode: "unknown" }
      ],
      attributeColumns: ["Totale dikte (mm)", "Poolhoogte (mm)", "Verfmethode", "Poolmateriaal", "Soort Backing", "Garantie Woongebruik"]
    },
    notes: "Karpetten zijn losse verkoopproducten, geen PVC en geen tapijtrol."
  },
  {
    supplierName: "Roots",
    name: "Roots collectie NL 2026",
    filePattern: "*Roots*2026*.xlsx",
    sheetPattern: "ROOTS 2026*",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "pvc",
      productKind: "click",
      codeColumns: ["SAP codes floors", "Commercial Code", "EAN Code"],
      supplierCodeColumn: "SAP codes floors",
      commercialCodeColumn: "Commercial Code",
      priceColumns: [
        { header: "Adviesverkoopprijs vanaf 01/05/2026", priceType: "advice_retail", priceUnit: "pack", vatMode: "unknown" },
        { header: "Netto inkoop per pak", priceType: "net_purchase", priceUnit: "pack", vatMode: "unknown" },
        { header: "Adviesverkoopprijs / m2 vanaf 01/05/2026", priceType: "advice_retail", priceUnit: "m2", vatMode: "unknown" }
      ],
      quantityColumns: ["Panels", "Packs"]
    },
    notes: "SAP code en commercial code apart bewaren; validFrom 01-05-2026."
  },
  {
    supplierName: "Co-pro",
    name: "Co-pro entreematten 2025",
    filePattern: "*Entreematten*.xlsx",
    sheetPattern: "Ambiant Entreematten",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "entreematten",
      productKind: "mat",
      sectionRows: true,
      nameColumns: ["Kwaliteit", "Afmetingen in cm"],
      priceColumns: [
        { header: "Coupageprijs", priceType: "cut_length", priceUnit: "m1", vatMode: "unknown" },
        { header: "Rolprijs", priceType: "roll", priceUnit: "roll", vatMode: "unknown" },
        { header: "Adviesverkoopprijs per m1 /stuks", priceType: "advice_retail", priceUnit: "m1", vatMode: "unknown" },
        { header: "Adviesverkoopprijs per m2 /stuks", priceType: "advice_retail", priceUnit: "m2", vatMode: "unknown" }
      ]
    },
    notes: "Geen harde artikelcodekolom; sectie en kwaliteit zijn belangrijk voor herkenning."
  },
  {
    supplierName: "Co-pro",
    name: "Co-pro lijm kit egaline 2025",
    filePattern: "*lijm*kit*egaline*.xlsx",
    sheetPattern: "Blad1",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      categoryFromSectionOrName: true,
      productKind: "adhesive",
      codeColumns: ["Artikelnummer", "EAN code"],
      quantityColumns: ["aantal per pallet"],
      priceColumns: [
        { header: "Palletprijs / per verpakking", priceType: "pallet", priceUnit: "package", vatMode: "unknown" },
        { header: "Palletprijs / per stuk, kilo, liter", priceType: "pallet", priceUnit: "custom", vatMode: "unknown" },
        { header: "commisieprijs / per verpakking", priceType: "commission", priceUnit: "package", vatMode: "unknown" },
        { header: "commisieprijs / per stuk, kilo, liter", priceType: "commission", priceUnit: "custom", vatMode: "unknown" },
        { header: "Adviesverkoopprijs incl. BTW. per verpakking", priceType: "advice_retail", priceUnit: "package", vatMode: "inclusive" }
      ]
    },
    notes: "Let op adviesverkoop incl. BTW per verpakking."
  },
  {
    supplierName: "Co-pro",
    name: "Co-pro plinten 2025",
    filePattern: "*Plinten*.xlsx",
    sheetPattern: "juli 2025",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "plinten",
      productKind: "plinth",
      codeColumns: ["Artikelnummer", "EAN code"],
      sectionRows: true,
      quantityColumns: ["bundel", "Besteleenheid", "plinten per pallet", "plinten per trailer"],
      priceColumns: [
        { header: "Palletprijs lengte (3,0)", priceType: "pallet", priceUnit: "meter", vatMode: "unknown" },
        { header: "Palletprijs (3,0) m1", priceType: "pallet", priceUnit: "m1", vatMode: "unknown" },
        { header: "Commissieprijs lengte (2,7)", priceType: "commission", priceUnit: "meter", vatMode: "unknown" },
        { header: "Commissieprijs (2,7) m1", priceType: "commission", priceUnit: "m1", vatMode: "unknown" },
        { header: "Adviesverkoopprijs lengte", priceType: "advice_retail", priceUnit: "meter", vatMode: "unknown" }
      ]
    },
    notes: "Plinten combineren verkoopproduct, lengtematen, bundels en montage in offertes."
  },
  {
    supplierName: "Ambiant",
    name: "Ambiant tapijt 2025",
    filePattern: "*Ambiant*Tapijt*.xlsx",
    sheetPattern: "Tapijt",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "tapijt",
      productKind: "carpet",
      supplierProductGroupColumn: "Artikelgroep",
      sectionRows: true,
      priceColumns: ["Rolprijs EUR m1", "Rolprijs EUR m2", "Coupageprijs EUR m1", "Coupageprijs EUR m2", "Adviesverkoopprijs EUR m1", "Adviesverkoopprijs EUR m2"]
    },
    notes: "Artikelgroep is assortimentgroep, niet als unieke artikelcode gebruiken."
  },
  {
    supplierName: "Ambiant",
    name: "Ambiant vinyl 2024",
    filePattern: "*Ambiant*Vinyl*.xlsx",
    sheetPattern: "Vinyl",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "vinyl",
      productKind: "vinyl",
      supplierProductGroupColumn: "Artikelgroep",
      sectionRows: true,
      priceColumns: ["Rolprijs EUR m1", "Rolprijs EUR m2", "Coupageprijs EUR m1", "Coupageprijs EUR m2", "Adviesverkoopprijs EUR m1", "Adviesverkoopprijs EUR m2"]
    },
    notes: "Vinyl bevat secties en rol/coupageprijzen per m1 en m2."
  },
  {
    supplierName: "Floorlife",
    name: "Traprenovatie Floorlife 2025",
    filePattern: "*Traprenovatie*.xlsx",
    sheetPattern: "Prijslijst*",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "traprenovatie",
      productKind: "other",
      codeColumns: ["Artikelnummer", "EAN code"],
      quantityColumns: ["Besteleenheid"],
      priceColumns: [
        { header: "prijs per verpakkking", priceType: "package", priceUnit: "pack", vatMode: "unknown" },
        { header: "prijs per trede / stuk", priceType: "step", priceUnit: "step", vatMode: "unknown" },
        { header: "adviesverkoopprijs per verpakkking", priceType: "advice_retail", priceUnit: "pack", vatMode: "unknown" },
        { header: "adviesverkoopprijs per trede / stuk", priceType: "advice_retail", priceUnit: "step", vatMode: "unknown" }
      ]
    },
    notes: "Traprenovatie combineert productregels met vaste arbeids-/prijsregels."
  },
  {
    supplierName: "Floorlife",
    name: "Douchepanelen en tegels 2025",
    filePattern: "*Douchepanelen*tegels*.xlsx",
    sheetPattern: "Blad1",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      categoryFromSectionOrName: true,
      productKind: "panel",
      codeColumns: ["Artikelnummer"],
      sectionRows: true,
      quantityColumns: ["Aantal panelen per pak", "Afname pallet = stuks"],
      priceColumns: [
        { header: "Inkoopprijs per stuk", priceType: "purchase", priceUnit: "piece", vatMode: "unknown" },
        { header: "Inkoopprijs per pallet", priceType: "purchase", priceUnit: "pallet", vatMode: "unknown" },
        { header: "Adviesverkoopprijs per pak", priceType: "advice_retail", priceUnit: "pack", vatMode: "unknown" }
      ]
    },
    notes: "Bevat panelen en tegels met sectierijen; mapping per sectie bevestigen."
  },
  {
    supplierName: "Floorlife",
    name: "Wandpanelen 2025",
    filePattern: "*Wandpanelen*.xlsx",
    sheetPattern: "Blad1",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "wandpanelen",
      productKind: "panel",
      codeColumns: ["Artikelnummer"],
      sectionRows: true,
      quantityColumns: ["Aantal panelen per pak", "Afname pallet = stuks"],
      priceColumns: [
        { header: "Inkoopprijs per stuk", priceType: "purchase", priceUnit: "piece", vatMode: "unknown" },
        { header: "Palletprijs per stuk", priceType: "pallet", priceUnit: "piece", vatMode: "unknown" },
        { header: "Adviesverkoopprijs per stuk", priceType: "advice_retail", priceUnit: "piece", vatMode: "unknown" }
      ]
    },
    notes: "Panelen hebben materiaal/backing/vochtwerend als attributes."
  },
  {
    supplierName: "Floorlife",
    name: "PVC palletcollectie 2025",
    filePattern: "*palletcollectie*.xlsx",
    sheetPattern: "Collectie overzicht",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "palletcollectie-pvc",
      productKind: "click",
      codeColumns: ["Artikelnummer", "EAN-code"],
      quantityColumns: ["Aantal m2 per pak", "Aantal pakken per pallet"],
      priceColumns: [
        { header: "inkoop op commissie", priceType: "commission", priceUnit: "pack", vatMode: "unknown" },
        { header: "Adviesverkoopprijs", priceType: "advice_retail", priceUnit: "m2", vatMode: "unknown" }
      ]
    },
    notes: "Palletafname is prijsbron/conditie; niet dedupliceren op bestandsnaam."
  }
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("/", "-")
    .replaceAll(".", "")
    .replaceAll(",", "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export const run = mutation({
  args: {},
  handler: async (ctx) => {
    requireConvexToolingEnabled("seed.run");
    const now = Date.now();

    const tenant =
      (await ctx.db
        .query("tenants")
        .withIndex("by_slug", (q) => q.eq("slug", "henke-wonen"))
        .first()) ??
      ({
        _id: await ctx.db.insert("tenants", {
          slug: "henke-wonen",
          name: "Henke Wonen",
          status: "active",
          createdAt: now,
          updatedAt: now
        })
      } as const);

    const tenantId = tenant._id;

    for (let index = 0; index < categories.length; index++) {
      const name = categories[index];
      const slug = slugify(name);
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("tenantId", tenantId).eq("slug", slug))
        .first();

      if (!existing) {
        await ctx.db.insert("categories", {
          tenantId,
          name,
          slug,
          sortOrder: index + 1,
          status: "active",
          createdAt: now,
          updatedAt: now
        });
      }
    }

    for (const supplierName of suppliers) {
      const existing = await ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .filter((q) => q.eq(q.field("name"), supplierName))
        .first();

      if (!existing) {
        await ctx.db.insert("suppliers", {
          tenantId,
          name: supplierName,
          productListStatus: "received",
          createdAt: now,
          updatedAt: now
        });
      }
    }

    for (const supplierName of requestedSuppliers) {
      const existing = await ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .filter((q) => q.eq(q.field("name"), supplierName))
        .first();

      if (!existing) {
        await ctx.db.insert("suppliers", {
          tenantId,
          name: supplierName,
          productListStatus: "requested",
          notes: "Genoemd in overzicht, prijslijst nog niet aangeleverd.",
          createdAt: now,
          updatedAt: now
        });
      }
    }

    for (const rule of serviceCostRules) {
      const existing = await ctx.db
        .query("serviceCostRules")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .filter((q) => q.eq(q.field("name"), rule.name))
        .first();

      if (!existing) {
        await ctx.db.insert("serviceCostRules", {
          tenantId,
          name: rule.name,
          description: rule.description,
          calculationType: rule.calculationType,
          priceExVat: rule.priceExVat,
          vatRate: rule.vatRate,
          status: "active",
          createdAt: now,
          updatedAt: now
        });
      }
    }

    const existingTemplate = await ctx.db
      .query("quoteTemplates")
      .withIndex("by_type", (q) => q.eq("tenantId", tenantId).eq("type", "default"))
      .filter((q) => q.eq(q.field("name"), "Standaard offerte woninginrichting"))
      .first();

    const legacyTemplate = existingTemplate
      ? null
      : await ctx.db
          .query("quoteTemplates")
          .withIndex("by_type", (q) => q.eq("tenantId", tenantId).eq("type", "default"))
          .filter((q) => q.eq(q.field("name"), "Henke Wonen standaard offerte"))
          .first();

    const templateToUpdate = existingTemplate ?? legacyTemplate;
    const defaultLines = quoteTemplateLines.map((line) => ({ ...line }));

    if (templateToUpdate) {
      await ctx.db.patch(templateToUpdate._id, {
        name: "Standaard offerte woninginrichting",
        sections: quoteTemplateSections,
        defaultTerms: quoteTerms,
        paymentTerms,
        defaultLines,
        status: "active",
        updatedAt: now
      });
    } else {
      await ctx.db.insert("quoteTemplates", {
        tenantId,
        name: "Standaard offerte woninginrichting",
        type: "default",
        sections: quoteTemplateSections,
        defaultTerms: quoteTerms,
        paymentTerms,
        defaultLines,
        status: "active",
        createdAt: now,
        updatedAt: now
      });
    }

    for (const profile of importProfiles) {
      const existing = await ctx.db
        .query("importProfiles")
        .withIndex("by_supplier", (q) =>
          q.eq("tenantId", tenantId).eq("supplierName", profile.supplierName)
        )
        .filter((q) => q.eq(q.field("name"), profile.name))
        .first();

      const mapping = {
        preserveCodesAsString: true,
        detectSectionRows: true,
        inferVatMode: true,
        preserveCommercialNames: true,
        separateQuantityColumnsFromPrices: true,
        ...(profile.mapping ?? {})
      };
      const supplier = await ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .filter((q) => q.eq(q.field("name"), profile.supplierName))
        .first();
      const mappedCategorySlug =
        typeof mapping.category === "string" ? slugify(mapping.category) : undefined;
      const category = mappedCategorySlug
        ? await ctx.db
            .query("categories")
            .withIndex("by_slug", (q) => q.eq("tenantId", tenantId).eq("slug", mappedCategorySlug))
            .first()
        : null;
      const priceColumns = Array.isArray(mapping.priceColumns) ? mapping.priceColumns : [];
      const existingVatModeByPriceColumn = existing?.vatModeByPriceColumn ?? {};
      const existingPriceColumnMappings = Array.isArray(existing?.priceColumnMappings)
        ? existing.priceColumnMappings
        : [];
      const existingVatModeForColumn = (header: string, sourceColumnIndex: number) => {
        const mappedVatMode = existingVatModeByPriceColumn[header];

        if (
          mappedVatMode === "inclusive" ||
          mappedVatMode === "exclusive" ||
          mappedVatMode === "unknown"
        ) {
          return mappedVatMode;
        }

        const existingColumn = existingPriceColumnMappings.find((column: any, index: number) => {
          const existingHeader = column.header ?? column.sourceColumnName;
          const existingIndex =
            typeof column.sourceColumnIndex === "number" ? column.sourceColumnIndex : index;

          return existingHeader === header || existingIndex === sourceColumnIndex;
        });

        return existingColumn?.vatMode;
      };
      const priceColumnObjects = priceColumns.map((column: any, index: number) => {
        const baseColumn =
          typeof column === "string"
            ? {
                header: column,
                sourceColumnIndex: index,
                priceType: "manual",
                priceUnit: "custom",
                vatMode: "unknown"
              }
            : {
                sourceColumnIndex: index,
                ...column
              };
        const header = baseColumn.header ?? baseColumn.sourceColumnName ?? `Kolom ${index + 1}`;
        const sourceColumnIndex =
          typeof baseColumn.sourceColumnIndex === "number" ? baseColumn.sourceColumnIndex : index;

        return {
          ...baseColumn,
          header,
          sourceColumnIndex,
          vatMode:
            existingVatModeForColumn(header, sourceColumnIndex) ??
            baseColumn.vatMode ??
          "unknown"
        };
      });
      const mappingWithPreservedPriceColumns = {
        ...mapping,
        priceColumns: priceColumnObjects
      };
      const vatModeByPriceColumn = Object.fromEntries(
        priceColumnObjects.map((column: any) => [column.header, column.vatMode ?? "unknown"])
      );
      const unitByPriceColumn = Object.fromEntries(
        priceColumnObjects.map((column: any) => [column.header, column.priceUnit ?? "custom"])
      );
      const priceTypeByPriceColumn = Object.fromEntries(
        priceColumnObjects.map((column: any) => [column.header, column.priceType ?? "manual"])
      );
      const profileFields = {
        supplierId: supplier?._id,
        categoryId: category?._id,
        expectedFileExtension:
          profile.supportsXls && !profile.supportsXlsx ? (".xls" as const) : (".xlsx" as const),
        filePattern: profile.filePattern,
        sheetPattern: profile.sheetPattern,
        supportsXlsx: profile.supportsXlsx,
        supportsXls: profile.supportsXls,
        sheetMapping: {
          pattern: profile.sheetPattern ?? "*",
          strategy: "match_by_name_or_first_usable_sheet"
        },
        headerRowStrategy: {
          strategy: "detect",
          maxScanRows: 100,
          preserveOriginalHeaders: true
        },
        sectionRowStrategy: {
          strategy: mapping.detectSectionRows || mapping.sectionRows ? "detect" : "optional",
          maxFilledCells: 2,
          requireNoCodeAndNoPrice: true
        },
        productKeyStrategy: {
          preserveCodesAsString: true,
          priority: ["articleNumber", "supplierCode", "ean", "commercialCode", "importKey"],
          fallback:
            "tenantId + supplierId + sourceFileName + sourceSheetName + rowHash, daarna supplier + collection + productName + colorName + width + unit"
        },
        columnMappings: mappingWithPreservedPriceColumns,
        priceColumnMappings: priceColumnObjects,
        vatModeByPriceColumn,
        unitByPriceColumn,
        priceTypeByPriceColumn,
        duplicateStrategy: {
          product: "tenantId + supplierId + articleNumber/supplierCode/EAN/importKey",
          price: "priceListId + priceType + unit + vatMode + validFrom + sourceColumnIndex",
          updateExistingProducts: true,
          keepPricesPerSourceKey: true
        },
        zeroPriceStrategy: {
          strategy: "skip",
          warning: true
        },
        allowUnknownVatMode: existing?.allowUnknownVatMode ?? false,
        vatModeReview: existing?.vatModeReview,
        vatModeUpdatedByExternalUserId: existing?.vatModeUpdatedByExternalUserId,
        vatModeUpdatedAt: existing?.vatModeUpdatedAt,
        mapping: mappingWithPreservedPriceColumns,
        notes: profile.notes,
        status: "active" as const
      };

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...profileFields,
          updatedAt: now
        });
      } else {
        await ctx.db.insert("importProfiles", {
          tenantId,
          supplierName: profile.supplierName,
          name: profile.name,
          ...profileFields,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    const activeImportProfileKeys = new Set(
      importProfiles.map((profile) => `${profile.supplierName}::${profile.name}`)
    );
    const tenantImportProfiles = await ctx.db
      .query("importProfiles")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    for (const profile of tenantImportProfiles) {
      const key = `${profile.supplierName}::${profile.name}`;
      if (!activeImportProfileKeys.has(key) && profile.status !== "inactive") {
        await ctx.db.patch(profile._id, {
          status: "inactive",
          updatedAt: now
        });
      }
    }

    return {
      tenantId,
      categories: categories.length,
      suppliers: suppliers.length + requestedSuppliers.length,
      serviceCostRules: serviceCostRules.length,
      quoteTemplates: 1,
      importProfiles: importProfiles.length
    };
  }
});
