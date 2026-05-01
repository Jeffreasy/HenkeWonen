# Henke Wonen portal - technische workflowmapping

Datum: 30 april 2026  
Doelgroep: Jeffrey / ontwikkelaar / onderhoud  
Status: gebaseerd op root-codebase controle

## Route -> component -> Convex mapping

| Route | Astro page | React components | Convex functies |
| --- | --- | --- | --- |
| `/portal` | `src/pages/portal/index.astro` | `DashboardShell`, `ProductionReadiness` | `portal.dashboard`, `catalogReview.productionReadiness` |
| `/portal/klanten` | `src/pages/portal/klanten/index.astro` | `CustomerWorkspace`, `CustomerList`, `CustomerForm` | `portal.listCustomers`, `portal.createCustomer` |
| `/portal/klanten/[id]` | `src/pages/portal/klanten/[id].astro` | `CustomerDetail` | `portal.customerDetail`, `portal.createCustomerContact` |
| `/portal/projecten` | `src/pages/portal/projecten/index.astro` | `ProjectWorkspace`, `ProjectForm` | `portal.listProjects`, `portal.listCustomers`, `portal.createProject` |
| `/portal/projecten/[id]` | `src/pages/portal/projecten/[id].astro` | `ProjectDetail`, `ProjectWorkflowRail`, `MeasurementPanel` | `portal.projectDetail`, `portal.addProjectRoom`, `portal.updateProjectStatus`, `portal.createWorkflowEvent`, `measurements.*` |
| `/portal/offertes` | `src/pages/portal/offertes/index.astro` | `QuoteWorkspace`, `QuoteBuilder` | `portal.listQuotesWorkspace`, `portal.createQuote`, `portal.addQuoteLine`, `portal.deleteQuoteLine`, `portal.updateQuoteTerms` |
| `/portal/offertes/[id]` | `src/pages/portal/offertes/[id].astro` | `QuoteWorkspace`, `QuoteBuilder`, `QuoteLineEditor`, `MeasurementLinePicker`, `QuoteTotals` | `portal.listQuotesWorkspace`, `portal.addQuoteLine`, `portal.deleteQuoteLine`, `portal.updateQuoteTerms`, `measurements.listReadyForQuoteByProject`, `measurements.markMeasurementLineConverted` |
| `/portal/catalogus` | `src/pages/portal/catalogus/index.astro` | `ProductList` | `catalog.listProductsForPortal` |
| `/portal/catalogus/data-issues` | `src/pages/portal/catalogus/data-issues.astro` | `CatalogDataIssues` | `catalogReview.duplicateEanReview`, `catalogReview.syncDuplicateEanIssues`, `catalogReview.updateDuplicateEanIssueReview` |
| `/portal/leveranciers` | `src/pages/portal/leveranciers/index.astro` | `SupplierWorkspace` | `portal.listSuppliers`, `portal.createSupplier`, `portal.updateSupplierProductListStatus` |
| `/portal/imports` | `src/pages/portal/imports/index.astro` | `ImportPreview`, `ProductionReadiness` | `imports.listBatchesForPortal`, `imports.getBatchForPortal`, `catalogImport.createPreviewBatch`, `catalogImport.savePreviewMapping`, `catalogImport.commitPreviewBatchChunk`, `catalogReview.productionReadiness` |
| `/portal/imports/[batchId]` | `src/pages/portal/imports/[batchId].astro` | `ImportPreview` | `imports.getBatchForPortal`, `catalogImport.savePreviewMapping`, `catalogImport.commitPreviewBatchChunk` |
| `/portal/import-profielen` | `src/pages/portal/import-profielen/index.astro` | `ImportProfiles`, `ProductionReadiness` | `catalogReview.vatMappingReview`, `catalogReview.updateProfileVatMode`, `catalogReview.bulkUpdateProfileVatModes`, `catalogReview.markProfileVatColumnsReviewed`, `catalogReview.setProfileAllowUnknownVatMode`, `catalogReview.productionReadiness` |
| `/portal/instellingen/werkzaamheden` | `src/pages/portal/instellingen/werkzaamheden.astro` | `ServiceRulesSettings` | `portal.listServiceRules` |
| `/portal/instellingen/categorieen` | `src/pages/portal/instellingen/categorieen.astro` | `CategoriesSettings` | `portal.listCategories` |
| `/portal/instellingen/offertetemplates` | `src/pages/portal/instellingen/offertetemplates.astro` | `QuoteTemplatesSettings` | `portal.listQuoteTemplates`, `portal.updateQuoteTemplateContent` |

## Workflow -> data entities

### Klantflow

Data:

- `customers`
- `customerContacts`
- `projects`

Functies:

- `portal.createCustomer`
- `portal.listCustomers`
- `portal.customerDetail`
- `portal.createCustomerContact`

UI:

- `CustomerWorkspace`
- `CustomerDetail`

Beperking:

- klantupdate/delete niet als hoofd-UI flow.

### Projectflow

Data:

- `projects`
- `projectRooms`
- `projectWorkflowEvents`
- `customers`

Functies:

- `portal.createProject`
- `portal.listProjects`
- `portal.projectDetail`
- `portal.addProjectRoom`
- `portal.updateProjectStatus`
- `portal.createWorkflowEvent`

UI:

- `ProjectWorkspace`
- `ProjectDetail`
- `ProjectWorkflowRail`
- `Timeline`

Beperking:

- workflowbuttons registreren dossiermomenten, geen volledige order/factuur/boekhoudflow.

### Inmeting

Data:

- `measurements`
- `measurementRooms`
- `measurementLines`
- `wasteProfiles`
- `projectRooms`

Functies:

- `measurements.getForProject`
- `measurements.createForProject`
- `measurements.updateMeasurement`
- `measurements.addMeasurementRoom`
- `measurements.addMeasurementLine`
- `measurements.updateMeasurementLineStatus`
- `measurements.listWasteProfiles`

UI:

- `MeasurementPanel`

Pure calculators:

- `src/lib/calculators/flooringCalculator.ts`
- `src/lib/calculators/plinthCalculator.ts`
- `src/lib/calculators/wallPanelCalculator.ts`
- `src/lib/calculators/stairCalculator.ts`
- `src/lib/calculators/wallpaperCalculator.ts`
- compatibility wrapper: `src/lib/wallpaperCalculator.ts`

Guardrail:

- geen quoteLines aanmaken in `MeasurementPanel`
- geen prijs/btw/productselectie

### Inmeting -> offerte

Data:

- `measurementLines`
- `quoteLines`
- `quotes`

Functies:

- `measurements.listReadyForQuoteByProject`
- `portal.addQuoteLine`
- `measurements.markMeasurementLineConverted`

UI:

- `MeasurementLinePicker`
- `QuoteBuilder`

Mapping:

- `measurementLine.quantity` -> `quoteLine.quantity`
- `measurementLine.unit` -> `quoteLine.unit`
- productgroep/berekening/ruimte -> titel en omschrijving
- `unitPriceExVat` -> 0
- `vatRate` -> 0 als neutrale placeholder; gebruiker kiest btw bewust in de offerte
- metadata bevat broninformatie van de meetregel

Guardrail:

- gebruiker moet expliciet selecteren en bevestigen
- meetregel wordt pas `converted` na succesvolle quoteLine creatie
- product, verkoopprijs en btw worden niet automatisch gekozen vanuit de inmeting

### Offerteflow

Data:

- `quotes`
- `quoteLines`
- `quoteTemplates`
- `projects`
- `customers`

Functies:

- `portal.listQuotesWorkspace`
- `portal.createQuote`
- `portal.addQuoteLine`
- `portal.deleteQuoteLine`
- `portal.updateQuoteTerms`

UI:

- `QuoteWorkspace`
- `QuoteBuilder`
- `QuoteLineEditor`
- `QuoteTotals`

Berekening:

- `portal.recalculateQuote` berekent subtotalen, btw en totaal opnieuw na add/delete line.

Guardrail:

- geen PDF/factuurflow
- geen automatische catalogusprijskeuze vanuit meetregel

### Offertesjablonen

Data:

- `quoteTemplates`

Functies:

- `portal.listQuoteTemplates`
- `portal.updateQuoteTemplateContent`

UI:

- `QuoteTemplatesSettings`
- `QuoteLineEditor` gebruikt `defaultLines`

Gedrag:

- nieuwe offertes nemen default terms/paymentTerms over
- bestaande offertes bewaren eigen terms/paymentTerms

Beperking:

- de UI wijzigt voorwaarden en betalingsafspraken, niet de volledige sjabloonstructuur.

### Catalogusflow

Data:

- `products`
- `productPrices`
- `categories`
- `suppliers`
- `priceLists`

Functies:

- `catalog.listProductsForPortal`

UI:

- `ProductList`

Beperking:

- raadpleeg/search UI; geen complete productbeheerflow.

### Leveranciersflow

Data:

- `suppliers`
- `products`
- `importProfiles`
- `productImportBatches`
- `priceLists`

Functies:

- `portal.listSuppliers`
- `portal.createSupplier`
- `portal.updateSupplierProductListStatus`

UI:

- `SupplierWorkspace`

Gedrag:

- `listSuppliers` verrijkt leveranciers met productaantallen, importprofielen, batch/sourcefile info en laatste importstatus.

Beperking:

- alleen productlijststatus is inline bij te werken voor bestaande leveranciers.

### Importflow

Data:

- `productImportBatches`
- `productImportRows`
- `importProfiles`
- `suppliers`

Functies:

- `imports.listBatchesForPortal`
- `imports.getBatchForPortal`
- `catalogImport.createPreviewBatch`
- `catalogImport.savePreviewMapping`
- `catalogImport.commitPreviewBatchChunk`

UI:

- `ImportPreview`

Guardrails in commit:

- batch moet bij tenant horen
- geen foutregels
- geen dubbele bronsleutels
- unknown-btw alleen als batch `allowUnknownVatMode` toestaat

### Importprofielen -> btw guardrail

Data:

- `importProfiles`
- `productImportBatches`
- `productPrices`

Functies:

- `catalogReview.vatMappingReview`
- `catalogReview.updateProfileVatMode`
- `catalogReview.bulkUpdateProfileVatModes`
- `catalogReview.markProfileVatColumnsReviewed`
- `catalogReview.setProfileAllowUnknownVatMode`
- `catalogReview.productionReadiness`

UI:

- `ImportProfiles`
- `ProductionReadiness`

Regel:

- productie-import is READY alleen als unresolved btw-mappings 0 zijn.

### Datakwaliteit duplicate EAN

Data:

- `catalogDataIssues`
- `products`
- `productPrices`

Functies:

- `catalogReview.duplicateEanReview`
- `catalogReview.syncDuplicateEanIssues`
- `catalogReview.updateDuplicateEanIssueReview`

UI:

- `CatalogDataIssues`

Guardrail:

- nooit automatisch samenvoegen.

## Known open points

- Factuurvoorbeeld van Simone moet nog worden verwerkt voordat PDF/factuurflow ontworpen wordt.
- Boekhoudexport is workflowmoment, geen technische exportflow.
- Outlook/Hotmail agenda-integratie is nog niet gebouwd.
- Werkzaamheden en categorieen zijn in UI alleen-lezen.
- Customer return handling bestaat deels in data/functies, maar is niet volledig als UI-flow aangesloten.
- Volledige productbeheerflow is niet onderdeel van de huidige portalroute.
- Btw-mapping moet zakelijk afgerond worden voordat productie-import READY is.

## Scripts en rapporten

Belangrijke toolbestanden:

- `tools/build_catalog_import.py`: compacte catalogusvoorvertoning en summary
- `tools/upload_catalog_batch_import.mjs`: catalogusimport
- `tools/test_portal_routes.mjs`: portalroutes smoke test
- `tools/test_portal_a11y.mjs`: lichte a11y/copy smoke test
- `tools/test_calculators.mjs`: calculator tests
- `tools/seed_demo_portal_data.mjs`: demo-data

Belangrijke recente docs:

- `docs/technisch/workflow-codebase-inventory-2026-04-30.md`
- `docs/klant/henke-wonen-portal-workflow-handleiding-2026-04-30.md`
- `docs/klant/henke-wonen-portal-quickstart-2026-04-30.md`
- `docs/implementation/inmeetmodule/inmeetmodule-phase-*.md`
- `docs/implementation/design-system/design-system-phase-*.md`
- `docs/catalog-import-summary.md`
