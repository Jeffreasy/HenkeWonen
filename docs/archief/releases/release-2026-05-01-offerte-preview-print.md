# Release 2026-05-01 - Offertepreview en concept print

Versie: 0.1.1

## Toegevoegd

- Pure QuoteDocumentModel mappinglaag voor bestaande offerte-, klant-, project-, regel- en templatedata.
- Henke Wonen company profile configuratie voor offertecontent.
- Read-only QuoteDocumentPreview binnen de offertebuilder.
- Concept print flow via browserprint (`window.print()`).
- Print CSS voor A4-layout, verborgen portal-UI, zichtbare conceptstatus, zichtbare manual-review waarschuwingen en betere page-breaks.
- Klantvriendelijke btw-labeltekst: "Btw wordt berekend op basis van de offerteregels."
- Demo/QA-documentatie voor de offertepreview en browserprint-flow.

## Bewust niet toegevoegd

- Geen server-side PDF-export.
- Geen PDF-library, Playwright, Puppeteer of React PDF.
- Geen export-endpoint en geen opslag van PDF-bestanden.
- Geen factuurflow, factuurnummers of boekhoudkoppeling.
- Geen automatische productkeuze.
- Geen automatische verkoopprijskeuze.
- Geen automatische btw-keuze buiten bestaande offertebuilderdata.

## Test- en buildresultaten

Uitgevoerd op 2026-05-01:

- `npm run check`: geslaagd, 0 errors, 0 warnings, 0 hints.
- `npm run test:quote-document`: geslaagd.
- `npm run test:calculators`: geslaagd.
- `npm run test:portal`: geslaagd voor 12 portalroutes.
- `npm run test:a11y`: geslaagd voor 12 portalroutes.
- `npm run build`: geslaagd.

Build-opmerking: de lokale Node.js versie 25 wordt door de Astro Vercel adapter niet ondersteund voor Vercel Serverless Functions; Vercel gebruikt Node.js 24 als runtime. Voor lokale parity is Node.js 24 aanbevolen.

## Demo-status

READY voor interne demo als concept-browserprint flow. De preview is read-only en blijft gebaseerd op het bestaande QuoteDocumentModel.

## Bekende beperkingen

- Browserprint is afhankelijk van de printdialoog en PDF-output van de browser.
- Er is nog geen opgeslagen/exporteerbare server-side PDF.
- Manual-review regels worden gemarkeerd, maar niet automatisch gecorrigeerd.
- Audit/versionering van PDF-export moet later apart worden ontworpen.
- Facturatie en boekhouding blijven buiten scope van deze release.
