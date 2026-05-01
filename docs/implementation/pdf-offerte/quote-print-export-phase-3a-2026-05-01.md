# Quote Print Export - Fase 3a

Datum: 2026-05-01

## Doel

Fase 3a voegt een veilige concept-print ervaring toe aan de bestaande offertepreview. Dit is browserprint:
de gebruiker kan via de browserprintdialoog eventueel "Opslaan als PDF" kiezen. Er is geen server-side
PDF-download, geen export-endpoint en geen bestandsopslag toegevoegd.

## Aangepaste bestanden

- `src/components/quotes/QuoteDocumentPreview.tsx`
  - Voegt de knop `Concept printen` toe.
  - De knop roept alleen `window.print()` aan.
  - De knop staat in een `quote-document-actions no-print` container, zodat hij niet op de print komt.
  - De preview behoudt `Concept preview` en manual-review waarschuwingen.
- `src/styles/global.css`
  - Voegt A4 printinstellingen toe via `@page`.
  - Verbergt omliggende portalnavigatie, knoppen en niet-printbare UI.
  - Houdt de offertepreview zichtbaar.
  - Voegt page-break regels toe voor secties, tekstblokken en totalen.
  - Laat manual-review waarschuwingen en conceptstatus zichtbaar.
- `tests/quoteDocumentPreview.test.tsx`
  - Controleert dat de preview `Concept preview` toont.
  - Controleert dat de printknoptekst `Concept printen` rendert.
  - Controleert dat manual-review waarschuwingen zichtbaar blijven.

## Guardrails

De printknop:

- voert geen Convex mutation uit;
- wijzigt geen quote status;
- maakt geen factuurstatus aan;
- maakt geen exportrecord aan;
- slaat geen bestand op;
- kiest geen product;
- kiest geen verkoopprijs;
- kiest geen btw.

De printweergave rendert uitsluitend bestaande `QuoteDocumentModel` data via de bestaande
`QuoteDocumentPreview`.

## Geen nieuwe PDF-dependency

Er is bewust geen Playwright, Puppeteer, React PDF, jsPDF, pdf-lib, pdfkit of andere PDF-library
toegevoegd. Het Fase 3-plan koos voor HTML/print CSS als veilige eerste stap, omdat de codebase nog
geen bestaande PDF-stack heeft.

## Fase 3b later

Een echte server-side PDF-download/export moet apart worden ontworpen en pas worden gebouwd nadat
de rendering stack, runtime, audit/versionering en manual-review blokkade expliciet zijn gekozen.
Fase 3b mag geen factuurflow of boekhoudkoppeling impliceren.
