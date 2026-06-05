# Import-tools — `tools/`

Node.js en Python scripts voor catalogusbeheer, BTW-mapping, reconciliatie en smoke-tests.

## Catalogus-pipeline

| Script | Gebruik |
| --- | --- |
| `build_catalog_import.py` | Bouwt de import-preview JSON vanuit lokale Excel-bronbestanden |
| `upload_catalog_import.mjs` | Enkelvoudige import naar Convex development |
| `upload_catalog_batch_import.mjs` | Batch-import met retry, reconciliatie en productie-guardrails |
| `reset_catalog_import.mjs` | Reset de development catalogus (wist alle batches/products) |
| `parse_flexcolours_matrix.py` | Verwerkt FlexColours-specifieke Excel-matrix naar preview JSON |

## BTW-mapping

| Script | Gebruik |
| --- | --- |
| `export_vat_mapping_review.mjs` | Exporteert btw-mapping-overzicht naar `docs/release-readiness/vat-mapping/` |
| `apply_vat_mapping_decisions.mjs` | Verwerkt `vat-mapping-decisions.json` en past btw-modes aan in Convex |

## Reconciliatie & audit

| Script | Gebruik |
| --- | --- |
| `reconcile_catalog_sources.py` | Vergelijkt lokale preview met Convex development-stand |
| `fetch_convex_snapshot.mjs` | Maakt een volledige Convex-snapshot (read-only) |
| `audit_excel_data.py` | Auditeert lokale Excel-bronbestanden op kwaliteit |
| `deep_data_reaudit.py` | Diepgaande heraudit van bestaande import-data |
| `sync_duplicate_ean_issues_from_preview.mjs` | Synchroniseert EAN-duplicaten van preview naar Convex review |
| `catalog_status.mjs` | Toont actuele importstatus van alle batches |

## Cleanup-scripts (leverancierspecifiek)

| Script | Gebruik |
| --- | --- |
| `cleanup_pvc_click.mjs` | Verwijdert PVC/click-flooring duplicaten |
| `cleanup_raambekleding.mjs` | Opruimen raambekleding-categorisatie |
| `cleanup_roots_supplier.mjs` | Roots leverancier opschoning |

## Smoke-tests

| Script | Gebruik |
| --- | --- |
| `test_portal_routes.mjs` | Test alle portalroutes op HTTP 200/302 |
| `test_portal_routes_with_dev_auth.mjs` | Idem, met dev-auth sessie |
| `test_portal_a11y.mjs` | Toegankelijkheidstest via Playwright |
| `test_calculators.mjs` | Unit-tests voor alle inmeet-calculators |
| `test_workflow_mutation_guardrails.mjs` | Test Convex-mutatiebeveiligingen |
| `test_quote_document_model.mjs` | Test offerte-documentmodel |

## Overig

| Script | Gebruik |
| --- | --- |
| `authz_actor.mjs` | Helper: maakt een authz-actor-token voor tool-gebruik |
| `catalog_tooling_env.mjs` | Shared env-validatie en Convex-client setup |
| `run_python_tool.mjs` | Wrapper: voert Python-tools uit met correcte env |
| `seed_demo_portal_data.mjs` | Seed demo-data in development (nooit in productie) |
| `use-node24.ps1` | PowerShell helper om Node 24 te activeren via nvm |

## Productie-guardrails

Alle scripts die productie raken vereisen:
```
--target=production --confirm-production-<actie>
```

Zie [`convex/catalog/README.md`](../convex/catalog/README.md) voor de volledige pipeline-documentatie.
