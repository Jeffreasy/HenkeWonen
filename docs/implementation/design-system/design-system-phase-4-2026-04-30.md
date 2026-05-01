# Design-system Fase 4 - 2026-04-30

## Samenvatting

Fase 4 is uitgevoerd als UX-polish op de productie-vrijgave flow rond imports, VAT mapping review en catalog data issues. Er zijn geen Convex schemawijzigingen gedaan, geen importarchitectuur aangepast, geen VAT business logic gewijzigd en geen duplicate-EAN merge-logica toegevoegd.

De focus lag op scanbaarheid, releaseveiligheid en professionele afwerking: in drie seconden moet duidelijk zijn waarom productie-import nog `BLOCKED` is, welke acties veilig zijn en welke reviews alleen waarschuwingen zijn.

## Aangepaste schermen

### `/portal`

`ProductionReadiness.tsx` is aangescherpt als release checklist.

Toegevoegd:

- duidelijke `Production import status: BLOCKED / READY`
- visueel onderscheid tussen harde blokkade en waarschuwing
- checklist "Wat blokkeert productie?"
- samenvatting van laatste preview
- directe acties naar VAT review, data issues en import batches
- bronbestandentelling uit echte Convex-readiness data

Ongewijzigd:

- `api.catalogReview.productionReadiness`
- READY-regel: alleen `READY` wanneer unresolved VAT mappings nul is
- duplicate-EAN issues blijven waarschuwingen, geen harde blokkade

### `/portal/import-profielen`

`ImportProfiles.tsx` is gepolijst voor snelle en veilige VAT mapping review.

Toegevoegd:

- summarykaarten voor unresolved, inclusive, exclusive, allowUnknown, reviewed en totaal
- compactere profielheaders met unresolved/resolved/reviewed counts
- reviewed-status per prijskolom
- kortere reason-tekst met inline help voor de volledige uitleg
- duidelijke success feedback na acties
- bevestiging voor bulk inclusive/exclusive acties
- extra waarschuwing wanneer `allowUnknownVatMode` wordt ingeschakeld

Ongewijzigd:

- `vatMappingReview`
- `updateProfileVatMode`
- `bulkUpdateProfileVatModes`
- `markProfileVatColumnsReviewed`
- `setProfileAllowUnknownVatMode`
- geen VAT mapping guardrail aangepast

### `/portal/imports`

`ImportPreview.tsx` is verder afgewerkt als audit-dashboard.

Toegevoegd:

- batchlijst met compactere issue-kolom voor errors, warnings en error messages
- batchdetail-tabs: Summary, Rows, Warnings/errors en Reconciliation
- row filters op `rowKind` en row status binnen de geladen audit rows
- sterkere weergave van warning/error rows
- reconciliation summary met duplicate matches, zero price rows, orphan checks en skipped prices
- bevestiging voordat een definitieve batchcommit wordt gestart

Ongewijzigd:

- batch creation
- mapping save
- commit chunk logic
- import guardrails
- allowUnknownVatMode gedrag
- `createPreviewBatch`, `savePreviewMapping` en `commitPreviewBatchChunk`

### `/portal/catalogus/data-issues`

`CatalogDataIssues.tsx` is gepolijst als review-only datakwaliteitscherm.

Toegevoegd:

- duidelijke waarschuwing: EAN is ondersteunend, er wordt nooit automatisch gemerged
- summarykaarten voor open, reviewed, accepted duplicates en resolved
- filter op recommendation naast status, supplier en search
- compactere productvergelijking met side-by-side productblokken
- helptekst per reviewbeslissing
- duidelijker notitieveld: "Interne reviewnotitie"

Ongewijzigd:

- alleen `syncDuplicateEanIssues` en `updateDuplicateEanIssueReview` worden gebruikt
- geen merge-mutatie
- geen automatische productaanpassing
- producten blijven gescheiden tot expliciete zakelijke beslissing

## Toegevoegde kleine UI components

Toegevoegd in `src/components/ui`:

- `ConfirmDialog.tsx`
  - eenvoudige bevestigingsdialog voor risicovollere bulkacties
  - gebruikt bestaande `Alert` en `Button`
  - ondersteunt danger/warning/info tone

- `SummaryList.tsx`
  - compacte key/value summary voor audit- en reconciliationblokken

- `Checklist.tsx`
  - release checklist met success/warning/danger/info tonen

- `InlineHelp.tsx`
  - korte tekst met volledige uitleg via `title`

Deze components bevatten geen domeinlogica.

## CSS aanvullingen

Toegevoegd in `src/styles/global.css`:

- confirm dialog styling
- summary list styling
- checklist styling
- inline help styling
- release panel states
- compacte product comparison styling

Alle styling gebruikt de tokens uit Fase 1 en behoudt de bestaande backwards compatible portal classes.

## UX verbeteringen

- Production readiness is nu expliciet een release-checklist in plaats van losse metrics.
- VAT review maakt onderscheid tussen unresolved, resolved, reviewed en allowUnknown.
- Bulkacties zijn zichtbaarder en vragen bevestiging voordat meerdere prijskolommen worden aangepast.
- `allowUnknownVatMode` krijgt extra waarschuwing, omdat dit een productie-risico is.
- Import batches zijn auditbaarder door tabs en reconciliation summary.
- Audit rows kunnen binnen de geladen dataset op row kind/status worden gefilterd.
- Duplicate-EAN review communiceert duidelijk dat dit geen merge-scherm is.
- Productvergelijkingen zijn compacter en beter scanbaar.

## Veiligheidsverbeteringen

- Bulk inclusive/exclusive acties op VAT mappings voeren niet meer stil uit.
- Definitieve batchcommit vanuit de UI vraagt bevestiging.
- `allowUnknownVatMode` inschakelen vraagt bevestiging met waarschuwing.
- Duplicate-EAN acties blijven reviewstatus/notities; geen automatische merge.
- Production readiness blijft live uit Convex komen en bevat geen hardcoded baseline-tellingen.

## Bewust niet aangepakt

Conform opdracht niet gedaan:

- geen Convex schemawijzigingen
- geen importarchitectuur wijziging
- geen VAT business logic wijziging
- geen duplicate-EAN merge
- geen catalogus prijslogica
- geen offertebuilder/projecten/klanten redesign
- geen DataTable architectuurwijziging
- geen full modal/drawer systeem

## Business logic bevestiging

Business logic bleef ongewijzigd.

De wijzigingen zitten in:

- React UI components
- globale CSS voor visuele polish
- documentatie

Er zijn geen wijzigingen gedaan in `convex/schema.ts`, importmutations, catalogusberekeningen of product/price dedupe-strategie.

## Verificatie

- `npm run check`: OK
- `npm run build`: OK

Route spotcheck via lokale Astro dev server:

- `/portal`: HTTP 200
- `/portal/imports`: HTTP 200
- `/portal/import-profielen`: HTTP 200
- `/portal/catalogus/data-issues`: HTTP 200

Live Convex readiness:

- production import status: `BLOCKED`
- unresolved VAT mappings: `54`
- duplicate EAN issues open: `25`
- last preview rows: `10.691`
- last product rows: `10.291`
- last price rules: `13.015`
- last source files: `17`

Extra checks:

- scan op hardcoded importtellingen in `src`: geen hits voor bekende baseline-tellingen
- duplicate-EAN review blijft review-only
- geen auto-merge pad toegevoegd
- import batches blijven echte Convex-data lezen

Build-notitie: de bestaande Vercel-waarschuwing blijft zichtbaar dat lokale Node.js 25 niet gelijk is aan Vercel Serverless runtime Node.js 24. De build is succesvol.

## Risico's

- `ConfirmDialog` is bewust lichtgewicht en nog geen volledig app-breed modal systeem.
- Audit row filters werken op de geladen rows; de server-side row limit blijft leidend.
- Lange VAT reasons worden compact weergegeven met inline help; voor complexe reviews kan later een detaildrawer prettiger zijn.
- Duplicate-EAN productvergelijking toont de eerste twee producten expliciet en vat extra producten samen; een latere detailview kan meer diepte geven.

## Vervolgadvies Fase 5

Fase 5 kan zich richten op klanten/projecten/offertes UX-polish:

- klantdetail met contactmomenten en uitgeleende items scanbaarder maken
- projectworkflow als compacte timeline/checklist
- offertebuilder scanbaarheid verbeteren zonder prijslogica te wijzigen
- interne versus klantzichtbare notities visueel scheiden
- consistente empty/error/loading copy per domein
