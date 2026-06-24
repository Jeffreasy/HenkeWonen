# Prod-deploy/migratie-runbook — main → productie (2026-06-24)

> **Doel:** één geordend, geverifieerd plan om de productie-Convex in lijn te brengen met de huidige
> `main` (na de merges van #27 agenda + #28 buitendienst, en al het werk sinds de prod-go-live van 15 jun).
> **Een AI mag prod niet deployen/muteren** — dit runbook is voor de eigenaar. Read-only inspectie mag.
> Opgesteld read-only vanuit de repo; de feitelijke prod-stand is **onbekend tot Fase 0** is gedraaid.

---

## ⚠️ Twee landmijnen om vóór alles te begrijpen

**L1 — De frontend kan al vóór de Convex-backend live staan.** Vercel deployt (waarschijnlijk) de
frontend automatisch bij een push naar `main`; **Convex deployt handmatig**. Sinds 15 jun is `main`
fors gegroeid (matrix-richtprijs, buitendienst-calculators, agenda-module, bulk-inmeetregels). Als de
Vercel-frontend wél meegelopen is maar `npx convex deploy` niet is gedraaid, dan roept de live
frontend backend-functies aan die op prod **niet bestaan** → kapotte schermen *nu al*:
- `/portal/agenda` (roept `api.portal.agendaWeek`)
- de "Raambekleding"-richtprijs-tab in de inmeting (`getMatrixIndicativePrice`/`listMatrixOptions`)
- bulk-inmeetregels (`addMeasurementLinesBulk`)
→ **Fase 0 vraag Q1 stelt dit vast.** Regel: **Convex altijd vóór de frontend.**

**L2 — Een directe `convex deploy` van `main` kan worden geweigerd.** `main`'s schema maakt
`measurementRooms.projectRuimteId` **verplicht** ([schema.ts:793](../../convex/schema.ts)) — dit is
ruimte-model A2 (de "contract"-stap). Convex' deploy-validatie **weigert** de deploy als er op prod
ook maar één `measurementRooms`-rij zonder `projectRuimteId` bestaat. Dan moet je **expand-then-contract**
doen (A1 deployen → backfill → A2 deployen), zie ruimte-model-runbook. → **Fase 0 vraag Q3.**

---

## Fase 0 — Grondwaarheid vaststellen (READ-ONLY, eerst doen)

Backup + inspectie in één:
```
npx convex export --prod --path <duurzaam-pad>\prod-pre-deploy-20260624.zip
```
Pak de zip uit en beantwoord met streamende node-scripts over de JSONL (lees grote tabellen NOOIT
volledig in context) deze 4 vragen:

| Q | Vraag | Hoe te zien | Bepaalt |
|---|---|---|---|
| Q1 | Staat de **laatste code** al op prod? | Bestaan de tabellen `priceMatrices`, `calculatorRules`, `monteurWerktijden`, `monteurAfwezigheid`? Zo niet → Convex is achter. (Of: `npx convex function-spec --prod` en zoek `agendaWeek`, `addMeasurementLinesBulk`.) | Of Fase 1 nodig is |
| Q2 | Zijn de **referentie-seeds** gevuld? | `priceMatrices` telt **29**, `calculatorRules` telt **51**? | Of Fase 2 nodig is |
| Q3 | Zijn **alle** `measurementRooms` gekoppeld? | Alle rijen hebben een `projectRuimteId`? (0 zonder = veilig; ≥1 zonder = expand-then-contract) | Deploy-volgorde (L2) |
| Q4 | Loopt de **frontend** voor op de backend? | Welke commit draait live op Vercel vs. of Q1 "ja" is? | Urgentie L1 |

> **Verwachting o.b.v. docs** (te bevestigen, niet aannemen): NL-schema + catalogus staan op prod sinds
> 15 jun, prijsdata gerepareerd 17 jun. De ruimte-model-A-backfill en de priceMatrices/calculatorRules-
> seeds zijn als **eigenaarsactie** gemarkeerd en **waarschijnlijk nog niet** op prod gedraaid.

---

## Fase 1 — Convex-backend deployen (eigenaar)

Additieve velden (`quoteLines.handmatigAangepast`, de `indicative*`-velden, agenda-tabellen) zijn
veilig voor bestaande data. **Volgorde hangt op Q3:**

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

## Fase 2 — Referentie-seeds draaien (eigenaar; alleen als Q2 leeg/onvolledig)

Beide zijn `internalMutation` → vereisen de tooling-gate. Zet tijdelijk `ALLOW_CONVEX_TOOLING=true` op
prod (en **terug uit** erna), dan:
```
npx convex run catalog/priceMatrices:seedPriceMatrices --prod        # → 29 matrices
npx convex run catalog/calculatorRules:seedCalculatorRules --prod    # → 51 regels (18 placeholders)
```
> ⚠️ De 18 `calculatorRules`-placeholders zijn **onbevestigde aannames** (arbeid=0, snijverlies-%,
> plooifactor). Laat Wim/Simone die bevestigen vóórdat de richtprijs/hoeveelheden echt leidend zijn.
> Optioneel: `seedDefaultWasteProfiles` als die nog niet bestaan.

## Fase 3 — Data-migraties (eigenaar; conditioneel)

- **NL-rename:** volgens docs al op prod (15 jun) → **alleen verifiëren** (export toont NL-sleutels).
  Volledige sequentie indien tóch nodig: `nl-rename-glossary.md` §Prod-runbook.
- **Ruimte-model-A-backfill:** afgehandeld in Fase 1b (alleen bij Q3 ≥1).
- **Quote-totalen** (`repair_quote_totals.mjs`): alleen draaien als een export afwijkende
  `subtotalExBtw`-totalen toont.

## Fase 4 — Frontend (Vercel)

Frontend deployt op `main`-push. **Borg dat Fase 1 (Convex) klaar is vóór de frontend live komt** (L1).
Als de frontend al vooruit liep: na Fase 1 is de mismatch automatisch opgelost (functies bestaan dan).

## Fase 5 — Verifiëren na deploy

- Smoke: `/portal/agenda` laadt, richtprijs-tab geeft een prijs, een inmeetregel opslaan werkt.
- `npx convex logs --prod` op fouten (prod maskeert gewone `Error` als "Server Error"; ConvexError toont detail).
- Export-tellingen: priceMatrices 29, calculatorRules 51, 0 `measurementRooms` zonder `projectRuimteId`.

---

## Niet in dit runbook (aparte openstaande sporen — zie `openstaand-2026-06-16.md`)

- Owner-ops/security: secret-rotatie, backup/restore-test, echte LaventeCare-login-smoke, 13 prod-wezen.
- Business: de 18 calculator-bedrijfsregels bevestigen (raakt Fase 2).
- Feature-beslissing: leveranciersbestel-flow (ontworpen, ongebouwd) — nodig voor de pilot?
