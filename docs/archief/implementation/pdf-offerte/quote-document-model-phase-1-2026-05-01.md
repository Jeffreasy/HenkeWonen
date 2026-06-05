# Quote document model fase 1

Datum: 1 mei 2026  
Scope: pure mappinglaag voor toekomstige offerte/PDF-flow

## Toegevoegde bestanden

- `src/lib/quotes/henkeCompanyProfile.ts`
- `src/lib/quotes/quoteDocumentModel.ts`
- `tests/quoteDocumentModel.test.ts`
- `tools/test_quote_document_model.mjs`

Daarnaast is `package.json` uitgebreid met:

- `npm run test:quote-document`

## Wat deze fase doet

Fase 1 introduceert een `QuoteDocumentModel` en een pure functie `buildQuoteDocumentModel`.

De mapper leest bestaande portaldata:

- quote
- customer
- project, optioneel
- quoteLines
- quoteTemplate sections, optioneel
- Henke Wonen company profile content

Daarna vormt de mapper deze data om naar een renderbaar documentmodel met:

- bedrijfsblok;
- klantblok;
- offertegegevens;
- secties en offerteregels;
- bestaande totalen;
- klantvriendelijk btw-label;
- voorwaarden;
- betalingsafspraken.

## Waarom dit nog geen PDF-flow is

Deze fase voegt geen route, knop, preview, download of export toe. Er wordt niets opgeslagen en er wordt geen PDF-bestand gegenereerd.

De mapper is alleen een voorbereide data-laag. Een toekomstige HTML/PDF-preview kan dit model gebruiken, maar dat is bewust nog niet gebouwd.

## Guardrails

Behouden guardrails:

- geen automatische productkeuze;
- geen automatische verkoopprijskeuze;
- geen automatische btw-keuze;
- geen herberekening van prijzen of totalen in de mapper;
- geen Convex mutation;
- geen factuurflow;
- geen boekhoudkoppeling;
- geen productie-PDF-download.

De mapper neemt `unitPriceExVat`, `vatRate`, `lineTotalIncVat`, `subtotalExVat`, `vatTotal` en `totalIncVat` over uit bestaande quote-data.

Regels krijgen `requiresManualReview` als:

- `unitPriceExVat` 0 is;
- de regel metadata heeft die wijst op bron `measurement`;
- er measurement metadata aanwezig is;
- metadata expliciet handmatige product-, prijs- of btw-review markeert.

## Tests

Toegevoegd in `tests/quoteDocumentModel.test.ts`:

- quote totalen worden exact overgenomen;
- `unitPriceExVat` wordt niet aangepast;
- `vatRate` wordt niet aangepast;
- btw-label gebruikt klantvriendelijke neutrale taal: `Btw wordt berekend op basis van de offerteregels.`;
- gemengde btw-percentages krijgen geen hardcoded 21%-label;
- regels zonder section metadata komen in een fallback-sectie;
- voorwaarden en betalingsafspraken worden opgesplitst naar leesbare regels;
- measurement/zero-price regels krijgen `requiresManualReview`.

## Vervolg

Fase 2 kan een preview renderen vanuit hetzelfde `QuoteDocumentModel`. Die preview moet read-only blijven en mag geen quote-data corrigeren of aanvullen.

PDF-download/export hoort pas in fase 3, nadat de preview en auditafspraken vastliggen.

Factuurflow blijft fase 4 en moet apart worden ontworpen.
