# Production readiness review - 2026-04-29

## Samenvatting

De importstraat blijft technisch akkoord. De productie-vrijgave is nog **BLOCKED** omdat er nog **54 unresolved VAT mappings** openstaan. Duplicate EAN issues blijven zichtbaar als waarschuwing en blokkeren productie-import niet.

## Readiness uit Convex

| Check | Waarde |
| --- | ---: |
| VAT mappings totaal | 55 |
| VAT mappings resolved | 1 |
| VAT mappings unresolved | 54 |
| VAT mappings allowUnknown | 0 |
| Duplicate EAN issues open | 25 |
| Last preview rows | 10.691 |
| Last product rows | 10.291 |
| Last price rules | 13.015 |
| Last source files | 17 |
| Production import status | BLOCKED |

## Portal routes

| Route | Resultaat |
| --- | --- |
| `/portal/import-profielen` | HTTP 200 |
| `/portal/imports` | HTTP 200 |
| `/portal/catalogus/data-issues` | HTTP 200 |

## Checks

| Command | Resultaat |
| --- | --- |
| `npx convex dev --once` | OK |
| `npm run check` | OK |
| `npm run build` | OK, met lokale Node 25 waarschuwing t.o.v. Vercel Node 24 |
| `npm run catalog:preview` | OK: 10.291 productrijen, 10.691 preview rows, 13.015 price rules |
| `npm run catalog:import` | Faalt correct op 54 unresolved VAT mappings en 10.291 blocked preview rows |

## UI vrijgaveflow

- `/portal/import-profielen` toont production readiness en de VAT mapping review.
- Filters toegevoegd: unresolved, inclusive, exclusive, unknown, allowUnknownVatMode en alle.
- Bulkacties per importProfile toegevoegd: selectie op inclusive, selectie op exclusive en selectie reviewed markeren.
- Elke prijskolom toont profiel, supplier, categorie, bronkolom, index, priceType, unit, huidige vatMode, suggestie, confidence, reden, updatedAt, reviewedAt en reviewer.
- `/portal/catalogus/data-issues` toont duplicate EAN issues met reviewbeslissing en notities.
- Duplicate EAN review ondersteunt: keep_separate, merge_later, source_error, accepted_duplicate en resolved.
- Er is geen automatische merge gebouwd.

## Conclusie

Productie-import zonder dev override is **nog niet vrijgegeven**. De release wordt **READY** zodra unresolved VAT mappings op 0 staan. De 25 open duplicate-EAN issues blijven zichtbaar als datakwaliteit-waarschuwing en mogen zakelijk worden beoordeeld zonder de producten automatisch samen te voegen.
