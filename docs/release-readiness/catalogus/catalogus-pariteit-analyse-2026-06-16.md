# Catalogus-bron/pariteit — analyse & beslisdocument (2026-06-16)

> Beantwoordt de openstaande vraag uit `prod-update-runbook-2026-06-15.md` (§Catalogus-aantallen)
> en `plan-richtprijs-inmeting-2026-06-13.md` §7.10: **prod ≈20k vs dev ≈11k producten — welke
> bronset is leidend, en klopt de prod-catalogus?** Geverifieerd tegen repo + git op 2026-06-16.
> Wat NIET vanaf deze machine te verifiëren is (live prod-tellingen), is expliciet als zodanig gemarkeerd.

## Kernconclusie

1. **Er is één bronset.** Zowel dev als prod komen uit dezelfde **32 Excel-bronbestanden** in
   `HenkeWonenDATA` (per bestand uitgesplitst in `docs/generated/catalog-import-summary.md`).
   Het verschil is geen andere data, maar een andere **build-/curatiestaat**.
2. **Prod = volledige rauwe build; dev = gecureerde build.** Prod kreeg de hele 32-bestanden-preview;
   dev kreeg dezelfde import + bewuste opschoningen (`cleanup_catalog.mjs`: categorie `raambekleding`,
   `pvc-click`, leverancier `Roots`) + de Fase 0-datareparaties.
3. **De prod-import van 2026-06-15 kwam vermoedelijk uit een verouderde preview.** Het lokale
   `docs/generated/catalog-import-preview.json` (de bron die `catalog:import:prod` leest) is gedateerd
   **2026-06-01** — vóór de Fase 0-fixes en de parser-fix van **2026-06-13**. Het is sinds 06-01 niet
   opnieuw gegenereerd op deze machine.
4. **Gevolg — BEVESTIGD op prod (2026-06-17 dry-run):** de prod-prijsdata staat nog op de pre-Fase-0-stand.
   `node tools/repair_price_data.mjs --env-file=.env.production --target=production` (read-only) matcht:
   **17.070 prijsregels met verkeerde btw** (`inclusive`/`unknown` → moet `exclusive`; Texdecor CASCAM 10.171
   + PBA 6.662 + ZTAHL 132 + Lamelio 74 + Co-pro 31), **10.149 pseudo-prijzen** ("Qté multiple d'achat"),
   **12 producten** met `packageContentM2` ×1000 te groot. Dit matcht de 2026-06-13-audit (17.039 / 10.149)
   bijna exact → de catalogus is vervangen uit de **pre-fix 06-01 preview**; alleen de Texdecor-categorie is
   daarna los gerepareerd, de btw/pseudo niet. Een eerdere snelle aanname ("die auditcijfers zijn stale")
   was dus fout. **Reparatie nodig vóór de richtprijs naar prod mag** (zie §Reparatie onderaan).

## De drie builds (tijdlijn)

| Moment | Wat | Producten | Prijs-/btw-staat |
|---|---|---:|---|
| Pre-06-01 | Oude dev-baseline (17 van 32 bestanden) | ~10.291 rijen | oud |
| **2026-06-01** | Volledige 32-bestanden-preview gegenereerd → `catalog-import-preview.json` (199 MB) | **27.880 productrijen** (~25k uniek) | 16.203 prijsregels `unknown` btw; pseudo-prijzen aanwezig |
| 2026-06-13 | **Fase 0 op DEV**: 31.860 rijen → `exclusive`; 14.066 pseudo-prijzen weg; 6.991 Texdecor → Behang; **parser + build-pijplijn gefixt** (toekomstige previews bakken dit in) | dev opgeschoond | dev: 0 `unknown`, schoon |
| 2026-06-15 | **Prod go-live**: NL-migratie + `catalog:reset` + `catalog:import:prod` (54 batches). Import leest `catalog-import-preview.json` = **de 06-01 (pre-fix) preview** + losse `repair_texdecor_categories.mjs` op prod | prod ≈20k | Texdecor-categorie gefixt; **btw/pseudo onbevestigd** |

> De per-categorie-divergentie uit de runbook (Behang dev 2878 / prod 143; PVC Dryback dev 48 / prod 176)
> verklaart zich hieruit: prod toont de **pre-fix categorisatie** (Texdecor-behang in "Overig" = 6.991;
> Behang = alleen de 143 niet-Texdecor) plus de ongecureerde categorieën; dev toont de post-fix +
> gecureerde stand. Het is dus geen subset-vs-superset maar twee verschillende generaties van dezelfde bron.

## Wat zeker is vs. wat live-verificatie vereist

**Zeker (uit repo/git):**
- Eén bronset (32 Excels); `catalog:import:prod` leest `docs/generated/catalog-import-preview.json`.
- Dat preview-bestand is 2026-06-01, vóór de 06-13 fixes; niet sindsdien herbouwd op deze machine.
- De upload-strip (`upload_catalog_batch_import.mjs:120-137`) verwijdert alléén `codeprix*`/`unitedevente`
  pseudo-prijzen — **niet** de 10.149 "Qté multiple d'achat"-regels (die gingen in Fase 0 via `repair_price_data.mjs`).
- Dev-cureringen (`raambekleding`/`pvc-click`/`Roots`) zijn dev-only npm-scripts; geen prod-equivalent gedraaid.

**Vereist live read-only prod-export (kan ik niet vanaf deze machine):**
- Huidige prod-tellingen per categorie/leverancier (de "≈20k" en "Behang 143" zijn doc-cijfers, deels stale).
- Of prod-prijsregels `unknown`/`inclusive` btw bevatten (de kernrisico-vraag voor de richtprijs).
- Of de "Qté multiple d'achat"-pseudo-prijzen nog op prod staan.

## De beslissing

**Vraag 1 — datakwaliteit (technisch, urgent):** is de prod-prijsdata op de gecorrigeerde Fase 0-stand?
→ Dit is geen smaakkwestie maar correctheid. Moet geverifieerd, en zo niet, gerepareerd (her-import uit
verse preview, óf de `repair_price_data.mjs`-stappen op prod). Blokkeert betrouwbare richtprijzen op prod.

**Vraag 2 — curatie-scope (business/owner):** moet de prod-catalogus de **volledige rauwe** set zijn
(~20k, inclusief alle Texdecor duplicate-EAN-varianten en de categorieën die dev bewust wegliet) of de
**gecureerde** set (dev-stijl)? Hangt op:
- `plan-richtprijs §7.6`: welke prijslijsten zijn commercieel actueel (vtwonen PVC 11-2023, Ambiant vinyl
  07-2024 vs Roots/Unilin 05-2026)?
- `plan-richtprijs §7.9`: raamdecoratie/Masureel-scope — bewust "geen richtprijs" accepteren? (FlexColours
  is niet geïmporteerd; raambekleding-producten zonder prijsmatrix zijn daarom uit dev gehaald.)
- Duplicate-EAN: al geaccepteerd/geparkeerd voor prod (`duplicate-ean-prod-acceptatie-2026-06-13.md`).

## Aanbevolen route (volgt de bronbesluit-releasepoort)

De `catalogus-bronbesluit-2026-06-01.md` schrijft exact dit pad al voor; concretisering:

1. **Verse preview genereren** met Node 24 (bakt de 06-13 parser/btw/Texdecor-fixes in):
   `.\tools\use-node24.ps1 npm run catalog:preview`
2. **Naar DEV importeren** en stand opnemen: `catalog:reset` (dev) → `catalog:import:dev` → `catalog:status`.
3. **Curatie-besluit toepassen** (vraag 2): bevestig welke `cleanup_catalog`-acties horen bij de canonieke
   definitie en draai die op dev. Leg de canonieke set vast (aantallen per categorie).
4. **Prod read-only verifiëren** vóór elke prod-mutatie:
   `npm run catalog:vat:export -- --target=production` (+ een read-only tellingen-export). Leg naast de
   canonieke dev-stand → bevestigt óf prod al klopt, óf wat afwijkt.
5. **Eén gecontroleerde prod-stap** (eigenaar): óf de `repair_price_data.mjs`-stappen op prod als alleen
   btw/pseudo afwijkt, óf een schone her-import (`catalog:reset` + `catalog:import:prod`) uit de verse
   preview als de hele build moet meebewegen. Altijd backup eerst, dry-run vóór `--apply`.

## Concrete read-only commando's om dit af te ronden

```powershell
# 1. Verse preview (lokaal, schrijft niets naar Convex)
.\tools\use-node24.ps1 npm run catalog:preview:check

# 2. Live prod btw-stand exporteren (read-only)
npm run catalog:vat:export -- --target=production

# 3. Prod-status (read-only tellingen)
npm run catalog:status   # met prod-target/env
```

## Reparatie (eigenaaractie — AI muteert prod niet)

> **UITGEVOERD 2026-06-17 (stap 1–3):** backup gemaakt
> (`OneDrive/HenkeWonenDATA/DATABackup/henke-prod-2026-06-17.zip`), dry-run + `--apply` met de
> gecombineerde regelset gedraaid. Resultaat: 17.070 rijen → `exclusive`, 31 Co-pro-rijen terug naar
> `inclusive` (last-write-wins, correct), 10.149 "Qté"-pseudo verwijderd (prod 84.374→~74.225
> prijsregels), 12 packageContent gecorrigeerd. **Verificatie-dry-run (stap 5) GEDAAN — schoon:**
> vat-rule-1=31 (alleen Co-pro, correct inclusief), pseudo=0, packageContent=0, scanned=74.225 prijsregels.
> Prod-prijsrijen = identiek aan de gecorrigeerde dev-stand.
>
> **Profielmappings (stap 4) GEVERIFIEERD CORRECT 2026-06-17** (read-only prod-export): 61/63 kolommen
> `exclusive`; de enige 2 `inclusive`-kolommen zijn legitiem (Co-pro `Adviesverkoopprijs incl. BTW. per
> verpakking` = audit C-1; Masureel `Aanbevolen verkoopprijs € incl. BTW…` = ook letterlijk "incl. BTW" +
> niet geïmporteerd/dormant). ZTAHL-verkooplijst staat correct op `exclusive`. **Geen fix nodig** — de
> profielen waren al goed gezet door `catalog:prod:bootstrap`; alleen de rijen (uit de pre-fix preview)
> waren fout. Aandachtspunt: bij een toekomstige Masureel-import de btw-stand even met de business bevestigen.
>
> **Curatie-scope BESLOTEN 2026-06-17: "volledig houden (~20k)"** (eigenaarkeuze) — geen her-import/curatie.
> **Catalogus-saga daarmee gesloten:** prod-data én profielen correct, volledige set behouden.

Bevestigd nodig op prod: 17.070 btw-flips + 10.149 pseudo-verwijderingen + 12 packageContent-correcties.
**Valkuil:** de default-regel flipt álles `inclusive→exclusive`, inclusief de 31 Co-pro-rijen
`Adviesverkoopprijs incl. BTW. per verpakking` die wél legitiem inclusief zijn (audit C-1). Daarom een
gecombineerde regelset (catch-all eerst, Co-pro-terugcorrectie daarna): `prod-price-repair-rules-2026-06-17.json`.

1. **Backup prod** (hard vereist): `npx convex export --prod --path <pad-buiten-repo>/henke-prod-<datum>.zip`.
2. **Dry-run met de gecombineerde regels** (verifieer dat Co-pro netto inclusief blijft):
   ```
   node tools/repair_price_data.mjs --env-file=.env.production --target=production \
     --rules-file=docs/release-readiness/vat-mapping/prod-price-repair-rules-2026-06-17.json
   ```
3. **Apply** (muteert prod — bewust):
   ```
   node tools/repair_price_data.mjs --env-file=.env.production --target=production --apply \
     --confirm-production-price-repair \
     --rules-file=docs/release-readiness/vat-mapping/prod-price-repair-rules-2026-06-17.json
   ```
4. **Profielmappings gelijktrekken in de portal-btw-workbench** (anders komt de oude btw-stand terug bij een
   volgende import — de tool waarschuwt hier expliciet voor, o.a. de ZTAHL-verkooplijst stond op `inclusive`).
5. **Her-verifiëren**: dry-run opnieuw → enige resterende match mag alléén de 31 Co-pro-rijen zijn (die horen
   inclusief te blijven); pseudo = 0; packageContent = 0.

## Samenvatting

- Geen databron-mysterie: één bronset, twee build-generaties (prod = rauw/pre-fix, dev = gecureerd/post-fix).
- **Urgent technisch:** verifieer of prod-prijsdata de Fase 0-fixes heeft; waarschijnlijk niet volledig
  (prod imporеteerde vermoedelijk de pre-fix 06-01 preview; alleen Texdecor is los gerepareerd).
- **Owner-beslissing:** canonieke curatie-scope (volledig vs. gecureerd) — hangt op §7.6/§7.9 van het richtprijs-plan.
- **Route:** verse preview → dev → audit → prod read-only diff → één gecontroleerde prod-stap. Volgt de
  bestaande bronbesluit-poort; geen blinde opschoning.
