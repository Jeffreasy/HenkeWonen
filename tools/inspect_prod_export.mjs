#!/usr/bin/env node
/*
 * inspect_prod_export.mjs — READ-ONLY Fase-0 grondwaarheid-inspectie.
 *
 * Beantwoordt in één run de 5 grondwaarheid-vragen uit
 * `docs/technisch/prod-deploy-runbook-2026-06-24.md` tegen een UITGEPAKTE Convex
 * prod-export, en kiest per vraag de vervolg-fase. Muteert NIETS — leest alleen
 * de export-JSONL (streamend, dus veilig op prod-volume).
 *
 * Gebruik (eigenaar; de export zelf is read-only):
 *   npx convex export --prod --path prod-pre-deploy.zip
 *   # pak prod-pre-deploy.zip uit naar bv. ./prod-export
 *   node tools/inspect_prod_export.mjs ./prod-export
 *
 * Opties:
 *   --spec <pad>   pad naar nl-rename-spec.json (default tools/nl-rename-spec.json)
 *   --json         machine-leesbare output i.p.v. de beslis-tabel
 *
 * Verwachtingen (geverifieerd 2026-06-24 tegen seed-bron + schema):
 *   priceMatrices=29, calculatorRules=51, wasteProfiles=8.
 */

import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const specIdx = args.indexOf("--spec");
const specPath = specIdx !== -1 ? args[specIdx + 1] : path.join(HIER, "nl-rename-spec.json");
const root = args.find((a) => !a.startsWith("--") && a !== specPath);

if (!root) {
  console.error("Geef het pad naar de UITGEPAKTE prod-export. Bv: node tools/inspect_prod_export.mjs ./prod-export");
  process.exit(2);
}

// Referentie-seed-aantallen die op een verse prod aanwezig moeten zijn.
const EXPECT = { priceMatrices: 29, calculatorRules: 51, wasteProfiles: 8 };
// Tabellen die pas bestaan ná de recente code-deploys (proxy voor "staat de code er?").
const CODE_TABLES = ["priceMatrices", "calculatorRules", "monteurWerktijden", "monteurAfwezigheid"];
// Tabellen met echte prod-data die op resterende Engelse veldsleutels gescand worden (Q5).
const Q5_TABLES = [
  "customers", "projects", "measurements", "measurementRooms",
  "measurementLines", "quotes", "quoteLines", "invoices", "users"
];

/** Vind per tabelnaam het JSONL-databestand in de export. Convex: <root>/<tabel>/documents.jsonl. */
async function findTableFiles(dir) {
  const map = new Map();
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    console.error(`Kan exportmap niet lezen: ${dir}`);
    process.exit(2);
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      const docs = path.join(dir, e.name, "documents.jsonl");
      try {
        await stat(docs);
        map.set(e.name, docs);
        continue;
      } catch { /* geen documents.jsonl in deze map */ }
    }
    if (e.isFile() && e.name.endsWith(".jsonl")) {
      map.set(e.name.replace(/\.jsonl$/, ""), path.join(dir, e.name));
    }
  }
  return map;
}

async function* streamDocs(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (t) {
      try {
        yield JSON.parse(t);
      } catch {
        /* sla onparseerbare regel over (export bevat soms een trailing newline) */
      }
    }
  }
}

async function countDocs(file) {
  let n = 0;
  // eslint-disable-next-line no-unused-vars
  for await (const _doc of streamDocs(file)) n++;
  return n;
}

async function loadSpec() {
  try {
    const parsed = JSON.parse(await readFile(specPath, "utf8"));
    return parsed.tables ?? parsed;
  } catch {
    return null;
  }
}

async function main() {
  const files = await findTableFiles(root);
  const spec = await loadSpec();
  const report = { q1: {}, q2: {}, q3: null, q5: {}, q4: "handmatig: vergelijk de live Vercel-commit met main" };

  // Q1 — staat de recente code op prod? (tabel bestaat = schema gedeployd)
  for (const t of CODE_TABLES) report.q1[t] = files.has(t);

  // Q2 — referentie-seeds gevuld?
  for (const [t, exp] of Object.entries(EXPECT)) {
    report.q2[t] = files.has(t) ? { count: await countDocs(files.get(t)), expected: exp } : { count: null, expected: exp };
  }

  // Q3 — measurementRooms zonder projectRuimteId (ruimte-model A)
  if (files.has("measurementRooms")) {
    let total = 0, missing = 0;
    for await (const doc of streamDocs(files.get("measurementRooms"))) {
      total++;
      if (doc.projectRuimteId === undefined || doc.projectRuimteId === null) missing++;
    }
    report.q3 = { total, missing };
  }

  // Q5 — resterende Engelse veldsleutels (NL-rename) per tabel
  for (const t of Q5_TABLES) {
    if (!files.has(t)) continue;
    const oldKeys = spec?.[t]?.fields ? Object.keys(spec[t].fields) : null;
    if (!oldKeys || oldKeys.length === 0) {
      report.q5[t] = { docs: null, withOld: null, note: "geen rename-mapping in spec" };
      continue;
    }
    let docs = 0, withOld = 0;
    const hitKeys = new Set();
    for await (const doc of streamDocs(files.get(t))) {
      docs++;
      let hit = false;
      for (const k of oldKeys) {
        if (Object.prototype.hasOwnProperty.call(doc, k)) { hit = true; hitKeys.add(k); }
      }
      if (hit) withOld++;
    }
    report.q5[t] = { docs, withOld, voorbeeldSleutels: [...hitKeys].slice(0, 6) };
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // ── Beslis-tabel ────────────────────────────────────────────────────────────
  const ok = (b) => (b ? "JA " : "NEE");
  const lines = [];
  lines.push("");
  lines.push("════════ Fase-0 grondwaarheid prod-export ════════");
  lines.push(`export: ${path.resolve(root)}`);
  lines.push("");

  const codeAanwezig = CODE_TABLES.every((t) => report.q1[t]);
  lines.push("Q1  Staat de recente code op prod? (tabel bestaat = schema gedeployd)");
  for (const t of CODE_TABLES) lines.push(`      ${ok(report.q1[t])} ${t}`);
  lines.push(`    → ${codeAanwezig ? "code lijkt gedeployd" : "CODE ACHTER → Fase 1 nodig"}`);
  lines.push("");

  lines.push("Q2  Referentie-seeds gevuld?");
  let seedsOk = true;
  for (const [t, v] of Object.entries(report.q2)) {
    const good = v.count === v.expected;
    if (!good) seedsOk = false;
    lines.push(`      ${good ? "JA " : "NEE"} ${t}: ${v.count ?? "tabel ontbreekt"} / verwacht ${v.expected}`);
  }
  lines.push(`    → ${seedsOk ? "seeds compleet" : "SEED(S) ONTBREKEN → Fase 2 (seed.run eerst, dan de missende)"}`);
  lines.push("");

  lines.push("Q3  measurementRooms zonder projectRuimteId? (ruimte-model A / L2)");
  if (report.q3 === null) {
    lines.push("      (geen measurementRooms in export — nog geen inmeet-ruimtes; deploy veilig op dit punt)");
  } else {
    lines.push(`      totaal ${report.q3.total}, zonder koppeling ${report.q3.missing}`);
    lines.push(`    → ${report.q3.missing === 0
      ? "0 los → directe deploy mag (geen ruimte-model expand-then-contract)"
      : "≥1 los → RUIMTE-MODEL-A expand-then-contract (A1 → backfill_room_links → A2)"}`);
  }
  lines.push("");

  lines.push("Q5  Resterende Engelse veldsleutels? (NL-rename / 2e deploy-breaker)");
  let nlVuil = false;
  for (const t of Q5_TABLES) {
    const v = report.q5[t];
    if (!v) { lines.push(`      —   ${t}: niet in export`); continue; }
    if (v.withOld === null) { lines.push(`      ?   ${t}: ${v.note}`); continue; }
    const vuil = v.withOld > 0;
    if (vuil) nlVuil = true;
    lines.push(`      ${vuil ? "VUIL  " : "schoon"} ${t}: ${v.withOld}/${v.docs} docs met oude sleutel` +
      (vuil ? ` (${v.voorbeeldSleutels.join(", ")})` : ""));
  }
  lines.push(`    → ${nlVuil
    ? "ENGELSE SLEUTELS AANWEZIG → NL-RENAME expand-then-contract EERST (schemaValidation:false-deploy → migrate_nl_fields --apply → --verify==0 → schemaValidation:true-deploy)"
    : "alle gescande tabellen NL → NL-rename al op prod (alleen verifiëren)"}`);
  lines.push("    (autoritatief: tools/migrate_nl_fields.mjs --verify; dit is een top-level tripwire)");
  lines.push("");

  lines.push("Q4  Loopt de frontend voor op de backend? (L1)");
  lines.push("      handmatig: vergelijk de live Vercel-prod-commit met origin/main;");
  lines.push("      als Q1=NEE en de frontend staat op main → agenda/richtprijs/bulk zijn NU kapot.");
  lines.push("");

  lines.push("──────── DEPLOY-TAK ────────");
  const stappen = [];
  if (nlVuil) stappen.push("1. NL-rename expand-then-contract (Fase 1.0)");
  if (report.q3 && report.q3.missing > 0) stappen.push("2. Ruimte-model-A expand-then-contract (Fase 1b)");
  if (!codeAanwezig && !(report.q3 && report.q3.missing > 0) && !nlVuil) stappen.push("Directe Convex-deploy (Fase 1a)");
  if (!seedsOk) stappen.push("3. Seeds draaien (Fase 2): seed.run → ontbrekende seed(s)");
  if (stappen.length === 0) stappen.push("Niets schema-blokkerend; verifieer Q2/Q4 en deploy desgewenst (Fase 1a).");
  for (const s of stappen) lines.push(`   • ${s}`);
  lines.push("   ⚠ Volgorde: NL-rename vóór ruimte-model-A; Convex vóór de frontend.");
  lines.push("   ⚠ Zet ALLOW_CONVEX_TOOLING erna weer UIT en draai NOOIT demo:run op prod.");
  lines.push("");

  console.log(lines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
