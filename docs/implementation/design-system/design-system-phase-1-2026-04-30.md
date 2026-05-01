# Design-system Fase 1 - 2026-04-30

## Samenvatting

Fase 1 is uitgevoerd als funderingslaag voor de Henke Wonen portal. Er is geen groot redesign gedaan, geen domeinflow gewijzigd en geen import-, catalogus-, offerte- of business logic aangepast.

De wijziging bestaat uit drie delen:

- formele design tokens en accessibility-basics in `src/styles/global.css`
- herbruikbare basiscomponenten in `src/components/ui`
- beperkte migratie van drie bestaande operationele schermen om de componenten veilig te bewijzen

## Toegevoegde tokens

`src/styles/global.css` bevat nu formele tokens voor:

- kleuren: warme neutrale achtergronden, surfaces, tekst, border, accent, success, warning, danger en info
- spacing: `--space-1` t/m `--space-10`
- radius: `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg`
- shadows: `--shadow-xs`, `--shadow-sm`, `--shadow-md`
- typography: `--font-sans`, `--text-xs` t/m `--text-3xl`, `--line-tight`, `--line-normal`

Backwards compatibility is bewust behouden. Bestaande variabelen zoals `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-strong`, `--success`, `--warning` en `--danger` blijven bestaan als aliases naar de nieuwe tokenlaag.

## Toegevoegde componenten

Nieuwe map: `src/components/ui`.

Toegevoegd:

- `Button.tsx`: variants `primary`, `secondary`, `ghost`, `danger`; sizes `sm`, `md`, `lg`; loading/disabled; left/right icon; veilige `type` default.
- `IconButton.tsx`: verplichte `aria-label`; variants `ghost`, `secondary`, `danger`; sizes `sm`, `md`.
- `Badge.tsx`: variants `neutral`, `info`, `success`, `warning`, `danger`, `accent`; optioneel icon en toegankelijk label.
- `StatusBadge.tsx`: generieke status naar variant mapping; toont altijd tekst.
- `Card.tsx`: variants `default`, `raised`, `muted`, `danger`, `warning`, `success`, `info`; padding varianten.
- `Field.tsx`: label, description/helpText, error, required indicator en `htmlFor`.
- `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Checkbox.tsx`: consistente control-styling, focus-visible, disabled en `aria-invalid`.
- `Alert.tsx`: variants `info`, `success`, `warning`, `danger`; `danger` gebruikt `role="alert"`.
- `EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx`: consistente states; loading gebruikt `aria-live="polite"`.
- `StatCard.tsx`: dashboard/readiness metric component met tone varianten.

Ook toegevoegd: `classNames.ts` als kleine lokale helper voor componentclasses.

## Accessibility basis

In `global.css` toegevoegd of aangescherpt:

- zichtbare `:focus-visible` voor links, knoppen, inputs, selects, textareas, tabs en navlinks
- disabled states via `:disabled` en `[aria-disabled="true"]`
- `prefers-reduced-motion: reduce`
- table wrappers behouden horizontale overflow voor brede datasets
- control focus en error states via border/focus ring

## Gemigreerde plekken

Beperkt en veilig gemigreerd:

- `src/components/imports/ProductionReadiness.tsx`
  - gebruikt nu `Button`, `Badge`, `Alert` en `StatCard`
  - production readiness blijft dezelfde Convex-query en dezelfde BLOCKED/READY-logica gebruiken

- `src/components/imports/ImportProfiles.tsx`
  - gebruikt nu `Button`, `Badge`, `Checkbox`, `Select`, `Alert` en `StatCard`
  - VAT review, filters, bulkacties en mutations zijn inhoudelijk ongewijzigd

- `src/components/catalog/CatalogDataIssues.tsx`
  - gebruikt nu `Button`, `Badge`, `Field`, `Select`, `Textarea`, `Alert` en `LoadingState`
  - duplicate-EAN review blijft review-only; er is geen merge-logica toegevoegd

## Bewust niet aangepakt

Conform opdracht niet gedaan:

- geen DataTable gebouwd
- geen portal shell redesign
- geen topbar, breadcrumbs of sidebarwijzigingen
- geen offertebuilder redesign
- geen server-side query wijzigingen
- geen Convex/import/business logic wijzigingen
- geen catalogus- of offerteberekeningen aangepast
- geen grote CSS-herstructurering buiten tokens/primitives

## Risico's

- De bestaande globale CSS en nieuwe UI-componentklassen bestaan nu naast elkaar. Dat is bewust voor backwards compatibility, maar Fase 2 moet bepalen welke patronen leidend worden.
- De beperkte migratie bewijst de componenten op drie schermen, maar de rest van de portal gebruikt nog grotendeels de oude losse CSS-klassen.
- Tabellen blijven in deze fase nog basis-HTML-tabellen. Voor grote imports en catalogusflows is een DataTable-patroon nog steeds nodig.
- Focus states zijn nu zichtbaarer, maar volledige keyboard/a11y validatie per flow hoort in een latere pass.

## Vervolgadvies voor Fase 2

Fase 2 zou zich moeten richten op de portal shell en consistente paginaopbouw:

- `PageHeader`
- `SectionHeader`
- `Breadcrumbs`
- lichte topbar of contextbar
- actieve navigatiestatus in sidebar
- uniforme page actions
- consistente spacing tussen header, filters, tables en detailpanelen

Daarna is Fase 3 logisch: `DataTable`, `FilterBar`, `SearchInput`, `Pagination` en server/client-filterpatronen voor catalogus, imports, VAT review en data issues.

## Verificatie

- `npm run check`: OK
- `npm run build`: OK
- route spotcheck:
  - `/portal`: HTTP 200
  - `/portal/import-profielen`: HTTP 200
  - `/portal/imports`: HTTP 200
  - `/portal/catalogus/data-issues`: HTTP 200

Build-notitie: de bestaande Vercel-waarschuwing blijft zichtbaar dat lokale Node.js 25 niet gelijk is aan Vercel Serverless runtime Node.js 24. De build is wel succesvol afgerond.

## Acceptatiecriteria status

- `src/components/ui` bestaat: ja
- basiscomponenten compileren: ja, bevestigd door `npm run check`
- bestaande CSS classes backwards compatible: ja, oude variabelen en klassen blijven bestaan
- focus states zichtbaarer: ja
- ProductionReadiness gebruikt echte readinessdata en dezelfde BLOCKED/READY-logica: ja
- VAT review blijft functioneel: ja, alleen UI-primitives vervangen
- duplicate-EAN review blijft review-only: ja
- business logic wijzigingen: geen
