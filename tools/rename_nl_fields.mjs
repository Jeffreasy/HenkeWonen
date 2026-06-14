// Type-bewuste veldnaam-codemod (Fase 2). Hernoemt Engelse schemavelden -> Nederlands volgens
// tools/nl-rename-map.mjs, VEILIG:
//  - property-access/object-keys worden alleen hernoemd als hun symbool-declaratie in
//    convex/schema.ts, convex/_generated/* of src/lib/portalTypes.ts ligt (zo blijven
//    error.message, lib-API's en lokale vars met dezelfde naam ongemoeid).
//  - schema.ts + portalTypes.ts: structurele key-rename van de definities.
//  - string-literals alleen in veld-referentie-posities: .index(naam, [VELDEN]), searchField,
//    filterFields, en 1e arg van q.eq()/q.field()/q.search().
//  - tabelnamen, index-namen en enum-waarden worden nooit geraakt (staan niet in fieldMap /
//    zitten niet in een veld-positie).
//
// Gebruik:  node tools/rename_nl_fields.mjs [--apply] [--scope convex|src|all]
//   zonder --apply = dry-run (rapport, niets opgeslagen).

import { Project, Node } from "ts-morph";
import { fieldMap } from "./nl-rename-map.mjs";

const APPLY = process.argv.includes("--apply");
const scopeArg = (() => {
  const i = process.argv.indexOf("--scope");
  return i >= 0 ? process.argv[i + 1] : "all";
})();

const ROOT = "C:/Users/jeffrey/Desktop/Projecten/HenkeWonen";
const SCHEMA = `${ROOT}/convex/schema.ts`;
const PORTAL_TYPES = `${ROOT}/src/lib/portalTypes.ts`;

const project = new Project({ tsConfigFilePath: `${ROOT}/tsconfig.json` });
// Zorg dat alle relevante bronnen geladen zijn (tsconfig dekt src; convex expliciet toevoegen).
project.addSourceFilesAtPaths([`${ROOT}/convex/**/*.ts`, `${ROOT}/src/**/*.{ts,tsx}`]);

const isDeclFile = (path) =>
  path.includes("/convex/schema.ts") ||
  path.includes("\\convex\\schema.ts") ||
  path.includes("/convex/_generated/") ||
  path.includes("\\convex\\_generated\\") ||
  path.includes("/src/lib/portalTypes.ts") ||
  path.includes("\\src\\lib\\portalTypes.ts");

const stats = {};
// Shorthand-property edits vervangen het HELE node -> dat "vergeet" de node tijdens een
// getDescendants()-iteratie. Daarom verzamelen en pas NA de passes toepassen.
const shorthandEdits = [];
const bump = (file, kind) => {
  stats[file] ??= {};
  stats[file][kind] = (stats[file][kind] ?? 0) + 1;
};

/** Is dit een veldnaam waarvan de declaratie in een schema-/types-bestand ligt? (named interfaces) */
function symbolDeclaredInSchema(nameNode) {
  try {
    const sym = nameNode.getSymbol();
    if (!sym) return false;
    for (const d of sym.getDeclarations()) {
      if (isDeclFile(d.getSourceFile().getFilePath())) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Convex-document-types zijn ge-expand mapped types zonder declaratie, maar bevatten _creationTime. */
function typeLooksLikeDoc(typeText) {
  return typeof typeText === "string" && typeText.includes("_creationTime");
}

/** Property-access doc.veld: schemaveld als symbool uit types komt OF de receiver een Convex-doc is. */
function isSchemaFieldAccess(nameNode, receiverExpr) {
  if (symbolDeclaredInSchema(nameNode)) return true;
  try {
    return typeLooksLikeDoc(receiverExpr.getType().getText());
  } catch {
    return false;
  }
}

/** Object-key {veld:...}: schemaveld als symbool uit types komt OF het object het arg is van
 *  insert/patch/replace (dan is het een document-vorm; contextuele type mist _creationTime). */
function isSchemaObjectKey(propAssignment, nameNode) {
  if (symbolDeclaredInSchema(nameNode)) return true;
  try {
    const obj = propAssignment.getParent();
    if (!obj || !Node.isObjectLiteralExpression(obj)) return false;
    const call = obj.getParent();
    if (call && Node.isCallExpression(call)) {
      const callee = call.getExpression();
      if (Node.isPropertyAccessExpression(callee)) {
        const m = callee.getName();
        if (m === "insert" || m === "patch" || m === "replace") {
          // obj moet een argument van de call zijn (niet de callee).
          if (call.getArguments().includes(obj)) return true;
        }
      }
    }
    const ct = obj.getContextualType && obj.getContextualType();
    return ct ? typeLooksLikeDoc(ct.getText()) : false;
  } catch {
    return false;
  }
}

function inScope(filePath) {
  const isConvex = filePath.includes("/convex/") || filePath.includes("\\convex\\");
  const isSrc = filePath.includes("/src/") || filePath.includes("\\src\\");
  if (filePath.includes("_generated")) return false;
  if (scopeArg === "convex") return isConvex;
  if (scopeArg === "src") return isSrc;
  return isConvex || isSrc;
}

// VOLGORDE is cruciaal: eerst de REFERENTIES (pass 2, terwijl de oude declaraties nog
// type-resolven), DAARNA de DECLARATIES (pass 1). Andersom resolven de oude property-accesses
// niet meer en mist de type-bewuste rename alles.

// ── Helper: hernoem veld-referentie-strings in een CallExpression-argument ───────
function renameStringArg(argNode, file) {
  if (argNode && Node.isStringLiteral(argNode)) {
    const v = argNode.getLiteralValue();
    if (fieldMap[v]) {
      argNode.setLiteralValue(fieldMap[v]);
      bump(file, "str");
    }
  }
}

// ── Pass 2: alle bronbestanden — type-bewuste property-rename + positionele strings ─
for (const sf of project.getSourceFiles()) {
  const fp = sf.getFilePath();
  if (!inScope(fp)) continue;
  const short = sf.getFilePath().split(/[\\/]/).slice(-2).join("/");
  const isDecl = isDeclFile(fp);

  for (const node of sf.getDescendants()) {
    // 2a. Property-access: doc.veld -> doc.nieuwVeld (alleen als symbool uit schema/types komt).
    if (Node.isPropertyAccessExpression(node)) {
      const nameNode = node.getNameNode();
      const name = nameNode.getText();
      if (fieldMap[name] && isSchemaFieldAccess(nameNode, node.getExpression())) {
        nameNode.replaceWithText(fieldMap[name]);
        bump(short, "access");
      }
      continue;
    }

    // 2b. Object-literal keys (insert/patch/return): { veld: ... } -> { nieuwVeld: ... }
    //     alleen als de contextuele property uit schema/types komt. Sla schema.ts/portalTypes
    //     over (die zijn in pass 1 gedaan).
    if (!isDecl && Node.isPropertyAssignment(node)) {
      const nameNode = node.getNameNode();
      const name = nameNode.getText().replace(/^["']|["']$/g, "");
      if (fieldMap[name] && isSchemaObjectKey(node, nameNode)) {
        nameNode.replaceWithText(fieldMap[name]);
        bump(short, "objkey");
      }
      continue;
    }

    // 2b'. Shorthand object-key in een schema-insert/patch: { veld } -> { nieuwVeld: veld }.
    if (!isDecl && Node.isShorthandPropertyAssignment(node)) {
      const name = node.getName();
      if (fieldMap[name] && isSchemaObjectKey(node, node.getNameNode())) {
        shorthandEdits.push({ node, text: `${fieldMap[name]}: ${name}`, file: short, kind: "objkey" });
      }
      continue;
    }

    // 2c. Positionele veld-referentie-strings.
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      const args = node.getArguments();
      if (Node.isPropertyAccessExpression(expr)) {
        const method = expr.getName();
        if (method === "eq" || method === "field" || method === "search") {
          renameStringArg(args[0], short); // 1e arg = veldnaam
        } else if (method === "index") {
          // arg0 = index-NAAM (overslaan); arg1 = array van veldnaam-strings.
          const arr = args[1];
          if (arr && Node.isArrayLiteralExpression(arr)) {
            for (const el of arr.getElements()) renameStringArg(el, short);
          }
        }
      }
    }

    // 2d. searchIndex-definitie: searchField: "x" + filterFields: ["x", ...]  (alleen schema.ts).
    if (isDecl && Node.isPropertyAssignment(node)) {
      const key = node.getNameNode().getText().replace(/^["']|["']$/g, "");
      if (key === "searchField") {
        renameStringArg(node.getInitializer(), short);
      } else if (key === "filterFields") {
        const arr = node.getInitializer();
        if (arr && Node.isArrayLiteralExpression(arr)) {
          for (const el of arr.getElements()) renameStringArg(el, short);
        }
      }
    }
  }
}

// ── Pass 1 (NA pass 2): structurele key-rename in schema.ts (convex) + portalTypes.ts (src) ──
// Scope-bewust: schema.ts hoort bij de backend-rename, portalTypes.ts bij de frontend-rename.
// Ze zijn onafhankelijk (backend gebruikt Doc-types uit schema; frontend gebruikt portalTypes).
const declTargets = [];
if (scopeArg === "convex" || scopeArg === "all") declTargets.push(SCHEMA);
if (scopeArg === "src" || scopeArg === "all") declTargets.push(PORTAL_TYPES);
for (const declPath of declTargets) {
  const sf = project.getSourceFile(declPath);
  if (!sf) continue;
  const short = sf.getFilePath().split(/[\\/]/).slice(-2).join("/");

  for (const node of sf.getDescendants()) {
    if (Node.isPropertyAssignment(node) || Node.isPropertySignature(node)) {
      const nameNode = node.getNameNode();
      const name = nameNode.getText().replace(/^["']|["']$/g, "");
      if (fieldMap[name]) {
        nameNode.replaceWithText(fieldMap[name]);
        bump(short, "key");
      }
    } else if (Node.isShorthandPropertyAssignment(node)) {
      // schema-velden als shorthand (bv. `priceType,` = const-validator) -> `prijsSoort: priceType`.
      const name = node.getName();
      if (fieldMap[name]) {
        shorthandEdits.push({ node, text: `${fieldMap[name]}: ${name}`, file: short, kind: "key" });
      }
    }
  }
}

// ── Shorthand-edits NU toepassen (na alle traversals) ───────────────────────────
for (const e of shorthandEdits) {
  e.node.replaceWithText(e.text);
  bump(e.file, e.kind);
}

// ── Rapport ─────────────────────────────────────────────────────────────────────
const files = Object.keys(stats).sort();
let totals = { key: 0, access: 0, objkey: 0, str: 0 };
console.log(`\n=== NL-rename codemod (${APPLY ? "APPLY" : "DRY-RUN"}, scope=${scopeArg}) ===`);
for (const f of files) {
  const s = stats[f];
  for (const k of Object.keys(totals)) totals[k] += s[k] ?? 0;
  console.log(
    `  ${f.padEnd(48)} key:${s.key ?? 0} access:${s.access ?? 0} objkey:${s.objkey ?? 0} str:${s.str ?? 0}`
  );
}
console.log(
  `\nTOTAAL  keys:${totals.key}  access:${totals.access}  objkeys:${totals.objkey}  strings:${totals.str}  (bestanden:${files.length})`
);

if (APPLY) {
  await project.save();
  console.log("\nOpgeslagen. Draai nu: npx convex codegen && npm run check");
} else {
  console.log("\nDRY-RUN — niets opgeslagen. Voeg --apply toe om te schrijven.");
}
