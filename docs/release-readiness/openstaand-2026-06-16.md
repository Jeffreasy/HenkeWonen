# Openstaand werk — geconsolideerde stand (2026-06-16)

> Eén actuele bron-van-waarheid voor "wat hebben we nog over". Vervangt het verspreide,
> deels verouderde beeld in de losse audit-/release-docs. Geverifieerd tegen de huidige
> code en git-stand op 2026-06-16 (na PR's #1–#14 + de prod-go-live van 2026-06-15).

## Belangrijke nuance vooraf (datakwaliteit prod is NIET aantoonbaar schoon)

De prod-data-audit van **2026-06-13** (`data-issues/convex-prod-data-audit-2026-06-13.md`)
rapporteert grote prijs-/catalogusfouten op de **oude** prod-catalogus: ~17.039 verkeerd-`inclusive`
btw-rijen, ~10.149 pseudo-prijzen ("Qté multiple d'achat"), 6.991 Texdecor-behang in "Overig", 988 namen.
Die oude catalogus is op **2026-06-15** gewist en her-geïmporteerd — **maar vermoedelijk uit de
verouderde `catalog-import-preview.json` van 2026-06-01**, die vóór de Fase 0-fixes en de parser-fix
(beide 2026-06-13) is gegenereerd. Alleen de **Texdecor-categorie** is daarna los op prod gerepareerd
(`repair_texdecor_categories.mjs`, 0 matches). De **btw-stand en de "Qté"-pseudo-prijzen zijn voor prod
NIET bevestigd** — de upload-strip vangt die laatste niet. Dus: de 06-13-cijfers zijn mogelijk grotendeels
nog van toepassing op huidige prod. Dit is een **open technisch punt**, geen afgesloten zaak.
→ Volledige analyse + beslisroute: [catalogus-pariteit-analyse-2026-06-16](./catalogus/catalogus-pariteit-analyse-2026-06-16.md).

## Status: live, kernpoorten gesloten

- NL-schema op prod (migratie 2026-06-15), 31 echte klanten intact.
- Btw-mapping **READY** — 0 onopgeloste verplichte mappings (`vat-mapping-current-state-2026-06-13.md`).
- Catalogus vers geïmporteerd (NL-native, prod's eigen tenantId).
- Auth-provider (`src/lib/auth/laventeCareAuthProvider.ts`) is **echt/productierijp** — de
  "placeholder provider"-notitie in `archief/technisch/project-overdracht-2026-05-05.md` is achterhaald.
- Open PR's: alleen [#14](https://github.com/Jeffreasy/HenkeWonen/pull/14) (buitendienst monteur-filter). Geen open issues.

---

## 🟥 Owner-/bedrijfsbeslissingen (geen dev geblokkeerd, raakt wél correctheid)

| # | Punt | Bewijs | Actie |
|---|---|---|---|
| 1 | **18 calculator-bedrijfsregels onbevestigd.** Alle `labor_surcharge = 0` (arbeid nergens beprijsd); snijverlies-%, gordijn-plooifactor/zoom zijn aannames. Voeden richtprijs én offerte-hoeveelheden. | `convex/catalog/calculatorRulesSeed.ts:297-440` (`vereistKlantInput:true`); test `tests/calculatorRulesSeed.test.ts:18` vergrendelt "18 placeholders". | Bevestigen met Wim/Simone → daarna triviale seed-update. Verzachting: prijs wordt definitief in de offerte gezet ("richtprijs"-ontwerp); hoeveelheden/snijverlies tellen wel echt mee. |
| 2 | **Catalogus-bron/pariteit + prod-datakwaliteit.** Eén bronset (32 Excels); prod = rauwe/pre-fix build, dev = gecureerde/post-fix build. Prod-prijsdata (btw-stand, "Qté"-pseudo-prijzen) is **niet aantoonbaar schoon**. | [catalogus-pariteit-analyse-2026-06-16](./catalogus/catalogus-pariteit-analyse-2026-06-16.md). | **(a)** Prod read-only verifiëren (`catalog:vat:export --target=production`); **(b)** owner kiest curatie-scope (volledig vs. gecureerd); **(c)** verse preview → dev → diff → één gecontroleerde prod-stap. |
| 3 | **Duplicate-EAN backlog** — geaccepteerd/geparkeerd by design (1.871 groepen prod). | `data-issues/duplicate-ean-prod-acceptatie-2026-06-13.md`. | Geen, tenzij her-open-trigger. |

## 🟧 Owner ops/security (live-prod hygiëne)

| # | Punt | Bewijs | Actie |
|---|---|---|---|
| 4 | **Secret-rotatie.** `AUTHZ_TOKEN_SECRET` (dev+prod), `LAVENTECARE_JWT_SECRET` en een Vercel-token ooit blootgesteld; CI/git-route al dicht, live secrets nog de oude. | `security/secret-rotation-runbook-2026-06-13.md` (checklist nog ongevinkt). | Roteren door eigenaar (Convex→Vercel→redeploy→verify) + coördineren met LaventeCare. |
| 5 | **Backup/restore ongetest + niet geautomatiseerd.** Eén handmatige export-zip; restore nooit beproefd; geen periodieke/off-site kopie. | `backup-restore-runbook-2026-06-13.md` (§Openstaande eigenaarsacties). | Eén proef-restore naar dev + periodieke off-site export inplannen. |
| 6 | **Echte LaventeCare-login nooit end-to-end gedraaid** (incl. MFA). Code is rijp; nooit live uitgevoerd. | `auth-env-status-2026-06-01.md` (§Smoke-tests "Niet uitgevoerd"). | Eén login→dashboard→buitendienst→logout smoke met testaccount. |
| 7 | **13 cascade-wezen op prod** (2 projectRooms, 3 projectTasks, 7 workflowEvents, 1 quoteLine). Laag-urgent, onzichtbaar. | `data-issues/prod-cleanup-analysis-2026-06-13.md` §B1; tool `tools/cleanup_orphan_records.mjs` bestaat. | Dry-run + apply door eigenaar. |
| 8 | **Vercel Preview-env** — 3 auth-vars leeg in lokale snapshot; blokkeert alleen Preview-als-acceptatieomgeving (prod niet). | `auth-env-status-2026-06-01.md` §Acties #1. | Waarden zetten in Vercel Preview (mogelijk al gedaan — onzeker). |

## 🟩 Dev-bouwwerk (echte features)

| # | Punt | Bewijs | Actie |
|---|---|---|---|
| 9 | **Leveranciersbestel-flow ongebouwd.** `supplierOrders` volledig ontworpen (status-machine, bestelnummer, leverdatums) maar **nul** mutations/queries/UI; alleen `clearTenantData` raakt 'm. | `convex/schema.ts:1068`; enige refs: `convex/beheer/clearTenantData.ts:116`. | Eerst beslissen of dit voor de pilot nodig is; dan bouwen (mutations + queries + UI). |
| 10 | **(Optioneel) Echte PDF + verzenden** voor offertes & facturen — nu beide alleen browser-print (bewust). | `src/components/quotes/QuoteDocumentPreview.tsx`; `archief/.../quote-print-export-phase-3a-2026-05-01.md`. | Volgende waarschijnlijke klantvraag; geen PDF-lib geïnstalleerd. |

## ⬜ Dev-hygiëne (niet-blokkerend)

| # | Punt | Bewijs |
|---|---|---|
| 11 | **Twee admin-audit-queries doen ongebonden `.collect()`** → falen hard op prod-volume (~20k producten/~74k prijzen). Admin-only/read-only, maar de feature wérkt niet op prod. Fix = de `takeBy`-aanpak die `getCatalogImportStats` al heeft. | `convex/catalog/productionAudit.ts:72-102` (geverifieerd); `convex/catalog/validation.ts` (`validateCatalog`, zelfde patroon). |
| 12 | **`addMeasurementLine` valideert `aantal`/`snijverliesPct` niet** (deels opgevangen door NaN-guard in `calculateLineTotals`). | `convex/projecten/measurements.ts:781-856`. |
| 13 | **`updateProject` laat vrije status-sprong** toe buiten de workflow-invarianten (laag). | `convex/projecten/core.ts:291-330`. |
| 14 | Kleine staart: dashboard-collect (`portal.ts`), `nextInvoiceNumber`-fallback-collect, dode indexen (`schema.ts`), `quoteLineFormToApi` Fase-2 NL-rename (cosmetisch), **QuoteBuilder duplicate-key** (al als achtergrondtaak weggezet), UI/UX-`Resterend` (`docs/ui-ux-verbeterplan.md:94`). | div. |

## ⚠️ Verificatie-gat (samenhangend met punt 2)

De huidige prod-catalogus is **niet** op datakwaliteit ge-audit ná de go-live, en de import kwam
vermoedelijk uit de pre-fix preview. Een read-only prod-export (`catalog:vat:export --target=production`
+ tellingen) is de enige manier om vast te stellen of prod de Fase 0-fixes (btw `exclusive`, geen
pseudo-prijzen) heeft. Tot dat moment: behandel prod-prijsdata als **onbevestigd** — relevant zodra de
richtprijs-feature naar prod gaat (verkeerde btw-stand = ~21% te hoog/laag). Zie de pariteit-analyse.

---

## Samenvatting

Geen release-blokkers meer. Het echte resterende werk:
- **(a)** Wim/Simone laten de 18 calculatorwaarden bevestigen.
- **(b)** Eigenaar-ops: secrets roteren, backup beproeven, login-smoke, wezen opruimen.
- **(c)** Feature: leveranciersbestel-flow — indien nodig voor de pilot.
- **(d)** Open onderzoeksvraag: catalogus-bron/pariteit (welke bronset is leidend).
