# Release-readiness

Deze map bevat dossiers die relevant zijn voor productie-vrijgave.

## Catalogusbron

| Document | Gebruik |
| --- | --- |
| [Catalogus bronbesluit 2026-06-01](./catalogus/catalogus-bronbesluit-2026-06-01.md) | Besluit welke catalogusstand leidend is, welke lokale preview kandidaatbron is en welke poort voor productie geldt |
| [Catalogus development-reconciliatie 2026-06-01](./catalogus/catalogus-development-reconciliatie-2026-06-01.md) | Uitkomst van volledige preview, development-reset/import, parserfixes en duplicate-EAN restpunt |

## Btw-mapping

| Document | Gebruik |
| --- | --- |
| [Production readiness](./vat-mapping/vat-mapping-production-readiness-2026-04-30.md) | Hoofdrapport voor productie-importstatus |
| [Huidige stand 2026-06-01](./vat-mapping/vat-mapping-current-state-2026-06-01.md) | Actuele btw-mapping na volledige development-import |
| [Huidige stand](./vat-mapping/vat-mapping-current-state-2026-04-30.md) | Alle prijskolommen en huidige btw-mapping |
| [Menselijke beslistabel](./vat-mapping/vat-mapping-human-decision-table-2026-04-30.md) | Open beslissingen voor klant/bedrijf |
| [Apply-resultaat](./vat-mapping/vat-mapping-apply-result-2026-04-30.md) | Resultaat van toegepast beslisbestand |
| [Beslisbestand JSON](./vat-mapping/vat-mapping-decisions.json) | Input voor apply-script |

## Datakwaliteit

| Document | Gebruik |
| --- | --- |
| [Duplicate-EAN parkeerbesluit 2026-06-01](./data-issues/duplicate-ean-parkeerbesluit-2026-06-01.md) | Professioneel parkeerbesluit: bekende waarschuwing, guardrails en heropen-triggers |
| [Duplicate EAN review 2026-06-01](./data-issues/catalog-duplicate-ean-review-2026-06-01.md) | Actuele duplicate-EAN review na volledige development-import en batch-sync |
| [Duplicate EAN review](./data-issues/catalog-duplicate-ean-review-2026-04-29.md) | Dubbele EAN-waarschuwingen |

## Hoofdregel

Productie-import mag pas door als verplichte btw-mappings opgelost zijn, de gekozen catalogusbron aantoonbaar overeenkomt met de development-importbaseline en open datakwaliteitspunten expliciet beoordeeld of professioneel geparkeerd zijn. Dubbele EAN-waarschuwingen blijven zichtbaar als reviewpunt, maar worden niet automatisch samengevoegd.
