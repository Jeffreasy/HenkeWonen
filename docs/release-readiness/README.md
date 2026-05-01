# Release-readiness

Deze map bevat dossiers die relevant zijn voor productie-vrijgave.

## Btw-mapping

| Document | Gebruik |
| --- | --- |
| [Production readiness](./vat-mapping/vat-mapping-production-readiness-2026-04-30.md) | Hoofdrapport voor productie-importstatus |
| [Huidige stand](./vat-mapping/vat-mapping-current-state-2026-04-30.md) | Alle prijskolommen en huidige btw-mapping |
| [Menselijke beslistabel](./vat-mapping/vat-mapping-human-decision-table-2026-04-30.md) | Open beslissingen voor klant/bedrijf |
| [Apply-resultaat](./vat-mapping/vat-mapping-apply-result-2026-04-30.md) | Resultaat van toegepast beslisbestand |
| [Beslisbestand JSON](./vat-mapping/vat-mapping-decisions.json) | Input voor apply-script |

## Datakwaliteit

| Document | Gebruik |
| --- | --- |
| [Duplicate EAN review](./data-issues/catalog-duplicate-ean-review-2026-04-29.md) | Dubbele EAN-waarschuwingen |

## Hoofdregel

Productie-import mag pas door als verplichte btw-mappings opgelost zijn. Dubbele EAN-waarschuwingen blijven zichtbaar als reviewpunt, maar worden niet automatisch samengevoegd.

