# Project cleanup audit - 2026-05-01

Scope: projectbrede audit op demo-data, oude data, testfixtures, tijdelijke bestanden, verouderde documentatie en seed/demo tooling.

Releasecontext: 0.1.1 is klaar voor interne demo met QuoteDocumentModel, read-only QuoteDocumentPreview en browserprint via `window.print()`. Deze audit voegt geen PDF-library, server-side PDF-export, factuurflow, boekhoudkoppeling of automatische product/prijs/btw-keuze toe.

## Uitgevoerde controles

- `git status --short --branch`: branch `main`, gelijk aan `origin/main` bij start van de audit.
- `git status --ignored --short`: lokale ignored artefacten gecontroleerd.
- `package.json`: scripts en versie `0.1.1` gecontroleerd.
- `.gitignore`: bestaande lokale hygiene-regels gecontroleerd.
- `git ls-files`: tracked documenten, scripts, Convex bestanden, tests en broncode gecontroleerd.
- `git grep`: referenties gecontroleerd voor demo, seed, fixture, sample, mock, old, backup, kopie, temp, scratch, legacy, TODO, FIXME, localhost en bekende seed/import entrypoints.
- Lokale `DATA/` en `docs/artifacts/` mappen geinventariseerd zonder inhoudelijke klantdata of secrets uit te lezen.

## Samenvatting

Er zijn 20 auditgroepen gevonden:

- 6 lokale ignored artefactgroepen: logs/cache/build-output, audit/import JSON-output, `.env.local`, `.vercel/`, `DATA/`, `docs/artifacts/`.
- 6 seed/demo/import-tooling groepen: demo seed, seed tool, productie/bootstrap seed, waste-profile seed, actieve catalogus import tooling, legacy direct import guard.
- 5 documentatie/testdata groepen: catalog import summaries, data-import audits, design-system fases, inmeet/offerte faseverslagen, actuele release/workflow/PDF-offerte docs.
- 3 test/runtime configuratiegroepen: localhost testdefaults, package scripts, tracked source/config met env-var verwijzingen.

Geen tracked bronbestand is als 100% veilig verwijderbaar gemarkeerd.

## Inventarisatie per item

| Pad/bestand | Type | Huidige functie | Gebruikt door build/test/runtime? | Veilig verwijderen | Aanbevolen actie | Risico bij verwijderen |
| --- | --- | --- | --- | --- | --- | --- |
| `.astro-dev*.log`, `dev-server.*.log` | temp | Lokale dev/test logs | Nee, ignored | Ja, lokaal na expliciete delete-confirmatie | Behouden ignored of lokaal opruimen | Geen runtime-risico; alleen verlies van lokale diagnosehistorie |
| `.astro/`, `dist/`, `node_modules/`, `.audit-cache/`, `tools/__pycache__/` | temp/cache | Build-, dependency- en toolcache | Worden opnieuw gegenereerd | Ja, lokaal na expliciete delete-confirmatie | Behouden ignored | Tijdelijk trager opnieuw installeren/bouwen |
| `.audit-production-*.json`, `.catalog-import-*.json`, `.duplicate-ean-*.json`, `.latest-*-batches.json`, `.portal-*-check*.json`, `.production-readiness.json`, `.readiness-batches.json`, `.special-checks.json`, `.vat-review-query.json` | temp/audit-output | Lokale audit/import/run-output | Nee, ignored | Ja, lokaal na expliciete delete-confirmatie | Behouden ignored | Verlies van lokale runhistorie; geen app-risico |
| `.env.local` | productieconfig/lokaal secret | Lokale Convex/Vercel configuratie | Alleen lokale tools/dev | Nee | Behouden ignored, nooit committen | Verwijderen breekt lokale tooling; committen kan secrets lekken |
| `.vercel/` | productieconfig/lokaal | Lokale Vercel projectlink/cache | Alleen Vercel CLI lokaal | Nee | Behouden ignored | Verwijderen vereist opnieuw linken; committen ongewenst |
| `DATA/**` | data/Excel bronbestanden | Lokale leverancier/Excel brondata voor catalogus- en offerteanalyse | Niet tracked; tools verwijzen conceptueel naar DATA-bronnen | Onzeker | Behouden ignored; handmatige data-retentie review | Kan echte leverancier/klantdata bevatten; verwijderen kan import/audit reproduceerbaarheid breken |
| `docs/artifacts/**` | documentatie/QA artefacten | Lokale QA screenshots en bewijsbestanden | Niet build/runtime; ignored | Onzeker | Behouden ignored of later selectief opruimen | Verlies van visuele regressiehistorie |
| `convex/demoSeed.ts` | demo-data/seed | Idempotente demo portaldata, inclusief demo-klanten/projecten/offertes | Ja, via Convex generated API en `portal:demo-seed` | Nee | Behouden voor demo; duidelijk demo-only houden | Interne demo/testdata verdwijnt |
| `tools/seed_demo_portal_data.mjs` | seed/tooling | Roept `convex dev --run demoSeed:run` aan met `.env.local` | Ja, via `npm run portal:demo-seed` | Nee | Behouden voor demo; niet automatisch in build/deploy draaien | Demo seed niet meer makkelijk reproduceerbaar |
| `convex/seed.ts` | seed/productieconfig | Bootstrap voor tenant, categorieen, leveranciers, service rules, quote templates en import profiles | Ja, handmatig via Convex seed; docs verwijzen hiernaar | Nee | Behouden als productieachtige bootstrap/config | Verlies van noodzakelijke basisconfiguratie |
| `convex/measurements.ts#seedDefaultWasteProfiles` | seed/config | Default materiaalverliesprofielen voor inmeetmodule | Niet in package script; wel gedocumenteerd | Onzeker | Behouden; handmatige review voordat dit wordt hernoemd of verplaatst | Inmeetmodule kan default profielen missen |
| `tools/build_catalog_import.py` en `tools/run_python_tool.mjs` | tooling/testdata verwerking | Genereert catalogus preview/samenvatting vanuit Excel-bronnen | Ja, via `catalog:preview`; docs verwijzen hiernaar | Nee | Behouden | Catalogus preview en btw-review tooling breekt |
| `tools/upload_catalog_batch_import.mjs` | tooling/productie-import | Batch-import met audit rows en btw-guardrails | Ja, via `catalog:import` en `catalog:import:dev` | Nee | Behouden | Productie-import guardrails en batch audit trail breken |
| `tools/upload_catalog_import.mjs` | legacy/tooling guard | Legacy direct import, bewust geblokkeerd zonder `--legacy-direct-confirm` | Ja, via scriptnaam en historische docs; default faalt veilig | Onzeker | Behouden als historische guard of later package-script hernoemen na aparte review | Te snel verwijderen kan auditgeschiedenis en expliciete safety-stub kwijtraken |
| `package.json#catalog:import:legacy` | legacy script | Wijst naar geblokkeerde legacy direct import | Ja, maar faalt bewust zonder private flag | Onzeker | Handmatige review: script verwijderen of hernoemen in aparte taak | Verwarring als iemand script draait; verwijderen zonder docs-update kan referenties breken |
| `docs/catalog-import-summary.md`, `docs/catalog-import-summary.json`, `docs/catalog-import-sample.md` | documentatie/generated summary | Compacte actuele catalogus preview output | Ja, `catalog:preview` schrijft summary; docs index verwijst ernaar | Nee | Behouden | Import/audit documentatie wordt onvolledig |
| `docs/audits/data-import/**` | documentatie/auditdata | Historische data-import, btw en readiness audits, inclusief sample JSON | Niet runtime; wel release/guardrail context | Onzeker | Behouden; eventueel later naar archive/json na docs-script review | Verlies van audit trail rond productie-import guardrails |
| `docs/implementation/design-system/**` | documentatie/historisch faseverslag | Design-system fasehistorie en QA-verwijzingen | Niet runtime; docs verwijzen ernaar | Onzeker | Archive-kandidaat, niet verplaatsen in deze fase | Historische context en linkstructuur kan breken |
| `docs/implementation/inmeetmodule/**`, `docs/implementation/offertes/**` | documentatie/historisch faseverslag | Inmeet/offerte implementatiehistorie en guardrails | Niet runtime; actuele workflowdocs verwijzen inhoudelijk | Onzeker | Archive-kandidaat, niet verplaatsen in deze fase | Guardrail- en besluitgeschiedenis kan verdwijnen |
| `docs/implementation/pdf-offerte/**`, `docs/releases/release-2026-05-01-offerte-preview-print.md`, `docs/klant/**`, `docs/technisch/**` | documentatie/actueel | Actuele release-, workflow- en PDF/offertepreview documentatie | Niet runtime, wel bron voor release/demo | Nee | Behouden | Release 0.1.1 context en interne demo-uitleg verdwijnt |
| `tools/test_portal_routes.mjs`, `tools/test_portal_a11y.mjs` | testfixture/testconfig | Portal route/a11y smoke tests met `http://localhost:4321` default en env override | Ja, via `test:portal` en `test:a11y` | Nee | Behouden | Route/a11y smoke coverage breekt |
| `src/lib/convex/client.ts`, `tools/*PUBLIC_CONVEX_URL*` | productieconfig/env gebruik | Leest publieke Convex URL uit env; geen hardcoded productie secret | Ja, runtime en tools | Nee | Behouden; env buiten git beheren | Runtime kan geen Convex verbinding maken |

## Package scripts

| Script | Gebruikt demo/seed/testdata? | Status | Advies |
| --- | --- | --- | --- |
| `dev` | Nee | Actief | Behouden |
| `build` | Nee | Actief | Behouden |
| `preview` | Nee | Actief | Behouden |
| `check` | Nee | Actief | Behouden |
| `catalog:audit` | Ja, leest lokale Excel/data via toolconfig | Actief audittooling | Behouden |
| `catalog:preview` | Ja, genereert catalogus summary/sample docs | Actief importvoorbereiding | Behouden |
| `catalog:reset` | Ja, reset import state via Convex | Actief onderhoudsscript | Behouden; alleen bewust draaien |
| `catalog:import` | Ja, importeert cataloguspreview met productieguardrails | Actief | Behouden |
| `catalog:import:dev` | Ja, dev override voor unknown VAT | Actief dev-only | Behouden, duidelijk dev-only |
| `catalog:import:legacy` | Legacy direct import, default geblokkeerd | Legacy/safety stub | Handmatige review in aparte taak |
| `portal:demo-seed` | Ja, demo portaldata | Actief demo-only | Behouden; nooit automatisch in build/deploy |
| `test:portal` | Testdata afhankelijk van runtime/demo seed mogelijk | Actief | Behouden |
| `test:a11y` | Testdata afhankelijk van runtime/demo seed mogelijk | Actief | Behouden |
| `test:calculators` | Testfixtures in toolscript | Actief | Behouden |
| `test:quote-document` | QuoteDocumentModel/preview fixtures | Actief | Behouden |
| `convex:dev` | Convex dev | Actief | Behouden |
| `convex:deploy` | Convex deploy | Actief | Behouden |

## Convex en demo-data

- `convex/demoSeed.ts` bevat herkenbare demo-records zoals demo-klanten, demo-projecten en demo-offertes. Dit is nodig voor interne demo en wordt niet in de Vercel build automatisch uitgevoerd.
- `tools/seed_demo_portal_data.mjs` is de enige package-script route naar `demoSeed:run`.
- `convex/seed.ts` is geen vrijblijvende demo-data. Het bevat basisconfiguratie zoals categorieen, leveranciers, service rules, quote templates en import profiles.
- `convex/measurements.ts#seedDefaultWasteProfiles` is seed/config voor default materiaalverliesprofielen. Omdat dit in de inmeetmodule-documentatie staat, blijft dit behouden tot een aparte review.
- Productie-import guardrails blijven behouden: de actieve import loopt via `tools/upload_catalog_batch_import.mjs`; legacy direct import is standaard geblokkeerd.

## Documentatie

Te behouden als actueel:

- `docs/implementation/pdf-offerte/henke-offerte-template-analysis-2026-05-01.md`
- `docs/implementation/pdf-offerte/quote-document-model-phase-1-2026-05-01.md`
- `docs/implementation/pdf-offerte/quote-document-preview-phase-2-2026-05-01.md`
- `docs/implementation/pdf-offerte/quote-pdf-export-phase-3-plan-2026-05-01.md`
- `docs/implementation/pdf-offerte/quote-print-export-phase-3a-2026-05-01.md`
- `docs/implementation/pdf-offerte/quote-print-demo-qa-2026-05-01.md`
- `docs/releases/release-2026-05-01-offerte-preview-print.md`
- `docs/klant/**`
- `docs/technisch/**`

Archive-kandidaten, maar niet verplaatst in deze audit:

- oudere `docs/implementation/design-system/design-system-phase-*.md`
- oudere `docs/implementation/inmeetmodule/inmeetmodule-phase-*.md`
- oudere `docs/implementation/offertes/*.md`
- grote JSON-auditbestanden onder `docs/audits/data-import/**`

Reden om nu niet te verplaatsen: de bestaande documentatie-audit adviseert verplaatsen alleen samen met bijgewerkte referenties/scripts. Deze audit voert geen linkstructuur-refactor uit.

## Cleanup-plan

### A. Veilig direct verwijderen

Geen tracked bestanden.

Technisch veilig maar niet uitgevoerd zonder aparte lokale delete-confirmatie:

- lokale ignored logs: `.astro-dev*.log`, `dev-server.*.log`
- lokale ignored caches/build-output: `.astro/`, `dist/`, `.audit-cache/`, `tools/__pycache__/`
- lokale ignored audit/import JSON-output in de repo-root

### B. Eerst verplaatsen naar archive

Niet uitgevoerd in deze fase.

Archive-kandidaten voor een aparte docs-refactor:

- historische design-system faseverslagen
- historische inmeetmodule/offerte faseverslagen
- grote machine-readable audit JSON onder `docs/audits/data-import/**`

Voorwaarde: docs indexen en verwijzingen moeten in dezelfde wijziging worden bijgewerkt.

### C. Behouden voor tests/demo

- `convex/demoSeed.ts`
- `tools/seed_demo_portal_data.mjs`
- `tools/test_portal_routes.mjs`
- `tools/test_portal_a11y.mjs`
- `tools/test_calculators.mjs`
- `tools/test_quote_document_model.mjs`
- actuele PDF/offertepreview documentatie

### D. Behouden voor productie/runtime

- `src/**`
- `convex/schema.ts`
- `convex/portal.ts`
- `convex/seed.ts`
- `convex/catalogImport.ts`
- `tools/upload_catalog_batch_import.mjs`
- `package.json`
- `.env.example` indien aanwezig; echte env blijft ignored

### E. Onzeker - handmatige review nodig

- `DATA/**`: lokale Excel/leveranciersdata, kan echte brondata bevatten.
- `docs/audits/data-import/**/*.json`: groot en deels sample-heavy, maar onderdeel van audit trail.
- `tools/upload_catalog_import.mjs` en `catalog:import:legacy`: legacy direct import guard; aparte beslissing nodig.
- `convex/measurements.ts#seedDefaultWasteProfiles`: seed/config voor inmeetmodule.
- oudere historische faseverslagen: archive-kandidaten, geen delete-kandidaten.

## .gitignore beoordeling

Bestaande dekking is goed voor:

- `node_modules/`, `dist/`, `.astro/`, `.vercel/`
- `DATA/`
- `.env`, `.env.*`, met uitzondering voor `.env.example`
- logs en Python cache
- bekende lokale audit/import JSON-output
- `docs/generated/`, `docs/catalog-import-preview.json`, `docs/artifacts/`

Toegevoegd in deze audit:

- generieke lokale tempregels: `tmp/`, `temp/`, `*.tmp`, `*.temp`
- OS/editor artefacten: `.DS_Store`, `Thumbs.db`
- Excel lock/lokale kopie patronen: `~$*.xlsx`, `~$*.xls`, `*.local.xlsx`, `*.local.xls`
- concept/generated print-PDF namen: `*.concept.pdf`, `*.generated.pdf`, `*.print.pdf`

Bewust niet toegevoegd:

- Geen globale `*.xlsx` of `*.xls`, omdat toekomstige expliciete fixtures anders per ongeluk genegeerd kunnen worden.
- Geen globale `*.pdf`, omdat toekomstige bewuste documentatie-PDFs anders verborgen worden.

## Uitgevoerde cleanup

- Geen tracked bestanden verwijderd.
- Geen bestanden naar archive verplaatst.
- `.gitignore` aangescherpt met veilige lokale artefactregels.

## Verificatie

Na de hygiene-wijzigingen zijn deze checks gedraaid:

| Check | Resultaat |
| --- | --- |
| `npm run check` | OK, 148 Astro files, 0 errors, 0 warnings, 0 hints |
| `npm run test:quote-document` | OK, Quote document model en preview tests passed |
| `npm run test:calculators` | OK, Calculator tests passed |
| `npm run test:portal` | OK, 12 portal routes HTTP 200 |
| `npm run test:a11y` | OK, 12 portal routes HTTP 200 en geen issues uit script |
| `npm run build` | OK, Astro/Vercel server build complete |

Opmerking: de lokale build meldt dat Node.js 25 lokaal niet de Vercel Serverless Functions runtime is en dat Vercel Node.js 24 gebruikt. Dit is een bestaande runtime-waarschuwing en geen gevolg van cleanup.
