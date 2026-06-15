# Fase 2 — NL-veldnaam-migratie: glossary, beslissingen & uitvoeringsplan

> Status: **analyse + beslissingen + canonieke map klaar; uitvoering volgt (compiler-gedreven, per gebied).**
> Canonieke veld-map (bron van waarheid voor codemod + datamigratie): [`tools/nl-rename-map.mjs`](../../tools/nl-rename-map.mjs).
> Voortkomend uit het plan `~/.claude/plans/humming-questing-mccarthy.md` Fase 2.

## Beslissingen (eigenaar, 2026-06-14)

1. **Conventie = volg HenkeWonenDATA `NAMING.md`.** Stammen vertalen; loanwords/technisch blijven Engels:
   `type` (los veld), `code`-suffix, `status`, `label`, `email`, `slug`, `ean`, `sku`, `currency`,
   `metadata`, `mapping`, `batch`, `*Id`-suffix.
2. **`tenantId` + `externalUserId` (+ alle `*ByExternalUserId`) blijven Engels.** SaaS-/auth-termen,
   staan in elke `by_tenant`-index en de auth-laag.
3. **`productKind → productSoort`, `productType → productAard`** (botsing in `products` ontdubbeld).
4. **Compounds met "Type": stam vertalen, "Type" behouden** (`calculationType → berekeningType`,
   `lineType → regelType`, `quoteLineType → offerteRegelType`).
5. `priceMatrices` + `calculatorRules` zijn al Nederlands → niet hernoemen (wel referenties elders).

217 veld-mappings; zie `tools/nl-rename-map.mjs` (`fieldMap`, `keepFields`, `tableNames`,
`dangerousGenericFields`, `alreadyDutchTables`).

## Wat NIET hernoemen

- **Tabelnamen** (32) en **index-/searchIndex-namen** (`by_tenant`, `search_products`, …). Wél mee:
  de **veld-referentie-strings** in de index-arrays + `searchField`/`filterFields`.
- **Enum-WAARDEN** (alle `v.literal("…")` en `=== "…"`-vergelijkingen) — data-identifiers, blijven Engels.
- `convex/catalog/priceColumnKey.ts` dynamische sleutels (Excel-headers, geen schemavelden).

## ⚠️ Kernrisico bij de uitvoering — geen blinde sweep

Generieke veldnamen (`key`, `name`, `type`, `unit`, `result`, `input`, `amount`, `status`, `errors`,
`sections`, `terms`, `optional`, `quantity`, …) botsen met alomtegenwoordige JS/React-identifiers
(`key={}`-props, `Object.entries`, lokale variabelen, library-API's). Een tekstuele/identifier-sweep
zou die corrumperen. **Daarom compiler-gedreven (type-bewust):**

1. Hernoem de velden in **`convex/schema.ts`** (defineTable-keys + de veld-strings in `.index([...])`,
   `searchField`, `filterFields`) en in **`src/lib/portalTypes.ts`** (de handgeschreven spiegel).
2. `npx convex codegen` → `_generated` reflecteert de NL-namen.
3. `npm run check` (astro/tsc) + Convex-index-typing vlaggen **elke** kapotte verwijzing
   (property-access én `q.eq("veld")`-strings). Fix precies wat de compiler aanwijst, per gebied.
4. `npm run test` + `npm run lint` per gebied groen houden.

Een AST-codemod (ts-morph met type-info / rename-symbol) mag de mechanische bulk doen, maar
uitsluitend type-bewust; de compiler blijft het vangnet.

## Volgorde (per gebied, telkens groen vóór door)

1. **schema.ts** (incl. index-/search-strings) + `_generated` regenereren.
2. **Backend** (~32 convex-bestanden) — compiler-gedreven; let op de gedupliceerde enum-validators per bestand.
3. **Frontend** — `src/lib/portalTypes.ts` eerst, dan componenten (hotspot `MeasurementPanel.tsx`);
   `src/lib/calculators/` + `statusLabels.ts` buiten scope; auth-boundary = `src/lib/auth/sessionSync.ts`.
4. **Tooling** — `tools/build_catalog_import.py` (output-rijsleutels), `upload_catalog_batch_import.mjs`,
   `import_data_catalog_direct.mjs`, `build_data_catalog_preview.mjs` (preview-rijsleutels), vat-/repair-tools.
5. **Dev-datamigratie** (zie hieronder) → tests/reconciliatie → **prod-migratie (eigenaarsactie)**.

## Datamigratie op de gedeployede DB (schemaValidation:false big-bang)

Per omgeving (dev eerst, met backup; prod = eigenaar):
1. `defineSchema(tables, { schemaValidation: false })` in `convex/schema.ts` → deploy.
2. NL-schema + code-cutover deployen.
3. **Chunked backfill** per tabel: `patch(_id, { nieuw: doc.oud, oud: undefined })`, gepagineerd
   (≤300/call, cursor-loop, dryRun-default). Herbruikbaar skelet: een gated `renameFieldsChunk`-mutatie
   met arg `fieldMap` per tabel (zie het migratie-rapport in de analyse). Idempotent + herrunbaar.
4. `{ schemaValidation: true }` terug → deploy; de deploy-validatie bevestigt dat alle docs NL zijn.

Backup vóór elke stap: `npx convex export [--prod] --path <duurzaam pad>.zip` (PII — buiten repo/temp).
Rollback = `npx convex import [--prod] --replace …` (destructief; eigenaarsactie).
**Een AI muteert prod niet** — levert kant-en-klare commando's; de eigenaar draait apply/deploy/import.

### Geïmplementeerde tooling (gebouwd + bevroren)
- `tools/build_rename_spec.mjs` → genereert de BEVROREN spec `tools/nl-rename-spec.json`
  uit het schema-diff (EN-commit `791774b` ↔ huidig NL-schema), POSITIONEEL uitgelijnd en
  gekruist met `fieldMap` (0 mismatches: 357 top-level + 17 geneste renames, 30 tabellen).
- `convex/beheer/migrateNlFields.ts` → `renameFieldsChunk` (gated: admin + `confirm:"RENAME_NL_FIELDS"`
  + dryRun-default, hele-tabel-scan, idempotent) en `countRemainingOldFields` (read-only verificatie).
- `tools/migrate_nl_fields.mjs` → driver (cursor-loop, dryRun-default, `--apply`, `--verify`, `--only=`).

### Uitvoering DEV — afgerond & gevalideerd (2026-06-14)
1. Backup: `C:\Users\jeffrey\HenkeBackups\dev-pre-nl-rename-20260614.zip` (123 MB, EN-velden bevestigd).
2. `{ schemaValidation: false }` → `npx convex dev --once` (NL-schema + functies live).
3. `node tools/migrate_nl_fields.mjs --apply` → **294.008 docs gemigreerd over 30 tabellen**
   (matched===patched===scanned per tabel).
4. `--verify` → **0 resterende EN-velden** (alle `docsWithAnyOld: 0`).
5. `{ schemaValidation: true }` → `npx convex dev --once` → deploy-validatie van ~294k docs **groen** (41s).
6. `npm run test` → 190/190 groen (incl. portal-HTTP-smoke tegen de gemigreerde dev-DB).

### Prod-runbook (EIGENAARSACTIE — exact dezelfde sequentie, prod-flags)
```
# 1. Backup (buiten repo/temp; bevat PII)
npx convex export --prod --path <pad>\prod-pre-nl-rename-<datum>.zip
# 2. schemaValidation:false in convex/schema.ts → deploy
npx convex deploy   # of: npx convex deploy --prod, afhankelijk van CONVEX_DEPLOY_KEY
# 3. Backfill (dryRun eerst, dan apply)
node tools/migrate_nl_fields.mjs --env-file .env.production --production --target=production
node tools/migrate_nl_fields.mjs --apply --env-file .env.production --production \
  --target=production --confirm-production-nl-rename      # vereist AUTHZ_TOKEN_SECRET
# 4. Verifieer 0 resterende EN-velden
node tools/migrate_nl_fields.mjs --verify --env-file .env.production --production --target=production
# 5. schemaValidation:true terug → deploy (deploy-validatie = extra vangnet)
```

## Codemod-engine (gebouwd) + trial-apply-bevindingen

`tools/rename_nl_fields.mjs` (ts-morph, dev-dep `ts-morph` via `npm i ts-morph --no-save`):
- **Pass 2 (eerst):** type-bewuste rename van property-access + object-keys waar het symbool in
  schema/_generated/portalTypes declareert OF de receiver een Convex-doc is (`_creationTime` in
  het type); + positionele veld-strings (`q.eq/q.field/q.search` 1e arg, `.index([...])`-arrays,
  `searchField`/`filterFields`). **Pass 1 (daarna):** structurele key-rename in `schema.ts`
  (incl. shorthand-validators `priceType,`→`prijsSoort: priceType`) en `portalTypes.ts`.
  Volgorde is cruciaal (anders resolven oude accesses niet meer). Scope-bewust: `--scope convex`
  doet schema+backend, `--scope src` doet portalTypes+frontend (onafhankelijk).
- Draaien: `node tools/rename_nl_fields.mjs --apply --scope convex` → `npx convex codegen` → `npm run check`.

**Trial-apply backend (scope=convex):** 376 schema-keys + 936 accesses + 925 object-keys + 132
strings toegepast; codegen groen; **33 resterende type-errors** (alleen backend, frontend ontkoppeld),
in 3 categorieën:
1. **Lokale spiegel-types** — `convex/catalog/pilot.ts` `PilotProductLike` (en zijn functies) gebruiken
   nog EN-velden terwijl callers NL-docs doorgeven (~13). Fix: die interface + interne accesses NL maken.
2. **args|doc-unie** — `convex/projecten/measurements.ts` snapshot-logica leest een union van mutation-
   args (EN) en de doc (NL) → één naam past niet op beide (~9). Fix: vertak args/doc, of NL-args.
3. **Const-data + mutation-args met EN-subkeys** naar NL-schemavelden — `seed/core.ts`
   (quoteTemplateSections/Lines), `offertes/templates.ts` (sections/defaultLines-args),
   `catalog/core.ts` (commercialNames-arg) (~11). Fix: const-data-keys NL + args mappen óf NL.

### ⚠️ OPEN STRATEGISCHE BESLISSING: worden de mutation-arg-validators (de frontend↔backend-API) óók NL?
- **Args EN houden** (NL-DB, EN-API): backend kan zelfstandig groen (args EN, expliciete EN→NL-mapping
  bij inserts van sub-objecten). Frontend ongemoeid tot de aparte frontend-stap.
- **Args NL maken** (volledig NL): schoner eindresultaat, maar backend + frontend moeten samen groen
  (één big-bang gate; frontend-callers passen de NL-arg-namen meteen mee).
Deze keuze bepaalt hoe de 33-residue wordt opgelost en de uitvoeringsvolgorde.

## Verificatie per gebied

`npm run check` · `npm run test` (vitest portal + convex) · `npm run lint` · `npm run build` ·
`npx convex dev --once` (codegen + dev-schemavalidatie) · na de import-tooling-rename:
`tools/reconcile_catalog_sources.py` / `catalog:status`.
