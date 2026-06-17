# Catalogus & Import — `convex/catalog/`

Backend voor de catalogusimport-pipeline: preview, validatie, import-batches, prijzen en reconciliatie.

## Bestanden

| Bestand | Functie |
| --- | --- |
| `core.ts` | Basiscatalogus queries: products, prices, collections, brands |
| `import.ts` | Import-batch verwerking en row-import logica |
| `imports.ts` | Batch-overzichten en status-management |
| `validation.ts` | Import-validatie: btw-modus, prijzen, EAN, source-keys |
| `review.ts` | Catalogusreview, btw-mapping-review, duplicate-EAN-kwesties en `productionReadiness` (`READY`/`BLOCKED`) |
| `reconciliation.ts` | Reconcilieer lokale preview vs. Convex development-stand |
| `productionAudit.ts` | Productie-importaudit en statistieken |
| `pilot.ts` | Pilot-presentatie: PVC-Click verbergen, Roots→Moduleo, Floorlife/Ambiant-weergave, `cleanProductDisplayName` |
| `pricing.ts` | Richtprijs-lookup (`getIndicativePrice`) voor de inmeetmodule |
| `pricingRules.ts` | Deterministische, pure prijskeuzeregel (klantgerichte richtprijs + matrix-selectie) |
| `maintenance.ts` | Onderhoudsmutaties op prijsdata (btw-modus repareren, pseudo-prijsregels verwijderen) |
| `pickerSearch.ts` | Productzoeker voor de product-pickers (inmeting + offertebouwer) |
| `priceColumnKey.ts` | `toAsciiFieldKey`: maakt prijskolom-headers Convex-veilig (ASCII-only) |
| `priceMatrices.ts` | Seed + lookup van de breedte×hoogte-richtprijsmatrices voor raambekleding |
| `calculatorRules.ts` | Seed van calculator-regels (marge-delers + bedrijfsregels) |

## Import-pipeline

```
Excel/CSV (lokaal)
    ↓ tools/build_catalog_import.py      → docs/generated/catalog-import-preview.json
    ↓ tools/upload_catalog_batch_import.mjs  → Convex (development)
    ↓ tools/reconcile_catalog_sources.py → docs/generated/reconciliation-snapshot.json
    ↓ tools/upload_catalog_batch_import.mjs --target=production → Convex (production)
```

## BTW-guardrail

Productie-import is geblokkeerd zolang er prijskolom-mappings met `btwModus = "unknown"` zijn zonder bewuste override. `review.productionReadiness` rapporteert dit als `productionImportStatus: "READY"` (geen onopgeloste btw-mappings) of `"BLOCKED"`. De definitieve commit (`import.commitPreviewBatchChunk`) weigert bovendien zolang de batch onbekende-btw-rijen heeft zonder `staBtwModusOnbekendToe`.

- Bekijk de actuele stand: [`docs/release-readiness/vat-mapping/`](../../docs/release-readiness/vat-mapping/)
- Beslisbestand: `docs/release-readiness/vat-mapping/vat-mapping-decisions.json`
- Toepassen: `node tools/apply_vat_mapping_decisions.mjs`

> [!CAUTION]
> Gebruik `catalog:import:dev` (met `--allow-unknown-vat`) nooit voor productie.
> Production targets vereisen altijd `--target=production --confirm-production-catalog-import`.

## Datakwaliteitsregels

De importlaag bewaakt:

| Regel | Toelichting |
| --- | --- |
| Geen producten zonder prijs | Elke geïmporteerde productrij moet ≥1 prijsregel hebben |
| Geen orphan price rules | Prijsregels zonder product worden geblokkeerd |
| Geen duplicate source keys | In de preview als waarschuwing geteld; de definitieve commit weigert bij dubbele `bronSleutel` |
| Geen foutregels | De commit weigert zolang de batch `foutRijen > 0` heeft |
| Geen prijs ≤ 0 | Prijsregels met `amount ≤ 0` worden overgeslagen |
| Sectionrijen ≠ product | Header/section-rijen worden nooit als product geïmporteerd |
| EAN-duplicaten | Worden als waarschuwing getoond, nooit automatisch samengevoegd |

## Richtprijs & matrix

De inmeetmodule toont een indicatieve richtprijs; de offerte blijft definitief.

- `pricing.getIndicativePrice` levert per product een klantgerichte richtprijs. `pricingRules.ts` bevat de pure, deterministische keuzeregel: alleen klantgerichte prijstypes (`advice_retail`/`retail`), btw genormaliseerd, en bij twijfel géén prijs (`btwModus`/`vatMode` `"unknown"` levert nooit een richtprijs op).
- Raambekleding gebruikt een breedte×hoogte-richtprijsmatrix (`priceMatrices.ts` + tabel `priceMatrices`), geseed uit HenkeWonenDATA en idempotent op (`tenantId`, `productToolSleutel`, `prijsgroep`, `bronBlad`).

## Convex-deployment targets

| Target | Deployment |
| --- | --- |
| Development | `dev:*` (lokale Convex dev server) |
| Production | `prod:accomplished-kangaroo-354` (`https://accomplished-kangaroo-354.eu-west-1.convex.cloud`) |

Zie ook: [`tools/README.md`](../../tools/README.md)
