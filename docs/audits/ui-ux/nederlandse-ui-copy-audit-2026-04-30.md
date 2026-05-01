# Nederlandse UI-copy audit - 2026-04-30

## Samenvatting

De hoofdflows van de Henke Wonen portal zijn gecontroleerd op zichtbare Engelse copy, technische enumwaarden en inconsistente terminologie. De belangrijkste UI-tekst is omgezet naar professioneel Nederlands voor medewerkers in winkel en backoffice. Er is geen business logic, importarchitectuur, prijslogica, offerteberekening, auth of Convex schema aangepast.

De belangrijkste winst zit in drie lagen:

- Centrale Nederlandse terminologie en statuslabels via `src/lib/i18n`.
- Hoofdmodules tonen geen ruwe statussen zoals `quote_draft`, `READY`, `BLOCKED`, `unknown` of `allowUnknownVatMode` meer aan normale gebruikers.
- Import-, btw-review-, duplicate-EAN-, offerte-, klant- en projectschermen gebruiken duidelijkere Nederlandse acties, waarschuwingen, empty states en aria-labels.

## Belangrijkste gevonden termen

Tijdens de audit kwamen vooral deze typen termen terug:

- Engelse of technische statussen: `READY`, `BLOCKED`, `failed`, `ready_to_import`, `needs_mapping`, `quote_draft`.
- Technische importtermen: `preview rows`, `product rows`, `price rules`, `unknown VAT`, `allowUnknownVatMode`.
- Domeintermen met Engelse oorsprong: `quote`, `quote line`, `template`, `paymentTerms`, `terms`.
- Datakwaliteitstermen: `Duplicate EAN issues`, `needs review`, `source file`.
- Technische fallbackmeldingen: foutmeldingen waarin de gegevensverbinding als technische backend werd benoemd.

Code-only termen blijven bestaan waar ze onderdeel zijn van types, imports, Convex API-contracten of machine-readable JSON. Die zijn niet bedoeld als zichtbare UI-copy.

## Gekozen terminologie

De portal gebruikt nu consequent:

- `Productie-import geblokkeerd` / `Productie-import gereed`
- `Btw-mapping`, `Btw-modus onbekend`, `Btw-mappings te beoordelen`
- `Dubbele EAN-waarschuwingen`
- `Offerteconcept`, `Offertepost`, `Offerteregels`
- `Offertesjablonen`, `Sjabloonregel laden`
- `Klantzichtbaar`, `Alleen intern`, `Uitgeleend item`
- `Voorvertoning`, `Auditregels`, `Kopregel`, `Sectieregel`, `Genegeerde regel`
- `Gereed`, `Geblokkeerd`, `Mislukt`, `Geïmporteerd`, `Klaar voor import`

## Centrale helpers

Toegevoegd:

- `src/lib/i18n/nl.ts`
- `src/lib/i18n/statusLabels.ts`

Belangrijkste helpers:

- `formatStatusLabel`
- `formatProjectStatus`
- `formatQuoteStatus`
- `formatCustomerStatus`
- `formatCustomerType`
- `formatImportStatus`
- `formatVatMode`
- `formatLineType`
- `formatIssueStatus`
- `formatReviewDecision`
- `formatRowKind`
- `formatRowStatus`
- `formatPriceType`
- `formatUnit`
- `formatRecommendation`

Deze helpers worden gebruikt in badges, tabellen, filters, offertebuilder, projectworkflow, importschermen en datakwaliteitsschermen.

## Aangepaste modules

Dashboard:

- Productiegereedheid toont nu Nederlandse statuscopy.
- Metrics gebruiken termen zoals `Laatste voorvertoningsregels`, `Prijsregels` en `Dubbele EAN-waarschuwingen`.
- Pipeline/projectstatussen gebruiken Nederlandse projectlabels.

Klanten:

- Klanttypen en statussen worden centraal vertaald.
- Empty/error states en dossierlabels zijn Nederlands.
- Notitiezichtbaarheid is duidelijk: `Klantzichtbaar` of `Intern`.

Projecten:

- Projectstatussen zijn Nederlands.
- Workflow rail gebruikt duidelijke fases zoals `Offerteconcept`, `Offerte akkoord` en `Inmeting`.
- Tijdlijn/events zijn naar begrijpelijke Nederlandse labels gebracht.

Offertes:

- Regeltypes worden getoond als `Productregel`, `Arbeidsregel`, `Materiaalregel`, `Tekstregel`, enzovoort.
- Offertevoorwaarden en betalingsafspraken gebruiken Nederlandse labels.
- Offertesjabloon-copy is aangepast van technische template-taal naar winkel/backoffice-taal.
- Behangcalculator gebruikt Nederlandse labels en een duidelijke indicatieve waarschuwing.

Catalogus:

- Productlijst gebruikt Nederlandse filter-, empty- en foutteksten.
- Eenheden worden via centrale helpers getoond.
- Datakwaliteit gebruikt `Dubbele EAN-waarschuwingen` en benadrukt dat EAN alleen een hulpmiddel is.

Imports en btw-review:

- Importbatches tonen Nederlandse statussen en counters.
- Btw-review toont `Btw-mappings te beoordelen`, `Inclusief btw`, `Exclusief btw`, `Onbekende btw-modus`.
- Bulkacties en confirm dialogs zijn aangescherpt met veilige Nederlandse waarschuwingen.
- `allowUnknownVatMode` is niet langer zichtbaar als technische term.

Instellingen en leveranciers:

- `Offertetemplates` is zichtbaar gemaakt als `Offertesjablonen`.
- Leveranciersstatussen en werkzaamheden gebruiken Nederlandse statuslabels.

Generated docs:

- `docs/catalog-import-summary.md` is nu de primaire Nederlandse reviewbron.
- `docs/catalog-import-sample.md` gebruikt Nederlandse koppen, regeltypes en statussen.
- Machine-readable JSON behoudt technische keys waar dat nuttig is voor scripts.

## Bewust niet aangepast

- Historische technische auditdocs zijn niet massaal herschreven om onnodige diff en contextverlies te voorkomen.
- Convex function names, TypeScript types, enumwaarden en JSON keys zijn niet vertaald omdat dit API-contracten zijn.
- Bestandsnamen en bronkolomnamen uit leveranciersbestanden blijven origineel.
- Importguardrails, VAT logic, duplicate-EAN reviewgedrag en offerteberekeningen zijn inhoudelijk ongewijzigd.

## Resterende aandachtspunten

- Sommige backendfoutmeldingen kunnen nog Engelse details bevatten als de server zelf een Engelstalige exception terugstuurt.
- Generated JSON blijft machinegericht en gebruikt Engelse keys.
- De route `/portal/instellingen/offertetemplates` behoudt technisch de bestaande URL, terwijl de UI `Offertesjablonen` toont.
- Build geeft een Vercel-waarschuwing dat lokale Node.js 25 afwijkt van Vercel runtime 24; de build zelf slaagt.

## Verificatie

Uitgevoerd:

- `npm run check` - OK, 0 errors/warnings/hints.
- `npm run build` - OK, met alleen de bekende lokale Node/Vercel runtime-waarschuwing.
- `npm run catalog:preview` - OK.

Catalogusbaseline uit preview blijft gelijk:

- Productregels: 10.291
- Voorvertonings-/auditregels: 10.691
- Prijsregels: 13.015
- Prijsregels met onbekende btw-modus: 12.984

Route spotcheck:

- `/portal` - HTTP 200
- `/portal/klanten` - HTTP 200
- `/portal/projecten` - HTTP 200
- `/portal/offertes` - HTTP 200
- `/portal/catalogus` - HTTP 200
- `/portal/imports` - HTTP 200
- `/portal/import-profielen` - HTTP 200
- `/portal/catalogus/data-issues` - HTTP 200
- `/portal/instellingen/offertetemplates` - HTTP 200

## Conclusie

De hoofd-UI is nu geschikt Nederlands voor dagelijks gebruik bij Henke Wonen. Technische enumwaarden zijn uit de normale hoofdflows gehaald, statuslabels komen centraal uit helpers en de import/productiegereedheid blijft inhoudelijk ongewijzigd. De productie-import blijft terecht geblokkeerd zolang btw-mappings openstaan; duplicate-EAN blijft review-only.
