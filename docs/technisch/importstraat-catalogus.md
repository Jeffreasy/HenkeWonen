# Importstraat en catalogus

## Huidige baseline

De catalogusimport is technisch opgezet met preview, audit rows, batches, importprofielen, btw-mapping guardrails en reconciliation.

Laatste compacte cataloguspreview:

- Productregels: 11.117
- Voorvertonings-/auditregels: 14.201
- Prijsregels: 13.841
- Prijsregels met onbekende btw-modus: 12.984

Primaire reviewbron:

- [Catalogusimport samenvatting](../catalog-import-summary.md)
- [Catalogusimport JSON](../catalog-import-summary.json)
- [Catalogusimport sample](../catalog-import-sample.md)

## Productie-import guardrail

Productie-import zonder dev override mag pas slagen als verplichte btw-mappings zijn opgelost. `unknown` is alleen toegestaan als bewuste uitzondering per profiel.

Production gebruikt Convex deployment `prod:accomplished-kangaroo-354`
(`https://accomplished-kangaroo-354.eu-west-1.convex.cloud`). Catalogustooling mag
die deployment alleen raken met een expliciete production target:

```bash
node tools/bootstrap_production_base.mjs --env-file .env.production.local --production --target=production --confirm-production-bootstrap
node tools/export_vat_mapping_review.mjs --env-file .env.production.local --production --target=production
node tools/apply_vat_mapping_decisions.mjs --env-file .env.production.local --production --target=production
node tools/apply_vat_mapping_decisions.mjs --env-file .env.production.local --production --target=production --apply --confirm-production-vat-apply
node tools/upload_catalog_batch_import.mjs --env-file .env.production.local --production --target=production --confirm-production-catalog-import
node tools/run_python_tool.mjs tools/reconcile_catalog_sources.py --env-file .env.production.local --production --target=production
```

Gebruik `catalog:import:dev` nooit voor production: dat script staat `--allow-unknown-vat`
toe en is alleen bedoeld voor lokale/dev-iteraties.

De production bootstrap draait alleen `convex/seed.ts` en niet `convex/demoSeed.ts`.
`seed.ts` zet basisconfig neer: tenant, categorieen, leveranciers, servicekosten,
offertetemplate en importprofielen. `demoSeed.ts` maakt demo-klanten, projecten en
offertes aan en hoort niet in production.

Actuele locatie van het btw-beslisbestand:

- `docs/release-readiness/vat-mapping/vat-mapping-decisions.json`

De root-locatie `docs/vat-mapping-decisions.json` is legacy en moet niet meer als
primaire bron worden gebruikt.

De reconciliation-tool is read-only richting Convex en schrijft alleen auditbestanden
naar `docs/audit/`. Gebruik `--no-write` en eventueel `--source <bestandsfilter>`
voor een veilige smoke-test zonder docs te overschrijven.

Laatste release-readiness dossier:

- [Production btw-mapping stand 2026-05-08](../release-readiness/vat-mapping/vat-mapping-current-state-2026-05-08.md)
- [Production menselijke beslistabel 2026-05-08](../release-readiness/vat-mapping/vat-mapping-human-decision-table-2026-05-08.md)
- [Btw-mapping production readiness](../release-readiness/vat-mapping/vat-mapping-production-readiness-2026-04-30.md)
- [Huidige btw-mapping stand](../release-readiness/vat-mapping/vat-mapping-current-state-2026-04-30.md)
- [Menselijke beslistabel](../release-readiness/vat-mapping/vat-mapping-human-decision-table-2026-04-30.md)

## Datakwaliteit

De importlaag bewaakt onder andere:

- geen producten zonder prijsregels
- geen orphan price rules
- geen duplicate source keys
- geen prijsregels met bedrag <= 0
- sectierijen niet als product
- Headlam nulprijzen overslaan
- Interfloor artikelnummers als string behouden
- Co-pro dubbele commissie-kolommen via sourceColumnIndex apart bewaren

## Duplicate EAN

Dubbele EAN-waarschuwingen zijn datakwaliteitsissues. Ze blokkeren productie-import niet, maar moeten zichtbaar blijven voor menselijke review.

- [Duplicate EAN review](../release-readiness/data-issues/catalog-duplicate-ean-review-2026-04-29.md)

## Historische auditbronnen

- [Data- en importaudits](../audits/data-import/README.md)
