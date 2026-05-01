# Henke Wonen productie-import audit - 2026-04-29

## Samenvatting

De productie-importlaag is inhoudelijk gecontroleerd op schema, preview/commit-consistentie, Convex-cataloguskwaliteit, idempotency, tenant-scoping en portalroutes. De catalogusbaseline blijft stabiel op **7.775 actieve producten** en **13.015 prijsregels**. De schone rerun verwerkt **10.691 auditrows**, **10.291 productrows** en **13.015 prijsregels** zonder nieuwe producten of extra prijsregels aan te maken.

Advies: **nog niet blind productie-committen zonder datamapping**. De importlaag is traceerbaar en idempotent, maar productie-import zonder override weigert terecht omdat **12.984 prijsregels vatMode=unknown** hebben. Daarnaast zijn er **25 supplier+EAN duplicate groepen** in de brondata die niet automatisch mogen worden samengevoegd.

## Eindstand

| Onderdeel | Waarde |
| --- | --- |
| Actieve producten | 7.775 |
| Productprijzen | 13.015 |
| Actieve importprofielen | 16 |
| Producten zonder prijsregels | 0 |
| Orphan price rules | 0 |
| Duplicate product importKeys | 0 |
| Duplicate price sourceKeys | 0 |
| Prijsregels amount <= 0 | 0 |
| Sectierijen als product | 0 |

## Script- en routechecks

| Check | Resultaat |
| --- | --- |
| npm run check | OK |
| npm run build | OK, met lokale Node 25/Vercel Node 24 waarschuwing |
| catalog:preview | OK: 10.291 productrows, 10.691 preview rows, 13.015 prices |
| catalog:import zonder override | OK: exit 1, batches 42 -> 42 |
| catalog:import:dev rerun | OK: exit 0/0, catalogustellingen stabiel |
| /portal/imports | HTTP 200 |
| /portal/import-profielen | HTTP 200 |
| /portal/imports/[batchId] | HTTP 200 |
| Hardcoded importtellingen in app logic | Geen matches |

## Reconciliation

- **10.291 productrijen** komen uit de genormaliseerde Excel-preview na header-, section-, empty- en duplicate-file filtering.
- **10.691 preview/audit rows** = 10.291 productrows + 400 header/section/empty/ignored rows binnen het geanalyseerde tabelgebied.
- **13.015 prijsregels** blijven hoger dan actieve producten doordat prijsregels per source row/price column/sourceKey worden bewaard.
- **7.775 actieve producten** blijven lager door dedupe op importKey/articleNumber/supplierCode met EAN als ondersteunend signaal, niet als enige sleutel.
- Exacte duplicate bestanden zijn in preview overgeslagen; unieke gecommitte bronbestanden in de laatste schone run: **17**.

## Breakdown per SourceFileName

| Bronbestand | Preview | Product | Verwerkt | Dedupe | Prijzen | Ignored | Unknown btw rows | Zero/no price | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx | 8.216 | 8.205 | 8.205 | 8.205 | 8.205 | 11 | 8.205 | 10 | 0 |
| henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls | 990 | 988 | 988 | 988 | 988 | 2 | 988 | 0 | 0 |
| Prijslijst PVC 11-2025 click dryback apart.xlsx | 336 | 262 | 262 | 262 | 786 | 74 | 262 | 0 | 0 |
| PVC 11-2025 click dryback apart floorlife.xlsx | 336 | 262 | 262 | 262 | 786 | 74 | 262 | 0 | 0 |
| Co-pro Entreematten 2025.xlsx | 144 | 111 | 111 | 111 | 420 | 33 | 111 | 0 | 0 |
| Co-pro prijslijst Plinten 2025-07.xlsx | 91 | 67 | 67 | 67 | 469 | 24 | 67 | 0 | 0 |
| Roots collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 1.05.2026 - A.xlsx | 62 | 59 | 59 | 59 | 146 | 3 | 59 | 0 | 0 |
| Prijslijst EVC 2025 click en dryback apart.xlsx | 73 | 56 | 56 | 56 | 168 | 17 | 56 | 0 | 0 |
| PVC - palletcollectie op palletafname_2025 2025-06-11 07_31_31 (005).xlsx | 93 | 54 | 54 | 54 | 108 | 39 | 54 | 0 | 0 |
| Prijslijst Ambiant Tapijt 2025-04.xlsx | 78 | 45 | 45 | 45 | 270 | 33 | 45 | 0 | 0 |
| Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx | 66 | 40 | 40 | 40 | 120 | 26 | 40 | 0 | 0 |
| Co-pro prijslijst lijm kit en egaline 2025-04.xlsx | 44 | 31 | 31 | 31 | 162 | 13 | 31 | 0 | 0 |
| Prijslijst VT Wonen Karpetten 2024.xlsx | 33 | 26 | 26 | 26 | 51 | 7 | 26 | 0 | 0 |
| Prijslijst Wandpanelen 2025-05.xlsx | 45 | 24 | 24 | 24 | 72 | 21 | 24 | 0 | 0 |
| Prijslijst Douchepanelen en tegels 2025-04.xlsx | 33 | 23 | 23 | 23 | 69 | 10 | 23 | 0 | 0 |
| Prijslijst Ambiant Vinyl 07-2024.xlsx | 34 | 23 | 23 | 23 | 138 | 11 | 23 | 0 | 0 |
| Prijslijst Traprenovatie Floorlife 2025.xlsx | 17 | 15 | 15 | 15 | 57 | 2 | 15 | 0 | 0 |

## Product Counts Per Supplier

| Leverancier | Actieve producten |
| --- | --- |
| Headlam | 5.954 |
| Interfloor | 988 |
| Floorlife | 376 |
| Co-pro | 209 |
| Ambiant | 67 |
| vtwonen | 66 |
| Roots | 59 |
| EVC | 56 |

## Price Counts Per VatMode

| vatMode | Prijsregels |
| --- | --- |
| inclusive | 31 |
| unknown | 12.984 |

## Price Counts Per Type

| priceType | Prijsregels |
| --- | --- |
| advice_retail | 10.510 |
| commission | 891 |
| cut_length | 235 |
| net_purchase | 59 |
| package | 14 |
| pallet | 840 |
| purchase | 96 |
| roll | 235 |
| step | 15 |
| trailer | 120 |

## Duplicate Checks

| Check | Groepen | Extra records | Status |
| --- | --- | --- | --- |
| product importKey | 0 | 0 | OK |
| supplier + articleNumber | 0 | 0 | OK |
| supplier + EAN | 25 | 25 | DATA WARNING |
| supplier + supplierCode | 0 | 0 | OK |
| price sourceKey | 0 | 0 | OK |
| price identity excl. sourceKey | 2.260 | 2.266 | TRACEERBAAR/BRONHISTORIE |

## Batch/Row Counters

| Counter | Waarde |
| --- | --- |
| Totaal batches | 76 |
| Geimporteerd | 74 |
| Failed | 2 |
| Preview/audit rows totaal | 61.242 |
| Laatste schone run preview rows | 10.691 |
| Laatste schone run product rows | 10.291 |
| Laatste schone run prices verwerkt | 13.015 |

## Special-case checks

| Case | Resultaat |
| --- | --- |
| Headlam producten | 5.954 producten / 8.205 prijsregels / 5.954 unieke supplier codes |
| Headlam nulprijzen | 10 previewregels met zonder bruikbare prijs worden niet geimporteerd |
| Headlam productKind | curtain_fabric: 5.954 |
| Interfloor .xls | 988 producten, 988 art.nr. met punt, unit m1: 988 |
| Co-pro entreematten | 111 producten, 420 prijsregels |
| Co-pro lijm/kit/egalisatie | 162 prijsregels, 69 commissieprijzen, 69 distinct commissie column keys |
| PVC overlap | PVC bestand 260 producten/786 prijzen; Floorlife bestand 260 producten/786 prijzen |
| Sectierijen | Geen matches voor Tegel decoren, Boucle/Bouclé, Decor gelijke plinten, Traprenovatie PVC Floorlife of Ambiant vinyl Beton |

## Gevonden issues en fixes

- **convex/schema.ts**: Added previewRows, committedAt, failedAt, errorMessage, importKey/sourceKey row fields, and audit indexes for rowKind and sourceFile/sourceColumn. Reden: Batches and rows needed complete lifecycle and lookup metadata for auditable production imports. Effect: New imports can be traced by batch, row kind, source key and commit/failure state.
- **convex/catalogImport.ts**: Added failPreviewBatch, committedAt handling, row importKey/sourceKey persistence and runtime failure status handling; fixed unknownVatModeRows double counting. Reden: A failed import should leave an explicit failed batch and preview counters should not be incremented again during commit. Effect: Future script failures are visible in Convex and latest-run batch counters now match preview row counters.
- **tools/upload_catalog_batch_import.mjs**: Encoded raw Excel objects with non-ASCII column names as key/value entries before sending to Convex; wrapped per-file processing in failPreviewBatch handling. Reden: Convex rejects object field names containing characters such as euro signs and superscript 2 from Excel headers. Effect: Rows with columns like Adviesverkoopprijs euro/m2 remain auditbaar and imports no longer crash on raw headers.
- **tools/upload_catalog_import.mjs**: Disabled legacy direct import unless explicitly confirmed by a private flag. Reden: Production imports must always use productImportBatches and productImportRows. Effect: The normal script surface no longer bypasses audit rows.
- **src/components/imports/ImportPreview.tsx / src/lib/portalTypes.ts / convex/imports.ts**: Exposed previewRows, committedAt, failedAt and errorMessage in portal import views. Reden: The portal must display real Convex lifecycle/counter data, not opaque status. Effect: Import pages show actual Convex batch lifecycle data.

## Openstaande risico's

- **Btw-mapping**: 12.984 prijsregels zijn nog unknown. Productie-import zonder override faalt bewust; profielen moeten per prijskolom exclusive/inclusive krijgen.
- **Duplicate EAN-brondata**: 25 groepen delen supplier+EAN maar hebben andere articleNumbers/producten. Niet automatisch dedupen op EAN.
- **Duplicate price identity excl. sourceKey**: 2.260 groepen, vooral Headlam dubbele source rows. Omdat sourceKey uniek is, blijft dit auditbaar.
- **Audit-query volume**: importProductionAudit leest circa 13,8 MB; prima voor audit, niet voor hoogfrequent dashboardgebruik.

## Production ready?

**Voor de importlaag: ja, met guardrails.** Batches/rows worden gevuld, routes lezen echte Convex-data, reruns zijn catalogus-idempotent en fake importpaden zijn afgesloten.

**Voor definitieve productie-import zonder menselijke mapping: nee.** Eerst vatMode mappings afronden en duplicate-EAN waarschuwingen zakelijk beoordelen.

