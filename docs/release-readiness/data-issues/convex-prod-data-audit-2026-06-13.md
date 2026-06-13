# Geconsolideerd Productie-Auditrapport — Henke Wonen Convex-data

**Deployment:** `prod:accomplished-kangaroo-354` (`accomplished-kangaroo-354.eu-west-1.convex.cloud`)
**Tenant:** `n97bdehedkx3de0senxhejwznd86an0b` (henke-wonen, active) — single-tenant, 100% schoon gescoped
**Snapshot:** 2026-06-02 06:17–06:34 (één bulk-import, van vóór alle dev-reparaties)
**Datum rapport:** 2026-06-13 · **Status reparaties op productie: NUL uitgevoerd**

---

## 1. Eindoordeel

**De productiedata is NIET klant-veilig voor prijs- of catalogus-gerichte features.** Geen enkele van de vijf in dev doorgevoerde reparaties is op productie toegepast — de prod-snapshot dateert van vóór de fixes. De ernstigste blocker is een BTW-fout: **17.039 prijsregels staan onterecht als `vatMode=inclusive`** (verifiëerd door 4 onafhankelijke audits), wat bij elke prijsberekening of richtprijs ~21% afwijking veroorzaakt. Daarnaast vervuilen **10.149 pseudo-prijzen** (bestelveelvouden, geen geldbedragen) de prijstabel als `priceType=purchase`, staan **6.991 Texdecor-behangproducten** in de verkeerde categorie, en bevatten **988 productnamen** een gelekte bronbestandsnaam. Tegelijk is de structurele integriteit sterk: tenant-scoping, schema-enums, verplichte velden, timestamps, FK-integriteit en sourceKey/importKey-uniciteit zijn 100% schoon. De goede nieuwsboodschap voor de live-klantdata: de **31 echte klanten zijn alle valide leads zonder testdata**; de enige live-workflow-schade is een cascade-delete-lek (13 verweesde child-records) en één offerte zonder regels. **Kortom: catalogus + prijslaag zijn niet productieklaar; de klantenlaag is grotendeels gezond maar heeft een klein integriteitslek. Repareren is verplicht vóór elke prijs-/offerte-feature live gaat.**

---

## 2. Prod-vs-Dev-reparatiestatus

| # | Dev-reparatie | Prod-stand | Getroffen rijen (prod) | Moet nog? | Tool |
|---|---|---|---|---|---|
| R1 | BTW: `inclusive`/`unknown` → `exclusive` (incl. Co-pro-uitzondering 31 rijen behouden) | NIET uitgevoerd — 17.070 inclusive waarvan 17.039 fout | **17.039** fout (16.833 Texdecor + Hebeta 132 + Lamelio 74) · **31** legitiem (Co-pro) | **JA — Critical** | `repair_price_data.mjs` (vat-stap) |
| R2 | Pseudo-prijzen "Qté multiple d'achat" verwijderen | NIET uitgevoerd | **10.149** rijen als `priceType=purchase` | **JA — High** | `repair_price_data.mjs` (`--skip-vat`, pseudo-stap) |
| R3 | Texdecor "Papier peint" → categorie Behang / `productKind=wallpaper` | DEELS — 143 echte wallpaper-kind staan correct; gros niet | **6.991** in categorie "Overig" / `productKind=other` | **JA — High** | `repair_texdecor_categories.mjs` |
| R4 | `packageContentM2 >= 100` delen door 1000 | NIET uitgevoerd | **12** producten (Moduleo/ROOTS, factor ~1000x; waarden 3403/4861) | **JA — Medium** | `repair_price_data.mjs` (package-content-stap) |
| R5 | Interfloor-namen: gelekte bestandsnaam strippen | NIET uitgevoerd | **988** namen met "henke-swifterbant-artikeloverzi" | **JA — Medium** | `repair_product_names.mjs` |

Alle drie de tools draaien **standaard als dry-run**; pas met `--apply` muteren ze. Productie vereist bovendien `--production --target=production`, de tool-specifieke confirm-flag, een geldig `.env`-bestand met `AUTHZ_TOKEN_SECRET`, én exacte match op `prod:accomplished-kangaroo-354`. R1 (vat) en R2 (pseudo) en R4 (package-content) zitten in één tool en kunnen onderling met `--skip-*` worden gescheiden.

---

## 3. Bevindingen, geprioriteerd

Legenda: **[KLANT]** = raakt live-klantdata (customers/quotes/projects) · **[CAT]** = alleen catalogus/prijzen.

### CRITICAL

**C1 — BTW-flip niet uitgevoerd: 17.039 prijsregels onterecht `inclusive` [CAT]** (bevestigd ×4)
Alle 17.070 inclusive-rijen zijn `priceType=advice_retail`. Slechts **31** zijn legitiem (Co-pro kolom "Adviesverkoopprijs incl. BTW. per verpakking"). De 17.039 foute komen uit twee Franse adviesverkoopkolommen die níet via tekstscan vindbaar zijn: **"Prix de vente CASCAM BNL Public" (10.171)** en **"Prix de vente public PBA" (6.662)**, plus "Prijs" (132) en "Price" (74).
*Impact:* elke prijs/richtprijs op deze regels is ~21% verkeerd.
*Herstel:* `repair_price_data.mjs` met default-regel (`unknown`+`inclusive` → `exclusive`), gevolgd door een tweede run met `copro-inclusive-fix-rules-2026-06-13.json` om de 31 Co-pro-rijen terug te zetten. **Business-besluit vereist** (zie §4 stap 3).

### HIGH

**H1 — Pseudo-prijzen niet verwijderd: 10.149 "Qté multiple d'achat"-rijen [CAT]** (bevestigd ×2)
Bestelveelvouden (1–75), geen geldbedragen, opgeslagen als `priceType=purchase`. Vervuilen prijslogica en aggregaten.
*Herstel:* `repair_price_data.mjs` pseudo-stap (`deletePseudoPriceRowsChunk`).

**H2 — Texdecor-behang niet gehercategoriseerd: 6.991 producten in "Overig" [CAT]** (bevestigd ×2; cross-cutting telde 5.312 als deelverzameling Casadeco/Caselio)
Caselio/Casadeco/Casamance "Papier peint" met `productKind=other` i.p.v. Behang/wallpaper. Niet vindbaar in catalogus-UI onder Behang.
*Herstel:* `repair_texdecor_categories.mjs` (default suppliers Casadeco/Caselio/Casamance). Stem `matched` in dry-run af tegen de verwachte ~6.991.

**H3 — EAN-duplicaten niet geparkeerd: 1.871 groepen over 4.393 producten [CAT]** (bevestigd ×2)
`catalogDataIssues`-tabel is volledig leeg (0 rijen), terwijl 1.805 clusters bínnen één leverancier zitten (grootste: 14 producten op één EAN). Geen tool aanwezig om te parkeren.
*Herstel:* **geen bestaand reparatie-tool** — vereist nieuwe maintenance-mutatie + business-triage. Niet blocking voor go-live, wel kwaliteitsschuld.

**H4 — Cascade-delete-lek: 13 verweesde project-/quote-records [KLANT]** (bevestigd ×2) **← RAAKT LIVE-KLANTDATA**
Twee projecten (`md71jap4…`, `md79jzh2…`) en één quote (`ms72eg3w…`) zijn verwijderd zonder cascade. Achtergebleven: 2/2 projectRooms, 3/3 projectTasks, 7/8 projectWorkflowEvents, 1/1 quoteLines.
*Herstel:* gerichte cleanup-mutatie die child-records zonder bestaande parent verwijdert (eerst dry-run lijst van id's). **Geen bestaand tool** — handmatig/nieuw script, met klant-zorgvuldigheid.

**H5 — Enige overlevende quote heeft 0 regels [KLANT]** (bevestigd ×1) **← RAAKT LIVE-KLANTDATA**
De enige `quoteLine` hangt aan de verwijderde quote én verwijst naar een verwijderde measurement (dubbel verweesd). De overlevende quote is leeg.
*Herstel:* onderdeel van H4-cleanup; valideer of de lege quote bewust of artefact is (business-check met de eigenaar).

### MEDIUM

**M1 — packageContentM2 ≥ 100 niet gedeeld door 1000: 12 producten [CAT]** (bevestigd ×1) — factor ~1000x te groot (Moduleo/ROOTS, waarden 3403/4861). Herstel: `repair_price_data.mjs` package-content-stap.
**M2 — 415 producten zonder verkoop-/adviesprijs (alleen inkoop) [CAT]** — vrijwel allemaal ZTAHL-verlichting. Geen tool; business beslist of ze verborgen/aangevuld worden.
**M3 — Staging-bloat: batch "NL NG 01052026.XLSX" 9.354 rijen, 0 imports + 2 onafgemaakte importprofielen [CAT]** — opruimen via maintenance, geen klantimpact.
**M4 — Mogelijke dubbele prijsregels door her-import Floorlife PVC 11-2025 (n=2) [CAT]** — verifiëren vóór opruimen.
**M5 — Dubbel user-account met identiek e-mailadres (n=2) [KLANT-aangrenzend]** — dedupe in users.
**M6 — Zakelijke klant als `type=private` (n=1) [KLANT]** · **M7 — Ongeldig e-mailadres met illegaal teken (n=1) [KLANT]** — handmatige correctie, geen tool.
**M8 — `dossierAttachments` geregistreerd als tabel (id 10031) maar ontbreekt in schema.ts** — verweesde tabeldefinitie; schema-housekeeping.

### LOW

**L1 — 2.763 groepen exact-gelijke productnamen (16.876 producten) [CAT]** — slechte onderscheidbaarheid in UI.
**L2 — 18.970 producten (76%) zonder supplierCode [CAT]** — kwaliteitsmetriek.
**L3 — Alle 29 suppliers missen `status`-veld [CAT]**.
**L4 — 1 collectie met onzin-naam "1930" + 6 lege categorieën [CAT]**.
**L5 — Misvormde postcode (n=1) [KLANT]** · **L6 — Klantvelden firstName/lastName/companyName/customerNumber structureel leeg over alle 31 klanten [KLANT]** — vormkwaliteit, geen integriteitsfout.
**L7 — Workflow-aggregaten over verwijderde projecten geven misleidend beeld (n=10)** — verdwijnt zodra H4 is opgelost.

---

## 4. Aanbevolen reparatie-volgorde voor productie

**Voorbereiding (eenmalig, verplicht):** zet een prod-`.env` klaar met `CONVEX_DEPLOYMENT=prod:accomplished-kangaroo-354`, `PUBLIC_CONVEX_URL=https://accomplished-kangaroo-354.eu-west-1.convex.cloud` en `AUTHZ_TOKEN_SECRET`. De env-guard weigert te muteren als deployment/URL niet exact matchen of de target ≠ production is. **Maak vóór stap 1 een Convex-snapshot/backup-export** (zie §5).

**Stap 1 — Pseudo-prijzen verwijderen (H1) — dry-run eerst**
Doe dit vóór de BTW-flip zodat de vat-telling niet door 10.149 nep-rijen wordt vertroebeld.
```
node tools/repair_price_data.mjs --skip-vat --skip-package-content \
  --production --target=production --env-file=<prod.env> \
  --confirm-production-price-repair          # voeg --apply pas toe na dry-run-controle
```
Verwacht dry-run `matched` ≈ 10.149.

**Stap 2 — packageContentM2 (M1) — dry-run eerst**
```
node tools/repair_price_data.mjs --skip-vat --skip-pseudo \
  --production --target=production --env-file=<prod.env> \
  --confirm-production-price-repair [--apply]
```
Verwacht `matched` = 12.

**Stap 3 — BTW-flip (C1) — BUSINESS-BESLUIT + dry-run eerst** ⚠️
Twee runs, in deze volgorde (last-write-wins):
1. Default-regel (`unknown`+`inclusive` → `exclusive`) over alle 17.070 inclusive-rijen.
2. Co-pro-correctie terug met `--rules-file=docs/release-readiness/vat-mapping/copro-inclusive-fix-rules-2026-06-13.json` (zet de 31 "Adviesverkoopprijs incl. BTW. per verpakking"-rijen terug op inclusive).
```
node tools/repair_price_data.mjs --skip-pseudo --skip-package-content \
  --production --target=production --env-file=<prod.env> \
  --confirm-production-price-repair [--apply]
# daarna de Co-pro-correctierun met --rules-file=...
```
**Business-besluit vereist vóór `--apply`:** bevestig per bronkolom dat hij daadwerkelijk exclusief hoort te zijn. De 17.039 zitten geconcentreerd in 4 kolommen ("Prix de vente CASCAM BNL Public" 10.171, "Prix de vente public PBA" 6.662, "Prijs" 132, "Price" 74). De klant/eigenaar moet per kolom incl/excl bevestigen; de Co-pro-kolom (31) is bewijsbaar inclusief en is de enige uitzondering. **Let op:** dit tool repareert alleen bestaande rijen — controleer vóór de eerstvolgende import de btw-workbench in de portal, anders komt de oude stand bij her-import terug.

**Stap 4 — Texdecor-hercategorisatie (H2) — dry-run eerst**
```
node tools/repair_texdecor_categories.mjs \
  --production --target=production --env-file=<prod.env> \
  --confirm-production-texdecor-repair [--apply]
```
Verwacht productsPatched ≈ 6.991 (verdeeld over Casadeco/Caselio/Casamance).

**Stap 5 — Interfloor-namen strippen (R5/M-naam) — dry-run eerst**
```
node tools/repair_product_names.mjs \
  --production --target=production --env-file=<prod.env> \
  --confirm-production-name-repair [--apply]
```
Verwacht `patched` = 988.

**Stap 6 — Live-klantdata cleanup (H4/H5) — handmatig, GEEN bestaand tool, business-besluit** ⚠️ **[KLANT]**
Vereist een nieuw, gericht script of handmatige mutatie. Eerst een **read-only** lijst van de 13 verweesde id's produceren, met de eigenaar bevestigen dat de 2 projecten + 1 quote bewust verwijderd zijn, dán de wezen verwijderen. Beslis tegelijk of de lege overlevende quote terecht leeg is.

**Stap 7 — Overige (M2–M8, H3, L*) — los, niet-blocking**
EAN-parkeren (H3), staging-bloat (M3), Floorlife-dubbel (M4), user-dedupe (M5), klant-correcties (M6/M7) en schema-housekeeping (M8) hebben **geen bestaand tool** en kunnen na go-live als kwaliteitsschuld worden ingepland.

---

## 5. Risico's bij muteren van LIVE productiedata + niet-verifieerbaar

**Mutatie-risico's:**
- **Geen backup = onherstelbaar.** Stap 1 verwijdert 10.149 rijen permanent; H4 verwijdert klant-gerelateerde records. Maak vóór elke stap een Convex backup/export en valideer dat herstel mogelijk is.
- **BTW-flip is breed en onomkeerbaar zonder rules-file.** De default-regel raakt 17.070 rijen; een verkeerd business-besluit per kolom verschuift alle prijzen 21%. De Co-pro-correctie (stap 3.2) is de enige terugdraai-stap en moet ná de default-run draaien (volgorde-afhankelijk, last-write-wins). Bij meerdere overlappende regels telt een dry-run per regel tegen de óngepatchte staat — de tellingen voorspellen het apply-eindresultaat niet exact; beoordeel per regel, niet als som.
- **Importprofiel-mappings blijven onaangeraakt.** Een toekomstige import kan de BTW-fout en pseudo-prijzen opnieuw introduceren als de portal-workbench niet eerst is rechtgezet.
- **H4/H5 raken echte klantdossiers.** Verwijderen zonder eigenaar-bevestiging kan legitiem (maar incompleet aangemaakt) werk wissen. Doe dit als laatste, gescript, met dry-run-id-lijst.
- **Stap-isolatie.** Voer stappen één voor één uit met dry-run → controle → `--apply`; combineer geen onbewezen stappen in één run.

**Niet (volledig) verifieerbaar in deze audit:**
- Of de 17.039 inclusive-rijen per bronkolom écht exclusief horen te zijn — dit is een **business-feit** (afspraak met leveranciers), geen data-afleidbaar feit. Alleen de Co-pro-31 is bewijsbaar.
- De **202 deel-conversie-afwijkingen** (128 tapijt-PDF /4, 74 Lamelio /2.017) zijn als feit bevestigd, maar of de conversie zelf fout of bedoeld is, is niet vastgesteld — geen tool en geen herstelvoorstel; vereist nadere analyse van de bron-PDF's. *(Deze stond als losse productPrices-bevinding (n=202) en is hier niet in de §3-prioritering opgenomen omdat de richting onbekend is.)*
- Of de **1.082 producten zonder collectie** en **415 zonder verkoopprijs** bedoeld zijn, is een catalogusbeleid-vraag.
- De audit is gebaseerd op de **snapshot van 2026-06-02**; eventuele mutaties op prod ná die datum zijn niet meegenomen. Verifieer de tellingen opnieuw via de dry-runs vlak vóór elke `--apply`.

---

**Geverifieerde tools (bestaan, dry-run = default, prod-flags exact zoals opdracht):**
`C:\Users\jeffrey\Desktop\Projecten\HenkeWonen\tools\repair_price_data.mjs` (R1/H1/M1 — confirm `--confirm-production-price-repair`)
`C:\Users\jeffrey\Desktop\Projecten\HenkeWonen\tools\repair_product_names.mjs` (R5 — `--confirm-production-name-repair`)
`C:\Users\jeffrey\Desktop\Projecten\HenkeWonen\tools\repair_texdecor_categories.mjs` (H2 — `--confirm-production-texdecor-repair`)
`C:\Users\jeffrey\Desktop\Projecten\HenkeWonen\tools\catalog_tooling_env.mjs` (env-guard, prod = `prod:accomplished-kangaroo-354`)
Co-pro-correctieregels: `C:\Users\jeffrey\Desktop\Projecten\HenkeWonen\docs\release-readiness\vat-mapping\copro-inclusive-fix-rules-2026-06-13.json`
**Geen bestaand tool** voor: H3 (EAN-parkeren), H4/H5 (cascade-cleanup), M2–M8.