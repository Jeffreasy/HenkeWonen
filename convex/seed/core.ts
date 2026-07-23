import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireConvexToolingEnabled } from "../authz";
import { toAsciiFieldKey } from "../catalog/priceColumnKey";

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
  "Verlichting",
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
  "Roots",
  "ZTAHL"
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
    sleutel: "vloeren",
    titel: "Vloeren",
    omschrijving: "Ondervloer, egaliseren, vloerproduct en legwerk.",
    sortOrder: 1
  },
  {
    sleutel: "plinten",
    titel: "Plinten",
    omschrijving: "Plinten geleverd en geplaatst.",
    sortOrder: 2
  },
  {
    sleutel: "raamdecoratie",
    titel: "Gordijnen & raamdecoratie",
    omschrijving: "Gordijnen, rails, plissés, jaloezieën en duettes.",
    sortOrder: 3
  },
  {
    sleutel: "traprenovatie",
    titel: "Traprenovatie",
    omschrijving: "PVC traprenovatie inclusief kleur en stripkeuze.",
    sortOrder: 4
  },
  {
    sleutel: "wandafwerking",
    titel: "Wandafwerking",
    omschrijving: "Wandpanelen inclusief montagebenodigdheden.",
    sortOrder: 5
  },
  {
    sleutel: "behang",
    titel: "Behang",
    omschrijving: "Behang geleverd en aanbrengen behang als aparte arbeidsregel.",
    sortOrder: 6
  },
  {
    sleutel: "voorwaarden",
    titel: "Voorwaarden",
    omschrijving: "Standaard uitvoeringsvoorwaarden.",
    sortOrder: 7
  },
  {
    sleutel: "facturering",
    titel: "Facturering",
    omschrijving: "Betaling, aanbetaling en betaaltermijnen.",
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
    sectieSleutel: "vloeren",
    regelType: "material",
    titel: "Zwevende zelfklevende ondervloer t.b.v. PVC",
    omschrijving: "Ondervloer voor PVC, hoeveelheid per m² invullen.",
    eenheid: "m2",
    standaardAantal: 1,
    sortOrder: 1,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Ondervloer",
    productSoortHint: "underlay"
  },
  {
    sectieSleutel: "vloeren",
    regelType: "labor",
    titel: "Primeren en egaliseren",
    omschrijving: "Voorbehandeling en egaliseren per m².",
    eenheid: "m2",
    standaardAantal: 1,
    sortOrder: 2,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Egaline"
  },
  {
    sectieSleutel: "vloeren",
    regelType: "product",
    titel: "PVC/tapijt/vinyl fabrikant, naam, kleur",
    omschrijving: "Vloerproduct inclusief fabrikant, collectie/naam en kleur.",
    eenheid: "m2",
    standaardAantal: 1,
    sortOrder: 3,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "PVC Vloeren / Tapijt / Vinyl"
  },
  {
    sectieSleutel: "vloeren",
    regelType: "labor",
    titel: "Legkosten PVC visgraat/rechte plank/tapijt/vinyl",
    omschrijving: "Legwerk als aparte arbeidsregel per m².",
    eenheid: "m2",
    standaardAantal: 1,
    sortOrder: 4,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Werkzaamheden"
  },
  {
    sectieSleutel: "plinten",
    regelType: "product",
    titel: "Plinten maat kleur geplaatst",
    omschrijving: "Plintmaat en kleur invullen; montage apart in tekst of prijs opnemen.",
    eenheid: "meter",
    standaardAantal: 1,
    sortOrder: 5,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Plinten",
    productSoortHint: "plinth"
  },
  {
    sectieSleutel: "raamdecoratie",
    regelType: "manual",
    titel: "Gordijnen fabrikant, stof en kleur",
    omschrijving: "Maatwerkregel voor gordijnen, stofkwaliteit en kleur.",
    eenheid: "custom",
    standaardAantal: 1,
    sortOrder: 6,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Gordijnen",
    productSoortHint: "curtain_fabric"
  },
  {
    sectieSleutel: "raamdecoratie",
    regelType: "product",
    titel: "Gordijnrails merk, kleur",
    omschrijving: "Rail/roede met merk, kleur en lengte.",
    eenheid: "meter",
    standaardAantal: 1,
    sortOrder: 7,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Roedes/Railsen",
    productSoortHint: "rail"
  },
  {
    sectieSleutel: "raamdecoratie",
    regelType: "manual",
    titel: "Plissés fabrikant, kleur",
    omschrijving: "Maatwerkregel voor plissé raamdecoratie.",
    eenheid: "custom",
    standaardAantal: 1,
    sortOrder: 8,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Raambekleding",
    productSoortHint: "plisse"
  },
  {
    sectieSleutel: "raamdecoratie",
    regelType: "manual",
    titel: "Houten/bamboe jaloezieën fabrikant, kleur",
    omschrijving: "Maatwerkregel voor houten of bamboe jaloezieën.",
    eenheid: "custom",
    standaardAantal: 1,
    sortOrder: 9,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Raambekleding",
    productSoortHint: "jaloezie"
  },
  {
    sectieSleutel: "raamdecoratie",
    regelType: "manual",
    titel: "Duettes fabrikant, kleur",
    omschrijving: "Maatwerkregel voor duette raamdecoratie.",
    eenheid: "custom",
    standaardAantal: 1,
    sortOrder: 10,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Raambekleding",
    productSoortHint: "duette"
  },
  {
    sectieSleutel: "wandafwerking",
    regelType: "product",
    titel: "Wandpanelen merk, kleur",
    omschrijving: "Wandpanelen geplaatst inclusief benodigde lijm waar van toepassing.",
    eenheid: "m2",
    standaardAantal: 1,
    sortOrder: 12,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Wandpanelen",
    productSoortHint: "panel"
  },
  {
    sectieSleutel: "behang",
    regelType: "product",
    titel: "Behang merk, kleur",
    omschrijving: "Behang geleverd; aantal rollen kan met de behangcalculator worden voorbereid.",
    eenheid: "roll",
    standaardAantal: 1,
    sortOrder: 13,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Behang",
    productSoortHint: "wallpaper"
  },
  {
    sectieSleutel: "behang",
    regelType: "labor",
    titel: "Aanbrengen behang",
    omschrijving: "Arbeidsregel voor aanbrengen behang per rol.",
    eenheid: "roll",
    standaardAantal: 1,
    sortOrder: 14,
    optioneel: true,
    standaardIngeschakeld: false,
    categorieHint: "Behang"
  }
] as const;

const importProfiles = [
  {
    supplierName: "ZTAHL",
    name: "ZTAHL verkoopprijslijst 2026",
    filePattern: "*Verkoopprijslijst ZTAHL 2026*.xlsx",
    sheetPattern: "*",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "verlichting",
      productKind: "other",
      codeColumns: ["Artikelnummer", "EAN code"],
      sectionRows: true,
      nameColumns: ["Model", "Uitvoering", "Omschrijving"],
      priceColumns: [
        { header: "Prijs", priceType: "advice_retail", priceUnit: "piece", vatMode: "inclusive" }
      ],
      attributeColumns: [
        "Afmeting (incl. kap)",
        "Uitvoering",
        "Fitting/lamp",
        "Diameter/ Hoogte",
        "Merk",
        "Fitting",
        "Kelvin/ kleur",
        "Lumen",
        "Wattage",
        "Watt",
        "Dimbaar",
        "levensduur"
      ]
    },
    notes:
      "ZTAHL armaturen en lichtbronnen. Excel print-header vermeldt letterlijk: ZTAHL verkoopprijslijst incl. BTW - 2026. Prijzen komen uit gecachte Excel-formules met externe verwijzingen."
  },
  {
    supplierName: "ZTAHL",
    name: "ZTAHL inkoopprijslijst 2026",
    filePattern: "*Inkoopprijslijst ZTAHL 2026*.xlsx",
    sheetPattern: "*",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "verlichting",
      productKind: "other",
      codeColumns: ["Artikelnummer", "EAN code"],
      sectionRows: true,
      nameColumns: ["Model", "Uitvoering", "Omschrijving"],
      priceColumns: [
        { header: "Prijs", priceType: "purchase", priceUnit: "piece", vatMode: "exclusive" }
      ],
      attributeColumns: [
        "Afmeting (incl. kap)",
        "Uitvoering",
        "Fitting/lamp",
        "Diameter/ Hoogte",
        "Merk",
        "Fitting",
        "Kelvin/ kleur",
        "Lumen",
        "Wattage",
        "Watt",
        "Dimbaar",
        "levensduur"
      ]
    },
    notes:
      "ZTAHL inkoopprijzen. Excel print-header vermeldt letterlijk: ZTAHL inkooppprijslijst excl. BTW - 2026. Prijzen komen uit gecachte Excel-formules met externe verwijzingen."
  },
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
        {
          header: "Commissieprijs EUR m2",
          priceType: "commission",
          priceUnit: "m2",
          vatMode: "unknown"
        },
        { header: "Trailerprijs", priceType: "trailer", priceUnit: "m2", vatMode: "unknown" },
        {
          header: "Adviesverkoopprijs EUR m2",
          priceType: "advice_retail",
          priceUnit: "m2",
          vatMode: "unknown"
        }
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
        {
          header: "Adviesverkoopprijs",
          priceType: "advice_retail",
          priceUnit: "piece",
          vatMode: "unknown"
        }
      ],
      attributeColumns: [
        "Totale dikte (mm)",
        "Poolhoogte (mm)",
        "Verfmethode",
        "Poolmateriaal",
        "Soort Backing",
        "Garantie Woongebruik"
      ]
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
        {
          header: "Adviesverkoopprijs vanaf 01/05/2026",
          priceType: "advice_retail",
          priceUnit: "pack",
          vatMode: "unknown"
        },
        {
          header: "Netto inkoop per pak",
          priceType: "net_purchase",
          priceUnit: "pack",
          vatMode: "unknown"
        },
        {
          header: "Adviesverkoopprijs / m2 vanaf 01/05/2026",
          priceType: "advice_retail",
          priceUnit: "m2",
          vatMode: "unknown"
        }
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
        {
          header: "Adviesverkoopprijs per m1 /stuks",
          priceType: "advice_retail",
          priceUnit: "m1",
          vatMode: "unknown"
        },
        {
          header: "Adviesverkoopprijs per m2 /stuks",
          priceType: "advice_retail",
          priceUnit: "m2",
          vatMode: "unknown"
        }
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
        {
          header: "Palletprijs / per verpakking",
          priceType: "pallet",
          priceUnit: "package",
          vatMode: "unknown"
        },
        {
          header: "Palletprijs / per stuk, kilo, liter",
          priceType: "pallet",
          priceUnit: "custom",
          vatMode: "unknown"
        },
        {
          header: "commisieprijs / per verpakking",
          priceType: "commission",
          priceUnit: "package",
          vatMode: "unknown"
        },
        {
          header: "commisieprijs / per stuk, kilo, liter",
          priceType: "commission",
          priceUnit: "custom",
          vatMode: "unknown"
        },
        {
          header: "Adviesverkoopprijs incl. BTW. per verpakking",
          priceType: "advice_retail",
          priceUnit: "package",
          vatMode: "inclusive"
        }
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
        {
          header: "Palletprijs lengte (3,0)",
          priceType: "pallet",
          priceUnit: "meter",
          vatMode: "unknown"
        },
        {
          header: "Palletprijs (3,0) m1",
          priceType: "pallet",
          priceUnit: "m1",
          vatMode: "unknown"
        },
        {
          header: "Commissieprijs lengte (2,7)",
          priceType: "commission",
          priceUnit: "meter",
          vatMode: "unknown"
        },
        {
          header: "Commissieprijs (2,7) m1",
          priceType: "commission",
          priceUnit: "m1",
          vatMode: "unknown"
        },
        {
          header: "Adviesverkoopprijs lengte",
          priceType: "advice_retail",
          priceUnit: "meter",
          vatMode: "unknown"
        }
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
      priceColumns: [
        "Rolprijs EUR m1",
        "Rolprijs EUR m2",
        "Coupageprijs EUR m1",
        "Coupageprijs EUR m2",
        "Adviesverkoopprijs EUR m1",
        "Adviesverkoopprijs EUR m2"
      ]
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
      priceColumns: [
        "Rolprijs EUR m1",
        "Rolprijs EUR m2",
        "Coupageprijs EUR m1",
        "Coupageprijs EUR m2",
        "Adviesverkoopprijs EUR m1",
        "Adviesverkoopprijs EUR m2"
      ]
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
        {
          header: "prijs per verpakkking",
          priceType: "package",
          priceUnit: "pack",
          vatMode: "unknown"
        },
        {
          header: "prijs per trede / stuk",
          priceType: "step",
          priceUnit: "step",
          vatMode: "unknown"
        },
        {
          header: "adviesverkoopprijs per verpakkking",
          priceType: "advice_retail",
          priceUnit: "pack",
          vatMode: "unknown"
        },
        {
          header: "adviesverkoopprijs per trede / stuk",
          priceType: "advice_retail",
          priceUnit: "step",
          vatMode: "unknown"
        }
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
        {
          header: "Inkoopprijs per stuk",
          priceType: "purchase",
          priceUnit: "piece",
          vatMode: "unknown"
        },
        {
          header: "Inkoopprijs per pallet",
          priceType: "purchase",
          priceUnit: "pallet",
          vatMode: "unknown"
        },
        {
          header: "Adviesverkoopprijs per pak",
          priceType: "advice_retail",
          priceUnit: "pack",
          vatMode: "unknown"
        }
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
        {
          header: "Inkoopprijs per stuk",
          priceType: "purchase",
          priceUnit: "piece",
          vatMode: "unknown"
        },
        {
          header: "Palletprijs per stuk",
          priceType: "pallet",
          priceUnit: "piece",
          vatMode: "unknown"
        },
        {
          header: "Adviesverkoopprijs per stuk",
          priceType: "advice_retail",
          priceUnit: "piece",
          vatMode: "unknown"
        }
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
        {
          header: "inkoop op commissie",
          priceType: "commission",
          priceUnit: "pack",
          vatMode: "unknown"
        },
        {
          header: "Adviesverkoopprijs",
          priceType: "advice_retail",
          priceUnit: "m2",
          vatMode: "unknown"
        }
      ]
    },
    notes: "Palletafname is prijsbron/conditie; niet dedupliceren op bestandsnaam."
  },
  {
    supplierName: "Masureel",
    name: "Masureel Behang NL NG 2026",
    filePattern: "*NL NG*.xlsx",
    sheetPattern: "*",
    supportsXlsx: true,
    supportsXls: false,
    mapping: {
      category: "behang",
      productKind: "wallpaper",
      codeColumns: ["Reference"],
      nameColumns: ["Naam"],
      priceColumns: [
        {
          header: "Aankoopprijs \u20AC excl. BTW 010526/Stuk of m",
          priceType: "purchase",
          priceUnit: "roll",
          vatMode: "exclusive"
        },
        {
          header: "Aanbevolen verkoopprijs \u20AC incl. BTW 010526/Stuk of m",
          priceType: "advice_retail",
          priceUnit: "roll",
          vatMode: "inclusive"
        }
      ],
      attributeColumns: [
        "Rapport",
        "Hoogte (cm)",
        "Breedte (m)",
        "Lengte (m)",
        "Rol/stuk/m",
        "Gewicht (g/m2)",
        "Fire resistance"
      ]
    },
    notes:
      "Masureel behang NL NG 01052026. Sheets: MASUREEL (4633 rijen), PROJECTS (1346 rijen), COLMP4 (255 rijen), ART FACTORY (8 rijen), STOFFEN (42 rijen). Aankoopprijs excl. BTW, adviesverkoop incl. BTW per rol."
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

export const run = internalMutation({
  // deactivateUnlisted (default false): zet import-profielen die niet in de hardcoded
  // basislijst staan op "inactive". Bewust OPT-IN — anders kan een bootstrap/herrun per
  // ongeluk echte, later toegevoegde profielen op prod uitschakelen (destructief).
  args: { deactivateUnlisted: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
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
          naam: "Henke Wonen",
          status: "active",
          aangemaaktOp: now,
          gewijzigdOp: now
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
          naam: name,
          slug,
          sortOrder: index + 1,
          status: "active",
          aangemaaktOp: now,
          gewijzigdOp: now
        });
      }
    }

    for (const supplierName of suppliers) {
      const existing = await ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .filter((q) => q.eq(q.field("naam"), supplierName))
        .first();

      if (!existing) {
        await ctx.db.insert("suppliers", {
          tenantId,
          naam: supplierName,
          prijslijstStatus: "received",
          aangemaaktOp: now,
          gewijzigdOp: now
        });
      }
    }

    for (const supplierName of requestedSuppliers) {
      const existing = await ctx.db
        .query("suppliers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .filter((q) => q.eq(q.field("naam"), supplierName))
        .first();

      if (!existing) {
        await ctx.db.insert("suppliers", {
          tenantId,
          naam: supplierName,
          prijslijstStatus: "requested",
          notities: "Genoemd in overzicht, prijslijst nog niet aangeleverd.",
          aangemaaktOp: now,
          gewijzigdOp: now
        });
      }
    }

    for (const rule of serviceCostRules) {
      const existing = await ctx.db
        .query("serviceCostRules")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .filter((q) => q.eq(q.field("naam"), rule.name))
        .first();

      if (!existing) {
        await ctx.db.insert("serviceCostRules", {
          tenantId,
          naam: rule.name,
          omschrijving: rule.description,
          berekeningType: rule.calculationType,
          prijsExBtw: rule.priceExVat,
          btwTarief: rule.vatRate,
          status: "active",
          aangemaaktOp: now,
          gewijzigdOp: now
        });
      }
    }

    const existingTemplate = await ctx.db
      .query("quoteTemplates")
      .withIndex("by_type", (q) => q.eq("tenantId", tenantId).eq("type", "default"))
      .filter((q) => q.eq(q.field("naam"), "Standaard offerte woninginrichting"))
      .first();

    const legacyTemplate = existingTemplate
      ? null
      : await ctx.db
          .query("quoteTemplates")
          .withIndex("by_type", (q) => q.eq("tenantId", tenantId).eq("type", "default"))
          .filter((q) => q.eq(q.field("naam"), "Henke Wonen standaard offerte"))
          .first();

    const templateToUpdate = existingTemplate ?? legacyTemplate;
    const defaultLines = quoteTemplateLines.map((line) => ({ ...line }));

    if (templateToUpdate) {
      await ctx.db.patch(templateToUpdate._id, {
        naam: "Standaard offerte woninginrichting",
        secties: quoteTemplateSections,
        standaardVoorwaarden: quoteTerms,
        betalingsvoorwaarden: paymentTerms,
        standaardRegels: defaultLines,
        status: "active",
        gewijzigdOp: now
      });
    } else {
      await ctx.db.insert("quoteTemplates", {
        tenantId,
        naam: "Standaard offerte woninginrichting",
        type: "default",
        secties: quoteTemplateSections,
        standaardVoorwaarden: quoteTerms,
        betalingsvoorwaarden: paymentTerms,
        standaardRegels: defaultLines,
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    for (const profile of importProfiles) {
      const existing = await ctx.db
        .query("importProfiles")
        .withIndex("by_supplier", (q) =>
          q.eq("tenantId", tenantId).eq("leverancierNaam", profile.supplierName)
        )
        .filter((q) => q.eq(q.field("naam"), profile.name))
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
        .filter((q) => q.eq(q.field("naam"), profile.supplierName))
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
      const existingVatModeByPriceColumn = existing?.btwModusPerPrijskolom ?? {};
      const existingPriceColumnMappings = Array.isArray(existing?.prijskolomMappings)
        ? existing.prijskolomMappings
        : [];
      const existingVatModeForColumn = (header: string, sourceColumnIndex: number) => {
        const mappedVatMode = existingVatModeByPriceColumn[toAsciiFieldKey(header)];

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
            existingVatModeForColumn(header, sourceColumnIndex) ?? baseColumn.vatMode ?? "unknown"
        };
      });
      const mappingWithPreservedPriceColumns = {
        ...mapping,
        priceColumns: priceColumnObjects
      };
      const vatModeByPriceColumn = Object.fromEntries(
        priceColumnObjects.map((column: any) => [
          toAsciiFieldKey(column.header),
          column.vatMode ?? "unknown"
        ])
      );
      const unitByPriceColumn = Object.fromEntries(
        priceColumnObjects.map((column: any) => [
          toAsciiFieldKey(column.header),
          column.priceUnit ?? "custom"
        ])
      );
      const priceTypeByPriceColumn = Object.fromEntries(
        priceColumnObjects.map((column: any) => [
          toAsciiFieldKey(column.header),
          column.priceType ?? "manual"
        ])
      );
      const profileFields = {
        leverancierId: supplier?._id,
        categorieId: category?._id,
        verwachteBestandsextensie:
          profile.supportsXls && !profile.supportsXlsx ? (".xls" as const) : (".xlsx" as const),
        bestandPatroon: profile.filePattern,
        bladPatroon: profile.sheetPattern,
        ondersteuntXlsx: profile.supportsXlsx,
        ondersteuntXls: profile.supportsXls,
        bladMapping: {
          pattern: profile.sheetPattern ?? "*",
          strategy: "match_by_name_or_first_usable_sheet"
        },
        koprijStrategie: {
          strategy: "detect",
          maxScanRows: 100,
          preserveOriginalHeaders: true
        },
        sectierijStrategie: {
          strategy: mapping.detectSectionRows || mapping.sectionRows ? "detect" : "optional",
          maxFilledCells: 2,
          requireNoCodeAndNoPrice: true
        },
        productSleutelStrategie: {
          preserveCodesAsString: true,
          priority: ["articleNumber", "supplierCode", "ean", "commercialCode", "importKey"],
          fallback:
            "tenantId + supplierId + sourceFileName + sourceSheetName + rowHash, daarna supplier + collection + productName + colorName + width + unit"
        },
        kolomMappings: mappingWithPreservedPriceColumns,
        prijskolomMappings: priceColumnObjects,
        btwModusPerPrijskolom: vatModeByPriceColumn,
        eenheidPerPrijskolom: unitByPriceColumn,
        prijsSoortPerPrijskolom: priceTypeByPriceColumn,
        dubbelenStrategie: {
          product: "tenantId + supplierId + articleNumber/supplierCode/EAN/importKey",
          price: "priceListId + priceType + unit + vatMode + validFrom + sourceColumnIndex",
          updateExistingProducts: true,
          keepPricesPerSourceKey: true
        },
        nulPrijsStrategie: {
          strategy: "skip",
          warning: true
        },
        staBtwModusOnbekendToe: existing?.staBtwModusOnbekendToe ?? false,
        btwModusReview: existing?.btwModusReview,
        vatModeUpdatedByExternalUserId: existing?.vatModeUpdatedByExternalUserId,
        btwModusGewijzigdOp: existing?.btwModusGewijzigdOp,
        mapping: mappingWithPreservedPriceColumns,
        notities: profile.notes,
        status: "active" as const
      };

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...profileFields,
          gewijzigdOp: now
        });
      } else {
        await ctx.db.insert("importProfiles", {
          tenantId,
          leverancierNaam: profile.supplierName,
          naam: profile.name,
          ...profileFields,
          aangemaaktOp: now,
          gewijzigdOp: now
        });
      }
    }

    // Alleen op expliciet verzoek niet-gelijste profielen deactiveren (zie args-comment).
    if (args.deactivateUnlisted) {
      const activeImportProfileKeys = new Set(
        importProfiles.map((profile) => `${profile.supplierName}::${profile.name}`)
      );
      const tenantImportProfiles = await ctx.db
        .query("importProfiles")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();

      for (const profile of tenantImportProfiles) {
        const key = `${profile.leverancierNaam}::${profile.naam}`;
        if (!activeImportProfileKeys.has(key) && profile.status !== "inactive") {
          await ctx.db.patch(profile._id, {
            status: "inactive",
            gewijzigdOp: now
          });
        }
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
