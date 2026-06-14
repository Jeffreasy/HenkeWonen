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

## Verificatie per gebied

`npm run check` · `npm run test` (vitest portal + convex) · `npm run lint` · `npm run build` ·
`npx convex dev --once` (codegen + dev-schemavalidatie) · na de import-tooling-rename:
`tools/reconcile_catalog_sources.py` / `catalog:status`.
