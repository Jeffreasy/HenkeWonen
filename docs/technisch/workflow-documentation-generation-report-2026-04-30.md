# Workflowdocumentatie generatie-rapport

Datum: 30 april 2026  
Status: documentatie aangemaakt na root-codebase controle

## Wat gecontroleerd is

Gecontroleerde projectdelen:

- `package.json`
- `astro.config.mjs`
- `src/pages/**`
- `src/components/**`
- `src/components/ui/**`
- `src/components/layout/**`
- `src/components/dashboard/**`
- `src/components/customers/**`
- `src/components/projects/**`
- `src/components/quotes/**`
- `src/components/catalog/**`
- `src/components/imports/**`
- `src/components/suppliers/**`
- `src/components/settings/**`
- `src/lib/**`
- `src/lib/i18n/**`
- `src/lib/calculators/**`
- `convex/schema.ts`
- `convex/portal.ts`
- `convex/measurements.ts`
- `convex/catalog.ts`
- `convex/imports.ts`
- `convex/catalogReview.ts`
- `convex/catalogImport.ts`
- `convex/seed.ts`
- `tools/**`
- relevante recente `docs/**`

## Aangemaakte documenten

- `docs/technisch/workflow-codebase-inventory-2026-04-30.md`
- `docs/technisch/workflow-codebase-inventory-2026-04-30.json`
- `docs/klant/henke-wonen-portal-workflow-handleiding-2026-04-30.md`
- `docs/klant/henke-wonen-portal-quickstart-2026-04-30.md`
- `docs/technisch/henke-wonen-portal-workflow-technical-map-2026-04-30.md`
- `docs/technisch/workflow-documentation-generation-report-2026-04-30.md`

## Belangrijkste aannames

- De documentatie beschrijft alleen functionaliteit die in de gecontroleerde code terugkomt.
- Demo-IDs uit de testtools zijn niet opgenomen als gebruikersinstructie, omdat medewerkers niet met technische IDs hoeven te werken.
- “Factuur” en “boekhouder export” zijn beschreven als workflowmomenten, niet als volledige factuur- of boekhoudflow.
- Inmeting is beschreven als voorbereiding voor hoeveelheden en omschrijvingen, niet als prijs- of btw-bron.
- Btw-mapping is beschreven als verplichte zakelijke controle voordat productie-import gereed is.

## Bewust uitgesloten functionaliteit

Niet beschreven als bestaande functionaliteit:

- automatische verkoopprijskeuze vanuit meetregels
- automatische productselectie vanuit meetregels
- automatische btw-keuze bij onbekende prijskolommen
- automatische merge van dubbele EAN-producten
- volledige PDF-offerteflow
- volledige factuurflow
- boekhoudkoppeling/export als echte integratie
- Outlook/Hotmail agenda-integratie
- uitgebreide klantbewerkflow
- leverancier-deleteflow
- volledige catalogusbeheerflow

## Documentatiekeuzes

De klantgerichte handleiding gebruikt geen developertermen zoals mutation, schema, query, API of JSON.

Technische termen die gebruikers wel in de UI zien, zoals import, btw-mapping en dubbele EAN-waarschuwing, worden uitgelegd in gewone taal.

De technische mapping is apart gehouden voor onderhoud en ontwikkeling.

## Verificatie

Uit te voeren na documentgeneratie:

- `npm run check`
- `npm run build`
- `npm run test:portal`
- `npm run test:a11y`
- `npm run catalog:preview`

Verificatiecriteria:

- documentatie verwijst niet naar niet-bestaande factuur/PDF-flow
- documentatie claimt geen automatische prijs- of productkeuze
- documentatie claimt niet dat productie-import READY is zolang btw-mappings openstaan
- klantgerichte documentatie is Nederlands en praktisch

## Open punten

- Productie-import blijft afhankelijk van afgeronde btw-mappings.
- Factuur/PDF-flow moet wachten op Simone’s factuurvoorbeeld.
- Agenda-integratie is later werk.
- Werkzaamheden en categorieen kunnen later echte beheerschermen worden.
- Customer return handling kan later verder worden aangesloten in de UI.
