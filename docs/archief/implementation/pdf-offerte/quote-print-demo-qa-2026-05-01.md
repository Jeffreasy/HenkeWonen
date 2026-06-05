# Quote Print Demo QA

Datum: 2026-05-01

## Scope

QA-pass op de offertepreview en Fase 3a browserprint-flow:

- `QuoteDocumentModel` als enige inputlaag;
- read-only `QuoteDocumentPreview`;
- knop `Concept printen` met alleen `window.print()`;
- print-CSS in `src/styles/global.css`;
- geen server-side PDF, PDF-library, exportroute, opslag, factuurflow of boekhoudkoppeling.

## Gecontroleerde demo/offertedata

De testfixture in `tests/quoteDocumentPreview.test.tsx` is uitgebreid naar realistische demodata met:

- klant: Familie Jansen;
- onderwerp/projecttitel: benedenverdieping en raambekleding;
- offertenummer `OFF-2026-014`;
- datum en geldigheid;
- meerdere offertepostgroepen: `Vloeren`, `Montage en afwerking`, `Raambekleding`;
- lange omschrijvingen;
- normale prijsregels;
- een regel met `unitPriceExVat: 0`;
- een regel met `requiresManualReview: true`;
- voorwaarden;
- betalingsafspraken;
- subtotalen, btw en totaal incl. btw;
- klantvriendelijk btw-label vanuit het model: `Btw wordt berekend op basis van de offerteregels.`

## Visuele en printlogica

Gecontroleerd via markup, CSS, server-render test en een lokale browserfixture met dezelfde realistische
offertedata:

- `Concept preview` blijft zichtbaar in de preview en dus in print.
- `Concept printen` staat in `quote-document-actions no-print`.
- Print-CSS verbergt `.no-print` en `.quote-document-actions`.
- Portalnavigatie en omliggende portal-UI worden bij print verborgen doordat de print-CSS alleen
  de tijdelijke `.quote-print-root` zichtbaar maakt.
- Manual-review waarschuwingen blijven in de markup en worden niet verborgen in print.
- Het totalenblok heeft `print-keep-together`.
- Secties, sectiekoppen, tabellen, voorwaarden, meta-informatie, briefhoofd, totalen en afsluiting
  hebben page-break guards.
- Lange tabelteksten krijgen wrapping via `overflow-wrap: anywhere`.
- De printtabel gebruikt in printmodus `table-layout: fixed` met vaste kolombreedtes voor A4.

Browserfixture-resultaat:

- portaltekst `PORTAL UI MAG NIET PRINTEN` was aanwezig in de DOM, maar niet zichtbaar in de printroot-weergave;
- `Concept preview` was zichtbaar;
- manual-review waarschuwing `Controleer product, prijs en btw.` was zichtbaar;
- btw-label `Btw wordt berekend op basis van de offerteregels.` was zichtbaar;
- totalenblok had `quote-document-totals print-keep-together`.

## Gevonden issues

1. Lange omschrijvingen konden op A4 te veel invloed hebben op de tabelkolommen.
2. De eerste print-CSS gebruikte `visibility: hidden` voor portalcontent. Daardoor was die content
   onzichtbaar, maar hield die nog wel layout-hoogte vast. In browserprint kon dit extra pagina's
   veroorzaken, waaronder een bijna lege eerste pagina.

## Fixes

- In `src/styles/global.css` is printmodus aangescherpt:
  - `table-layout: fixed` op `.quote-document-table`;
  - vaste kolombreedtes voor aantal, eenheid, omschrijving, prijs, btw en totaal;
  - `overflow-wrap: anywhere` op tabelcellen.
- De printknop maakt tijdelijk een aparte `quote-print-root` direct onder `document.body` met een
  kloon van de offertepreview.
- In printmodus wordt bij `quote-print-active` alles buiten `.quote-print-root` met `display: none`
  uit de layout gehaald. De originele portal-layout, navigatie, tabellen en panels kunnen daardoor
  geen lege printpagina's meer veroorzaken.
- De gekloonde preview zelf staat in print op `position: static`, zodat de browser alleen de echte
  documenthoogte paginateert.
- De printknop zet tijdelijk `quote-print-active` op `document.body` en verwijdert de printroot na
  `afterprint`.
- Het btw-label is aangepast naar klantvriendelijke taal: `Btw wordt berekend op basis van de offerteregels.`
- Sectiekoppen vermijden een page break direct na de titel; totalen vermijden een break voor of binnen
  het blok.
- In `tests/quoteDocumentPreview.test.tsx` is de fixture uitgebreid met meerdere secties en langere
  omschrijvingen.
- Tests controleren nu ook:
  - preview-root class `quote-document-preview`;
  - actiecontainer `quote-document-actions no-print`;
  - totalenblok `quote-document-totals print-keep-together`;
  - `Concept preview`;
  - `Concept printen`;
  - manual-review waarschuwing.
  - print-CSS verbergt alles buiten `.quote-print-root` met `display: none`;
  - de oude `body * { visibility: hidden }` aanpak komt niet terug;
  - globale `body:has(.quote-document-preview)` printselectors komen niet terug.

## Beperkingen

- De browserprintdialoog zelf is niet geautomatiseerd getest.
- Er wordt geen PDF-bestand gegenereerd als testartefact.
- Browserprint kan per browser/printerdriver kleine verschillen geven.
- Er is nog geen audit/versionering van exports.
- Er is nog geen definitieve server-side PDF-download; dat blijft Fase 3b.

## Conclusie

**READY voor interne demo** als concept-browserprintflow.

Demo-uitleg: dit is browserprint/Opslaan als PDF vanuit de bestaande offertepreview. Het is geen
productieclaim voor server-side PDF-export en geen factuur- of boekhoudflow.
