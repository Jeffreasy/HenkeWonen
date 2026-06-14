/**
 * Genereert de BEVROREN datamigratie-spec voor de NL-veldnaam-rename (Fase 2).
 *
 * Bron van waarheid = het verschil tussen het EN-schema (vlak vóór de rename,
 * commit 791774b) en het huidige NL-schema. Beide worden met ts-morph geparset;
 * per tabel worden de top-level defineTable-sleutels POSITIONEEL uitgelijnd
 * (de codemod hernoemde alleen sleutels, voegde niets toe/verwijderde niets en
 * herschikte niet — 427 ins / 427 del, symmetrisch). Elk paar waar de sleutel
 * verschilt is een rename. De 3 hand-getypte geneste structuren
 * (products.commercialNames, quoteTemplates.secties/standaardRegels) worden
 * apart meegegeven omdat hun binnenste sleutels ook hernoemd zijn.
 *
 * Kruiscontrole: elke afgeleide rename MOET in tools/nl-rename-map.mjs.fieldMap
 * staan (oud→nieuw). Mismatches worden hard gerapporteerd.
 *
 * Output: tools/nl-rename-spec.json (bevroren; commit dit). Het is de input voor
 * convex/beheer/migrateNlFields.ts (in-place chunked backfill) en de driver
 * tools/migrate_nl_fields.mjs.
 *
 * Draaien: node tools/build_rename_spec.mjs   (vereist ts-morph als dev-dep;
 *          installeer met: npm i ts-morph --no-save --engine-strict=false)
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { Project, SyntaxKind } from "ts-morph";
import { fieldMap, alreadyDutchTables } from "./nl-rename-map.mjs";

const EN_SCHEMA_COMMIT = "791774b";

// Hand-getypte geneste structuren (zie convex/schema.ts). Sleutel = OUD buitenste
// veldnaam zoals in de opgeslagen docs; newOuter = nieuwe buitenste naam.
const NESTED_ARRAYS = {
  products: [
    {
      oldOuter: "commercialNames",
      newOuter: "commercialNames",
      fields: {
        brandName: "merknaam",
        collectionName: "collectieNaam",
        colorName: "kleurnaam",
        displayName: "weergaveNaam"
      }
    }
  ],
  quoteTemplates: [
    {
      oldOuter: "sections",
      newOuter: "secties",
      fields: { key: "sleutel", title: "titel", description: "omschrijving" }
    },
    {
      oldOuter: "defaultLines",
      newOuter: "standaardRegels",
      fields: {
        sectionKey: "sectieSleutel",
        lineType: "regelType",
        title: "titel",
        unit: "eenheid",
        description: "omschrijving",
        defaultQuantity: "standaardAantal",
        optional: "optioneel",
        defaultEnabled: "standaardIngeschakeld",
        categoryHint: "categorieHint",
        productKindHint: "productSoortHint"
      }
    }
  ]
};

function tableTopLevelKeys(sourceText, label) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(`${label}.ts`, sourceText);
  const result = {};

  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return;
    if (node.getExpression().getText() !== "defineTable") return;

    const arg = node.getArguments()[0];
    if (!arg || arg.getKind() !== SyntaxKind.ObjectLiteralExpression) return;

    const propAssign = node.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
    const tableName = propAssign?.getName();
    if (!tableName) return;

    const keys = arg
      .getProperties()
      .filter(
        (p) =>
          p.getKind() === SyntaxKind.PropertyAssignment ||
          p.getKind() === SyntaxKind.ShorthandPropertyAssignment
      )
      .map((p) => p.getName());
    result[tableName] = keys;
  });

  return result;
}

const enSchema = execSync(`git show ${EN_SCHEMA_COMMIT}:convex/schema.ts`, {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024
});
const nlSchema = readFileSync("convex/schema.ts", "utf8");

const enKeys = tableTopLevelKeys(enSchema, "en");
const nlKeys = tableTopLevelKeys(nlSchema, "nl");

const inverseFieldMap = Object.fromEntries(
  Object.entries(fieldMap).map(([oud, nieuw]) => [nieuw, oud])
);

const spec = {};
const warnings = [];
const crossCheckMismatches = [];
let totalTopLevel = 0;
let totalNested = 0;

const allTables = Array.from(new Set([...Object.keys(enKeys), ...Object.keys(nlKeys)]));

for (const table of allTables.sort()) {
  if (alreadyDutchTables.includes(table)) continue; // al NL, geen migratie

  const en = enKeys[table];
  const nl = nlKeys[table];

  if (!en || !nl) {
    warnings.push(`Tabel ${table} bestaat maar in één schema (en=${!!en}, nl=${!!nl}) — overgeslagen.`);
    continue;
  }
  if (en.length !== nl.length) {
    warnings.push(
      `Tabel ${table}: sleutel-aantal verschilt (en=${en.length}, nl=${nl.length}) — POSITIONELE uitlijning onbetrouwbaar, handmatig controleren.`
    );
    continue;
  }

  const fields = {};
  const nestedOuterOld = new Set((NESTED_ARRAYS[table] ?? []).map((n) => n.oldOuter));

  for (let i = 0; i < en.length; i++) {
    const oldK = en[i];
    const newK = nl[i];
    if (oldK === newK) continue;
    // Geneste array-buitennamen worden via NESTED_ARRAYS afgehandeld (niet dubbel).
    if (nestedOuterOld.has(oldK)) {
      // wel kruiscontrole op de buitenste rename
      if (fieldMap[oldK] && fieldMap[oldK] !== newK) {
        crossCheckMismatches.push(`${table}.${oldK}: schema→${newK} maar fieldMap→${fieldMap[oldK]}`);
      }
      continue;
    }
    fields[oldK] = newK;
    totalTopLevel++;

    // Kruiscontrole tegen fieldMap.
    if (fieldMap[oldK] === undefined) {
      crossCheckMismatches.push(`${table}.${oldK}→${newK}: oud niet in fieldMap (inverse: ${inverseFieldMap[newK] ?? "—"})`);
    } else if (fieldMap[oldK] !== newK) {
      crossCheckMismatches.push(`${table}.${oldK}: schema→${newK} maar fieldMap→${fieldMap[oldK]}`);
    }
  }

  const nestedArrays = NESTED_ARRAYS[table] ?? [];
  for (const nested of nestedArrays) {
    totalNested += Object.keys(nested.fields).length;
    // kruiscontrole binnenste velden
    for (const [oi, ni] of Object.entries(nested.fields)) {
      if (fieldMap[oi] !== undefined && fieldMap[oi] !== ni) {
        crossCheckMismatches.push(`${table}.${nested.oldOuter}[].${oi}: spec→${ni} maar fieldMap→${fieldMap[oi]}`);
      }
    }
  }

  if (Object.keys(fields).length > 0 || nestedArrays.length > 0) {
    spec[table] = { fields, nestedArrays };
  }
}

const output = {
  generatedFrom: { enSchemaCommit: EN_SCHEMA_COMMIT, nlSchema: "convex/schema.ts (working tree)" },
  note:
    "Bevroren NL-veldnaam-migratiespec. Per tabel: top-level field-renames (oud→nieuw) + geneste array-objecten. Idempotent toe te passen.",
  tables: spec
};

writeFileSync("tools/nl-rename-spec.json", JSON.stringify(output, null, 2) + "\n", "utf8");

console.log(`Spec geschreven: tools/nl-rename-spec.json`);
console.log(`Tabellen met renames: ${Object.keys(spec).length}`);
console.log(`Top-level field-renames: ${totalTopLevel}`);
console.log(`Geneste binnenste-renames: ${totalNested}`);

if (warnings.length) {
  console.log(`\n⚠️  WAARSCHUWINGEN (${warnings.length}):`);
  warnings.forEach((w) => console.log(`  - ${w}`));
}
if (crossCheckMismatches.length) {
  console.log(`\n❌ FIELDMAP-KRUISCONTROLE MISMATCHES (${crossCheckMismatches.length}):`);
  crossCheckMismatches.forEach((m) => console.log(`  - ${m}`));
  process.exitCode = 1;
} else {
  console.log(`\n✅ Alle afgeleide renames komen overeen met fieldMap.`);
}
