# Design-system Fase 3 - 2026-04-30

## Samenvatting

Fase 3 is uitgevoerd als data-heavy UI-laag. Er zijn geen Convex schemawijzigingen gedaan, geen importarchitectuur aangepast, geen VAT business logic gewijzigd, geen catalogusberekening aangepast en geen duplicate-EAN merge-logica toegevoegd.

De portal heeft nu herbruikbare primitives voor tabellen, filters, zoeken en paginatie. Deze zijn gecontroleerd toegepast op de belangrijkste data-heavy schermen.

## Toegevoegde componenten

Toegevoegd in `src/components/ui`:

- `DataTable.tsx`
  - generic typed component
  - columns config met `key`, `header`, `render(row)`, `width`, `align`, `priority`, `hideOnMobile`
  - loading/error/empty states via `TableState`
  - density: `compact` en `comfortable`
  - `ariaLabel` verplicht

- `FilterBar.tsx`
  - layout primitive voor search, filters en actions
  - responsive stacking via globale CSS

- `SearchInput.tsx`
  - controlled search input
  - clear button wanneer waarde aanwezig is
  - verplicht toegankelijk label

- `Pagination.tsx`
  - ondersteunt page-based en cursor-achtige flows via `hasNextPage` en `hasPreviousPage`
  - disabled states via bestaande `Button`

- `TableState.tsx`
  - uniforme loading/error/empty render voor tabellen

## CSS aanvullingen

Toegevoegd in `src/styles/global.css`:

- `data-table-wrap`
- `data-table`
- compact/comfortable density
- align helpers
- mobile hide helper voor minder belangrijke kolommen
- `filter-bar`
- `search-input`
- `pagination`

De styling gebruikt tokens uit Fase 1 en behoudt de warme backoffice-uitstraling.

## Gemigreerde schermen

### `/portal/catalogus/data-issues`

`CatalogDataIssues.tsx` is gemigreerd naar:

- `DataTable`
- `FilterBar`
- `SearchInput`
- `StatusBadge`
- `Alert`

Toegevoegd:

- statusfilter: open/reviewed/accepted/resolved/all
- supplierfilter
- zoekveld over leverancier, EAN, productnamen, artikelnummers, supplier codes en bronbestanden
- duidelijke waarschuwing dat er geen automatische merge gebeurt

Ongewijzigd:

- `syncDuplicateEanIssues`
- `updateDuplicateEanIssueReview`
- reviewstatus/notities
- geen merge-logica

### `/portal/imports`

`ImportPreview.tsx` is gemigreerd naar:

- `DataTable` voor import batches
- `FilterBar` met zoekveld en statusfilter
- `DataTable` voor import audit rows
- `Pagination` voor geladen audit rows
- `StatusBadge`, `StatCard`, `Badge`, `Button`

Ongewijzigd:

- `listBatchesForPortal`
- `getBatchForPortal`
- `createPreviewBatch`
- `savePreviewMapping`
- `commitPreviewBatchChunk`
- commit guardrails en allowUnknownVatMode gedrag

### `/portal/import-profielen`

`ImportProfiles.tsx` is gemigreerd naar:

- `FilterBar` voor de bestaande filtertabs
- `DataTable` per importprofiel voor VAT mapping rows
- bestaande bulkacties blijven per profiel werken

Ongewijzigd:

- `vatMappingReview`
- `updateProfileVatMode`
- `bulkUpdateProfileVatModes`
- `markProfileVatColumnsReviewed`
- `setProfileAllowUnknownVatMode`
- geen VAT business logic gewijzigd

### `/portal/catalogus`

`ProductList.tsx` is veilig gemigreerd naar:

- `FilterBar`
- `SearchInput`
- `DataTable`

Het bestaande querycontract blijft intact:

- `search`
- `category`
- `limit`

De bestaande “Meer laden”-flow blijft bestaan. Er is geen server-side pagination rewrite gedaan.

## Query/business logic wijzigingen

Geen.

Er zijn geen wijzigingen gedaan in:

- Convex schema
- Convex queries/mutations
- import commit gedrag
- VAT mapping guardrails
- duplicate-EAN mergebeleid
- catalogusprijzen of productberekeningen
- offertebuilder

## Bewust niet aangepakt

Conform opdracht niet gedaan:

- geen full mobile card rewrite
- geen Drawer/Modal
- geen server-side filter/pagination rewrite
- geen offertebuilder/projecten/klanten redesign
- geen grote domeinflow-aanpassing
- geen duplicate-EAN merge

## Performance overwegingen

- DataTable is render-only en bevat geen businesslogica.
- Filters in gemigreerde reviewschermen zijn client-side op de reeds geladen data.
- Import audit rows blijven beperkt door bestaande `rowLimit` in `getBatchForPortal`; de UI pagineert alleen de geladen rows.
- Catalogus blijft het bestaande `limit`-model gebruiken. Voor echte catalogus schaal op langere termijn is server-side cursor pagination beter, maar dat is bewust Fase 3b.

## Risico's

- De nieuwe DataTable is nog bewust eenvoudig: geen sortering, kolomconfiguratie UI of sticky headers.
- Catalogus gebruikt nog `Meer laden` met groeiende `limit`; dit is acceptabel voor deze fase, maar niet het eindpatroon voor zeer grote datasets.
- ImportProfiles rendert nog per profiel een aparte DataTable, omdat bulkacties per profiel blijven werken. Een latere Fase 3b kan dit centraliseren als dat UX-matig gewenst is.
- Detail drawers zijn bewust niet gebouwd; lange productvergelijkingen blijven compact in tabelcellen.

## Vervolgadvies Fase 3b / Fase 4

Fase 3b:

- server-side cursor pagination voor catalogus
- optionele sorting in DataTable
- betere row density presets
- batch row filters op rowKind/status binnen batchdetails
- table toolbar patroon met selected count

Fase 4:

- imports/importprofielen/data-issues polish
- detail drawers of sidepanels voor zware productvergelijkingen
- consistent table empty/loading/error copy per domein
- visual QA op laptop/tablet/mobile

## Verificatie

- `npm run check`: OK
- `npm run build`: OK
- Route spotcheck:
  - `/portal/imports`
  - `/portal/import-profielen`
  - `/portal/catalogus/data-issues`
  - `/portal/catalogus`
  - `/portal`
  - alle routes HTTP 200

Extra controles:

- ProductionReadiness blijft `BLOCKED`: 54 unresolved VAT mappings en 25 open duplicate-EAN issues
- VAT review leest echte Convex-data: 55 VAT rows, 54 unresolved
- import batches lezen echte Convex-data: 76 batches via `listBatchesForPortal`
- duplicate-EAN review leest echte Convex-data: 25 duplicate groepen
- duplicate-EAN review blijft review-only; alleen `syncDuplicateEanIssues` en `updateDuplicateEanIssueReview` worden gebruikt
- scan op hardcoded importtellingen in `src`: geen hits voor bekende baseline-tellingen zoals 7775, 13015, 10291 en 10691

Build-notitie: de bestaande Vercel-waarschuwing blijft zichtbaar dat lokale Node.js 25 niet gelijk is aan Vercel Serverless runtime Node.js 24. De build is succesvol.
