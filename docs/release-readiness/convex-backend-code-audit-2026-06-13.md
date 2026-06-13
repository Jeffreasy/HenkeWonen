# Convex-backend code-audit — Henke Wonen (2026-06-13)

> **Bron:** multi-agent statische audit van de Convex-backend (~17k regels, 31 modules), uitgevoerd via
> een geautomatiseerde workflow: 8 module-deepreads + 2 cross-cut passes (autorisatie/tenant-isolatie en
> schema/indexen/perf), gevolgd door **adversariële verificatie** van elke medium+ bevinding (elke claim
> apart geprobeerd te weerleggen) en synthese met deduplicatie.
> **Statistiek:** 75 ruwe bevindingen → 67 bevestigd / 8 weerlegd →
> 45 uniek na dedup. Verdeling (bevestigd, pre-dedup): {"medium":16,"low":33,"info":10,"high":7,"critical":1}.
> **Aard:** statisch (geen code uitgevoerd). Bevindingen citeren file:line. Verifieer kritieke fixes lokaal
> voordat je ze toepast. De machine-leesbare bevindingen staan in `convex-backend-code-audit-2026-06-13-findings.json`.

---

# Auditrapport — Henke Wonen portal (Convex-backend)

## Management-samenvatting

Deze statische audit van de Convex-backend (multi-tenant SaaS, prod-deployment `accomplished-kangaroo-354` met echte data) leverde **45 unieke, adversarieel-bevestigde bevindingen** op na deduplicatie. De algemene autorisatie-architectuur is solide: het token + tenant + rol-model wordt overal in de gewone CRUD-paden consistent en correct toegepast, met juiste tenant-scoping op alle reads/writes — er is **geen actief cross-tenant datalek aangetroffen**. De zwaartepunten liggen elders: één **kritieke** bevinding (een publieke, ongeauthenticeerde tenant-wipe achter alleen een env-vlag), een cluster **high**-bevindingen rond (a) prod-veiligheid van seed/tooling-mutaties zonder actor-auth, (b) full-table `.collect()` op de grote catalogus-tabellen (~25k producten / ~74k prijsregels) die op prod-volume de Convex read-limiet overschrijden en hard falen, en (c) twee correctheids-/geldbevindingen in de prijs- en facturatie-pijplijn (prijs-rehang bij dedup, en factuurtotalen die ongecontroleerd van de client worden vertrouwd). Daarnaast een laag van validatie- (`v.any()`, ontbrekende numerieke ondergrenzen), prijs-correctheids-, en codebase-brede error-handling-bevindingen (geen enkel gebruik van `ConvexError`, waardoor alle gebruikersgerichte foutteksten op prod als generieke "Server Error" maskeren).

### Telling per severity

| Severity | Aantal |
|---|---|
| Critical | 1 |
| High | 6 |
| Medium | 12 |
| Low | 19 |
| Info | 7 |
| **Totaal** | **45** |

### Telling per dimensie

| Dimensie | Aantal |
|---|---|
| perf | 13 |
| prod-safety | 6 |
| validation | 7 |
| correctness | 8 |
| authz | 5 |
| error-handling | 1 (codebase-breed, samengevoegd) |
| schema-index | 5 |
| tenant-isolation | 1 |

---

## CRITICAL

### [critical · authz] `clearTenantData` — publieke, ongeauthenticeerde cross-tenant data-wipe
**`convex/beheer/clearTenantData.ts:56-87`** (samengevoegd met AT-1, deels CI-09)

**Probleem.** `clearTenantData` is een **publieke** Convex `mutation` (her-geëxporteerd via `portal.ts:244`) met als enige beveiliging `requireConvexToolingEnabled("clearTenantData")` (env `ALLOW_CONVEX_TOOLING==="true"`) plus de in de broncode hardcoded `confirmPhrase` `"JA_VERWIJDER_TESTDATA"`. Er is **geen actor-token, geen rolcheck en geen binding aan de tenant van de aanroeper** — de doel-tenant komt uit de vrije `tenantSlug`-arg en wordt via `by_slug` opgezocht.

**Impact.** Zodra de env-vlag op prod aanstaat (een gedocumenteerd, bewust scenario — `tools/bootstrap_production_base.mjs:107-113` zet hem tijdens reparaties tijdelijk op `true`), kan elke aanroeper die de Convex-URL kent **alle transactionele data van élke tenant wissen**: measurements/rooms/lines, quoteLines/quotes/invoices/supplierOrders, projectTasks/workflowEvents/projects, customerContacts/customers (regels 89-149). Voor de 31 prod-tenants is dit een volledige per-tenant data-wipe. De confirmPhrase is een publieke constante en blokkeert alleen per ongeluk, niet kwaadwillig.

**Fix.** Eis een admin-actor-token van **dezelfde** tenant via `requireMutationRole(ctx, tenantSlug, actor, ["admin"])` (bindt de target aan de aanroeper), **én** voeg een harde prod-deployment-guard toe (zie ook beheer-tooling-gate-no-prod). Overweeg `internalMutation` zodat de functie niet client-aanroepbaar is.

---

## HIGH

### [high · prod-safety] `seed.run` en `demoSeed.run` zijn publieke mutaties zonder actor-/rolcheck
**`convex/seed/core.ts:936-939`**, **`convex/seed/demo.ts:441-444`** (samengevoegd: seed-1, seed-2, AT-1)

**Probleem.** Beide `run`-functies zijn publieke `mutation`s (`_generated/server.d.ts:52` bevestigt de builder als `"public"`) met als enige gate `requireConvexToolingEnabled(...)` — geen actor-token, geen admin-rol. `demoSeed.run` schrijft herkenbare demo-records ("Demo - Familie De Vries", quotes `DEMO-OFF-2026-001/002`) naar de **hardcoded prod-tenant `henke-wonen`**.

**Impact.** Bij open tooling-vlag op prod kan een ongeauthenticeerde aanroeper de tenantconfig overschrijven (suppliers, serviceCostRules, quoteTemplate, importProfiles) of demo-vervuiling tussen de 31 echte klanten injecteren. Idempotent/single-tenant, dus pollutie/overschrijven (geen wipe) — daarom high, niet critical.

**Fix.** Maak beide `internalMutation` (niet client-aanroepbaar). Demo-data hoort sowieso niet op de prod-tenant: gebruik een aparte demo-slug of een deployment-naam-guard. Als publiek vereist: voeg actor-token + admin-rolcheck toe.

### [high · perf] `validateCatalog` doet full-table `.collect()` over products (~25k) + productPrices (~74k)
**`convex/catalog/validation.ts:58-83`** (samengevoegd: CRM-4, PERF-1)

**Probleem.** In één `Promise.all` worden zes tabellen volledig via `.withIndex("by_tenant").collect()` geladen — inclusief productPrices (~74k) en products (~25k) — plus per importbatch nóg een `.collect()` op productImportRows (regel 317-321, N+1).

**Impact.** Convex heeft een harde leeslimiet (~16.384 docs / 8 MiB per query). Bij ~74k prijsregels overschrijdt deze query de limiet en **faalt hard op precies de prod-tenant die hij hoort te auditen**. Admin-only/read-only, geen datalek — daarom high i.p.v. critical, maar de feature is op prod-volume niet-functioneel.

**Fix.** Maak de auditquery cursor-/paginatie-gebaseerd (zoals `supplierProductAudit` in `maintenance.ts` al doet), of bouw incrementele tellers. Vermijd de per-batch `.collect()` door aggregatie via index/teller.

### [high · perf] `getCatalogImportStats` en `getSupplierCatalogStats` collecten products + productPrices volledig
**`convex/catalog/import.ts:1139-1183` (getCatalogImportStats, exact-tak)** en **`1195-1211` (getSupplierCatalogStats)** (samengevoegd: CI-1, PERF-3, PERF-4)

**Probleem.** De helper `collectByTenant()` (import.ts:35-40) doet onbegrensd `.collect()`. `getCatalogImportStats` (niet-summary tak) collect t products + productPrices, waarbij de ~74k prijs-collect **alleen voor `productPrices.length`** wordt gebruikt (regel 1176) — een full-table-scan voor een telling. `getSupplierCatalogStats` collect t de hele products- én productPrices-tabel en filtert pas daarna in geheugen op één leverancier, terwijl de index `products.by_supplier` precies deze selectie zou doen.

**Impact.** Gegarandeerde overschrijding van de Convex read-limiet op prod → de queries falen. Contrast: de summary-tak vermijdt de prijs-collect bewust, en `getProductCount`/`listCategoryStats` gebruiken een cap/truncatie — die mitigatie ontbreekt hier.

**Fix.** Verwijder de full `productPrices.collect()` (gebruik een incrementele teller of laat de exacte prijstelling weg). Voor supplier-stats: zoek supplier-id en gebruik `products.withIndex("by_supplier", ...)` + per-product `by_product`. Voor productaantallen: hergebruik `getProductCount`/`listCategoryStats`.

### [high · correctness] Prijs-dedup op `(tenantId, sourceKey)` zonder `productId` kan een prijs naar een ander product verhangen
**`convex/catalog/import.ts:422-463`** (ook `core.ts:798-828`, `addPrice`) — **CI-2**

**Probleem.** Een bestaande prijs wordt gezocht via index `by_source_key = [tenantId, sourceKey]` en bij match ge-patcht met de nieuwe `productId`, **zonder te verifiëren dat `existingPrice.productId === productId`**. `sourceKey` is optioneel en niet product-uniek (de eigen audits `validation.ts:232-250` en `productionAudit.ts:315-318` rapporteren expliciet `duplicateSourceKeys` over meerdere producten — dus de collisie komt in prod-data voor).

**Impact.** Geld-gerelateerd correctheidsrisico: bij her-import waarbij de product-identiteit wijzigt maar `sourceKey` stabiel blijft, wordt de prijs van het oorspronkelijke product stil herhangen aan het nieuwe product → verkeerde prijskoppeling / verweesde prijs in geoffreerde bedragen. De preview-guard (`commitPreviewBatchChunk` weigert bij `duplicateSourceKeys > 0`) dekt alleen duplicaten *binnen* één import, niet tegen reeds-opgeslagen prijzen; `importRows` en `core.ts addPrice` hebben geen guard.

**Fix.** Neem `productId` mee in de dedup: voeg index `by_product_source_key = [tenantId, productId, sourceKey]` toe, of valideer dat de gevonden prijs dezelfde `productId` heeft vóór patchen (anders insert). Garandeer dat de normalizer `sourceKey` product-specifiek opbouwt.

### [high · correctness] `createInvoice` vertrouwt client-aangeleverde geldtotalen zonder hercontrole
**`convex/facturen/core.ts:166-226`** — **OF-1**

**Probleem.** `subtotalExVat`, `vatTotal` en `totalIncVat` komen als `v.number()`-args binnen en worden ongewijzigd in `invoices` ingevoegd (regels 209-211). Geen `invoiceLines`-tabel, geen hercomputatie, geen interne-consistentiecheck (`totalIncVat === subtotalExVat + vatTotal`), geen niet-negatief-check, geen spiegeling tegen de offerte. Rol `user` kan een factuur met willekeurige bedragen aanmaken.

**Impact.** Direct geld-/data-integriteitsrisico via een publieke money-mutatie (her-geëxporteerd via `portal.ts:243`). Breekt het eigen patroon: quotes herberekenen server-side via `recalculateQuote`, en `createInvoiceFromQuote` leidt totalen correct af. Authz/tenant-scope zijn wél correct; de UI gebruikt momenteel alleen `createInvoiceFromQuote`, dus het kwetsbare pad is reachable-maar-ongebruikt — daarom high, niet critical.

**Fix.** Bereken de totalen server-side uit een offerte/regelbron, of valideer minimaal interne consistentie + niet-negatieve bedragen vóór insert.

### [high · prod-safety] `seed/core.ts` deactiveert import-profielen buiten de hardcoded lijst (destructieve config-side-effect)
**`convex/seed/core.ts:1248-1264`** — **seed-3** *(bevestigd medium; opgenomen hier bij prod-safety-cluster — zie tabel: dit item telt als medium)*

> Opmerking: dit is een medium-bevinding; voor de leesbaarheid zie het bij MEDIUM hieronder.

---

## MEDIUM

### [medium · prod-safety] `requireConvexToolingEnabled` maakt geen onderscheid tussen prod en dev
**`convex/authz.ts:234-240`** — **beheer-tooling-gate-no-prod**

De enige gate is `process.env.ALLOW_CONVEX_TOOLING !== "true"`. Geen deployment-aware check (geen `CONVEX_CLOUD_URL`/`NODE_ENV`/deployment-naam). Dit is de gedeelde, load-bearing gate van `clearTenantData`, `seed.run` en `demoSeed.run`. Als de vlag ooit op prod `true` staat, staat alleen een statische confirmzin (of niets) tussen een operator en prod-data. **Fix:** voeg een deployment-aware harde guard toe of een prod-specifieke tweede bevestiging, los van de algemene vlag.

### [medium · prod-safety] Destructieve catalogus-bulk-delete/reset-mutaties zonder prod-guard of audit
**`convex/catalog/import.ts:1255-1314` (deleteProductsByCategoryChunk), `1321-1380` (deleteProductsBySupplierChunk), `1382-1425` (resetCatalogChunk)** — **CI-5**

Drie admin-only + confirm-literal mutaties verwijderen producten + prijzen (reset ook priceLists/collections/brands) hard, batchgewijs. Anders dan álle andere destructieve operaties in de codebase roepen ze **geen** `requireConvexToolingEnabled` aan en loggen ze geen actor/aantallen; `resetCatalogChunk` is bovendien ongescoped op leverancier/categorie. **Fix:** voeg de tooling-gate/prod-bevestiging toe (consistent met `clearTenantData`), log actor + counts naar een audit-tabel, overweeg soft-delete.

### [medium · prod-safety] `seed.run` deactiveert niet-hardcoded import-profielen
**`convex/seed/core.ts:1248-1264`** — **seed-3**

Na het upserten zet de seed elk import-profiel dat niet exact `supplierName::name` in de hardcoded array (~10 leveranciers) matcht op `status: "inactive"` — terwijl de tenant ~28 leveranciers heeft en admins via `upsertProfile` (ongated) eigen profielen aanmaken. Eén per ongeluk uitgevoerde `seed.run` (tooling aan) schakelt productie-importprofielen stil uit; geen confirmzin. De seed is dus niet puur additief/idempotent. **Fix:** maak deactiveren opt-in (`deactivateUnknownProfiles: boolean = false`) of return/log welke profielen geraakt zouden worden zonder te muteren; documenteer dit gedrag.

### [medium · correctness] `getIndicativePrice` filtert niet op `product.status` — inactieve/archived/draft producten leveren toch een richtprijs
**`convex/catalog/pricing.ts:29-47`** — **CP-2**

`getIndicativePrice` (en `requireSelectableProduct` in `measurements.ts`) checkt alleen tenant-match + `pilotHiddenReason`, niet `product.status`, terwijl `pickerSearch.ts:141-143` producten wél op `normalizedStatus === "active"` filtert. Een product dat de picker verbergt kan via een direct `getIndicativePrice`/`addMeasurementLine`-pad alsnog met richtprijs in een offerte komen. Dezelfde status-blindheid zit in `validateQuoteLineProduct` (`offertes/core.ts:290-313`, `portalUtils.ts:807-830`), dus een niet-actief product kan zelfs direct op een offerte landen. **Fix:** voeg een status-check toe in `getIndicativePrice`, `requireSelectableProduct` én beide `validateQuoteLineProduct`-implementaties, consistent met de picker.

### [medium · correctness] Picker toont `priceExVat` zonder bijbehorende `priceUnit` — pak-/rolprijs verschijnt als kale eenheidsprijs
**`convex/catalog/pickerSearch.ts:250-294`** — **CP-3**

`selectCustomerFacingPrice` (`pricingRules.ts:241-263`) negeert `priceUnit`; pickerSearch geeft `unitPriceExVat` terug met `product.unit` maar **laat de `priceUnit` van de gekozen prijsregel weg**. Een 'pack'/'roll'-prijs bij een 'm2'-product verschijnt zo zonder signaal. Frontend bevestigt de impact: `QuoteLineEditor.applyProduct` zet `unit=product.unit` én `unitPriceExVat=product.priceExVat`, waardoor een pakprijs als m²-eenheidsprijs wordt voorgevuld → fout regeltotaal (corrigeerbaar door de gebruiker, daarom medium). **Fix:** geef `priceUnit` mee in het picker-item, of laat `selectCustomerFacingPrice` alleen prijzen kiezen waarvan `priceUnit` met `product.unit` overeenkomt.

### [medium · correctness] `updateProfileVatMode` matcht kolom via OR (naam óf index) — kan verkeerde btw-kolom overschrijven
**`convex/catalog/review.ts:348-363`** — **CRM-1**

`const matches = header === args.sourceColumnName || sourceColumnIndex === args.sourceColumnIndex;` — de OR matcht elke kolom met dezelfde header óf dezelfde index, terwijl de bulk-variant (`columnMatches`, regel 105-108) bewust een **AND** gebruikt. Bij divergente arrays (`priceColumnMappings` vs `mapping.priceColumns`) of dubbele headers kan de btw-modus van een ongerelateerde kolom gewijzigd worden → directe incl/excl-geldfout. Latent (vuurt niet op de huidige uitgelijnde seed-data), daarom medium. **Fix:** gebruik dezelfde AND-match / hergebruik `columnMatches`.

### [medium · perf] `productionAudit.run` doet full-table `.collect()` over products + productPrices
**`convex/catalog/productionAudit.ts:72-102`** — **CRM-5, PERF-2**

Zelfde structuur als `validateCatalog`: `Promise.all` met `.collect()` over zeven tabellen, daarna meerdere O(n) full passes over alle ~74k prijzen en ~25k producten. Overschrijdt op prod de read-limiet (admin-only/read-only, daarom medium). **Fix:** cursor/paginatie of incrementele aggregatie; beperk samples via index-scans i.p.v. volledige tabellen in geheugen.

### [medium · perf] `getBatch.rows` doet ongepagineerde `.collect()` van alle importrijen
**`convex/catalog/imports.ts:168-179`** — **CI-6**

`getBatch` collect t alle `productImportRows` van een batch zonder cap, terwijl de sibling `getBatchForPortal` (regel 481) wél begrenst met `.take(min(max(rowLimit,25),1000))`. Een grote prijslijst-import (duizenden vette `raw`/`normalized`-rijen) kan de read-limiet raken. (De batch-lijst-`.collect()` in dezelfde functie is een kleiner, secundair punt.) **Fix:** cap/pagineer `getBatch.rows` zoals `getBatchForPortal`.

### [medium · validation] Meetwaarden worden zonder numerieke validatie opgeslagen en niet server-side herberekend
**`convex/projecten/measurements.ts:523-594, 631-723`** — **PROJ-2**

`addMeasurementLine`/`updateMeasurementLine` accepteren `quantity: v.number()`, `wastePercent`, en afmetingen (`widthM`/`lengthM`/...) zonder ondergrens en slaan ze ongewijzigd op; de berekening is volledig client-side. Geen check op negatief/NaN/Infinity (Convex `v.number()` accepteert NaN/±Infinity). De waarden stromen via `importMeasurementLinesToQuote` door naar offerte-/factuurregels — en `offertes/core.ts:addLine` + `calculateLineTotals` (`portalUtils.ts:195-214`) clampen evenmin. Authz/tenant-scope correct (alleen interne, bevoegde gebruiker kan eigen-tenant-data vervuilen), daarom medium. **Fix:** valideer `quantity >= 0`, `0 <= wastePercent <= grens`, afmetingen `> 0`, en `Number.isFinite`; overweeg server-side herberekening van `quantity`.

### [medium · validation] Geen validatie op negatieve `quantity`/`vatRate`/`unitPrice`/`discount` in offerteregels
**`convex/offertes/core.ts:176-206` (ook `493-497`, `903-905`)** — **OF-5**

Kale `v.number()` zonder ondergrens of vatRate-whitelist op alle drie de schrijf-paden. `calculateLineTotals` clampt niet: een negatieve `quantity`/`unitPrice` of een vatRate buiten {0,9,21} propageert via `recalculateQuote` naar de offerte- en factuurtotalen. (Het systeem ondersteunt bewust kortingsregels, dus niet élke negatieve waarde is fout — maar negatieve quantity/unitPrice en illegale vatRate wel.) **Fix:** valideer ondergrenzen + vatRate-set.

### [medium · perf] `validateCatalog`/review-queries — zie ook CRM-6 (low) en de high-versie hierboven
*(reeds gedekt; geen apart medium-item)*

---

## LOW

### Error-handling (codebase-breed) — geen enkel gebruik van `ConvexError`
**`convex/authz.ts:125-192`** + alle units: `catalog/import.ts`, `catalog/pricing.ts`, `catalog/maintenance.ts`, `catalog/review.ts`, `projecten/core.ts`, `projecten/measurements.ts`, `beheer/customers.ts`, `seed`-gate (samengevoegd: CI-01, CP-5, CI-4, CRM-3, PROJ-4, beheer-error-not-convexerror, seed-6)

**Probleem.** Een repo-brede grep op `ConvexError` levert **nul** treffers. Alle fouten — ook duidelijk gebruikersgerichte NL-meldingen ("Geen rechten voor deze wijziging.", "Ruimte is al gebruikt…", "Btw-mapping ontbreekt…", "Dit product is in de pilot niet beschikbaar.", "Product/Customer not found") — worden als gewone `Error` gegooid. Convex maskeert op **productie** de tekst van een gewone `Error` als generiek "Server Error"; alleen `ConvexError` exposeert detail.

**Impact.** De frontend kan een 403/rolfout niet onderscheiden van een echte serverfout; bewust geschreven NL-feedback (inclusief de bedoelde uitleg waarom een import/reparatie wordt geweigerd) bereikt de eindgebruiker/operator op prod niet → slechte UX en moeizame support.

**Fix.** Gebruik `ConvexError` (uit `convex/values`) met een gestructureerde payload (bv. `{ code: 'forbidden' | 'unauthenticated' | 'not_found' | 'validation' }`) voor alle gebruikersgerichte fouten in `authz.ts`, de gate `requireConvexToolingEnabled`, en de portal-/catalog-/projecten-/beheer-laag. Houd gewone `Error` alleen voor echte interne invarianten.

### [low · authz] Dev-auth-bypass leunt uitsluitend op het ontbreken van `AUTHZ_TOKEN_SECRET`; dev-tokens zijn ongetekend
**`convex/authz.ts:82-128`** — **CI-02** *(bevestigd medium; geplaatst onder authz; zie severity-tabel als medium)*

Bij ontbrekend `AUTHZ_TOKEN_SECRET` + `ALLOW_DEV_AUTHZ_TOKENS` accepteert `verifyToken` elk token dat aan een puur tekstueel patroon voldoet (`dev.`-prefix, juiste kind/slug, `dev-`-prefix `externalUserId`) — geen handtekening. Vandaag onbereikbaar in prod (secret is gezet), dus defense-in-depth-gap, niet actief lek. **Fix:** harde prod-guard die dev-tokens onvoorwaardelijk weigert; ontbrekend secret in prod = fail-closed, nooit een pad naar de dev-bypass.

### [low · validation] Import-mutaties accepteren `v.any()` voor rows/mapping
**`convex/catalog/import.ts:482-487, 739-745, 831-837, 675-688`** — **CI-3**

`importRows`/`appendPreviewRows`/`savePreviewMapping` accepteren willekeurige payloads; alle normalisatie via losse type-guards. Het schema dwingt de unions wél af bij insert, dus geen bad-enum-persistentie — maar één rotte rij laat de hele atomic batch falen (robuustheid/DX). Admin-only. **Fix:** clamp `priceType`/`priceUnit`/`vatMode`/`unit` naar toegestane literals of valideer-en-skip per rij.

### [low · validation] Talrijke `v.any()`-velden in het schema
**`convex/schema.ts:414, 549-550, 573-574, 622, 730-731, 831, 943-958, 982`** — **CI-05**

Kerntabellen gebruiken `v.any()` (o.a. `products.attributes`, `measurementLines.input/result`, `quoteLines.metadata`, de `importProfiles`-strategieën). De alarmerende claim dat `measurementLines.input/result` de calculators voeden is weerlegd (ze worden server-side nergens gelezen). Resterend: generieke validatie-/DX-hygiene. **Fix:** vervang door expliciete `v.object(...)` waar de vorm bekend is; gebruik `v.record(...)`/handmatige validatie waar echt dynamisch.

### [low · validation] `v.any()` op `measurementLines.input/result` in de mutatie-args
**`convex/projecten/measurements.ts:531-532, 639`** — **PROJ-3**

Idem; deze velden zijn write-only audit/scratch-snapshots, nooit teruggelezen in geldberekeningen (de offerte-conversie gebruikt uitsluitend getypeerde velden). Type-hygiene-nit. **Fix:** discriminated union per `calculationType` of validatie in de handler.

### [low · validation] `serviceCostRules.metadata` is `v.any()`
**`convex/beheer/serviceCostRules.ts:51, 67`** — **beheer-servicecost-vany**

Admin-only, inert (wordt nergens gedeserialiseerd of in `listServiceRules` teruggegeven). Validatie-hygiene. **Fix:** `v.object(...)` met verwachte velden.

### [low · validation] Ongebonden invoer-arrays + N+1 in `syncDuplicateEanIssues`
**`convex/catalog/review.ts:755-761`** — **CRM-7**

Alleen `syncDuplicateEanIssues` heeft de echte kern: `groups` ongebonden met per-group geneste db-queries en geen server-side lengtelimiet (de tool chunkt al op ≤100, maar dat is client-side). De N+1-claim voor `bulkUpdateProfileVatModes`/`markProfileVatColumnsReviewed` is feitelijk onjuist (één get + één patch). Admin-only; oversized batch faalt/rolt terug. **Fix:** server-side max-batch-cap op `syncDuplicateEanIssues`.

### [low · validation] `catalogDataIssues.metadata` is `v.any()` en wordt ongevalideerd teruggelezen/samengevoegd
**`convex/catalog/review.ts:658-660, 707-713`** — **CRM-8**

`metadata` wordt vrij uitgelezen en met `...(issue.metadata ?? {})` weggeschreven; leunt op `Array.isArray`-checks maar valideert het schema niet. **Fix:** expliciete `v.object(...)`-shape of validatie bij lezen.

### [low · authz] User-lookup via globale index `by_external_user` + `.first()` i.p.v. tenant-gescopet
**`convex/authz.ts:181-188`** — **CI-04**

`requireMutationRole` zoekt globaal en checkt daarna `user.tenantId !== tenant._id` (geen lek, wel een correctheidsbug-latentie bij dubbele `externalUserId`; `ensureUser` blokkeert dat in de praktijk). **Fix:** samengestelde index `by_tenant_external_user = [tenantId, externalUserId]`.

### [low · authz] Token-verificatie valideert `exp` maar niet `iat`/`nbf` en mist payload-vormvalidatie
**`convex/authz.ts:143-153`** — **CI-08**

`JSON.parse` + cast zonder runtime-vormcheck; alleen `exp <= now` wordt gecheckt (NaN-vergelijkingen kunnen stil slagen). HMAC dekt manipulatie af, dus hardening, geen acuut lek. **Fix:** valideer `typeof exp === 'number'`, kind/tenant/sub aanwezig; overweeg kleine klokskew-marge.

### [low · authz] Field-mode (`workspaceMode`) wordt server-side niet afgedwongen
**`convex/projecten/fieldService.ts:331-572`** (en alle projecten-mutaties) — **PROJ-1, AT-3**

`users.workspaceMode` bestaat en wordt geschreven, maar **nergens gelezen** voor een autorisatiebeslissing; field-queries staan alle rollen toe. De echte toegangsgrens (token + tenant + rol) is overal intact en er is geen cross-tenant lek; of "field-actors general-mutaties weigeren" een echt beleid is, staat niet vast (dood autorisatieveld + ongebruikte validator). **Fix:** lees `workspaceMode` in de role-helpers en dwing `requireWorkspaceMode('field')` af op field-only handlers, óf documenteer expliciet dat de mode niet-autorisatief (UI-cosmetisch) is.

### [low · perf] Dashboard collect t volledige tenant-tabellen (customers/projects/quotes)
**`convex/portal.ts:22-47`** — **CI-06**

Onbegrensd `.collect()` op een hoogfrequent reactief endpoint. De actionable winst is vooral bij `quotes` (alleen draft/sent nodig via `by_status`); customers/projects worden ook als id-maps gebruikt. **Fix:** gebruik status-indexen voor quotes; vermijd materialiseren van complete tabellen voor een samenvatting.

### [low · perf] `nextInvoiceNumber` fallback doet full `.collect()` van alle invoices
**`convex/portalUtils.ts:135-144`** — **CI-07**

Bij cache-mismatch leest de fallback alle facturen en parset elk nummer op het kritieke factuur-aanmaakpad. (De race-veiligheid zelf is OK via Convex OCC — zie weerlegging.) **Fix:** begrens de fallback via een index/laatste-N; behandel de collect als eenmalige migratie/herstel.

### [low · perf] `listProducts` `.collect()` zonder paginatie; `listProductsForPortal` N+1 prijs-lookups
**`convex/catalog/core.ts:126-165, 480-487`** — **CI-8**

`listProducts` collect t zonder cap; `listProductsForPortal` doet per product een aparte `productPrices.by_product`-collect (tot pageSize=500). Begrensd door pageSize, dus niet kritiek. **Fix:** `take()`-cap op `listProducts`; voorberekende `preferredPrice` of gerichtere fetch om de N+1 te vermijden.

### [low · perf] `fieldServiceWorkspace` fan-out van quotes/measurements/tasks per project
**`convex/projecten/fieldService.ts:357-406`** — **PROJ-6**

Drie `.collect()`-queries per actief project via `Promise.all`, schaalt met aantal actieve dossiers, geen bovengrens. **Fix:** paginatie/limiet op kaarten of gerichtere aggregatie.

### [low · perf] Review-queries collecten kleine tabellen volledig (`by_type_status` ongebruikt)
**`convex/catalog/review.ts:234-250, 572-588, 901-912, 1008-1023`** — **CRM-6**

`.collect()` op `importProfiles`/`categories`/`catalogDataIssues`/batches. Let op: `catalogDataIssues.issueType` is een single-valued union (`duplicate_ean`), dus de aanbevolen `by_type_status`-swap narrowt vandaag niets en de JS-filter is een no-op. Forward-looking schaalobservatie op kleine admin-tabellen. **Fix:** overweeg paginatie als deze tabellen groeien.

### [low · perf] Delete-chunks: per product onbegrensd `.collect()` van alle prijzen
**`convex/catalog/import.ts:1291-1301, 1357-1365`** — **PERF-6**

Per product alle `productPrices.by_product.collect()` zonder `.take()`; bij een product met zeer veel prijsregels + grote batchSize (max 500) richting de limiet. Admin-only chunked delete. **Fix:** `.take()` + lus, of prijzen als eigen delete-chunk-stap.

### [low · perf] `deleteProductsBySupplierChunk` gebruikt `by_tenant` + `.filter(supplierId)` i.p.v. `by_supplier`
**`convex/catalog/import.ts:1344-1348`** — **PERF-5** *(bevestigd medium; perf op grote tabel)*

`.filter()` draait ná de index op gelezen rijen, dus full-scan-achtig gedrag tot de batch vol is; de index `products.by_supplier = [tenantId, supplierId]` bestaat al. Admin-only migratie-tool. **Fix:** `.withIndex("by_supplier", q => q.eq("tenantId", …).eq("supplierId", …)).take(batchSize)`.

### [low · perf] `.collect()` zonder paginatie op beheer-tenant-tabellen
**`convex/beheer/customers.ts:46-51, 267-271`** — **beheer-collect-tenant-tables**

`list*/listSuppliers/listCategories/listServiceRules` collecten de volledige tenant-set; `listSuppliers` doet per leverancier extra queries (N+1). Volume klein, schaalbaarheidspunt. **Fix:** `.paginate()`/limieten; heroverweeg per-leverancier-aggregatie.

### [low · perf] Search-index `search_products` benut `categoryId`/`status`-filterFields niet
**`convex/catalog/pickerSearch.ts:172-202`** — **CP-4**

Filtert alleen op `tenantId`; categorie/status pas client-side in `consider()`, waardoor relevante categorie-treffers buiten de top-150 kunnen vallen. **Fix:** voeg `.eq("status","active")` en, bij één-categorie-filter, `.eq("categoryId", id)` toe aan de search-eq.

### [low · correctness] `fallbackImportKey` kan instabiel zijn tussen runs → duplicaat-producten
**`convex/catalog/import.ts:276-304, 306-323`** — **CI-9**

Zonder natuurlijke code valt de identiteit terug op samengestelde velden (naam/kleur/width/unit); een lichte wijziging bij her-import → geen match → duplicaat. **Fix:** verkies een stabiele `rowHash` van de normalizer of normaliseer (trim/lowercase/afronding) consistent; monitor `productsWithoutSupplierCode`.

### [low · correctness] `updateInvoiceStatus` naar `paid` verzoent `paidAmount` niet
**`convex/facturen/core.ts:334-384`** — **OF-3**

Status `paid` zonder `paidAmount` bij te werken (inconsistent met `markInvoicePaid`); geen guard vanuit `cancelled`. UI routeert "paid" altijd via `markInvoicePaid` en sluit `paid` aggregaten uit, dus impact cosmetisch/contained. **Fix:** zet `paidAmount` bij `paid` (of weiger die status hier) en guard `cancelled`.

### [low · correctness] `updateProject` staat vrije statuswijziging buiten de workflow om toe
**`convex/projecten/core.ts:343-386`** — **PROJ-7**

`status` wordt direct gepatcht zonder timestamps/workflow-events/invarianten (anders dan `updateProjectStatus`/`processProjectAction`). Een client kan naar `invoiced`/`paid`/`closed` zetten zonder factuur/offerte. **Fix:** verwijder `status` uit `updateProject` of pas dezelfde invariant-/timestamp-logica toe.

### [low · prod-safety] `syncDuplicateEanIssues` heropent als `resolved` gemarkeerde issues zonder dryRun/confirm
**`convex/catalog/review.ts:864-889`** — **CRM-9**

`status: existing.status === "resolved" ? "open" : existing.status` overschrijft een handmatige beslissing automatisch; geen confirm/dryRun. Herstelbaar, daarom low. **Fix:** respecteer handmatige `resolved`/`accepted`, of voeg dryRun/confirm + statuswijziging-logging toe.

### [low · prod-safety] Demo-seed schrijft fictieve `createdByExternalUserId: "demo-seed"`
**`convex/seed/demo.ts:6, 172, 259, 303, 366`** — **seed-4**

Geen echte `externalUserId`; vervuilt audit-velden van prod-data als demo ooit op de prod-tenant draait. **Fix:** gebruik een herkenbare `system:`-actor en houd demo-data in een aparte tenant.

### [low · correctness] Tenant-fallback `as const` levert een partieel pseudo-document
**`convex/seed/core.ts:942-957`** — **seed-5**

Bij ontbrekende tenant wordt een object met alleen `_id` gecast naar het tenant-type (type-leugen; toekomstige `tenant.slug`/`status`-reads → `undefined` zonder compile-fout). **Fix:** splits insert + `ctx.db.get(id)`, of hergebruik `ensureTenant`.

### [low · correctness] vatRate-fallback naar 21 zonder ondergrens-validatie
**`convex/catalog/pricingRules.ts:114-135, 270-280`** — **CP-6** *(info; geplaatst hier voor zichtbaarheid)*

`row.vatRate ?? 21` zonder plausibiliteitscheck; een `vatRate=0`/datafout (bv. 2100) geeft een incl-prijs gelijk aan ex zonder waarschuwing. Gezien de bekende inconsistente btw-stand vermeldenswaard. **Fix:** plausibiliteitscontrole (`0 < vatRate <= 30`) in `isCustomerFacingRow`/`normalizeVat`, anders regel overslaan.

### Schema-index — dode/ongebruikte indexen

- **[low · schema-index] products: `by_ean`, `by_brand`, `by_collection`** — **IDX-1** — `convex/schema.ts:435, 429, 430`. Gedefinieerd maar nooit via `withIndex` gebruikt op de zwaarst-geschreven tabel (~25k, import patcht alle rijen) → schrijf-overhead. **Fix:** verwijderen of de rechtvaardigende query toevoegen.
- **[low · schema-index] productPrices: `by_price_list`, `by_source_file_column`, `by_price_type`** — **IDX-2** — `convex/schema.ts:492, 494, 495`. Op de grootste tabel (~74k) ongebruikt → ~74k extra index-writes per her-import zonder leesbaat. **Fix:** verwijderen, of de in-memory `prices.filter(priceType===…)` in de auditquery's vervangen door `by_price_type`-queries.

---

## INFO

- **[info · schema-index] Ongebruikte search-indexen `search_customer`, `search_supplier`** — **IDX-3** — `convex/schema.ts:231-234, 298-301`. Alleen `search_products` wordt gebruikt; dode search-indexen brengen schrijf-/onderhoudskosten mee. **Fix:** verwijderen of de bedoelde `withSearchIndex`-query implementeren.
- **[info · schema-index] Diverse overige dode indexen** — **IDX-4** — `convex/schema.ts:671, 703, 802, 930, 1042, 1044, 272, 202, 315` (o.a. `projects.by_execution_date`, `quotes.by_quote_number`, `invoices.by_invoice_number/by_due_date`, `users.by_email`). Kleine tabellen, geen perf-risico, wel ruis. **Fix:** verwijderen of de rechtvaardigende lookup toevoegen (bv. nummer-lookup via `by_quote_number`/`by_invoice_number`).
- **[info · schema-index] Geen DB-niveau uniqueness op slugs/nummers/`externalUserId`** — **CI-10** — `convex/schema.ts:190-202, 770-803`. Convex kent geen unique constraints; code leunt op `.first()`/applicatielogica. Fragiel bij race/insert-bug. **Fix:** lookup-before-insert binnen dezelfde mutation borgen; periodieke integriteitscheck; documenteer de invariant.
- **[info · authz] `tenantBySlug()` gooit raw Error met tenant-bestaansinfo vóór de rolcheck** — **CI-10 (imports)** — `convex/catalog/imports.ts:41-52, 508-519, 601-603`. `updateBatchStatusForPortal`/`updateProfileStatusForPortal` lekken tenant-bestaan vóór authz. Geen data-lek. **Fix:** roep eerst `requireMutationRole` (token+tenant+rol in één) aan.
- **[info · tenant-isolation] `updateMeasurementLineStatus`/`deleteMeasurementLine` scopen op tenant maar niet op measurement/project** — **PROJ-8** — `convex/projecten/measurements.ts:596-629, 725-756`. Geen lek (tenant correct gecheckt); intra-tenant object-level autorisatie is consistent afwezig in de hele codebase. Geen actie nodig tenzij object-level autz ooit gewenst is.
- **[info · correctness] Chunked maintenance-mutaties: cursor over `by_tenant` zonder stabiliteitsgarantie bij gelijktijdige writes** — **CRM-10** — `convex/catalog/maintenance.ts:162-165, 387-390, 455-458, 518-521`. Bij gelijktijdige imports tijdens een meerdelige reparatierun kan paginatie rijen overslaan/dubbel zien; gemitigeerd doordat patches idempotent zijn en delete eenmalig. **Fix:** documenteer/forceer imports-pauze tijdens reparaties, of voeg een eind-rescan (`matched===0`) toe.
- **[info · validation] `createdByExternalUserId`-arg geaccepteerd maar genegeerd** — **beheer-createcontact-ignored-arg** — `convex/beheer/customers.ts:195, 221, 424, 450`. Veilig (geen author-spoofing), maar misleidende dead input. **Fix:** verwijder de arg uit de validators.
- **[info · authz] Klant-CRUD toegestaan voor basisrol `user`** — **beheer-user-role-customer-crud** — `convex/beheer/customers.ts:318-358`. `["user","editor","admin"]` laat `user` klantstatus (incl. `archived`) wijzigen. Consistent, geen lek; beleidsvraag. **Fix:** bevestig of `user` deze rechten hoort te hebben; zo niet `["editor","admin"]`.

---

## Wat is gecontroleerd

**8 modules:**
1. **core-infra** — `authz.ts`, `portal.ts`, `portalUtils.ts`, `schema.ts`, `clearTenantData.ts`
2. **catalog-import** — `catalog/import.ts`, `catalog/imports.ts`, `catalog/core.ts`
3. **catalog-pricing** — `catalog/pricing.ts`, `catalog/pricingRules.ts`, `catalog/pickerSearch.ts`, `catalog/pilot.ts`
4. **catalog-review-maint** — `catalog/review.ts`, `catalog/maintenance.ts`, `catalog/validation.ts`, `catalog/productionAudit.ts`
5. **projecten** — `projecten/core.ts`, `projecten/measurements.ts`, `projecten/fieldService.ts`
6. **offertes-facturen** — `offertes/core.ts`, `facturen/core.ts`
7. **beheer** — `beheer/customers.ts`, `beheer/users.ts`, `beheer/tenants.ts`, `beheer/serviceCostRules.ts`, `beheer/categories.ts`, `beheer/suppliers.ts`
8. **seed** — `seed/core.ts`, `seed/demo.ts`

**2 cross-cut passes:**
- **xcut-authz-tenant** — kruislingse verificatie van token/tenant-scope/rol en field-mode over alle units
- **xcut-schema-perf** — schema-/index-gebruik en `.collect()`/full-table-scan-analyse over alle queries

---

## Expliciet geverifieerd-veilig (bekende risico's die OK bleken)

- **Prod-wipe/seed achter guard (deels — risico #1):** `clearTenantData`, `seed.run` en `demoSeed.run` dragen daadwerkelijk de `requireConvexToolingEnabled`-gate (env `ALLOW_CONVEX_TOOLING`) plus, voor `clearTenantData`, een confirmzin. De **code-guard bestaat dus**; de resterende bevindingen gaan over het *ontbreken van actor-auth en prod-detectie* bovenop de env-vlag, niet over een ontbrekende guard.
- **`measurementLines.input/result` voeden de calculators NIET:** de offerte-conversie (`offertes/core.ts:1087-1129`) rekent uitsluitend met getypeerde velden (`quantity`, `indicativeUnitPriceExVat`, `indicativeVatRate`); `input`/`result` zijn write-only snapshots — het `v.any()`-risico daar is hygiene, geen geldfout.
- **`nextInvoiceNumber` is race-veilig:** Convex-mutaties draaien als serialiseerbare ACID-transacties met OCC; de lees-schrijf-afhankelijkheid op het tenant-document forceert retry bij conflict → geen dubbele/teruglopende nummers. (Alleen de onbegrensde fallback-`collect()` blijft als low-perf staan.)
- **`markInvoicePaid` overschrijft `paidAmount` correct:** het contract is "cumulatief totaal betaald" (`isFullyPaid = paidAmount >= totalIncVat`), niet een increment; accumuleren zou juist een bug introduceren.
- **`ensureUser`/`ensureTenant` vertrouwen geen ongevalideerde args:** `requireSyncToken` verifieert een HMAC-handtekening en scope't op `kind="sync"`, tenant-slug en (indien meegegeven) `externalUserId`; de sync-secret-houder is per ontwerp de vertrouwde Astro-server (dezelfde root-of-trust die actor-tokens mint). Geen privilege-escalatie. Cross-tenant insert wordt extra geblokkeerd.
- **`deletePseudoPriceRowsChunk` is correct beveiligd:** `requireMutationRole(...,["admin"])` (HMAC-token + tenant + rol) + confirm-literal + `dryRun`-default-true — sterker dan de tooling-gate; consistent met hoe álle geauthenticeerde destructieve mutaties in de app beveiligd zijn.
- **`commitPreviewBatchChunk` done-detectie is correct:** de "imported"-overgang baseert op echte rij-status-queries (`valid`/`warning` via `by_status`-index), niet op driftende tellers; een batch kan niet ten onrechte als geïmporteerd worden gemarkeerd terwijl er onverwerkte productrijen zijn.
- **`listReadyForQuoteByProject` is geen full-scan:** alle reads zijn index-scoped per project/measurement; de normale flow hergebruikt één measurement per project, dus geen ongebonden groei. De index `by_quote_status` bestaat wél.
- **Tenant-scoping algemeen:** in alle onderzochte CRUD-paden worden reads/writes correct op `tenantId` van de actor gescoped en is de rol-afdwinging (`viewer < user < editor < admin`) intact — geen cross-tenant datalek aangetroffen.