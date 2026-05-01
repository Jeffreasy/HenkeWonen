# Importstraat en catalogus

## Huidige baseline

De catalogusimport is technisch opgezet met preview, audit rows, batches, importprofielen, btw-mapping guardrails en reconciliation.

Laatste compacte cataloguspreview:

- Productregels: 10.291
- Voorvertonings-/auditregels: 10.691
- Prijsregels: 13.015
- Prijsregels met onbekende btw-modus: 12.984

Primaire reviewbron:

- [Catalogusimport samenvatting](../catalog-import-summary.md)
- [Catalogusimport JSON](../catalog-import-summary.json)
- [Catalogusimport sample](../catalog-import-sample.md)

## Productie-import guardrail

Productie-import zonder dev override mag pas slagen als verplichte btw-mappings zijn opgelost. `unknown` is alleen toegestaan als bewuste uitzondering per profiel.

Laatste release-readiness dossier:

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

