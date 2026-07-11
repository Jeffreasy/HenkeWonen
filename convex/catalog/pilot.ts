type CommercialName = {
  merknaam: string;
  collectieNaam?: string;
  kleurnaam?: string;
  weergaveNaam: string;
};

type PilotProductLike = {
  naam: string;
  productSoort?: string;
  commercialNames?: CommercialName[];
  kleurnaam?: string;
  sku?: string;
  eenheid?: string;
};

function normalized(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

export function pilotHiddenReason(product: PilotProductLike, categoryName?: string) {
  if (normalized(categoryName) === "pvc click") {
    return "PVC Click verborgen voor pilot";
  }

  if (normalized(product.productSoort) === "click") {
    return "PVC click verborgen voor pilot";
  }

  return undefined;
}

export function isPilotHiddenProduct(product: PilotProductLike, categoryName?: string) {
  return Boolean(pilotHiddenReason(product, categoryName));
}

export function isPvcProduct(product: PilotProductLike, categoryName?: string, supplierName?: string) {
  const values = [categoryName, product.productSoort, supplierName, product.naam].map(normalized);

  return values.some((value) => value.includes("pvc") || value === "dryback" || value === "src");
}

export function displaySupplierName(supplierName: string) {
  return normalized(supplierName) === "roots" ? "Moduleo" : supplierName;
}

export function displayProductName(
  product: PilotProductLike,
  categoryName?: string,
  supplierName?: string
) {
  const isPvc = isPvcProduct(product, categoryName, supplierName);
  const floorlifeName = product.commercialNames?.find(
    (name) => normalized(name.merknaam) === "floorlife"
  );

  if (floorlifeName && isPvc) {
    return floorlifeName.weergaveNaam;
  }

  if (isPvc && (normalized(supplierName) === "roots" || /\broots\b/i.test(product.naam))) {
    return product.naam
      .replace(/\bMOD ROOTS\b/gi, "Moduleo")
      .replace(/\bROOTS\b/gi, "Moduleo")
      .replace(/\bRoots\b/g, "Moduleo");
  }

  return product.naam;
}

export function visibleCommercialNames(product: PilotProductLike, categoryName?: string) {
  if (!product.commercialNames?.length) {
    return product.commercialNames;
  }

  if (!isPvcProduct(product, categoryName)) {
    return product.commercialNames;
  }

  const withoutAmbiant = product.commercialNames.filter(
    (name) => normalized(name.merknaam) !== "ambiant"
  );

  return withoutAmbiant.length ? withoutAmbiant : product.commercialNames;
}

// ── Schone klant-/offertenaam ─────────────────────────────────────────────────
//
// Sommige leverancierslijsten leveren rommelige productnamen aan (technische
// prefixes, dubbele collectienamen, artikelcodes). Die naam belandt nu op de
// klant-offerte. cleanProductDisplayName leidt een nette weergavenaam af uit de
// gestructureerde velden (merk + collectie + kleur), maar ALLEEN wanneer de
// rauwe naam aantoonbaar rommelig is — schone namen (Floorlife, Co-pro, EVC…)
// blijven onaangeroerd. De rauwe `name` blijft intact voor zoeken/import.

function squashWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleishToken(token: string) {
  // ALL-CAPS woorden (≥2 letters, geen cijfers/codes) leesbaar maken: "GRIS" -> "Gris".
  // Tokens met cijfers of gemengde casing (codes als "62MV", "Allegro") blijven staan.
  if (/^[A-ZÀ-Ý]{2,}$/.test(token)) {
    return token.charAt(0) + token.slice(1).toLowerCase();
  }
  return token;
}

function prettifyCaps(value: string) {
  return value
    .split(" ")
    .map((token) => token.split("/").map(titleishToken).join("/"))
    .join(" ");
}

function containsPhrase(haystack: string, needle: string) {
  if (!needle) {
    return false;
  }
  return ` ${normalized(haystack)} `.includes(` ${normalized(needle)} `);
}

/** True als een opeenvolgend 2-woord-fragment minstens twee keer voorkomt. */
function hasRepeatedBigram(value: string) {
  const words = normalized(value).split(" ").filter(Boolean);
  const seen = new Set<string>();
  for (let i = 0; i < words.length - 1; i += 1) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (seen.has(bigram)) {
      return true;
    }
    seen.add(bigram);
  }
  return false;
}

// Leverancier-/merkcodes die in productnamen voorkomen maar niets aan de
// klantnaam toevoegen. MOD ROOTS/ROOTS/ZLB/EIR case-insensitief; de Texdecor-
// merkcodes (CAD/CAL/CAS/CAM) alleen als losse hoofdletter-token zodat ze geen
// gewone woorden raken.
const LOWER_NOISE_TOKENS = new Set(["mod", "roots", "zlb", "eir"]);
const UPPER_NOISE_TOKENS = new Set(["CAD", "CAL", "CAS", "CAM"]);

function isNoiseToken(token: string) {
  const lower = token.toLowerCase();
  if (LOWER_NOISE_TOKENS.has(lower)) {
    return true;
  }
  if (UPPER_NOISE_TOKENS.has(token)) {
    return true;
  }
  if (/^0,\d{2}$/.test(token)) {
    // Diktemaat als "0,55" / "0,40".
    return true;
  }
  // Bron-bestandsnaam die bij de import in de productnaam is gelekt
  // (bv. "henke-swifterbant-artikeloverzicht").
  if (/artikeloverzicht/i.test(lower) || /^henke-[a-z0-9-]+$/i.test(token)) {
    return true;
  }
  // Alfanumerieke artikel-/decorcode (≥5 tekens, mix cijfers+letters), bv.
  // "54991Q", "46252CD", "RO54991SDP40849". Pure getallen (decornummer 54991)
  // en korte codes (kleurcode "62MV") blijven behouden.
  if (token.length >= 5 && /\d/.test(token) && /[a-zA-Z]/.test(token)) {
    return true;
  }
  return false;
}

/** Of `sub` (kleine letters) als aaneengesloten reeks in `arr` voorkomt. */
function containsRun(arr: string[], sub: string[]) {
  for (let start = 0; start + sub.length <= arr.length; start += 1) {
    let match = true;
    for (let offset = 0; offset < sub.length; offset += 1) {
      if (arr[start + offset] !== sub[offset]) {
        match = false;
        break;
      }
    }
    if (match) {
      return true;
    }
  }
  return false;
}

/**
 * Verwijdert latere herhalingen van een eerder voorgekomen woord-fragment
 * (≥2 woorden), ook als ze niet aangrenzend zijn:
 * "BEAUTY FULL IMAGE 2 BEAUTY FULL IMAGE UNI" -> "BEAUTY FULL IMAGE 2 UNI".
 */
function dropRepeatedPhrases(words: string[]) {
  const result: string[] = [];
  const emittedLower: string[] = [];
  let i = 0;
  while (i < words.length) {
    let skip = 0;
    const maxK = Math.min(words.length - i, emittedLower.length);
    for (let k = maxK; k >= 2; k -= 1) {
      const candidate = words.slice(i, i + k).map((w) => w.toLowerCase());
      if (containsRun(emittedLower, candidate)) {
        skip = k;
        break;
      }
    }
    if (skip > 0) {
      i += skip;
      continue;
    }
    // Aangrenzend identiek woord samenvouwen ("ALLEGRO Allegro" -> één).
    if (result.length > 0 && result[result.length - 1].toLowerCase() === words[i].toLowerCase()) {
      i += 1;
      continue;
    }
    result.push(words[i]);
    emittedLower.push(words[i].toLowerCase());
    i += 1;
  }
  return result;
}

function hasNoiseCode(rawName: string) {
  if (/\b(mod\s+roots|roots|zlb)\b/i.test(rawName)) {
    return true;
  }
  return rawName.split(/\s+/).some((token) => UPPER_NOISE_TOKENS.has(token));
}

function looksMessy(rawName: string, colorName: string) {
  if (hasNoiseCode(rawName)) {
    return true;
  }
  if (hasRepeatedBigram(rawName)) {
    return true;
  }
  // Kleurnaam staat in de rauwe naam met veel ruis eromheen.
  if (colorName && containsPhrase(rawName, colorName)) {
    const rawWords = squashWhitespace(rawName).split(" ").length;
    const colorWords = squashWhitespace(colorName).split(" ").length;
    if (rawWords >= colorWords + 3) {
      return true;
    }
  }
  return false;
}

/**
 * Nette weergavenaam voor klant-offerte en picker. Schoont de rauwe naam op
 * (merk-/artikelcodes eruit, herhalingen ontdubbeld), prefixt het merk en plakt
 * de kleur erbij als die nog niet in de naam zit. Valt terug op de bestaande
 * displayProductName wanneer de naam al schoon is of er niets bruikbaars
 * overblijft. De rauwe `name` blijft elders intact voor zoeken/import.
 */
/**
 * Maat-/variantaanduiding die in de weergavenaam thuishoort maar alleen in de
 * sku zit (catalogusaudit 2026-07-11):
 * - Maatwerk_Collectie: naam = "Duo Rolgordijn - PRIJSGROEP E" voor élke maat;
 *   de maat zit als "-60X100" in de eigen sku-conventie ("MAAT-…"). Zonder maat
 *   zijn tientallen pickerrijen identiek op de prijs na.
 * - Masureel-behang: hetzelfde dessin bestaat in twee rolhoogtes (sku-suffix
 *   "-260"/"-300" = hoogte in cm) met verschillende prijzen.
 * Bereik 200–400 cm voorkomt valse treffers (bv. dienst-sku "HW-DIENST-001").
 */
export function productVariantSuffix(product: {
  sku?: string;
  eenheid?: string;
}): string | undefined {
  const sku = product.sku ?? "";

  const maat = /^MAAT-.+-(\d{2,3})X(\d{2,3})$/i.exec(sku);
  if (maat) {
    return `${maat[1]}×${maat[2]} cm`;
  }

  if (product.eenheid === "roll") {
    const rol = /-(\d{3})$/.exec(sku);
    const hoogte = rol ? Number(rol[1]) : 0;
    if (hoogte >= 200 && hoogte <= 400) {
      return `rolhoogte ${hoogte} cm`;
    }
  }

  return undefined;
}

/**
 * Codes die kapitaal moeten blijven bij het netjes maken van volledig-kapitale
 * bronnamen: kwaliteits-/eigenschap-/merkcodes, geen woorden. Empirisch
 * bepaald over de 21.853 all-caps namen in de V2-catalogus (audit 2026-07-11).
 */
const KEEP_CAPS = new Set([
  "FR", // brandvertragend (stoffen)
  "MV", // met verduistering
  "LB",
  "VL",
  "LS",
  "CM",
  "XL",
  "XXL",
  "PU",
  "ZLB", // Headlam-kwaliteitscode
  "MOD",
  "REC",
  "RAL",
  "PVC",
  "SDN",
  "EIR",
  "SRC",
  "CAD", // Texdecor-merkcodes (Casadeco/Caselio/Casamance/Camengo)
  "CAL",
  "CAS",
  "CAM"
]);

function prettifyRawCapsToken(token: string) {
  if (KEEP_CAPS.has(token)) {
    return token;
  }
  // Alleen zuiver-alfabetische kapitaalwoorden omzetten; tokens met cijfers of
  // gemengde casing ("62MV", "140B", "0,55") zijn codes en blijven staan.
  if (/^[A-ZÀ-Ý]{2,}$/.test(token)) {
    return token.charAt(0) + token.slice(1).toLowerCase();
  }
  return token;
}

function prettifyAllCapsSegment(segment: string) {
  return segment
    .split(/(\s+)/)
    .map((part) =>
      part
        .split(/([./'’-])/)
        .map((token) => prettifyRawCapsToken(token))
        .join("")
    )
    .join("");
}

/**
 * Bronnamen die volledig in kapitalen staan ("TISSU SCENE D'ETE CAMEL") leesbaar
 * maken voor picker en klant-offerte. Alleen wanneer het deel buiten haakjes
 * géén kleine letters bevat — gemengde namen ("Ambiant PVC", "… RAL 9016")
 * blijven onaangeroerd, zodat bewuste kapitalen nooit sneuvelen. Het deel
 * tussen haakjes (collectienaam) is al netjes en blijft staan.
 */
function prettifyIfAllCaps(name: string) {
  const outside = name.replace(/\([^)]*\)/g, "");
  if (/[a-zà-ÿ]/.test(outside)) {
    return name;
  }
  if (!/[A-ZÀ-Ý]{3,}/.test(outside)) {
    return name;
  }
  return name
    .split(/(\([^)]*\))/)
    .map((segment) => (segment.startsWith("(") ? segment : prettifyAllCapsSegment(segment)))
    .join("");
}

export function cleanProductDisplayName(
  product: PilotProductLike,
  categoryName?: string,
  supplierName?: string
) {
  const base = prettifyIfAllCaps(cleanedBaseName(product, categoryName, supplierName));
  const variant = productVariantSuffix(product);
  if (variant && !normalized(base).includes(normalized(variant))) {
    return `${base} — ${variant}`;
  }
  return base;
}

function cleanedBaseName(
  product: PilotProductLike,
  categoryName?: string,
  supplierName?: string
) {
  const rawName = product.naam ?? "";
  const base = displayProductName(product, categoryName, supplierName);
  const color = squashWhitespace(product.kleurnaam ?? "");

  if (!looksMessy(rawName, color)) {
    return base;
  }

  // Roots-PVC staat onder leverancier "Unilin Flooring" maar wordt als Moduleo
  // verkocht; voor de overige leveranciers volstaat de leveranciersnaam.
  const brand = /\broots\b/i.test(rawName)
    ? "Moduleo"
    : displaySupplierName(supplierName ?? "").trim();

  const cleanedWords = dropRepeatedPhrases(
    rawName
      .split(/\s+/)
      .filter(Boolean)
      .filter((token) => !isNoiseToken(token))
  );
  const cleanedName = prettifyCaps(cleanedWords.join(" ")).trim();

  if (!cleanedName) {
    return base;
  }

  // Kleur toevoegen als die nog niet in de opgeschoonde naam zit.
  const withColor =
    color && !containsPhrase(cleanedName, color)
      ? `${cleanedName} · ${prettifyCaps(color)}`
      : cleanedName;

  if (brand && !containsPhrase(withColor, brand)) {
    return `${brand} ${withColor}`;
  }

  return withColor;
}
