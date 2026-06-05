# Catalogus & Import — `convex/catalog/`

Backend voor de catalogusimport-pipeline: preview, validatie, import-batches, prijzen en reconciliatie.

## Bestanden

| Bestand | Functie |
| --- | --- |
| `core.ts` | Basiscatalogus queries: products, prices, collections, brands |
| `import.ts` | Import-batch verwerking en row-import logica |
| `imports.ts` | Batch-overzichten en status-management |
| `validation.ts` | Import-validatie: btw-modus, prijzen, EAN, source-keys |
| `review.ts` | Catalogusreview en import-row inspectiefuncties |
| `reconciliation.ts` | Reconcilieer lokale preview vs. Convex development-stand |
| `productionAudit.ts` | Productie-importaudit en statistieken |
| `pilot.ts` | Pilot-specifieke catalogusfuncties |

## Import-pipeline

```
Excel/CSV (lokaal)
    ↓ tools/build_catalog_import.py      → docs/generated/catalog-import-preview.json
    ↓ tools/upload_catalog_batch_import.mjs  → Convex (development)
    ↓ tools/reconcile_catalog_sources.py → docs/generated/reconciliation-snapshot.json
    ↓ tools/upload_catalog_batch_import.mjs --target=production → Convex (production)
```

## BTW-guardrail

Productie-import is geblokkeerd zolang er prijsregels zijn met `vatMode = "unknown"`.

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
| Geen duplicate source keys | Dubbele importsleutels worden als warning gemarkeerd |
| Geen prijs ≤ 0 | Nulprijzen worden overgeslagen (tenzij leverancier-specifiek) |
| Sectionrijen ≠ product | Header/section-rijen worden nooit als product geïmporteerd |
| EAN-duplicaten | Worden als waarschuwing getoond, nooit automatisch samengevoegd |

## Convex-deployment targets

| Target | Deployment |
| --- | --- |
| Development | `dev:*` (lokale Convex dev server) |
| Production | `prod:accomplished-kangaroo-354` (`https://accomplished-kangaroo-354.eu-west-1.convex.cloud`) |

Zie ook: [`tools/README.md`](../../tools/README.md)
