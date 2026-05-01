# Design-system samenvatting

## Huidige stand

De portal heeft een warme, rustige backoffice-basis met design tokens, herbruikbare UI-componenten, centrale paginaheaders, breadcrumbs, mobiele navigatie, DataTable-patronen, Nederlandse UI-copy en eerste route/a11y smoke tests.

## Opgebouwd in fases

| Fase | Resultaat |
| --- | --- |
| Fase 1 | Design tokens, basiscomponenten en accessibility basis |
| Fase 2 | Portal shell, actieve navigatie, PageHeader, SectionHeader en breadcrumbs |
| Fase 3 | DataTable, FilterBar, SearchInput en Pagination |
| Fase 4 | Import-, VAT review- en catalog data issue polish |
| Fase 5 | Klanten, projecten en offertes UX-polish |
| Fase 6 | Responsive, accessibility en demo-data QA-pass |
| Fase 7 | Mobiele navigatie, DataTable mobile-card pattern en a11y/route smoke tooling |

## Belangrijkste guardrails

- Geen redesigns zonder modulegerichte onderbouwing.
- Geen business logic in UI-primitives.
- Geen prijs-, btw-, import- of offerteberekeningen in styling/componentlagen.
- Nederlandse UI-copy is de standaard voor hoofdflows.
- Statussen tonen altijd tekst, niet alleen kleur.

## Primaire componentlagen

- `src/components/ui`: generieke UI-componenten.
- `src/components/layout`: portal shell, sidebar en navigatie.
- Domeincomponenten blijven in `customers`, `projects`, `quotes`, `catalog`, `imports`, `suppliers` en `settings`.

## Belangrijkste open aandachtspunten

- DataTable server-side pagination per grote dataset blijft module-afhankelijk.
- Verdere visuele QA kan periodiek worden toegevoegd.
- Page-level polish moet per module blijven gebeuren, niet als generieke grote redesignronde.

## Brondocumenten

- [UI/UX design-system audit](../audits/ui-ux/ui-ux-design-system-audit-2026-04-30.md)
- [Nederlandse UI-copy audit](../audits/ui-ux/nederlandse-ui-copy-audit-2026-04-30.md)
- [Design-system faseverslagen](../implementation/design-system/README.md)

