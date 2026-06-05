# Workflow codebase-inventarisatie Henke Wonen portal

Datum: 30 april 2026  
Scope: root-codebase controle voor gebruikersdocumentatie  
Status: uitgevoerd op basis van bestaande code, zonder featurewijzigingen

## Samenvatting

De Henke Wonen portal is een Astro + React Islands + Convex applicatie met een centrale portalomgeving voor klanten, projecten, offertes, catalogus, leveranciers, imports, importprofielen, datakwaliteit en instellingen.

De codebase ondersteunt de dagelijkse hoofdflow:

1. klant aanmaken of opzoeken
2. project aanmaken
3. projectruimtes en werkproces volgen
4. inmeting starten en meetregels voorbereiden
5. offerte maken
6. sjabloonregels of meetregels laden
7. offerteposten, voorwaarden en betalingsafspraken beheren
8. catalogus en leveranciers raadplegen
9. importstatus, btw-mappings en datakwaliteitswaarschuwingen controleren

Belangrijke guardrail: inmetingen maken geen prijzen, producten of btw-keuzes automatisch aan. Ze bereiden alleen hoeveelheden, eenheden en omschrijvingen voor. De offertebuilder blijft verantwoordelijk voor product, prijs, btw en totalen.

## Rootbestanden en scripts

Gecontroleerd:

- `package.json`
- `astro.config.mjs`
- `src/pages/**`
- `src/components/**`
- `src/lib/**`
- `convex/**`
- `tools/**`
- recente `docs/**`

Belangrijke scripts:

- `npm run dev`: lokale Astro devserver
- `npm run check`: Astro typecheck
- `npm run build`: Astro check + build
- `npm run catalog:preview`: compacte catalogusvoorvertoning
- `npm run catalog:import`: productie-import met btw-guardrails
- `npm run catalog:import:dev`: dev-import met expliciete unknown-btw override
- `npm run portal:demo-seed`: demo/testdata
- `npm run test:portal`: route smoke test
- `npm run test:a11y`: lichte toegankelijkheidscheck
- `npm run test:calculators`: calculator tests

## Route-overzicht

| Route | Doel | Hoofdcomponenten | Data/acties |
| --- | --- | --- | --- |
| `/portal` | Dashboard en productiegereedheid | `DashboardShell`, `ProductionReadiness` | Dashboardtellingen, pipeline, importblokkades |
| `/portal/klanten` | Klanten zoeken en aanmaken | `CustomerWorkspace`, `CustomerList`, `CustomerForm` | Klantenlijst, filters, nieuwe klant |
| `/portal/klanten/[id]` | Klantdossier | `CustomerDetail` | Klantgegevens, projecten, contactmomenten, uitgeleende items |
| `/portal/projecten` | Projecten zoeken en aanmaken | `ProjectWorkspace`, `ProjectForm` | Projectlijst, filters, nieuw project |
| `/portal/projecten/[id]` | Projectdetail en inmeting | `ProjectDetail`, `ProjectWorkflowRail`, `MeasurementPanel` | Status, ruimtes, werkprocesmomenten, inmeting |
| `/portal/offertes` | Offertes zoeken en aanmaken | `QuoteWorkspace` | Offertelijst, nieuwe offerte, offertebuilder voor geselecteerde offerte |
| `/portal/offertes/[id]` | Offertebuilder | `QuoteWorkspace`, `QuoteBuilder`, `QuoteLineEditor`, `MeasurementLinePicker`, `QuoteTotals` | Offerteposten, sjabloonregels, inmeetregels, voorwaarden, totalen |
| `/portal/catalogus` | Productcatalogus | `ProductList` | Producten zoeken/filteren en prijsinformatie tonen |
| `/portal/catalogus/data-issues` | Datakwaliteit | `CatalogDataIssues` | Dubbele EAN-waarschuwingen beoordelen |
| `/portal/leveranciers` | Leveranciersopvolging | `SupplierWorkspace` | Leveranciers, productlijststatus, bronbestanden, gekoppelde producten/importprofielen |
| `/portal/imports` | Importbatches | `ImportPreview`, `ProductionReadiness` | Batches bekijken, batch aanmaken, mapping opslaan, definitief verwerken met guardrails |
| `/portal/imports/[batchId]` | Importbatchdetail | `ImportPreview` | Batchsamenvatting, auditregels, waarschuwingen/fouten, reconciliation |
| `/portal/import-profielen` | Btw-mapping review | `ImportProfiles`, `ProductionReadiness` | Prijskolommen beoordelen, bulkacties, unknown-btw uitzondering |
| `/portal/instellingen/werkzaamheden` | Werkzaamheden bekijken | `ServiceRulesSettings` | Werkzaamheden en prijzen excl. btw, nu alleen-lezen in UI |
| `/portal/instellingen/categorieen` | Categorieen bekijken | `CategoriesSettings` | Cataloguscategorieen, nu alleen-lezen in UI |
| `/portal/instellingen/offertetemplates` | Offertesjablonen beheren | `QuoteTemplatesSettings` | Sjabloonregels bekijken; voorwaarden en betalingsafspraken aanpassen |

## Module-overzicht

### Dashboard

Componenten:

- `src/components/dashboard/DashboardShell.tsx`
- `src/components/imports/ProductionReadiness.tsx`

Functies:

- toont dashboardtellingen voor klanten, projecten, offertes, catalogusregels en importstatus
- toont productiegereedheid
- toont harde blokkade als btw-mappings ontbreken
- toont dubbele EAN-waarschuwingen als waarschuwing, niet als blokkade

Convex:

- `portal.dashboard`
- `catalogReview.productionReadiness`

Guardrails:

- productie-import is alleen gereed als ontbrekende btw-mappings 0 zijn
- dubbele EAN-waarschuwingen leiden niet tot automatische samenvoeging

### Klanten

Componenten:

- `CustomerWorkspace`
- `CustomerList`
- `CustomerForm`
- `CustomerDetail`

Gebruikersacties:

- klanten zoeken en filteren
- nieuwe klant aanmaken
- klantdossier openen
- contactmoment toevoegen
- uitgeleend item als contactmoment registreren
- projecten van klant bekijken

Convex:

- `portal.listCustomers`
- `portal.createCustomer`
- `portal.customerDetail`
- `portal.createCustomerContact`
- `customers.markLoanedItemReturned` bestaat in Convex, maar is niet zichtbaar aangesloten in de hoofd-UI

Beperkingen:

- klantgegevens bewerken/verwijderen is niet zichtbaar als hoofdactie
- contactmomentformulier registreert het uitgeleende item, maar expected return/returned bediening is niet volledig zichtbaar in de UI

### Projecten

Componenten:

- `ProjectWorkspace`
- `ProjectForm`
- `ProjectDetail`
- `ProjectWorkflowRail`
- `ProjectStatusBadge`
- `Timeline`
- `NoteVisibilityBadge`

Gebruikersacties:

- project aanmaken vanuit bestaande klant
- projecten zoeken/filteren
- projectstatus bekijken
- project op inmeting gepland zetten
- projectruimte toevoegen
- werkprocesmoment toevoegen via snelle acties
- interne en klantzichtbare notities bekijken als ze aanwezig zijn
- inmeting openen binnen projectdetail

Convex:

- `portal.listProjects`
- `portal.createProject`
- `portal.projectDetail`
- `portal.addProjectRoom`
- `portal.updateProjectStatus`
- `portal.createWorkflowEvent`

Beperkingen:

- projectnotities worden getoond als data aanwezig is, maar er is geen uitgebreide notitie-editor in deze hoofdflow
- factuur/boekhouderacties zijn workflowmomenten; er is geen volledige factuur- of boekhoudkoppeling gebouwd

### Inmeting

Componenten:

- `MeasurementPanel`
- calculators in `src/lib/calculators/**`
- `WallpaperCalculator`

Gebruikersacties:

- inmeting starten
- inmeetdatum, ingemeten door en notities bijwerken
- meetruimte toevoegen
- bestaande projectruimte als basis gebruiken
- vloer, plinten, behang, wandpanelen en trap berekenen
- handmatige meetregel opslaan
- meetregel markeren als klaar voor offerte

Convex:

- `measurements.getForProject`
- `measurements.createForProject`
- `measurements.updateMeasurement`
- `measurements.addMeasurementRoom`
- `measurements.addMeasurementLine`
- `measurements.updateMeasurementLineStatus`
- `measurements.listWasteProfiles`
- `measurements.seedDefaultWasteProfiles`

Guardrails:

- geen offerteregels aanmaken vanuit `MeasurementPanel`
- geen prijs kiezen
- geen btw kiezen
- calculators zijn indicatief en puur op hoeveelheid gericht

### Offertes

Componenten:

- `QuoteWorkspace`
- `QuoteBuilder`
- `QuoteLineEditor`
- `MeasurementLinePicker`
- `QuoteTotals`
- `LineTypeBadge`
- `WallpaperCalculator`

Gebruikersacties:

- offerte maken vanuit een project
- offerte selecteren/openen
- handmatige offertepost toevoegen
- sjabloonregel laden en aanpassen
- meetregels uit inmeting laden na selectie en bevestiging
- offertepost verwijderen
- voorwaarden en betalingsafspraken per offerte aanpassen
- totalen bekijken

Convex:

- `portal.listQuotesWorkspace`
- `portal.createQuote`
- `portal.addQuoteLine`
- `portal.deleteQuoteLine`
- `portal.updateQuoteTerms`
- `measurements.listReadyForQuoteByProject`
- `measurements.markMeasurementLineConverted`

Guardrails:

- meetregelconversie vereist expliciete selectie en bevestiging
- meetregels krijgen `unitPriceExVat = 0`
- product, prijs en btw moeten in de offerte worden gecontroleerd
- totalen worden via bestaande offerteberekening herberekend
- er is geen PDF/factuurflow gebouwd

### Catalogus

Componenten:

- `ProductList`
- `ProductSearch` is aanwezig als component, maar de hoofdroute gebruikt `ProductList`

Gebruikersacties:

- producten zoeken op product, artikelnummer, kleur of leverancier
- filteren op categorie
- meer resultaten laden
- product, categorie, leverancier, labels, eenheid en prijs excl. btw bekijken

Convex:

- `catalog.listProductsForPortal`
- aanvullend aanwezig: `catalog.listProducts`, `catalog.getProductCount`, `catalog.listCollections`, `catalog.createProduct`, `catalog.addPrice`

Beperkingen:

- hoofd-UI is een zoek-/raadpleegscherm
- geen productbewerking in de portalroute
- onbekende btw-modus in import blijft apart via importprofielen bewaakt

### Leveranciers

Componenten:

- `SupplierWorkspace`

Gebruikersacties:

- leveranciers bekijken
- zoeken/filteren op leverancier, contactpersoon, notitie en productlijststatus
- leverancier toevoegen
- productlijststatus bijwerken
- gekoppelde producten, importprofielen, bronbestanden en laatste importstatus zien

Convex:

- `portal.listSuppliers`
- `portal.createSupplier`
- `portal.updateSupplierProductListStatus`

Beperkingen:

- bestaande leveranciercontactgegevens volledig bewerken is niet als aparte editflow zichtbaar
- geen leverancier-deleteflow
- importprofielen worden niet vanuit leverancierspagina aangepast

### Imports

Componenten:

- `ImportPreview`
- `ImportWarnings`
- `ProductionReadiness`

Gebruikersacties:

- importbatches bekijken
- importbatchdetail bekijken
- batch aanmaken voor bekende bronbestanden
- btw-mapping/unknown-btw uitzondering per batch opslaan
- definitief verwerken als guardrails dat toestaan
- auditregels filteren op regeltype/status
- waarschuwingen/fouten en reconciliation bekijken

Convex:

- `imports.listBatchesForPortal`
- `imports.getBatchForPortal`
- `catalogImport.createPreviewBatch`
- `catalogImport.savePreviewMapping`
- `catalogImport.commitPreviewBatchChunk`

Guardrails:

- definitief verwerken blokkeert bij foutregels, dubbele bronsleutels of onbekende btw-modus zonder expliciete uitzondering
- productie-import via script blokkeert zolang btw-mappings openstaan

### Importprofielen en btw-mapping

Componenten:

- `ImportProfiles`
- `ProductionReadiness`

Gebruikersacties:

- btw-mapping review openen
- filteren op te beoordelen, inclusief btw, exclusief btw, onbekend en uitzondering
- per prijskolom btw-modus zetten
- per profiel geselecteerde kolommen bulk op inclusief/exclusief zetten na bevestiging
- kolommen markeren als beoordeeld
- onbekende btw-modus als uitzondering toestaan met waarschuwing

Convex:

- `catalogReview.vatMappingReview`
- `catalogReview.updateProfileVatMode`
- `catalogReview.bulkUpdateProfileVatModes`
- `catalogReview.markProfileVatColumnsReviewed`
- `catalogReview.setProfileAllowUnknownVatMode`
- `catalogReview.productionReadiness`

Guardrails:

- standaard is onbekende btw-modus niet toegestaan
- productie-import blijft geblokkeerd zolang mappings ontbreken

### Datakwaliteit: dubbele EAN

Componenten:

- `CatalogDataIssues`

Gebruikersacties:

- dubbele EAN-waarschuwingen ophalen/synchroniseren
- zoeken/filteren op status, leverancier, advies en tekst
- reviewbeslissing kiezen
- interne notitie opslaan

Convex:

- `catalogReview.duplicateEanReview`
- `catalogReview.syncDuplicateEanIssues`
- `catalogReview.updateDuplicateEanIssueReview`

Guardrails:

- geen automatische merge
- EAN is ondersteunend signaal, geen primaire sleutel
- open dubbele EAN-waarschuwingen blokkeren productie-import niet

### Instellingen

Componenten:

- `ServiceRulesSettings`
- `CategoriesSettings`
- `QuoteTemplatesSettings`

Gebruikersacties:

- werkzaamheden bekijken
- categorieen bekijken
- offertesjablonen bekijken
- voorwaarden en betalingsafspraken in offertesjabloon aanpassen

Convex:

- `portal.listServiceRules`
- `portal.listCategories`
- `portal.listQuoteTemplates`
- `portal.updateQuoteTemplateContent`

Beperkingen:

- werkzaamheden en categorieen zijn in de huidige UI alleen-lezen
- offertesjabloonbeheer past voorwaarden en betalingsafspraken aan, niet de volledige structuur van sjabloonregels

## Data-entiteiten

Belangrijke tabellen in `convex/schema.ts`:

- `tenants`
- `users`
- `customers`
- `customerContacts`
- `categories`
- `suppliers`
- `brands`
- `productCollections`
- `products`
- `priceLists`
- `productPrices`
- `productImportBatches`
- `productImportRows`
- `serviceCostRules`
- `projects`
- `projectRooms`
- `measurements`
- `measurementRooms`
- `measurementLines`
- `wasteProfiles`
- `quotes`
- `quoteLines`
- `quoteTemplates`
- `projectWorkflowEvents`
- `importProfiles`
- `catalogDataIssues`
- `supplierOrders`
- `invoices`
- `timelineEvents`

Let op: `supplierOrders`, `invoices` en `timelineEvents` bestaan als tabellen, maar er is in de gecontroleerde portalroutes geen volledige gebruikersflow voor leveranciersbestellingen, facturen of boekhouding gebouwd.

## Bestaande workflowstatussen

Projectstatussen:

- Lead
- Offerteconcept
- Offerte verzonden
- Offerte akkoord
- Offerte afgewezen
- Inmeting gepland
- Uitvoering gepland
- Bestellen
- In uitvoering
- Gefactureerd
- Betaald
- Gesloten
- Geannuleerd

Offertestatussen:

- Concept
- Verzonden
- Geaccepteerd
- Afgewezen
- Verlopen
- Geannuleerd

Inmeetstatussen:

- Concept
- Ingemeten
- Gecontroleerd
- Verwerkt naar offerte

Meetregelstatussen:

- Concept
- Klaar voor offerte
- Verwerkt

Importstatussen:

- Geupload
- Analyseren
- Mapping vereist
- Klaar voor import
- Importeren
- Geimporteerd
- Mislukt

Leverancier-productlijststatussen:

- Onbekend
- Opgevraagd
- Ontvangen
- Download beschikbaar
- Niet beschikbaar
- Alleen handmatig

## Bewust geblokkeerde of niet-bestaande acties

Deze acties zijn niet als bestaande gebruikersfunctionaliteit gedocumenteerd:

- automatische verkoopprijs kiezen uit inmeting
- automatisch product kiezen uit catalogus bij meetregel
- automatisch btw kiezen bij onbekende prijskolom
- automatische EAN-merge
- volledige PDF-offerteflow
- volledige factuurflow
- boekhoudkoppeling/export als uitgewerkte flow
- Outlook/Hotmail agenda-integratie
- leverancier verwijderen
- productcatalogus handmatig volledig beheren via portal
- werkzaamheden/categorieen bewerken in UI

## Guardrails

- Alle portaldata is tenant-scoped via `tenantSlug` of `tenantId`.
- Import commit controleert foutregels, dubbele bronsleutels en onbekende btw-modus.
- Productie-import blijft geblokkeerd zolang btw-mappings ontbreken.
- `catalog:import:dev` bestaat alleen voor dev-baseline.
- Meetregels worden pas na expliciete bevestiging offerteregels.
- Meetregels krijgen geen automatische prijs.
- Dubbele EAN-waarschuwingen zijn review-only.
- Offertesjabloonwijzigingen gelden voor nieuwe offertes; bestaande offertes bewaren eigen voorwaarden/betalingsafspraken.

