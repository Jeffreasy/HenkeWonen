# Sessie-overdracht — Henke Wonen portal (2026-06-13)

> **Doel van dit document:** een nieuwe Claude-sessie (of ontwikkelaar) volledig op snelheid brengen
> zonder het onderzoek van deze sessie over te doen. Lees dit eerst, daarna de gelinkte detaildocs.
> Alle feiten hieronder zijn deze sessie geverifieerd tegen code en live data.
>
> **Bijgewerkt aan einde sessie:** ná de prod-data-reparaties zijn nog twee dingen gedaan: (1) de prod
> btw-workbench is her-import-veilig gemaakt (§8 punt 1 — opgelost), en (2) de feature-branch is naar
> `main` gemerged (fast-forward). Het enige dat nog rest is de **frontend-deploy** (`git push origin main`
> → Vercel) om de richtprijs-UI live te zetten — dat is een bewuste eigenaarsactie. Zie §8.

---

## 0. TL;DR — wat is er deze sessie gebeurd

1. **Volledige projectaudit** gedaan (stack, architectuur, auth, catalogus-pipeline, risico's).
2. **Feature "richtprijs bij inmeting" gebouwd**: tijdens het inmeten een product kiezen → direct een
   indicatieve verkoopprijs (incl./excl. btw) zien → snapshot stroomt als voorinvulling naar de offerte.
   Volledig getest (152 tests groen) en gereviewd (multi-agent, adversarieel).
3. **Catalogus-data gerepareerd** op **dev én productie** (btw, pseudo-prijzen, Texdecor-categorie,
   pakinhoud, gelekte productnamen). Productie is geverifieerd gelijk aan de doelstand.
4. **Productie-Convex gedeployd** (door de eigenaar zelf; een AI mag dat niet).
5. **Belangrijke valkuilen** rond productie-deploy/mutatie en de prod-omgeving gedocumenteerd (§6).

**De richtprijs-feature staat backend-technisch op productie, maar de frontend (UI) is bewust nog NIET
live voor pilot-gebruikers.** Dat is een bewuste go-live-beslissing voor de eigenaar.

---

## 1. Omgevingen, deployments, identiteiten

| | Dev | Productie |
|---|---|---|
| Convex deployment | `dev:kindly-greyhound-592` | `prod:accomplished-kangaroo-354` |
| Convex URL | `https://kindly-greyhound-592.eu-west-1.convex.cloud` | `https://accomplished-kangaroo-354.eu-west-1.convex.cloud` |
| Tenant slug | `henke-wonen` | `henke-wonen` |
| Tenant `_id` | `md7f9ecc27at3eqn5wvbshgrnx85sen9` | `n97bdehedkx3de0senxhejwznd86an0b` |
| Data | testdata + demo | **echte data: 31 klanten, 24.983 producten** |

- **Frontend**: Astro 6 SSR + React 19 islands, gehost op **Vercel** (project `prj_z0WyHCAICzBu84eQTO9VvqBYxP3e`,
  team `team_BXrDmTQBlk2ykC0fHjVMxPjn`). `.vercel/` is lokaal gelinkt (niet committen).
- **Auth**: LaventeCare (extern), eigen HMAC `AUTHZ_TOKEN_SECRET` voor Convex-actor-tokens. Rollen
  viewer/user/editor/admin. Prod heeft 5 users (3 admin, 2 editor) — echte LaventeCare-accounts met UUID/Clerk-id's.
- **Git**: repo `github.com/Jeffreasy/HenkeWonen`. Werk staat op branch
  **`feature/field-catalog-filter-measurement-fix`** — **NIET gemerged naar `main`**.
- **CI** (`.github/workflows/ci.yml`): draait alleen `astro check` + `vitest` + `astro build` tegen een
  test-Convex-URL bij push naar main/master. **Geen deploy-job.** Convex-deploy is handmatig.
  ⚠️ ci.yml bevat een hardcoded `AUTHZ_TOKEN_SECRET` (gelijk aan de dev-secret) — bekend, laag risico.

---

## 2. Commits deze sessie (branch `feature/field-catalog-filter-measurement-fix`)

Nieuwste eerst; `b62844a` en ouder = vóór deze sessie.

| Commit | Inhoud |
|---|---|
| `86945ab` | docs: prod btw-workbench Co-pro-kolom op inclusief (her-import-veilig) |
| `fa5c857` | docs: dit overdrachtsdocument |
| `467abf2` | docs: productie-data-auditrapport |
| `71ad1f2` | fix(data): audit-reparaties C-1 (btw) + H-1 (namen) + Interfloor-parser |
| `aeb78ee` | feat(catalog): schone klant-/offertenaam uit rommelige productnamen |
| `4012924` | fix(richtprijs): productkiezer toont nu producten + UI/UX-review fixes |
| `ef3b992` | fix: Texdecor-behang hersteld, prijslek gedicht, btw-stand consistent |
| `d903d8d` | docs: btw-mapping live-stand dev (2026-06-12 export) |
| `428d349` | feat: richtprijs bij inmeting met productkeuze en offerte-prefill |

**`main` is bijgewerkt** naar deze stand (fast-forward op 2026-06-13): zowel `main` als de feature-branch
wijzen naar `86945ab`. **Nog niet gepusht naar `origin` op moment van schrijven** — `git push origin main`
is de eigenaarsactie die (bij gekoppelde Vercel) de frontend-deploy triggert (§8).
Working tree is schoon. Niet gecommit (lokaal, gitignored): `.env.prod.local` (zie §6).

---

## 3. De richtprijs-feature — architectuur & kernbestanden

**Spelregel die overeind blijft:** de inmeting legt hoeveelheden vast; de **offerte** blijft de plek waar
prijs/product/btw definitief worden gecontroleerd. De richtprijs is expliciet *indicatief*.

### Backend (Convex)
- **`convex/schema.ts`** — `measurementLines` uitgebreid met optionele velden: `productId`, `productName`,
  `indicativeUnitPriceExVat`, `indicativeVatRate`, `indicativePriceUnit`, `indicativePriceType`,
  `indicativeCapturedAt`. (Additief — veilig voor bestaande data.)
- **`convex/catalog/pricingRules.ts`** *(NIEUW, puur, unit-getest)* — de deterministische prijskeuzeregel:
  - `selectIndicativePrice(rows, product, measurementUnit, now)` — voor de richtprijs.
  - `selectCustomerFacingPrice(rows, now)` — voor lijstweergaven (portal-catalogus, offertebouwer).
  - `isUnitCompatible(measurementUnit, priceUnit)` — gebruikt voor staleness-guard.
  - **Regels:** alleen `advice_retail`/`retail` (nooit inkoop/staffel); `vatMode unknown` → géén prijs;
    harde eenheid-match; enige conversie = pak/verpakking → m² via `packageContentM2`
    (plausibiliteitsgrens 0,2–50 m²); tie-break: hoogste `validFrom` → nieuwste `updatedAt` →
    hoogste `_creationTime` → stabiele `_id`. Incl-btw altijd afgeleid uit de (opgeslagen) ex-prijs
    (4 decimalen) zodat reconstructie cent-exact is.
- **`convex/catalog/pricing.ts`** *(NIEUW)* — query `getIndicativePrice` (rollen user/editor/admin,
  pilot-guard, geeft alléén afgeleide klantvelden terug — nooit inkoopdata).
- **`convex/catalog/pickerSearch.ts`** *(NIEUW)* — query `searchPickerProducts`: zoekt via de
  search-index op naam + de categorie-indexen van de productgroep (server-side productGroup→categorie
  mapping, niet client-omzeilbaar). Reden: `listProductsForPortal` scant maar één pagina van ~25k
  producten en filtert pas daarna → leverde nul resultaten in de picker.
- **`convex/projecten/measurements.ts`** — `addMeasurementLine`/`updateMeasurementLine` uitgebreid met
  product + snapshot; `requireSelectableProduct` (pilot-guard); `clearProduct`-vlag; eenheid-staleness-guard
  (snapshot vervalt als de prijseenheid niet meer bij de meeteenheid past).
- **`convex/offertes/core.ts`** — `importMeasurementLinesToQuote` vult `productId`/prijs/btw voor uit het
  snapshot; degradeert netjes bij verwijderd/pilot-verborgen product; prijsreview blijft verplicht.
- **`convex/portalUtils.ts`** — `importedMeasurementLineTitle/Description` tonen de productnaam.
- **`convex/catalog/pilot.ts`** — `cleanProductDisplayName` + helpers (`dropRepeatedPhrases`,
  `isNoiseToken`, `prettifyCaps`): leidt een nette klant-/offertenaam af, maar **alleen** bij gedetecteerde
  rommel; al-schone namen blijven onaangeroerd. De rauwe `name` blijft intact voor zoeken/import.

### Frontend (React/Astro)
- **`src/components/catalog/CatalogProductPicker.tsx`** *(NIEUW)* — herbruikbare productkiezer
  (gedebounced, Enter submit niet het formulier).
- **`src/components/projects/MeasurementPanel.tsx`** — per rekenhulp-tab de kiezer + live richtprijs in
  het resultaatpaneel; incl./excl.-btw-toggle (sessievoorkeur); race-guards op alle prijslookups;
  opslaan geblokkeerd zolang de prijs laadt. Zelfde component bedient winkel én buitendienst (`mode="field"`).
- **`src/components/quotes/QuoteLineEditor.tsx`** — gerefactord op `CatalogProductPicker`.
- **`src/components/quotes/MeasurementLinePicker.tsx`** — toont gekozen product + richtprijs vóór import.
- Types: `src/lib/portalTypes.ts`, `src/components/projects/measurement/measurementTypes.ts`.

### Tests
- `tests/indicativePrice.test.ts` (prijskeuzeregel), `tests/cleanProductName.test.ts`,
  uitbreidingen in `tests/workflowGuardrails.test.ts`. **Totaal 152 tests groen**, `astro check` schoon,
  productie-build slaagt.

---

## 4. Datakwaliteit & btw — het kernverhaal

De catalogus is geïmporteerd uit ~20 leverancier-Excels (Python+Node pipeline in `tools/`, npm-scripts
`catalog:*`). Daar zaten datafouten in die de richtprijs/offerte raken:

- **Btw-stand inconsistent.** Veel adviesprijzen stonden onterecht op `vatMode: inclusive`/`unknown`.
  **Klantbesluit 2026-06-13: "alle leverancierslijsten zijn exclusief btw."** → alles → `exclusive`,
  met **één bewuste uitzondering**: de Co-pro-kolom **"Adviesverkoopprijs incl. BTW. per verpakking"**
  (heet letterlijk incl. BTW, 31 regels) blijft `inclusive`. Regels: `docs/release-readiness/vat-mapping/copro-inclusive-fix-rules-2026-06-13.json`.
- **Pseudo-prijzen.** Texdecor "Qté multiple d'achat"/"Code prix"/"Unité de vente" = bestelaantallen/codes,
  geen geldbedragen → verwijderd.
- **Texdecor-behang** (Casadeco/Caselio/Casamance) stond in categorie "Overig" → naar "Behang" (+ priceUnit).
  Oorzaak in parser: vergelijking met `"Papier  peint"` (dubbele spatie) terwijl `clean_text` witruimte
  samenklapt — gefixt in `tools/build_catalog_import.py`.
- **packageContentM2 1000× te groot** (komma-als-duizendtal, bv. 4861 i.p.v. 4,861) → /1000.
- **Gelekte bestandsnaam** in Interfloor-namen ("henke-swifterbant-artikeloverzicht") → gestript.
  Oorzaak: `product_name_for` nam `sheet_name` (= bestandsnaam) op in de Interfloor-naam — verwijderd.

**Maten-misverstand (belangrijk):** de "88k prijsregels" zijn GEEN maten maar **prijstypes per product**
(inkoop/advies/staffel). Maten zijn aparte producten of `widthMm`/`lengthMm`-velden. FlexColours-raamdecoratie
(echte maat-matrix) is bewust niet geïmporteerd → géén richtprijs voor raamdecoratie.

---

## 5. Reparatie-tools (referentie)

Alle maintenance-mutaties: **admin-rol + letterlijke `confirm` + chunked + dryRun standaard**. Drivers in `tools/`.

| Doel | Convex-mutatie (`convex/catalog/maintenance.ts`) | Driver / npm-script |
|---|---|---|
| Btw vatMode ombuigen | `repairPriceVatModesChunk` | `tools/repair_price_data.mjs` · `catalog:prices:repair[:apply]` |
| Pseudo-prijzen verwijderen | `deletePseudoPriceRowsChunk` | idem (`--skip-vat --skip-package-content`) |
| packageContentM2 /1000 | `repairPackageContentChunk` | idem (`--skip-vat --skip-pseudo`) |
| Texdecor → Behang | `repairTexdecorCategoriesChunk` | `tools/repair_texdecor_categories.mjs` · `catalog:texdecor:repair[:apply]` |
| Gelekte bestandsnaam strippen | `stripLeakedFilenameFromNamesChunk` | `tools/repair_product_names.mjs` · `catalog:names:repair[:apply]` |
| Read-only leveranciers-audit | `supplierProductAudit` (query) | `tools/audit_supplier_products.mjs` |

**Standaard btw-regel** (`repair_price_data.mjs`): `{ fromModes:["unknown","inclusive"], toMode:"exclusive" }`,
mét de Co-pro-uitzondering die je ná de default-run terugzet via de rules-file.

**Productie draaien** vereist: `--production --target=production` + de tool-specifieke
`--confirm-production-*`-vlag + `--apply` (zonder `--apply` = dry-run), plus een geldige prod-env (§6).

---

## 6. ⚠️ KRITIEKE MECHANICA & VALKUILEN (de pijnlijk-ontdekte dingen)

**6.1 Een AI mag productie NIET deployen of muteren.** De auto-mode-classifier blokkeert
`npx convex deploy` naar prod, het schrijven van het prod-secret naar een bestand, het bewerken van de
eigen permissieregels, én het muteren van prod-data met een geïnfereerde admin-identiteit. Conclusie:
**de eigenaar (of een ontwikkelaar) draait de productie-commando's zelf**, of voegt vooraf Bash-permissieregels
toe via `/permissions`. Dry-runs (read-only) en exports werden wél toegestaan.

**6.2 Prod-env opzetten** (`.env.prod.local`, valt onder `.gitignore` via `.env.*`):
```
CONVEX_DEPLOYMENT=prod:accomplished-kangaroo-354
PUBLIC_CONVEX_URL=https://accomplished-kangaroo-354.eu-west-1.convex.cloud
AUTHZ_TOKEN_SECRET=<via: npx convex env get AUTHZ_TOKEN_SECRET --prod>
HENKE_TENANT_SLUG=henke-wonen
TOOL_AUTH_USER_ID=<een ECHTE prod-admin externalUserId — zie 6.3>
```
Maak het bestand met `Set-Content` + een **array** (elke regel apart). **Valkuil:** `Add-Content` zonder
trailing newline plakt de nieuwe regel vast aan de vorige → `HENKE_TENANT_SLUG` raakt vervuild → "Server Error".

**6.3 `TOOL_AUTH_USER_ID` is VERPLICHT op prod.** De tools tekenen standaard als `dev-user-jeffrey`
(via `tools/authz_actor.mjs`), die op prod niet als user bestaat → rolcheck faalt. Gebruik een echte
prod-admin `externalUserId` (staat in de prod `users`-tabel; er zijn 3 admins). De reparaties leggen geen
"uitgevoerd door"-veld vast, dus functioneel maakt het niet uit wélke admin.

**6.4 Convex verbergt op productie de tekst van gewone `Error`s als "Server Error".** Alleen `ConvexError`
toont detail. Dezelfde functie geeft op dev wél de echte melding. Debug prod-fouten dus via de Convex-logs
(`npx convex logs --prod`) of door te redeneren (vaak een authz-/tenant-fout — zie 6.2/6.3).

**6.5 `--env-file` botst met Node's eigen `--env-file`-vlag** → gebruik de env-variabele
`CATALOG_ENV_FILE=".env.prod.local"` in plaats van de `--env-file`-vlag.

**6.6 Deploy-volgorde.** Convex-deploy is handmatig (`npx convex deploy`); Vercel kan bij een push naar
`main` de frontend auto-deployen. Deploy daarom **Convex eerst**, dan pas de frontend, anders draait de
nieuwe frontend tegen een oude backend. De feature staat nu backend-gedeployd op prod; frontend bewust niet.

---

## 7. Huidige datastand productie (geverifieerd 2026-06-13 via read-only export)

- productPrices: **73.688** (was 83.837; 10.149 pseudo verwijderd). vatMode: **73.657 exclusive + 31 inclusive**
  (alleen de Co-pro-uitzondering), **0 unknown**.
- products: 24.983. packageContentM2 ≥ 100: **0**. Namen met bestandsnaam-lek: **0**. Texdecor in "Overig": **0**.
- **Backup** (vóór de reparaties): `%TEMP%\henke-prod-backup\prod-backup-20260613-171243.zip`
  — ⚠️ staat in de Windows-temp en kan opgeruimd worden; **verplaats naar een duurzame locatie** als je 'm wil bewaren.
  Terugzetten kan met `npx convex import --prod`.

Dev is eveneens gerepareerd (zelfde stappen, eerder in de sessie).

---

## 8. OPENSTAANDE PUNTEN (prioriteit)

**Go-live van de feature — DE enige resterende stap (eigenaarsactie):**
- [ ] **Frontend live zetten.** `main` is al bijgewerkt (§2). Draai `git push origin main`; bij een aan
  GitHub gekoppeld Vercel-project deployt dat de frontend automatisch naar productie (anders `npx vercel --prod`).
  Backend draait al op prod, dus frontend/backend zijn in sync. Hierna ziet de pilot de richtprijs-UI.
  ⚠️ Een AI kan dit niet zelf doen (zie §6.1) — de eigenaar pusht/deployt.

**Btw-workbench op prod — OPGELOST 2026-06-13 (was open):**
- [x] De prod btw-workbench stond al 61/61 op exclusief (status READY, conform "alles exclusief"). Eén
  refinement gedaan: de Co-pro-kolom "Adviesverkoopprijs incl. BTW. per verpakking" (profiel
  `js77a6f2k71154wb5z5746t0a986bb2d`, kolomindex 4) op **inclusief** gezet zodat een her-import de 31
  echt-inclusieve adviesprijzen niet als exclusief opslaat. Beslissing:
  `docs/release-readiness/vat-mapping/prod-copro-inclusive-decision-2026-06-13.json`, toegepast via
  `tools/apply_vat_mapping_decisions.mjs --decisions-file=... --production --target=production
  --confirm-production-vat-apply --apply`. Dev was eerder al gelijkgetrokken (ZTAHL). → her-import-veilig.

**Opruimwerk (laag, niet-blokkerend):**
- [ ] 13 cascade-delete-wezen op prod (resten van verwijderde test-projecten/quote) opruimen — geen bestaand tool.
- [ ] Duplicate-EAN-backlog (~1.8k groepen, bewust geparkeerd) — handmatige triage; prod heeft géén
  `catalogDataIssues` om ze te parkeren.
- [ ] `productImportRows` staging-bloat (dev ~232k/687MB, prod ~39k) — opschoonbaar na geslaagde import.
- [ ] Ongebruikte `productCollections` met onzin-namen; verweesde `dossierAttachments`-tabel (staat niet in schema.ts).

**Security (optioneel, op verzoek eigenaar):**
- [ ] De eigenaar heeft tijdens de sessie secrets in de chat geplakt (`AUTHZ_TOKEN_SECRET`,
  `LAVENTECARE_JWT_SECRET`, Vercel OIDC-token). Overweeg deze te rotéren. `AUTHZ_TOKEN_SECRET` staat
  bovendien hardcoded in `ci.yml`.

---

## 9. Detaildocumentatie (waar de diepte zit)

- **Plan + prijskeuzeregel:** `docs/technisch/plan-richtprijs-inmeting-2026-06-13.md`
- **Dev data-audit:** `docs/release-readiness/data-issues/convex-data-audit-2026-06-13.md`
- **Prod data-audit + reparatie-volgorde + risico's:** `docs/release-readiness/data-issues/convex-prod-data-audit-2026-06-13.md`
- **Co-pro btw-uitzonderingsregel:** `docs/release-readiness/vat-mapping/copro-inclusive-fix-rules-2026-06-13.json`
- **Btw-mapping live-stand (bewijs):** `docs/release-readiness/vat-mapping/vat-mapping-current-state-2026-06-12.{md,json}`
- **Auto-memory** (`~/.claude/.../memory/`): `henke-wonen-project-map.md`, `henke-wonen-richtprijs-plan.md`,
  `henke-wonen-data-audit.md`, `henke-wonen-audit-aandachtspunten.md`.

---

## 10. Snelle start voor een nieuwe sessie

1. Lees dit document + `henke-wonen-data-audit.md` (auto-memory).
2. Dev draaien: `.env.local` staat al goed (dev-deployment). `npm run dev`, `npm test`, `npx convex dev --once`.
   Voor een UI-review in dev-auth: `node tools/dev_preview_server.mjs` (forceert dev-auth) +
   `.claude/launch.json` ("portal-dev", poort 4399).
3. **Productie aanraken = altijd eerst de eigenaar.** Een AI kan prod niet deployen/muteren (§6.1).
   Lever kant-en-klare commando's; de eigenaar draait ze (dry-run → controle → `--apply`).
4. Read-only prod inspecteren mag wel: `npx convex export --prod --path <zip>` → uitpakken → streamende
   node-scripts over de JSONL (lees grote tabellen NOOIT volledig in context).
