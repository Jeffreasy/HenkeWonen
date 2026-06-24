# Prod-deploy/migratie-runbook — main → productie (2026-06-24)

> **Doel:** één geordend, geverifieerd plan om de productie-Convex in lijn te brengen met de huidige
> `main` (na de merges van #27 agenda + #28 buitendienst, en al het werk sinds de prod-go-live van 15 jun).
> **Een AI mag prod niet deployen/muteren** — dit runbook is voor de eigenaar. Read-only inspectie mag.
> Opgesteld read-only vanuit de repo; de feitelijke prod-stand is **onbekend tot Fase 0** is gedraaid.

---

## ⚠️ Landmijnen om vóór alles te begrijpen

**L1 — De frontend kan al vóór de Convex-backend live staan.** Vercel deployt (waarschijnlijk) de
frontend automatisch bij een push naar `main`; **Convex deployt handmatig**. Sinds 15 jun is `main`
fors gegroeid (matrix-richtprijs, buitendienst-calculators, agenda-module, bulk-inmeetregels). Als de
Vercel-frontend wél meegelopen is maar `npx convex deploy` niet is gedraaid, dan roept de live
frontend backend-functies aan die op prod **niet bestaan** → kapotte schermen *nu al* (8 koppelingen,
3 high-risk): `/portal/agenda` (blocking page-load `agendaWeek` → foutbanner), de "Raambekleding"-
richtprijs-tab (`listMatrixOptions`/`getMatrixIndicativePrice` → lege tab), bulk-inmeetregels
(`addMeasurementLinesBulk`). → **Fase 0 Q1+Q4.** Regel: **Convex altijd vóór de frontend.**

**L2 — Een directe `convex deploy` van `main` wordt geweigerd door schema-validatie** als de prod-data
niet bij het main-schema past. Er zijn **twee onafhankelijke triggers**, elk met een eigen
expand-then-contract; in deze **volgorde**:

- **L2a — NL-rename (eerst).** De NL-migratie (commit `7e00cdb`) hernoemde **verplichte** velden op
  álle prod-tabellen: `createdAt/updatedAt → aangemaaktOp/gewijzigdOp`, `customers.displayName →
  weergaveNaam`, enz. ([schema.ts:234,252](../../convex/schema.ts) — `v.string()`/`v.number()`, niet
  optioneel). Draagt een prod-rij nog de **oude Engelse sleutel**, dan weigert de deploy net zo hard
  als bij een nieuw-verplicht veld. Volgens `openstaand-2026-06-16.md` is deze migratie **op 15 jun op
  prod gedraaid** (31 klanten intact) → **waarschijnlijk al schoon**, maar dit runbook *verifieert* het
  (Fase 0 Q5) i.p.v. het aan te nemen. Fix indien vuil: schemaValidation-toggle-expand-then-contract
  (zie Fase 1.0).
- **L2b — Ruimte-model A (daarna).** `measurementRooms.projectRuimteId` is **verplicht**
  ([schema.ts:793](../../convex/schema.ts), commit `f2745aa`/A2). De deploy weigert als er één
  `measurementRooms`-rij zonder `projectRuimteId` bestaat → A1 → `backfill_room_links` → A2
  (zie `ruimte-model-runbook.md`). → **Fase 0 Q3.**

L2a en L2b zijn **orthogonaal** aan Q1 (tabel-/code-aanwezigheid): een tabel kan bestaan terwijl de
veld-/koppeling-staat nog de oude is. Alle drie (Q1, Q3, Q5) moeten "veilig" zijn vóór een directe deploy.

---

## Fase 0 — Grondwaarheid vaststellen (READ-ONLY, eerst doen)

Backup + inspectie in één. Maak eerst de read-only export (de export zelf muteert niets):
```
npx convex export --prod --path <duurzaam-pad>\prod-pre-deploy-20260624.zip
# pak de zip uit naar bv. .\prod-export, dan:
node tools/inspect_prod_export.mjs .\prod-export
```
Dat script beantwoordt streamend (muteert niets) alle 5 vragen in één run en print een **beslis-tabel
+ deploy-tak**. De vragen:

| Q | Vraag | Hoe te zien | Bepaalt |
|---|---|---|---|
| Q1 | Staat de **laatste code** al op prod? | Bestaan tabellen `priceMatrices`/`calculatorRules`/`monteurWerktijden`/`monteurAfwezigheid`? **Autoritatief:** `npx convex function-spec --prod` toont `portal.agendaWeek` + `portal.addMeasurementLinesBulk`. | Of Fase 1 nodig is |
| Q2 | Zijn de **referentie-seeds** gevuld? | `priceMatrices`=**29**, `calculatorRules`=**51**, `wasteProfiles`=**8**? | Of Fase 2 nodig is |
| Q3 | Zijn **alle** `measurementRooms` gekoppeld? | 0 rijen zonder `projectRuimteId` = veilig; ≥1 = ruimte-model-A expand-then-contract | Deploy-volgorde (L2b) |
| Q5 | Draagt prod-data nog **Engelse veldsleutels**? | Per tabel 0 docs met oude sleutel (`displayName`/`createdAt`/…)? ≥1 = NL-rename nog niet gedraaid. **Autoritatief:** `tools/migrate_nl_fields.mjs --verify`. | Deploy-volgorde (L2a) |
| Q4 | Loopt de **frontend** voor op de backend? | Live Vercel-prod-commit vs. `origin/main`; als Q1=nee en frontend=main → agenda/richtprijs/bulk zijn NU kapot. | Urgentie L1 |

> **Verwachting o.b.v. docs** (verifiëren, niet aannemen): NL-schema (Q5) staat op prod sinds 15 jun en
> catalogus/prijsdata is schoon (17 jun) → Q5 **waarschijnlijk schoon**. De ruimte-model-A-backfill (Q3),
> de seeds `priceMatrices`/`calculatorRules`/`wasteProfiles` (Q2) en de Convex-deploy van het werk ná
> 15 jun (Q1) zijn **eigenaarsacties die waarschijnlijk nog niet zijn gedraaid**.

---

## Fase 1.0 — NL-rename expand-then-contract (eigenaar; ALLEEN als Q5 = vuil)

**Overslaan als Q5 schoon is** (verwacht — migratie liep 15 jun). Alleen als de inspectie nog Engelse
sleutels vindt; dan vóór alles, want anders faalt elke deploy in Fase 1. Sequentie (zie
`migrate_nl_fields.mjs`-header / `nl-rename-glossary.md` §Prod-runbook):
```
npx convex export --prod --path <pad>\prod-pre-nl-rename.zip     # backup
# zet schemaValidation:false in convex/schema.ts:
npx convex deploy --env-file .env.prod.local                     # accepteert gemengde EN/NL-data
node tools/migrate_nl_fields.mjs --apply --env-file .env.production --production \
  --target=production --confirm-production-nl-rename
node tools/migrate_nl_fields.mjs --verify ...                    # tot overal docsWithAnyOld:0
# zet schemaValidation:true terug:
npx convex deploy --env-file .env.prod.local                     # validatie = vangnet (faalt bij rest-EN)
```

## Fase 1 — Convex-backend deployen (eigenaar)

Additieve velden (`quoteLines.handmatigAangepast`, de `indicative*`-velden, agenda-tabellen) zijn
veilig voor bestaande data. **Doe eerst Fase 1.0 als Q5 vuil was. Daarna hangt de volgorde op Q3:**

**1a. Als Q3 = "0 losse ruimtes" (of prod heeft nog geen measurementRooms):**
```
npx convex deploy --env-file .env.prod.local      # of jouw normale prod-deploy
```
Pusht in één keer alle nieuwe functies + (additief) schema.

**1b. Als Q3 = "≥1 losse ruimte":** expand-then-contract (zie `ruimte-model-runbook.md`):
```
git checkout d78371d   &&  npx convex deploy ...                 # A1: FK optioneel + sync/backfill-mutatie
node tools/backfill_room_links.mjs --apply --env-file .env.prod.local --production \
  --target=production --confirm-production-room-backfill          # tot "0 zonder koppeling"
git checkout main      &&  npx convex deploy ...                 # A2: FK verplicht (validatie bevestigt 0 orphans)
```

## Fase 2 — Referentie-seeds draaien (eigenaar; per Q2-telling)

Alle seeds zijn idempotent (upsert, geen duplicaatrisico). De tenant + catalogus bestaan al op prod
(live sinds 15 jun), dus `seed.run` (core) hoeft normaal niet opnieuw — draai 'm alleen als Q2 toont dat
`categories`/`importProfiles` ontbreken. De **nieuwe** referentiedata wel:

`seedPriceMatrices`/`seedCalculatorRules` zijn `internalMutation` → tooling-gate. Zet tijdelijk
`ALLOW_CONVEX_TOOLING=true` op prod (**en erna weer UIT**), dan:
```
npx convex run catalog/priceMatrices:seedPriceMatrices --prod        # → 29 matrices  (alleen als Q2 ≠ 29)
npx convex run catalog/calculatorRules:seedCalculatorRules --prod    # → 51 regels    (alleen als Q2 ≠ 51)
```
`seedDefaultWasteProfiles` is **GEEN optie maar conditioneel-verplicht** als Q2 `wasteProfiles ≠ 8` (de
8 snijverlies-profielen voeden de inmeet-calculators; ontbreken = rekenen zónder snijverlies). Let op:
het is een gewone `mutation`, geen internalMutation → vereist `tenantId` (henke-wonen) + een **admin-actor**,
niet alleen de tooling-gate. Roep aan met die args (zie `convex/projecten/measurements.ts`).

> ⚠️ De 18 `calculatorRules`-placeholders zijn **onbevestigde aannames** (arbeid=0, snijverlies-%,
> plooifactor). Laat Wim/Simone die bevestigen vóórdat de richtprijs/hoeveelheden echt leidend zijn.
> ⚠️ **Tijdens het `ALLOW_CONVEX_TOOLING`-venster: draai NOOIT `seed/demo:run` op prod** — de demo-seed
> heeft géén aparte prod-guard (alleen dezelfde tooling-gate) en zou fictieve klanten/offertes injecteren.
> Zet de vlag direct na de seeds weer uit.

## Fase 3 — Overige data-reparaties (eigenaar; conditioneel)

De twee schema-blokkerende migraties zijn al afgehandeld in Fase 1.0 (NL-rename, bij Q5 vuil) en Fase 1b
(ruimte-model-A-backfill, bij Q3 ≥1). Resteert alleen niet-blokkerende reparatie:
- **Quote-totalen** (`repair_quote_totals.mjs`): eenmalig, alleen als een dry-run afwijkende/NaN
  `subtotaalExBtw`-totalen toont (legacy van de recalculate-bug). Draai ná de deploy. Idempotent klaar
  zodra `mismatched:0`.

## Fase 4 — Frontend (Vercel)

Frontend deployt op `main`-push. **Borg dat Fase 1 (Convex) klaar is vóór de frontend live komt** (L1).
Als de frontend al vooruit liep: na Fase 1 is de mismatch automatisch opgelost (functies bestaan dan).

## Fase 5 — Verifiëren na deploy

- Smoke: `/portal/agenda` laadt, richtprijs-tab geeft een prijs, een inmeetregel opslaan werkt.
- `npx convex logs --prod` op fouten (prod maskeert gewone `Error` als "Server Error"; ConvexError toont detail).
- Draai `node tools/inspect_prod_export.mjs` opnieuw op een verse export: priceMatrices **29**,
  calculatorRules **51**, wasteProfiles **8**, 0 `measurementRooms` zonder `projectRuimteId`, Q5 overal schoon.

---

## Niet in dit runbook (aparte openstaande sporen — zie `openstaand-2026-06-16.md`)

- Owner-ops/security: secret-rotatie, backup/restore-test, echte LaventeCare-login-smoke, 13 prod-wezen.
- Business: de 18 calculator-bedrijfsregels bevestigen (raakt Fase 2).
- Feature-beslissing: leveranciersbestel-flow (ontworpen, ongebouwd) — nodig voor de pilot?
