// Mapper: HenkeWonenDATA stagingCatalogRows.jsonl -> importRows preview-JSON.
//
// Zet de schone, geoptimaliseerde DATA-catalogus om naar het rij-formaat dat
// `tools/upload_catalog_batch_import.mjs` + `convex/catalog/import.ts::importRows` verwachten.
// Output: docs/generated/data-catalog-import-preview.json ({ tenantSlug, rows: [...] }).
//
// Gebruik:  node tools/build_data_catalog_preview.mjs [--data <pad-naar-HenkeWonenDATA>] [--out <pad>]
//
// Veilig/read-only: leest alleen de DATA-JSONL en schrijft het preview-bestand. Geen Convex-calls.
// Valideert alle enum-waarden tegen de productie-schema-unions; faalt hard bij een onbekende waarde.

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const argVal = (flag, dflt) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const DATA_ROOT = argVal("--data", "C:/Users/jeffrey/Desktop/Projecten/HenkeWonenDATA");
const SRC = path.join(DATA_ROOT, "convex/import/stagingCatalogRows.jsonl");
const OUT = argVal("--out", "docs/generated/data-catalog-import-preview.json");
const TENANT_SLUG = "henke-wonen";

// ---------------------------------------------------------------------------
// Toegestane productie-enum-unions (uit convex/schema.ts) — harde validatie
// ---------------------------------------------------------------------------
const PRICE_TYPES = new Set([
  "purchase", "net_purchase", "retail", "advice_retail", "commission",
  "pallet", "trailer", "roll", "cut_length", "package", "step", "manual"
]);
const PRICE_UNITS = new Set([
  "m2", "m1", "meter", "piece", "package", "pack", "roll", "pallet",
  "trailer", "step", "liter", "kg", "custom"
]);
const VAT_MODES = new Set(["exclusive", "inclusive", "unknown"]);
const PRODUCT_KINDS = new Set([
  "click", "dryback", "src", "panel", "tile", "carpet", "vinyl", "curtain",
  "fabric", "curtain_fabric", "vitrage", "roman_blind_fabric", "panel_curtain_fabric",
  "mat", "rug", "blind", "plisse", "jaloezie", "duette", "rail", "wallpaper",
  "underlay", "adhesive", "plinth", "other"
]);
const PRODUCT_UNITS = new Set([
  "piece", "m2", "m1", "meter", "roll", "package", "pack", "pallet",
  "trailer", "step", "liter", "kg", "hour", "stairs", "custom"
]);
const PRODUCT_TYPES = new Set(["standard", "with_variants", "made_to_measure", "service", "manual"]);

// ---------------------------------------------------------------------------
// Waarde-maps (DATA -> productie)
// ---------------------------------------------------------------------------
const SOORT_TO_PRICE_TYPE = {
  recommended_retail: "advice_retail",
  retail: "retail",
  purchase: "purchase",
  pallet: "pallet",
  commission: "commission",
  trailer: "trailer",
  roll: "roll",
  coupage: "cut_length",
  pack: "package",
  unit: "manual",
  unknown: "manual"
};
const EENHEID_TO_PRICE_UNIT = {
  m2: "m2",
  m1: "m1",
  stuk: "piece",
  pak: "pack",
  rol: "roll",
  pallet: "pallet",
  lengte: "meter",
  trede: "step",
  kg: "kg",
  ltr: "liter",
  set: "custom",
  unknown: "custom"
};
const BASIS_TO_VAT_MODE = {
  exclusive_assumed: "exclusive",
  exclusive: "exclusive",
  inclusive: "inclusive"
};

// Masureel join/lookup-sheets — geen producten, overslaan.
const LOOKUP_SHEETS = new Set(["CUSTOMS", "EAN", "KG UNIT"]);

// ---------------------------------------------------------------------------
// Afleidingen per familie
// ---------------------------------------------------------------------------
const lc = (s) => (typeof s === "string" ? s.toLowerCase() : "");

function categoryNameFor(row) {
  const fam = row.familieSleutel;
  const cat = lc(row.categorie) + " " + lc(row.categorieSleutel) + " " + lc(row.productnaam);
  switch (fam) {
    case "behang": return "Behang";
    case "gordijnen_stoffen": return "Gordijnen";
    case "tapijt": return "Tapijt";
    case "vinyl": return "Vinyl";
    case "karpetten": return "Karpetten";
    case "plinten": return "Plinten";
    case "matten": return "Entreematten";
    case "traprenovatie": return "Traprenovatie";
    case "pvc":
      if (cat.includes("dryback")) return "PVC Dryback";
      if (cat.includes("click") || cat.includes("uniclick") || cat.includes("src") || cat.includes("silent"))
        return "PVC Click";
      return "PVC Vloeren";
    case "panelen":
      if (cat.includes("douche")) return "Douchepanelen";
      if (cat.includes("tegel")) return "Tegels";
      return "Wandpanelen";
    case "vloer_service":
      if (cat.includes("egal")) return "Egaline";
      if (cat.includes("lijm")) return "Lijm";
      if (cat.includes("kit")) return "Kit";
      return "Egaline";
    default: return "Overig";
  }
}

function productKindFor(row) {
  const fam = row.familieSleutel;
  const cat = lc(row.categorie) + " " + lc(row.categorieSleutel);
  switch (fam) {
    case "behang": return "wallpaper";
    case "gordijnen_stoffen": return cat.includes("vitrage") ? "vitrage" : "curtain_fabric";
    case "tapijt": return "carpet";
    case "vinyl": return "vinyl";
    case "karpetten": return "rug";
    case "plinten": return "plinth";
    case "matten": return "mat";
    case "traprenovatie": return "other";
    case "pvc":
      if (cat.includes("dryback")) return "dryback";
      if (cat.includes("src") || cat.includes("silent")) return "src";
      return "click";
    case "panelen": return cat.includes("tegel") ? "tile" : "panel";
    case "vloer_service": return "adhesive";
    default: return "other";
  }
}

const FAMILY_UNIT = {
  gordijnen_stoffen: "m1",
  pvc: "m2",
  vinyl: "m2",
  tapijt: "m2",
  panelen: "m2",
  plinten: "meter",
  traprenovatie: "step",
  matten: "piece",
  karpetten: "piece",
  behang: "roll",
  vloer_service: "piece"
};

const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
const str = (x) => (typeof x === "string" && x.trim() ? x.trim() : undefined);

// ---------------------------------------------------------------------------
// Hoofdverwerking
// ---------------------------------------------------------------------------
if (!fs.existsSync(SRC)) {
  console.error(`Bron niet gevonden: ${SRC}`);
  process.exit(1);
}

const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);
const rows = [];
const stats = {
  totalLines: 0,
  skippedLookup: 0,
  skippedNoName: 0,
  products: 0,
  productsNoPrice: 0,
  prices: 0,
  skippedPriceNonPositive: 0,
  byCategory: {},
  byVatMode: {},
  byPriceType: {},
  byPriceUnit: {},
  byFamily: {}
};
const invalid = [];
const bump = (obj, key) => { obj[key] = (obj[key] ?? 0) + 1; };

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  stats.totalLines++;
  let d;
  try {
    d = JSON.parse(trimmed);
  } catch (e) {
    invalid.push(`JSON-parse fout regel ${stats.totalLines}: ${e.message}`);
    continue;
  }

  // 1. Masureel lookup-sheets overslaan (geen producten).
  if (LOOKUP_SHEETS.has(d.bladnaam)) {
    stats.skippedLookup++;
    continue;
  }

  // 2. Productnaam bepalen; prijsloze naamloze rijen overslaan.
  const prijzen = Array.isArray(d.prijzen) ? d.prijzen : [];
  const productName = str(d.productnaam) ?? str(d.weergaveNaam) ?? (prijzen.length > 0 ? str(d.artikelcode) : undefined);
  if (!productName) {
    stats.skippedNoName++;
    continue;
  }

  bump(stats.byFamily, d.familieSleutel ?? "?");

  // 3. Prijzen mappen.
  const prices = [];
  const importKey = `data:${d.leverancierNaam}:${d.bestandsnaam}:${d.bladnaam}:${d.rijnummer}`;
  prijzen.forEach((p, idx) => {
    const amount = num(p.bedrag);
    if (amount === undefined || amount <= 0) {
      stats.skippedPriceNonPositive++;
      return;
    }
    const priceType = SOORT_TO_PRICE_TYPE[p.soort] ?? "manual";
    const priceUnit = EENHEID_TO_PRICE_UNIT[p.eenheid] ?? "custom";
    const vatMode = BASIS_TO_VAT_MODE[p.basis] ?? "unknown";
    if (!PRICE_TYPES.has(priceType)) invalid.push(`priceType '${priceType}' (soort=${p.soort})`);
    if (!PRICE_UNITS.has(priceUnit)) invalid.push(`priceUnit '${priceUnit}' (eenheid=${p.eenheid})`);
    if (!VAT_MODES.has(vatMode)) invalid.push(`vatMode '${vatMode}' (basis=${p.basis})`);
    bump(stats.byVatMode, vatMode);
    bump(stats.byPriceType, priceType);
    bump(stats.byPriceUnit, priceUnit);
    prices.push({
      sourceKey: `${importKey}#${idx}-${p.soort}-${p.eenheid}`,
      priceType,
      priceUnit,
      amount: Math.round(amount * 10000) / 10000,
      vatRate: 21,
      vatMode,
      currency: "EUR",
      sourceColumnName: str(p.kop),
      sourceValue: String(p.bedrag)
    });
  });

  // 4. Productvelden.
  const categoryName = categoryNameFor(d);
  const productKind = productKindFor(d);
  const unit = FAMILY_UNIT[d.familieSleutel] ?? "piece";
  const productType =
    productKind === "curtain_fabric" || productKind === "vitrage" ? "made_to_measure" : "standard";
  if (!PRODUCT_KINDS.has(productKind)) invalid.push(`productKind '${productKind}' (familie=${d.familieSleutel})`);
  if (!PRODUCT_UNITS.has(unit)) invalid.push(`unit '${unit}'`);
  if (!PRODUCT_TYPES.has(productType)) invalid.push(`productType '${productType}'`);

  const attributen = d.attributen && typeof d.attributen === "object" ? d.attributen : {};
  const attributes = {
    ...attributen,
    ...(str(d.kleurFamilie) ? { kleurFamilie: d.kleurFamilie } : {}),
    ...(str(d.afmeting) ? { afmeting: d.afmeting } : {}),
    ...(str(d.categorieSleutel) ? { categorieSleutel: d.categorieSleutel } : {}),
    bron: { bestand: d.bestandsnaam, blad: d.bladnaam, rij: d.rijnummer }
  };

  // thickness is consistent in mm; breedte/lengte zijn familie-afhankelijk (cm/m/mm) -> alleen ruw in attributes.
  const thicknessMm = num(attributen.thickness);

  const row = {
    importKey,
    productName,
    supplierName: str(d.leverancierNaam) ?? "Onbekend",
    categoryName,
    brandName: str(d.merknaam) ?? str(d.merk),
    collectionName: str(d.collectie),
    articleNumber: str(d.artikelcode),
    ean: str(d.ean),
    colorName: str(d.kleur),
    productKind,
    productType,
    unit,
    ...(thicknessMm !== undefined ? { thicknessMm } : {}),
    sourceFileName: str(d.bestandsnaam),
    sourceSheetName: str(d.bladnaam),
    sourceRowNumber: num(d.rijnummer),
    attributes,
    prices
  };
  // Verwijder undefined top-level keys (netter preview).
  for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];

  rows.push(row);
  stats.products++;
  stats.prices += prices.length;
  if (prices.length === 0) stats.productsNoPrice++;
  bump(stats.byCategory, categoryName);
}

if (invalid.length) {
  const uniq = [...new Set(invalid)];
  console.error("ONGELDIGE ENUM-WAARDEN gedetecteerd (import zou falen):");
  for (const m of uniq.slice(0, 50)) console.error("  - " + m);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Schrijven + rapport
// ---------------------------------------------------------------------------
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ tenantSlug: TENANT_SLUG, rows }, null, 0));

const sortDesc = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
const fmt = (o) => sortDesc(o).map(([k, v]) => `    ${k}: ${v}`).join("\n");

console.log(`\n=== DATA -> importRows preview ===`);
console.log(`bron:    ${SRC}`);
console.log(`output:  ${OUT}`);
console.log(`\nRegels totaal:            ${stats.totalLines}`);
console.log(`  overgeslagen (lookup):  ${stats.skippedLookup}  (Masureel CUSTOMS/EAN/KG UNIT)`);
console.log(`  overgeslagen (naamloos):${stats.skippedNoName}`);
console.log(`Producten (rows):         ${stats.products}`);
console.log(`  zonder prijs:           ${stats.productsNoPrice}`);
console.log(`Prijzen totaal:           ${stats.prices}`);
console.log(`  prijzen ≤0 overgeslagen:${stats.skippedPriceNonPositive}`);
console.log(`\nPer familie:\n${fmt(stats.byFamily)}`);
console.log(`\nPer categorie (productie):\n${fmt(stats.byCategory)}`);
console.log(`\nbtwModus-verdeling:\n${fmt(stats.byVatMode)}`);
console.log(`\npriceType-verdeling:\n${fmt(stats.byPriceType)}`);
console.log(`\npriceUnit-verdeling:\n${fmt(stats.byPriceUnit)}`);
console.log(`\nGEEN ongeldige enum-waarden. Preview is import-klaar.`);
