# Design-system Fase 5 - 2026-04-30

## Samenvatting

Fase 5 is uitgevoerd als UX-polish voor de dagelijkse backofficeflows: klanten, projecten en offertes. De focus lag op scanbaarheid, dossierstructuur, workflowcontext en winkelbruikbaarheid.

Er zijn geen Convex schemawijzigingen gedaan, geen prijslogica gewijzigd, geen offerteberekeningen aangepast, geen importarchitectuur geraakt en geen auth-wijzigingen gedaan.

## Aangepaste schermen

### `/portal/klanten`

Aangepast:

- `CustomerWorkspace.tsx`
- `CustomerList.tsx`
- `CustomerForm.tsx`

Verbeteringen:

- klantenoverzicht gebruikt nu `DataTable`
- zoekveld op naam, mail, telefoon, plaats en notities
- filters op status en klanttype
- summarykaarten voor totaal, leads en actieve klanten
- klantformulier gebruikt design-system `Field`, `Input`, `Select`, `Textarea` en `Button`
- formcopy is meer gericht op winkelcontact en leadregistratie

Business logic:

- `listCustomers` en `createCustomer` zijn ongewijzigd
- geen nieuw klantdatamodel toegevoegd

### `/portal/klanten/[id]`

Aangepast:

- `CustomerDetail.tsx`

Verbeteringen:

- klantdetail is nu ingericht als dossier
- basisgegevens staan in een compacte `SummaryList`
- projecten staan in een `DataTable`
- contactmomenten staan in een aparte `DataTable`
- uitgeleende items hebben een eigen sectie met status: uitgeleend, retour verwacht of teruggebracht
- interne notities/afspraken zijn visueel gescheiden van contactgegevens
- `NoteVisibilityBadge` toont intern versus klantzichtbaar
- loading/error/empty states gebruiken design-system states

Business logic:

- `customerDetail` en `createCustomerContact` zijn ongewijzigd
- geen nieuwe CRM-logica toegevoegd
- `expectedReturnDate` en `returnedAt` worden alleen getoond als de data aanwezig is

### `/portal/projecten`

Aangepast:

- `ProjectWorkspace.tsx`
- `ProjectForm.tsx`
- `ProjectStatusBadge.tsx`

Verbeteringen:

- projectlijst gebruikt nu `DataTable`
- zoeken op project, klant en status
- statusfilter met bestaande projectstatussen
- summarykaarten voor totaal, actief en offertefase
- projectformulier gebruikt design-system form components
- projectstatus gebruikt `StatusBadge` in plaats van losse legacy badgeclasses

Business logic:

- `listProjects` en `createProject` zijn ongewijzigd
- geen statusmutations aangepast

### `/portal/projecten/[id]`

Aangepast:

- `ProjectDetail.tsx`

Toegevoegd:

- `ProjectWorkflowRail.tsx`
- generieke `Timeline.tsx`

Verbeteringen:

- projectdetail voelt nu als workflow/proces
- workflow rail toont lead, concept, verzonden, akkoord, inmeten, bestellen, uitvoering, factuur, betaald en gesloten
- bestaande status blijft leidend
- ruimtes en maten staan in `DataTable`
- workflow events staan in een timeline
- interne en klantzichtbare projectnotities zijn visueel gescheiden wanneer data aanwezig is
- workflowacties blijven dezelfde bestaande mutations gebruiken

Business logic:

- `projectDetail`, `addProjectRoom`, `updateProjectStatus` en `createWorkflowEvent` zijn ongewijzigd
- workflow rail is pure presentatie
- geen statusoverganglogica toegevoegd of gewijzigd

### `/portal/offertes`

Aangepast:

- `QuoteWorkspace.tsx`

Verbeteringen:

- offerteoverzicht gebruikt nu `DataTable`
- zoeken op offertenummer, titel en klant
- statusfilter met bestaande offertestatussen
- summarykaarten voor offertes, concepten en totale waarde
- nieuwe offerteformulier gebruikt design-system form components
- geselecteerde offerte blijft de bestaande builder openen

Business logic:

- `listQuotesWorkspace` en `createQuote` zijn ongewijzigd

### `/portal/offertes/[id]`

Aangepast:

- `QuoteBuilder.tsx`
- `QuoteLineEditor.tsx`
- `QuoteTotals.tsx`

Toegevoegd:

- `LineTypeBadge.tsx`

Verbeteringen:

- offertebuilder is gestructureerd in offertegegevens, regel toevoegen, offerteregels, voorwaarden en totalen
- offerteregels gebruiken `DataTable`
- regeltypes zijn visueel herkenbaar: product, service, arbeid, materiaal, korting, tekst en handmatig
- totalen zijn prominenter en sticky op desktop
- excl. btw, btw en incl. btw blijven expliciet zichtbaar
- lege regels en lege voorwaarden hebben duidelijke empty states
- line editor is compacter en rustiger voor gebruik naast de klant

Business logic:

- `addQuoteLine`, `deleteQuoteLine` en `recalculateQuote` zijn ongewijzigd
- `QuoteTotals` gebruikt dezelfde optelling over bestaande line totals
- geen prijsberekening, VAT berekening of PDF/template flow aangepast

## Toegevoegde componenten

Toegevoegd:

- `src/components/ui/Timeline.tsx`
  - generieke timeline voor dossier- en workflowevents

- `src/components/common/NoteVisibilityBadge.tsx`
  - compacte badge voor intern versus klantzichtbaar

- `src/components/projects/ProjectWorkflowRail.tsx`
  - presentatiecomponent voor bestaande projectstatussen

- `src/components/quotes/LineTypeBadge.tsx`
  - presentatiecomponent voor offerteregeltypes

## CSS aanvullingen

Toegevoegd in `src/styles/global.css`:

- `stack-sm`
- `responsive-form-row`
- `two-column-even`
- timeline styling
- workflow rail styling
- dossier note styling
- quote workbench layout
- sticky quote totals
- quote term styling
- quote select button styling

Alle styling gebruikt bestaande Fase 1 tokens en houdt backwards compatibility met de bestaande portalclasses.

## Business logic bevestiging

Ongewijzigd:

- Convex schema
- Convex queries en mutations
- prijslogica
- offerteberekening
- importarchitectuur
- catalogus-import
- auth
- projectstatus mutaties
- quote line mutations

De wijzigingen zijn beperkt tot:

- React UI components
- globale CSS
- documentatie

## Bewust niet aangepakt

Conform opdracht niet gedaan:

- geen nieuwe CRM-tabellen of klantdossiervelden
- geen complexe contactmomentenworkflow
- geen nieuwe projectstatusmachine
- geen offertemplate/PDF redesign
- geen product picker drawer
- geen catalogus query rewrite
- geen prijs- of btw-rekenwijziging
- geen responsive mobile card rewrite voor alle tabellen

## Risico's

- De workflow rail is presentatie op basis van bestaande statussen; hij valideert geen statusovergangen.
- Detailroute met echte data kon lokaal niet inhoudelijk worden gevuld, omdat Convex op dit moment nul klanten, projecten en offertes teruggaf voor de tenant.
- De offertebuilder gebruikt nog geen catalogus-productpicker; handmatige regels blijven de bestaande flow.
- Sticky totalen zijn alleen een layoutverbetering; op small screens valt de layout terug naar één kolom.

## Verificatie

- `npm run check`: OK
- `npm run build`: OK

Route spotcheck:

- `/portal`: HTTP 200
- `/portal/klanten`: HTTP 200
- `/portal/projecten`: HTTP 200
- `/portal/offertes`: HTTP 200
- `/portal/klanten/no-existing-id`: HTTP 200
- `/portal/projecten/no-existing-id`: HTTP 200
- `/portal/offertes/no-existing-id`: HTTP 200

Convex data check:

- bestaande klanten: 0
- bestaande projecten: 0
- bestaande offertes: 0

Daarom zijn detailroutes met echte bestaande ids niet inhoudelijk getest. De detailroutes zijn wel gecompileerd via `astro check` en `astro build`, en routeren HTTP 200 met placeholder ids.

Build-notitie: de bestaande Vercel-waarschuwing blijft zichtbaar dat lokale Node.js 25 niet gelijk is aan Vercel Serverless runtime Node.js 24. De build is succesvol.

## Vervolgadvies Fase 6

Fase 6 kan zich richten op responsive en accessibility QA:

- visuele browsercheck op laptop, tablet en mobiel
- keyboard/focus pass door formulieren en tabellen
- table density fine-tuning
- detailpagina’s testen met echte klant/project/offertedata
- offertebuilder mobiele stapeling controleren
- empty states met realistische demo-data beoordelen
