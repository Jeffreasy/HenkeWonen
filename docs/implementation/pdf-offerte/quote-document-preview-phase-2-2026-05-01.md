# Quote Document Preview - Fase 2

Datum: 2026-05-01

## Doel

Fase 2 voegt een read-only offertepreview toe op basis van het bestaande `QuoteDocumentModel`.
De preview is bedoeld als veilige tussenlaag richting een toekomstige PDF-flow: renderbaar voor controle,
maar zonder download, export, factuurstappen of boekhoudkoppeling.

## Toegevoegde en aangepaste bestanden

- `src/components/quotes/QuoteDocumentPreview.tsx`
  - Rendert bedrijfsblok, klantblok, offertegegevens, aanhef, intro, offerteregels, totalen,
    btw-label, voorwaarden, betalingsafspraken en ondertekening.
  - Toont een duidelijke `Concept preview` aanduiding.
  - Toont bij regels met `requiresManualReview` de waarschuwing: `Controleer product, prijs en btw.`
- `src/lib/quotes/quoteDocumentFormatting.ts`
  - Bevat alleen presentatieformatting: valuta, datum, aantallen en btw-percentages.
- `src/components/quotes/QuoteBuilder.tsx`
  - Bouwt een `QuoteDocumentModel` vanuit bestaande quote-, customer-, project- en template-data.
  - Toont de preview als read-only sectie binnen de bestaande offertebuilder.
- `src/components/quotes/QuoteWorkspace.tsx`
  - Geeft de geselecteerde klant en het geselecteerde project door aan `QuoteBuilder`.
- `src/styles/global.css`
  - Bevat de styling voor de offertepreview.
- `tests/quoteDocumentPreview.test.tsx`
  - Test server-side rendering van de preview en de formatting helpers.
- `tools/test_quote_document_model.mjs`
  - Laadt naast de modeltests ook de TSX-previewtests.

## Waarom dit nog geen PDF-export is

Deze fase rendert alleen een preview in de bestaande portal-UI. Er is geen knop, route, endpoint,
downloadactie, bestandsopslag of exportproces toegevoegd. De preview gebruikt hetzelfde model dat later
als input voor PDF-rendering kan dienen, maar voert zelf geen PDF-generatie uit.

## Behouden guardrails

- Geen automatische productkeuze.
- Geen automatische verkoopprijskeuze.
- Geen automatische btw-keuze.
- Geen correctie of aanvulling van quoteLines in de preview.
- Geen mutations of Convex writes vanuit de preview.
- Geen factuurflow.
- Geen boekhoudkoppeling.
- Regels met handmatige aandacht blijven zichtbaar als waarschuwing; waarden worden niet aangepast.

## Tests

Toegevoegde testdekking:

- De preview rendert zonder crash met een volledig `QuoteDocumentModel`.
- De preview toont de concept/preview-status.
- De preview toont het btw-label uit het model.
- De preview toont de manual-review waarschuwing bij regels met `requiresManualReview`.
- Formatting helpers beperken zich tot presentatieformatting.

Uit te voeren script:

```bash
npm run test:quote-document
```

## Fase 3 later

Fase 3 kan een aparte PDF-download/export ontwerpen op basis van dezelfde `QuoteDocumentModel` input.
Die fase moet apart toetsen:

- hoe de preview wordt omgezet naar PDF;
- welke bestandsnaam en opslagstrategie nodig zijn;
- of de download alleen concept/offerte-output betreft;
- hoe fouten en auditbaarheid worden afgehandeld;
- dat facturatie en boekhouding buiten scope blijven tot een apart ontwerp.
