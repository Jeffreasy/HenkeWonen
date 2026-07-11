// Read-only verificatie van de V2-catalogus in de gekoppelde Convex-omgeving:
// zoekt per categorie een bekend product op via de picker-query en controleert
// dat de richtprijs (getIndicativePrice) de juiste eenheid, prijs en btw geeft.
//
//   node tools/verify_v2_pricing.mjs
//
// Alleen queries — muteert niets. Exit 1 bij een afwijking.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor } from "./authz_actor.mjs";
import { loadCatalogToolEnv } from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });
const client = new ConvexHttpClient(toolEnv.convexUrl);
const tenantSlug = toolEnv.tenantSlug;
const actor = createToolMutationActor(tenantSlug);

// Elke case: vind product via picker (zelfde route als de UI), vraag richtprijs
// met de meeteenheid van de betreffende rekenhulp, en vergelijk.
const CASES = [
  {
    name: "Vloer per m² (Floorlife dryback, 2 inkoopcondities)",
    group: "flooring", search: "Finsbury grey",
    measurementUnit: "m2",
    expect: { exVat: 36.95, incVat: 44.71, unit: "m2", vatMode: "exclusive" }
  },
  {
    name: "Vloer per pak → m²-conversie (Moduleo Roots)",
    group: "flooring", search: "GALWAY OAK 87231",
    measurementUnit: "m2",
    // Na pak→m²-conversie rapporteert de engine de geconverteerde eenheid (m2).
    expect: { exVat: 49.9469, incVat: 60.44, unit: "m2", vatMode: "exclusive", conversion: "package_to_m2" }
  },
  {
    name: "Plint per m¹ (Co-pro)",
    group: "plinths", search: "Plakplint",
    measurementUnit: "m1",
    expect: { exVat: 1.77, incVat: 2.14, unit: "m1", vatMode: "exclusive" }
  },
  {
    name: "Traprenovatie per trede (Floorlife Victoria)",
    // "Victoria grey" alleen matcht sinds de losse-termen-zoeker óók de
    // "OverzettredensetpvcVictoriagrey" (bron zonder spaties) — die sorteert
    // vóór de bedoelde tredenset en heeft terecht geen per-trede-prijs.
    group: "stairs", search: "Traptreden Victoria grey",
    measurementUnit: "trede",
    expect: { exVat: 27.45, incVat: 33.21, unit: "step", vatMode: "exclusive" }
  },
  {
    name: "Gordijn per strekkende meter (Headlam)",
    group: "curtains", search: "ADORABLE",
    measurementUnit: "m1",
    expect: { exVat: 99.95, incVat: 120.94, unit: "m1", vatMode: "exclusive" }
  },
  {
    name: "Jaloezie maatwerk per stuk (matrix-product)",
    group: "curtains", search: "PRIJSGROEP 0",
    measurementUnit: "stuk",
    expectUnitOnly: { unit: "piece", vatMode: "exclusive" }
  },
  {
    name: "Behang per rol (Masureel — btw INCL uit bron)",
    group: "wallpaper", search: "Gaio Mint",
    measurementUnit: "rol",
    expect: { exVat: 47.1074, incVat: 57.0, unit: "roll", vatMode: "inclusive" }
  },
  {
    name: "Behang staffel per m¹ (Masureel HPCVFB, afsnijding-tier)",
    group: "wallpaper", search: "Cadie Blush",
    measurementUnit: "m1",
    expect: { exVat: 49.5868, incVat: 60.0, unit: "m1", vatMode: "inclusive" }
  },
  {
    name: "Dienst per m² (Egaliseren, excl. — géén dubbele btw meer)",
    group: "other", search: "Egaliseren m2",
    measurementUnit: "m2",
    expect: { exVat: 15.95, incVat: 19.3, unit: "m2", vatMode: "exclusive" }
  },
  {
    // vtwonen-karpetnamen bevatten de maat niet (5 varianten met dezelfde
    // naam) — de picker kan elke maat teruggeven, dus alleen eenheid/btw testen.
    name: "Karpet per stuk (vtwonen)",
    group: "flooring", search: "Nature Cord Ecru",
    measurementUnit: "stuk",
    expectUnitOnly: { unit: "piece", vatMode: "exclusive" }
  },
  {
    name: "Behang per rol (Casadeco/Nomenclature — btw INCL, 2,2x-model)",
    group: "wallpaper", search: "1930 UNI IRISE BEIGE",
    measurementUnit: "rol",
    expect: { exVat: 60.0, incVat: 72.6, unit: "roll", vatMode: "inclusive" }
  },
  {
    name: "Gordijnstof per m¹ (Casamance/Nomenclature — staffel BNLA + BNLB)",
    group: "curtains", search: "CHROMA MUSCADE",
    measurementUnit: "m1",
    expect: { exVat: 57.1074, incVat: 69.1, unit: "m1", vatMode: "inclusive" }
  },
  {
    name: "Verlichting per stuk (ZTAHL — reconstructie uit prod, excl.)",
    group: "other", search: "Wandrek horizontaal Platinum",
    measurementUnit: "stuk",
    expect: { exVat: 1201, incVat: 1453.21, unit: "piece", vatMode: "exclusive" }
  },
  {
    name: "NEGATIEF: vaste dienst mag géén m²-richtprijs geven",
    group: "other", search: "Vinyl trap",
    measurementUnit: "m2",
    expectNull: true
  }
];

function close(a, b, eps = 0.005) {
  return Math.abs(a - b) <= eps;
}

let failures = 0;

for (const c of CASES) {
  let line = `\n### ${c.name}`;
  try {
    const found = await client.query(api.catalog.pickerSearch.searchPickerProducts, {
      tenantSlug, actor,
      productGroep: c.group === "other" ? undefined : c.group,
      search: c.search,
      limit: 5
    });
    const items = found.items ?? [];
    const product = items[0];
    if (!product) {
      console.log(`${line}\n  FOUT: product niet gevonden via picker (groep=${c.group}, zoek="${c.search}")`);
      failures++;
      continue;
    }
    line += `\n  picker: ${product.weergaveNaam ?? product.naam} [${product.category} / ${product.supplier}]`;

    const res = await client.query(api.catalog.pricing.getIndicativePrice, {
      tenantSlug, actor,
      productId: product.id,
      measurementUnit: c.measurementUnit
    });
    const ind = res.indicative;

    if (c.expectNull) {
      if (ind === null) {
        console.log(`${line}\n  OK: geen richtprijs (zoals bedoeld) voor eenheid '${c.measurementUnit}'`);
      } else {
        console.log(`${line}\n  FOUT: verwacht géén richtprijs, kreeg ${JSON.stringify(ind)}`);
        failures++;
      }
      continue;
    }

    if (!ind) {
      console.log(`${line}\n  FOUT: geen richtprijs voor eenheid '${c.measurementUnit}'`);
      failures++;
      continue;
    }

    const exp = c.expect ?? c.expectUnitOnly;
    const checks = [];
    if (exp.exVat !== undefined) checks.push(["exVat", close(ind.unitPriceExVat, exp.exVat), `${ind.unitPriceExVat} vs ${exp.exVat}`]);
    if (exp.incVat !== undefined) checks.push(["incVat", close(ind.unitPriceIncVat, exp.incVat), `${ind.unitPriceIncVat} vs ${exp.incVat}`]);
    checks.push(["priceUnit", ind.priceUnit === exp.unit, `${ind.priceUnit} vs ${exp.unit}`]);
    checks.push(["vatMode", ind.vatModeUsed === exp.vatMode, `${ind.vatModeUsed} vs ${exp.vatMode}`]);
    if (exp.conversion) checks.push(["conversie", ind.conversionApplied === exp.conversion, `${ind.conversionApplied} vs ${exp.conversion}`]);

    const bad = checks.filter(([, ok]) => !ok);
    if (bad.length === 0) {
      console.log(`${line}\n  OK: €${ind.unitPriceExVat} ex / €${ind.unitPriceIncVat} incl per ${ind.priceUnit} (btw ${ind.vatModeUsed}${ind.conversionApplied ? `, ${ind.conversionApplied}` : ""})`);
    } else {
      console.log(`${line}\n  FOUT: ${bad.map(([k, , d]) => `${k}: ${d}`).join("; ")}`);
      failures++;
    }
  } catch (error) {
    console.log(`${line}\n  FOUT (exception): ${String(error?.message ?? error).slice(0, 300)}`);
    failures++;
  }
}

console.log(`\n${failures === 0 ? "ALLE RICHTPRIJS-TESTS GROEN" : `${failures} TEST(S) GEFAALD`}`);
process.exitCode = failures === 0 ? 0 : 1;
