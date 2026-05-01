# Workflow mutation/delete audit - 2026-05-01

Scope: zeer grondige audit op create/update/delete/status/review/import/seed functionaliteit in de Henke Wonen portal.

Niet in scope en niet toegevoegd: server-side PDF-export, PDF-library, factuurflow, boekhoudkoppeling, automatische productkeuze, automatische verkoopprijskeuze of automatische btw-keuze.

## Samenvatting

### Wat gebruikers kunnen aanmaken

- Klanten via `CustomerWorkspace` -> `portal.createCustomer`.
- Klantcontacten en uitgeleende items als contactmoment via `CustomerDetail` -> `portal.createCustomerContact`.
- Projecten bij bestaande klanten via `ProjectWorkspace` -> `portal.createProject`.
- Projectruimtes via `ProjectDetail` -> `portal.addProjectRoom`.
- Project workflowevents via `ProjectDetail` -> `portal.createWorkflowEvent`.
- Inmetingen via `MeasurementPanel` -> `measurements.createForProject`.
- Meetruimtes via `MeasurementPanel` -> `measurements.addMeasurementRoom`.
- Meetregels via `MeasurementPanel` -> `measurements.addMeasurementLine`.
- Offertes via `QuoteWorkspace` -> `portal.createQuote`.
- Offerteposten via `QuoteBuilder` en `MeasurementLinePicker` -> `portal.addQuoteLine`.
- Leveranciers via `SupplierWorkspace` -> `portal.createSupplier`.
- Importbatches via `ImportPreview` -> `catalogImport.createPreviewBatch`.
- Catalogusproducten, prijsregels, brands, collecties en prijslijsten via import/tooling, niet via normale productbeheer-UI.
- Demo/bootstrapdata via seed/tooling, niet via normale portalgebruikersflow.

### Wat gebruikers kunnen wijzigen

- Projectstatus beperkt via `ProjectDetail` -> `portal.updateProjectStatus`, momenteel zichtbaar als "Inmeten plannen".
- Project workflowevents kunnen worden toegevoegd, maar niet gewijzigd.
- Inmeetmetadata via `MeasurementPanel` -> `measurements.updateMeasurement`.
- Meetregelstatus `draft` -> `ready_for_quote` via `measurements.updateMeasurementLineStatus`.
- Meetregel conversiestatus naar `converted` via `measurements.markMeasurementLineConverted`.
- Offertevoorwaarden en betalingsafspraken via `portal.updateQuoteTerms`.
- Leverancier productlijststatus via `portal.updateSupplierProductListStatus`.
- Offertesjabloon voorwaarden en betalingsafspraken via `portal.updateQuoteTemplateContent`.
- Import batch mapping via `catalogImport.savePreviewMapping`.
- Btw-mapping/importprofiel review via `catalogReview.updateProfileVatMode`, `bulkUpdateProfileVatModes`, `markProfileVatColumnsReviewed`, `setProfileAllowUnknownVatMode`.
- Duplicate EAN reviewstatus en notitie via `catalogReview.updateDuplicateEanIssueReview`.

### Wat gebruikers kunnen verwijderen

- Alleen offerteposten via `QuoteBuilder` -> `portal.deleteQuoteLine`.
- Deze delete herberekent de offertetotalen via `recalculateQuote`.

### Wat bewust niet kan

- Klant verwijderen.
- Klant volledig bewerken vanuit hoofd-UI.
- Contactmoment wijzigen of verwijderen.
- Uitgeleend item retour markeren vanuit hoofd-UI.
- Project verwijderen.
- Projectruimte wijzigen of verwijderen.
- Workflowevent wijzigen of verwijderen.
- Inmeting, meetruimte of meetregel verwijderen.
- Meetregel opnieuw via de normale lijst laden nadat de status `converted` is.
- Offerte verwijderen.
- Offertestatus beheren vanuit hoofd-UI.
- Producten/prijzen handmatig beheren of verwijderen vanuit catalogus-UI.
- Leverancier verwijderen.
- Importprofiel verwijderen.
- Categorieen of werkzaamheden beheren/verwijderen vanuit UI.
- Duplicate EAN issues verwijderen of producten samenvoegen.
- Server-side PDF-export, factuurflow of boekhoudkoppeling uitvoeren.

### Grootste risico's

- **Gefixt in deze audit:** `tools/reset_catalog_import.mjs` kon zonder extra CLI-bevestiging destructieve catalogusreset uitvoeren als `.env.local` naar de verkeerde Convex omgeving wees. Het script vereist nu `--confirm-reset-imported-catalog`.
- **P1 open punt:** meetregel naar offerte laden gebruikt nu twee mutations: eerst `portal.addQuoteLine`, daarna `measurements.markMeasurementLineConverted`. Als stap 2 faalt na succesvolle quote line creatie, kan een niet-geconverteerde meetregel alsnog een offertepost hebben. Advies: later een atomische Convex mutation bouwen.
- **P2 open punt:** offertepost verwijderen heeft geen bevestigingsdialoog. Data-integriteit is veilig door totalenherberekening, maar UX kan per ongeluk verwijderen mogelijk maken.
- **P2 open punt:** oudere/lage-niveau Convex modules exporteren extra write functions die niet vanuit de portal-UI worden gebruikt. Voor interne demo acceptabel, voor productie autorisatie/API-oppervlak hardenen.

### Eindconclusie

**MUTATION/DELETE READY voor interne demo**, met het expliciete voorbehoud dat productiehardening later autorisatie, atomische meetregelconversie en expliciete delete-confirm UX moet toevoegen.

## Matrix per module

| Module | Create | Update | Delete | Status/review acties | UI aanwezig | Convex functie | Guardrail | Risico | Advies |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Klanten | Klant, contactmoment | Geen volledige klantedit | Geen | Geen klantstatus in hoofd-UI | Ja | `portal.createCustomer`, `portal.createCustomerContact` | Tenant via slug, customer tenant check bij contact | Geen klant-delete voorkomt orphan projects | Behouden; later klantedit apart ontwerpen |
| Klantcontacten/uitgeleend | Contactmoment, uitgeleend item | Geen UI-edit | Geen UI-delete | Retourstatus bestaat alleen in oude module | Deels | `portal.createCustomerContact`, oude `customers.markLoanedItemReturned` | Customer tenant check | Retour markeren niet aangesloten | Documentatie klopt: retourinfo alleen zichtbaar als aanwezig |
| Projecten | Project | Alleen status via knop | Geen | Inmeten plannen; workflowevents toevoegen | Ja | `portal.createProject`, `portal.updateProjectStatus`, `portal.createWorkflowEvent` | Project vereist bestaande klant | Workflowevent "Akkoord" wijzigt geen status | Houd als dossiermoment; later statusacties explicieter maken |
| Projectruimtes | Ruimte toevoegen | Geen UI-edit | Geen | Geen | Ja | `portal.addProjectRoom` | Project tenant check | Geen delete voorkomt orphan measurement room refs | Later edit/delete alleen met cascadebeleid |
| Inmetingen | Inmeting | Metadata/status | Geen | Status draft/measured/reviewed/converted | Ja | `measurements.createForProject`, `updateMeasurement` | Project en customer tenant/project checks | Geen delete voorkomt orphan measurement lines | Behouden |
| Meetruimtes | Meetruimte toevoegen | Geen UI-edit | Geen | Geen | Ja | `measurements.addMeasurementRoom` | Measurement tenant check, projectRoom hoort bij project | Geen delete voorkomt orphan meetregels | Behouden |
| Meetregels | Meetregel toevoegen | Status ready/converted | Geen | Klaar voor offerte, converted | Ja | `measurements.addMeasurementLine`, `updateMeasurementLineStatus`, `markMeasurementLineConverted` | Geen product/prijs/btw, converted alleen vanaf ready | Twee-staps conversie kan partial failure geven | Later atomische import mutation |
| Offertes | Offerte | Voorwaarden/betalingsafspraken | Geen offerte-delete | Geen statusbeheer in UI | Ja | `portal.createQuote`, `portal.updateQuoteTerms` | Offerte vereist project, template wordt gekopieerd | Geen quote delete voorkomt orphan lines/workflow | Behouden |
| Offerteposten | Regel toevoegen | Geen edit flow; opnieuw toevoegen/verwijderen | Ja, echte delete | N.v.t. | Ja | `portal.addQuoteLine`, `portal.deleteQuoteLine` | Tenant/quote check, projectRoom check, totalenherberekening | Geen confirm UX | Voeg later bevestiging/undo toe |
| Offertepreview/print | Geen | Geen | Geen | Browserprint | Ja | Geen mutation | `QuoteDocumentPreview` gebruikt `window.print()` en geen API | Geen datarisico | Behouden |
| Catalogus | Via import/tooling | Via import/tooling | Geen UI-delete | Data issues review | Raadpleeg/search | `catalog.listProductsForPortal`, tool-only `catalog.createProduct`, `catalog.addPrice` | Import guardrails | Handmatige productbeheerflow ontbreekt bewust | Documentatie klopt |
| Leveranciers | Leverancier toevoegen | Productlijststatus | Geen | Productlijst opvolging | Ja | `portal.createSupplier`, `portal.updateSupplierProductListStatus` | Tenant check, duplicate name retourneert bestaande leverancier | Geen delete voorkomt orphan producten/imports | Behouden |
| Imports | Batch aanmaken | Mapping opslaan, fail status | Geen UI-delete | Definitief verwerken | Ja | `catalogImport.createPreviewBatch`, `savePreviewMapping`, `commitPreviewBatchChunk`, `failPreviewBatch` | Blokkeert unknown btw, error rows en duplicate source keys | Batch cleanup/delete ontbreekt bewust | Behouden |
| Import reset | Geen | Geen | Echte delete via tool | Reset imported catalog | Geen UI | `catalogImport.resetCatalogChunk`, `tools/reset_catalog_import.mjs` | Confirm literal + nu extra CLI flag | Kan catalogusdata verwijderen; geen UI | Alleen dev/maintenance, nooit demo/production zonder bewuste flag |
| Importprofielen | Via seed/tooling | Btw-mapping, bulk, reviewed, allow unknown | Geen | Reviewstatus | Ja | `catalogReview.*Profile*` | Tenant/profile check | Unknown override kan import toestaan, maar expliciet | Behouden |
| Duplicate EAN | Issue sync | Reviewstatus/notitie | Geen | keep/accept/resolve | Ja | `catalogReview.syncDuplicateEanIssues`, `updateDuplicateEanIssueReview` | Patcht alleen issues, geen products | Geen merge aanwezig | Behouden |
| Werkzaamheden | Via seed/lage-niveau module | Geen UI-update | Geen | Geen | Alleen-lezen | `portal.listServiceRules`, tool-only `serviceCostRules.create` | Geen beheer-UI | Geen delete voorkomt prijsregel-orphans | Documentatie klopt |
| Categorieen | Via seed/lage-niveau module | Geen UI-update | Geen | Geen | Alleen-lezen | `portal.listCategories`, tool-only `categories.create` | Geen beheer-UI | Geen delete voorkomt product/template/service refs | Documentatie klopt |
| Offertesjablonen | Via seed/upsert | Terms/paymentTerms | Geen | Status alleen seed/upsert | Ja, deels | `portal.updateQuoteTemplateContent`, `quoteTemplates.upsert` | Nieuwe offertes kopieren templatecontent; bestaande offertes bewaren eigen tekst | Geen stille wijziging bestaande offertes | Behouden |
| Demo/seed | Tenant/demo/config data | Idempotente patch/upsert | Geen cleanup | Seed | Tool-only | `seed.run`, `demoSeed.run`, `tenants.ensureTenant`, `users.ensureUser` | Idempotent op tenant/name | Kan demo data in gekozen Convex omgeving zetten | Alleen bewust draaien |

## Volledige write inventory

| Functie | Bestand | Entiteit/tabel | Type | Inputvelden | Validaties/tenant-scope | Relaties geraakt | UI/tool | Cascade/orphan risico |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `portal.createCustomer` | `convex/portal.ts` | `customers` | create | `tenantSlug`, type, displayName, email, phone, city, notes | `requireTenant` | Nieuwe customer | UI | Geen |
| `portal.createCustomerContact` | `convex/portal.ts` | `customerContacts` | create | `tenantSlug`, `customerId`, type, title, description, loaned item velden, visibility | Customer moet tenant matchen | Customer -> contacts | UI | Geen delete, dus geen orphan |
| `portal.createProject` | `convex/portal.ts` | `projects` | create | `tenantSlug`, `customerId`, title, description | Customer moet tenant matchen | Customer -> project | UI | Geen |
| `portal.addProjectRoom` | `convex/portal.ts` | `projectRooms` | create | `tenantSlug`, `projectId`, name, area, perimeter | Project moet tenant matchen | Project -> rooms | UI | Geen |
| `portal.updateProjectStatus` | `convex/portal.ts` | `projects`, optioneel `projectWorkflowEvents` | status-change | `tenantSlug`, `projectId`, status, optionele workflow | Project tenant check | Project timestamps, optioneel event | UI | Geen |
| `portal.createWorkflowEvent` | `convex/portal.ts` | `projectWorkflowEvents` | create | `tenantSlug`, `projectId`, type, title, description, visibility | Project tenant check | Project -> event | UI | Geen edit/delete |
| `portal.createQuote` | `convex/portal.ts` | `quotes`, `projects`, `projectWorkflowEvents` | create/status | `tenantSlug`, `projectId`, title | Project tenant check; actieve default template gelezen | Quote snapshot, project naar `quote_draft`, event | UI | Geen |
| `portal.addQuoteLine` | `convex/portal.ts` | `quoteLines`, `quotes` | create/update totals | `tenantSlug`, `quoteId`, line data, sortOrder, metadata | Quote tenant check, projectRoom hoort bij quote project | Quote -> lines, totals | UI | Geen product automatische keuze; totalen herberekend |
| `portal.deleteQuoteLine` | `convex/portal.ts` | `quoteLines`, `quotes` | echte delete/update totals | `tenantSlug`, `lineId` | Line tenant check | Verwijdert line, quote totals opnieuw | UI | Veilig voor totals; geen confirm UX |
| `portal.updateQuoteTerms` | `convex/portal.ts` | `quotes` | update | `tenantSlug`, `quoteId`, terms, paymentTerms | Quote tenant check | Alleen geopende quote | UI | Geen template side effect |
| `portal.createSupplier` | `convex/portal.ts` | `suppliers` | create/upsert-ish | `tenantSlug`, name, contact, status, dates, notes | Tenant check, bestaande naam retourneert bestaande id | Supplier | UI | Geen |
| `portal.updateSupplierProductListStatus` | `convex/portal.ts` | `suppliers` | status-change | `tenantSlug`, `supplierId`, status | Supplier tenant check | Supplier status | UI | Geen |
| `portal.updateQuoteTemplateContent` | `convex/portal.ts` | `quoteTemplates` | update | `tenantSlug`, `templateId`, defaultTerms, paymentTerms | Template tenant check | Alleen templatecontent | UI | Bestaande quotes worden niet gepatcht |
| `measurements.createForProject` | `convex/measurements.ts` | `measurements` | create | `tenantId`, `projectId`, `customerId`, date, measuredBy, notes | Project/customer tenant check; project.customerId moet matchen | Project/customer -> measurement | UI | Geen |
| `measurements.updateMeasurement` | `convex/measurements.ts` | `measurements` | update/status | `tenantId`, `measurementId`, status/date/measuredBy/notes | Measurement tenant check | Measurement metadata | UI | Geen |
| `measurements.addMeasurementRoom` | `convex/measurements.ts` | `measurementRooms` | create | `tenantId`, `measurementId`, optional projectRoomId, dimensions | Measurement tenant check; projectRoom hoort bij project | Measurement -> rooms | UI | Geen |
| `measurements.addMeasurementLine` | `convex/measurements.ts` | `measurementLines` | create | `tenantId`, `measurementId`, optional roomId, productGroup, calculationType, input/result, quantity/unit, quoteLineType | Measurement tenant check; room hoort bij measurement | Measurement -> lines | UI | Geen product/prijs/btw |
| `measurements.updateMeasurementLineStatus` | `convex/measurements.ts` | `measurementLines` | status-change | `tenantId`, `lineId`, quotePreparationStatus | Line tenant check | Line status | UI | Kan converted theoretisch handmatig zetten via API; UI gebruikt ready |
| `measurements.markMeasurementLineConverted` | `convex/measurements.ts` | `measurementLines` | status/link | `tenantId`, `lineId`, `quoteId`, `quoteLineId` | Line moet ready zijn; quote project moet matchen; quoteLine hoort bij quote | Link naar quote/line | UI | Twee-staps UI flow kan partial failure geven |
| `measurements.seedDefaultWasteProfiles` | `convex/measurements.ts` | `wasteProfiles` | seed/upsert | `tenantId` | TenantId input | Waste profiles | Tool/manual | Geen |
| `catalogImport.importRows` | `convex/catalogImport.ts` | products/prices/etc. | legacy direct import | `tenantSlug`, rows | Tenant slug; row import logic | Catalogusdata | Legacy tool only | Legacy direct path; normale script blokkeert zonder private flag |
| `catalogImport.createPreviewBatch` | `convex/catalogImport.ts` | `productImportBatches`, supplier | create/import | tenantSlug, file metadata, supplierName, profile, allowUnknown | Tenant slug; ensure supplier | Batch + supplier | UI/tool | Geen |
| `catalogImport.appendPreviewRows` | `convex/catalogImport.ts` | `productImportRows`, batch | create/update batch | tenantSlug, batchId, rows | Batch tenant check | Batch rows and summary | Tool | Geen delete |
| `catalogImport.savePreviewMapping` | `convex/catalogImport.ts` | `productImportBatches` | update/mapping | tenantSlug, batchId, mapping, allowUnknown | Batch tenant check | Batch status | UI/tool | Unknown btw blijft blocked tenzij explicit allow |
| `catalogImport.failPreviewBatch` | `convex/catalogImport.ts` | `productImportBatches` | status-change | tenantSlug, batchId, errorMessage | Batch tenant check | Batch failed metadata | Tool | Geen |
| `catalogImport.commitPreviewBatchChunk` | `convex/catalogImport.ts` | products/prices/import rows/batch | import | tenantSlug, batchId, allowUnknown, user, limit | Batch tenant check; blocks unknown btw, errorRows, duplicateSourceKeys | Import rows -> products/prices; batch reconciliation | UI/tool | Veiligste importpad; no merge by duplicate EAN |
| `catalogImport.resetCatalogChunk` | `convex/catalogImport.ts` | productPrices/products/priceLists/collections/brands | echte delete/reset | tenantSlug, confirm literal, batchSize | Tenant slug + `RESET_IMPORTED_CATALOG` | Imported catalog tables | Tool only | Destructief; script nu extra confirm-flag |
| `catalogReview.updateProfileVatMode` | `convex/catalogReview.ts` | `importProfiles` | update/review | tenantSlug, profileId, column, vatMode, user | Profile tenant check | Profile mappings/review | UI/tool | Geen |
| `catalogReview.bulkUpdateProfileVatModes` | `convex/catalogReview.ts` | `importProfiles` | bulk update/review | tenantSlug, profileId, columns, vatMode, user | Profile tenant check | Profile mappings/review | UI | Geen |
| `catalogReview.markProfileVatColumnsReviewed` | `convex/catalogReview.ts` | `importProfiles` | review | tenantSlug, profileId, columns, user | Profile tenant check | Review metadata | UI | Mark reviewed kan unknown laten bestaan; import blijft blocked tenzij allowUnknown |
| `catalogReview.setProfileAllowUnknownVatMode` | `convex/catalogReview.ts` | `importProfiles` | explicit override | tenantSlug, profileId, boolean, user | Profile tenant check | Profile allow flag | UI/tool | Bewuste uitzondering kan import toestaan |
| `catalogReview.updateDuplicateEanIssueReview` | `convex/catalogReview.ts` | `catalogDataIssues` | review/status | tenantSlug, issueId, decision, notes, user | Issue tenant + type check | Issue only | UI | Geen product merge/delete |
| `catalogReview.syncDuplicateEanIssues` | `convex/catalogReview.ts` | `catalogDataIssues` | sync/review | tenantSlug | Tenant check | Active products gelezen, issues upsert | UI | Geen product merge/delete |
| `imports.createBatch` | `convex/imports.ts` | `productImportBatches` | create | tenantId, file/profile metadata | TenantId input | Batch | oudere API | Niet hoofd-UI |
| `imports.addPreviewRow` | `convex/imports.ts` | `productImportRows`, batch | create/update batch | tenantId, batchId, row data | Batch tenant expected | Batch rows | oudere API | Niet hoofd-UI |
| `imports.upsertProfile` | `convex/imports.ts` | `importProfiles` | upsert | tenantId, supplier/profile/mapping data | Existing by supplier/name | Profile | seed/tool | Geen |
| `imports.saveMapping` | `convex/imports.ts` | `productImportBatches` | update | tenantId, batchId, mapping | Batch tenant expected | Batch mapping | oudere API | Niet hoofd-UI |
| `catalog.createProduct` | `convex/catalog.ts` | `products` | create | tenantId, category/supplier/brand/collection/product fields | Category/supplier tenant check; duplicate import/article returns existing | Product | tool/API only | Geen UI productbeheer |
| `catalog.addPrice` | `convex/catalog.ts` | `productPrices` | create/update | tenantId, productId, price fields | Product tenant check | Product -> prices | tool/API only | No price delete |
| `customers.create` | `convex/customers.ts` | `customers` | create | tenantId and full customer fields | TenantId input | Customer | oudere API | Portal gebruikt `portal.*` |
| `customers.updateStatus` | `convex/customers.ts` | `customers` | status-change | tenantId, customerId, status | Customer tenant check | Customer status | older/API | Niet hoofd-UI |
| `customers.createContact` | `convex/customers.ts` | `customerContacts` | create | tenantId, customerId, contact fields | Customer tenant check | Contact | older/API | Portal gebruikt `portal.*` |
| `customers.markLoanedItemReturned` | `convex/customers.ts` | `customerContacts` | update | tenantId, contactId | Contact tenant check | returnedAt | older/API | Niet UI-aangesloten |
| `projects.create` | `convex/projects.ts` | `projects` | create | tenantId, customerId, title | Customer tenant check | Project | oudere API | Portal gebruikt `portal.*` |
| `projects.addRoom` | `convex/projects.ts` | `projectRooms` | create | tenantId, projectId, room fields | Project tenant check | Room | oudere API | Portal gebruikt `portal.*` |
| `projects.updateStatus` | `convex/projects.ts` | `projects` | status-change | tenantId, projectId, status | Project tenant check | Project timestamps | oudere API | Portal gebruikt `portal.*` |
| `projectWorkflowEvents.create` | `convex/projectWorkflowEvents.ts` | `projectWorkflowEvents` | create | tenantId, projectId, event fields | Project tenant check | Event | oudere/API | Portal gebruikt `portal.*` |
| `quotes.create` | `convex/quotes.ts` | `quotes`, project | create/status | tenantId, projectId, customerId, quote fields | Project/customer tenant check | Quote + project status | oudere API | Portal gebruikt `portal.*` |
| `quotes.addLine` | `convex/quotes.ts` | `quoteLines`, quote | create/update totals | tenantId, quoteId, optional product/service/room, line fields | Quote tenant check | Quote lines/totals | oudere/API | Mist extra relation checks voor optional refs; niet UI |
| `quotes.recalculate` | `convex/quotes.ts` | `quotes` | update totals | tenantId, quoteId | Quote tenant check | Quote totals | older/API | Veilig |
| `categories.create` | `convex/categories.ts` | `categories` | create/upsert | tenantId, name, slug, parent, sort | Existing slug patch | Category | seed/tool | Geen UI beheer |
| `suppliers.create` | `convex/suppliers.ts` | `suppliers` | create/upsert-ish | tenantId, supplier fields | Existing name patch | Supplier | older/API | Portal gebruikt `portal.*` |
| `suppliers.updateProductListStatus` | `convex/suppliers.ts` | `suppliers` | status-change | tenantId, supplierId, status | Supplier tenant check | Supplier status | older/API | Portal gebruikt `portal.*` |
| `serviceCostRules.create` | `convex/serviceCostRules.ts` | `serviceCostRules` | create | tenantId, category, calculation, price, vat | Category not fully rechecked in this wrapper | Service rule | seed/tool | Geen UI beheer |
| `quoteTemplates.upsert` | `convex/quoteTemplates.ts` | `quoteTemplates` | upsert | tenantId, template fields | Existing by tenant/type/name | Template | seed/tool | Existing quotes unaffected |
| `tenants.ensureTenant` | `convex/tenants.ts` | `tenants` | seed/upsert | slug, name | By slug | Tenant | seed/tool | Geen |
| `users.ensureUser` | `convex/users.ts` | `users` | seed/upsert | tenantId, external user, role | Existing external user | User | seed/tool | Geen |
| `seed.run` | `convex/seed.ts` | tenant/config/templates/profiles | seed/upsert | none | Hardcoded Henke tenant | Bootstrap config | seed/tool | Niet automatisch in build |
| `demoSeed.run` | `convex/demoSeed.ts` | demo customers/projects/quotes/etc. | demo seed/upsert | none | Hardcoded Henke tenant/demo names | Demo data | seed/tool | Niet automatisch in build |

Er zijn geen custom `action` of `internalAction` write exports gevonden buiten Convex generated helpers.

## Echte deletefunctionaliteit

| Functie | Pad | Bereik | Veiligheidscontrole | Beoordeling |
| --- | --- | --- | --- | --- |
| `portal.deleteQuoteLine` | `convex/portal.ts` | Een `quoteLines` record | `tenantSlug` -> tenant, line tenant check, daarna `recalculateQuote` | Functioneel veilig; UI mist confirm/undo |
| `catalogImport.resetCatalogChunk` | `convex/catalogImport.ts` | `productPrices`, `products`, `priceLists`, `productCollections`, `brands` per tenant | `confirm: v.literal("RESET_IMPORTED_CATALOG")`; script vereist nu `--confirm-reset-imported-catalog` | Destructieve maintenance tool; geen portal-UI; niet voor normale demo |

Geen andere Convex write block bevat `ctx.db.delete(`.

## Bewust ontbrekende deletefunctionaliteit

- `customers`: geen delete. Voorkomt orphan `projects`, `customerContacts`, `quotes`, `invoices`.
- `projects`: geen delete. Voorkomt orphan `projectRooms`, `measurements`, `quotes`, `workflowEvents`.
- `projectRooms`: geen delete. Voorkomt orphan `measurementRooms` en `quoteLines.projectRoomId`.
- `measurements`, `measurementRooms`, `measurementLines`: geen delete. Voorkomt auditverlies en quote-conversiebreuken.
- `quotes`: geen delete. Voorkomt orphan `quoteLines` en workflowhistorie.
- `suppliers`: geen delete. Voorkomt orphan products, price lists, import profiles en batches.
- `products` en `productPrices`: geen UI-delete. Alleen reset-tool verwijdert geimporteerde catalogustabellen.
- `categories` en `serviceCostRules`: geen UI-delete. Voorkomt product/template/service refs.
- `importProfiles`: geen delete. Voorkomt verlies van btw-mapping audit trail.
- `catalogDataIssues`: geen delete. Duplicate EAN issues worden gesynchroniseerd en gereviewd, niet verwijderd.
- Duplicate EAN product merge: ontbreekt bewust en is bevestigd in code/test.

## Updatefunctionaliteit

- Klant: alleen create in portal; oude `customers.updateStatus` bestaat maar is niet UI-aangesloten.
- Contact: alleen create in portal; oude retourstatus bestaat maar is niet UI-aangesloten.
- Project: status/timestamps via `updateProjectStatus`; workflowevents toevoegen via aparte mutation.
- Inmeting: metadata/status update; meetregels alleen statuswijziging, geen inhoudelijke edit/delete.
- Offerte: terms/paymentTerms update; regels toevoegen/verwijderen; geen metadata/statusbeheer in UI.
- Catalogus: update via import/upsert en price source keys, geen handmatige UI-edit.
- Leverancier: status update; geen volledige supplier edit/delete.
- Importprofielen: btw mapping/review/allowUnknown update.
- Offertesjablonen: alleen voorwaarden/betalingsafspraken in portal; seed/upsert kan volledige template bijwerken.

## Relatie- en orphan-risico's

| Relatie | Huidig gedrag | Risico | Advies |
| --- | --- | --- | --- |
| customer -> projects -> measurements/quotes/events | Geen customer delete | Laag | Behouden tot cascade/archiefbeleid bestaat |
| project -> projectRooms -> measurements/quoteLines | Geen project/projectRoom delete | Laag | Later soft-archive ontwerpen |
| project -> measurements -> measurementRooms/measurementLines | Geen delete | Laag | Later alleen met cascade of status archive |
| measurementLines -> quoteLines | Mark converted bewaart quote en quoteLine id | Middel bij partial failure | Atomische import mutation in latere fase |
| quotes -> quoteLines | Quote line delete herberekent totals | Laag technisch, middel UX | Confirm/undo toevoegen |
| suppliers -> products -> prices -> importProfiles/batches | Geen supplier/product UI-delete | Laag | Behouden |
| categories -> products/templates/service rules | Geen category UI-delete | Laag | Behouden |
| importBatches -> importRows -> products/prices | Geen UI-delete; reset delete alleen catalogusdata | Middel in maintenance | Reset alleen met expliciete flag; later ook issue/import-row cleanupstrategie |
| catalogDataIssues -> products | Duplicate issues kunnen productIds naar reset products bevatten | Middel na reset | Sync na reset of reset ook issues laten opschonen in aparte taak |
| quoteTemplates -> quotes | `createQuote` kopieert content naar quote | Laag | Behouden |

## Guardrailcontrole

| Guardrail | Status | Bewijs |
| --- | --- | --- |
| Tenant isolation | Bevestigd voor hoofd-UI mutations | `portal.*`, `measurements.*`, `catalogReview.*`, `catalogImport.*` checken tenant via slug/id |
| Project vereist klant | Bevestigd | `portal.createProject`, `projects.create` checken customer tenant |
| Offerte vereist project | Bevestigd | `portal.createQuote`, `quotes.create` checken project tenant |
| QuoteLine delete herberekent totalen | Bevestigd en getest | `portal.deleteQuoteLine` roept `recalculateQuote` aan |
| Measurement conversion vereist bevestiging | Bevestigd in UI | `MeasurementLinePicker` gebruikt selectie + confirm dialog |
| Converted measurementLine wordt verwerkt | Bevestigd en getest | `markMeasurementLineConverted` vereist ready en zet `converted` + ids |
| Geen automatische product/prijs/btw vanuit inmeting | Bevestigd en getest | `MeasurementLinePicker` zet `unitPriceExVat: 0`, `vatRate: 0` en waarschuwing |
| Import commit blokkeert bij errors | Bevestigd en getest | `commitPreviewBatchChunk` checkt `errorRows` |
| Import commit blokkeert duplicate source keys | Bevestigd en getest | `commitPreviewBatchChunk` checkt `duplicateSourceKeys` |
| Import commit blokkeert unknown btw zonder override | Bevestigd en getest | Tooling en mutation checken `unknownVatModeRows`/mapping |
| Productie-import blijft geblokkeerd bij unresolved btw mappings | Bevestigd | `tools/upload_catalog_batch_import.mjs` blokkeert profile columns en rows |
| Duplicate EAN review doet geen merge | Bevestigd en getest | Mutations patchen/insert alleen `catalogDataIssues` |
| QuoteTemplate update wijzigt bestaande offertes niet stil | Bevestigd en getest | `updateQuoteTemplateContent` patcht alleen `quoteTemplates`; `createQuote` kopieert tekst |
| Concept print muteert geen data | Bevestigd en getest | `QuoteDocumentPreview` gebruikt `window.print()` en geen Convex mutation |

## Testdekking

### Bestaand

- `npm run test:quote-document`: QuoteDocumentModel en QuoteDocumentPreview, inclusief conceptstatus, btw-label, manual-review waarschuwing en print CSS checks.
- `npm run test:calculators`: rekenhulpen voor inmeetmodule.
- `npm run test:portal`: route smoke tests.
- `npm run test:a11y`: route/a11y smoke tests.
- `npm run check` en `npm run build`: Astro/TypeScript/buildcontrole.

### Toegevoegd in deze audit

- `npm run test:workflow-guardrails`
- Bestand: `tools/test_workflow_mutation_guardrails.mjs`

Deze statische guardrailtest controleert:

- alleen `portal.deleteQuoteLine` en `catalogImport.resetCatalogChunk` doen hard delete;
- offertepost delete herberekent quote totals;
- catalog reset mutation heeft confirm literal en reset geen klanten/projecten/offertes;
- reset script vereist `--confirm-reset-imported-catalog`;
- meetregelconversie vereist `ready_for_quote` en zet converted ids;
- import commit blokkeert unknown btw, error rows en duplicate source keys;
- duplicate EAN review/sync doet geen product insert/delete/merge;
- templatecontent update patcht geen bestaande quotes;
- QuoteDocumentPreview gebruikt print zonder mutation;
- MeasurementLinePicker gebruikt bevestiging en neutrale prijs/btw placeholders.

### Testgaps

- Geen Convex integration tests met echte database transacties.
- Geen concurrency test voor dubbele meetregelconversie.
- Geen test dat `portal.addQuoteLine` + `markMeasurementLineConverted` atomisch falen, omdat dat nu geen atomische flow is.
- Geen UI-test voor accidental quote line delete confirm, omdat confirm nog ontbreekt.
- Geen permission/auth tests.
- Geen test voor reset-run tegen production/previews, behalve statische flag-test.

## Documentatiecheck

### Klantgerichte handleiding

Status: klopt met de werkelijke functionaliteit.

Bevestigd:

- Klant aanmaken bestaat; uitgebreide klant-bewerkflow of verwijderflow wordt niet geclaimd.
- Project vereist bestaande klant.
- Factuur aangemaakt en export naar boekhouder worden als dossiermomenten beschreven, niet als volledige flow.
- Meetregels worden pas na expliciete selectie/bevestiging naar offerte geladen.
- Product, prijs en btw moeten na inmeting handmatig in offerte gecontroleerd worden.
- Offertepost verwijderen wordt correct genoemd en totalenherberekening klopt.
- Catalogus is raadpleeg/search UI, geen volledige productbeheerflow.
- Leveranciers toevoegen en productlijststatus wijzigen klopt.
- Duplicate EAN waarschuwingen worden niet automatisch samengevoegd.
- Werkzaamheden en categorieen zijn raadpleegschermen.
- Volledige factuur/PDF/boekhoudflow wordt expliciet uitgesloten.

### Technische docs

Status: grotendeels correct.

Bevestigd:

- Technical map noemt route/component/function mapping correct.
- Inmeetmodule-docs benoemen geen product/prijs/btw keuze.
- PDF/offerte docs blijven read-only/browserprint en claimen geen server-side PDF.
- Release 0.1.1 noemt correct wat bewust niet is toegevoegd.
- Cleanup audit blijft geldig.

Aanvulling vanuit deze audit:

- Documenteer later de extra reset-script confirm-flag in importstraat docs als catalog reset actief gebruikt blijft worden.
- Documenteer later dat meetregelconversie nu functioneel veilig is in normale UI, maar technisch nog niet atomisch is.

## Bevindingen

### P0

Geen P0 gevonden na de reset-script fix.

### P1

1. **Gefixt: destructieve catalog reset had geen extra CLI-confirmatie.**
   `tools/reset_catalog_import.mjs` gaf de mutation-confirm zelf door. Het script vereist nu `--confirm-reset-imported-catalog`.

2. **Open: meetregel naar offerte is niet atomisch.**
   De UI voegt eerst een quoteLine toe en markeert daarna de meetregel converted. Bij falen tussen die stappen kan bronmetadata inconsistent worden. Voor interne demo acceptabel; voor productie een gecombineerde Convex mutation ontwerpen.

### P2

1. **Offertepost verwijderen mist bevestigingsdialoog.**
   Technisch veilig door totalenherberekening, maar UX-risico.

2. **Publieke lage-niveau write mutations blijven zichtbaar in Convex API.**
   Niet UI-aangesloten, maar voor productie hoort autorisatie/API-oppervlak gehard te worden.

3. **Catalog reset kan na bewuste flag nog review/import-row referenties achterlaten.**
   Als reset in maintenance wordt gebruikt, daarna duplicate issues/import rows opnieuw syncen of resetstrategie uitbreiden.

### P3

1. Project workflowknoppen zoals "Akkoord" maken dossiermomenten, maar wijzigen niet allemaal projectstatus. Documentatie noemt dossiermomenten correct; UI-labels kunnen later explicieter.
2. Uitgeleend item retour markeren bestaat in oude Convex module, maar niet in hoofd-UI. Documentatie is voorzichtig genoeg.
3. Import reset confirm-flag later opnemen in technische importstraat documentatie.

## Uitgevoerde fixes

- `tools/reset_catalog_import.mjs`: destructieve reset vereist nu `--confirm-reset-imported-catalog` voordat `.env.local` wordt geladen of een Convex mutation wordt uitgevoerd.
- `package.json`: script `test:workflow-guardrails` toegevoegd.
- `tools/test_workflow_mutation_guardrails.mjs`: statische guardrailtest toegevoegd.

Er is geen businessdata verwijderd en er zijn geen grote features gebouwd.

## Open punten

- Bouw later een atomische mutation voor "meetregels naar offerte laden" die quoteLine creatie en measurementLine converted status in een transactie afhandelt.
- Voeg later confirm/undo toe aan `deleteQuoteLine` in de UI.
- Harden productieauth/autorisatie rond alle exported Convex write functions.
- Beslis later of oude lage-niveau modules (`customers.ts`, `projects.ts`, `quotes.ts`, etc.) public API moeten blijven of intern/portal-only gemaakt moeten worden.
- Documenteer catalog reset flag in importstraat docs als reset onderdeel van onderhoud blijft.
- Ontwerp later soft-archive/cascadebeleid voor klanten, projecten, leveranciers, producten, categorieen en templates voordat deletefunctionaliteit wordt toegevoegd.

## Conclusie

**MUTATION/DELETE READY voor interne demo.**

De huidige portal heeft beperkte, doelbewuste write-functionaliteit. Echte delete is beperkt tot offerteposten en een expliciet afgeschermde maintenance reset. De belangrijkste guardrails rond inmeting, duplicate EAN, import/btw en template snapshots zijn bevestigd en nu deels automatisch geborgd met een guardrailtest.
