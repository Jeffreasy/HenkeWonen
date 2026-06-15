# Productie-update runbook — NL-schema + catalogus (2026-06-15)

**Status:** klaar voor uitvoering door de **eigenaar**. Een AI muteert prod niet
(zie `tools/migrate_nl_fields.mjs` header). Claude bereidt voor, valideert op dev en
kijkt mee; alle prod-**muterende** stappen voer je zelf uit.

## Waarom
Productie draait nog het **oude Engelse schema** (`displayName`, `street`, `createdAt`…)
en de **verkeerde catalogus** (≥20.000 ongedupliceerde productrijen). Doel = gelijk aan
`feat/consolidate-nl`: volledig Nederlands schema + de opgeschoonde catalogus (~11.008 producten)
+ ontbrekende onderdelen, **met behoud van de 31 echte klanten**.

## Uitgangsstand prod (read-only gemeten 2026-06-15)
- tenant `henke-wonen` (`n97bdehedkx3de0senxhejwznd86an0b`)
- **customers: 31** (echte PII — behouden) · projects: 1 · quotes: 1 · quoteLines/invoices/measurements/wasteProfiles: leeg
- products ≥20.000 (rommelig) · categories/suppliers/importProfiles/serviceCostRules/quoteTemplates/productPrices: aanwezig (oud schema)
- env: alleen `AUTHZ_TOKEN_SECRET` gezet (geen `ALLOW_CONVEX_TOOLING`)

## Aanpak (besluit)
- **CRM + regels + templates** → in-place EN→NL migreren (idempotent, behoudt de 31 klanten).
- **Catalogus** → **vervangen** (reset → bootstrap → schone import). Dev-catalogus kopiëren kan NIET:
  dev-docs dragen dev's `tenantId` (`md7…`), wat prod's tenant-scoping zou breken. Opnieuw importeren
  geeft prod's eigen `tenantId`, schoon én NL-native.

---

## Voorwaarden
- [ ] `.env.production` met `AUTHZ_TOKEN_SECRET` (voor de tool-actor) — buiten de repo/git.
- [ ] Admin-gebruiker op prod (voor de migratie-actor).
- [ ] Bron-Excels voor de catalogus-import beschikbaar (zelfde set als dev gebruikte).
- [ ] Stille periode: geen klantactiviteit tijdens de migratie.

---

## Fase 0 — Backup (HARDE voorwaarde, onomkeerbaar zonder)
```
npx convex export --prod --path <duurzaam-pad-buiten-repo>/henke-prod-backup-2026-06-15.zip
```
> Bevat PII. Bewaar veilig, niet in git. Zonder geslaagde backup: STOP.

## Fase 1 — NL-code/schema deployen (transitioneel)
1. Zet in `convex/schema.ts`: `defineSchema({ … }, { schemaValidation: false })`.
2. Deploy de NL-code naar prod:
```
npx convex deploy --prod
```
> `schemaValidation:false` laat prod tijdelijk de oude EN-documenten accepteren naast de nieuwe NL-code.

## Fase 2 — NL-velddatamigratie (CRM + regels + templates)
Driver: `tools/migrate_nl_fields.mjs` (cursor-loop, idempotent, dryRun-default).
1. **Dry-run** (read-only, toont wat zou wijzigen):
```
node tools/migrate_nl_fields.mjs --env-file .env.production --production --target=production \
  --only=tenants,users,customers,customerContacts,projects,projectRooms,projectTasks,projectWorkflowEvents,timelineEvents,quotes,quoteLines,measurements,measurementRooms,measurementLines,invoices,supplierOrders,serviceCostRules,quoteTemplates,wasteProfiles
```
2. **Toepassen** (voeg `--confirm-production-nl-rename` toe; driver schrijft dan echt):
```
node tools/migrate_nl_fields.mjs --env-file .env.production --production --target=production \
  --confirm-production-nl-rename --only=<zelfde lijst>
```
3. **Verifiëren** (telt resterende oude velden; moet 0 zijn):
```
node tools/migrate_nl_fields.mjs --verify --env-file .env.production --production --target=production \
  --only=<zelfde lijst>
```
> De catalogus-tabellen (products, productPrices, categories, suppliers, brands, productCollections,
> priceLists, importProfiles, catalogDataIssues, productImportBatches/Rows) bewust NIET migreren —
> die worden in Fase 3 vervangen en komen NL-native binnen.

## Fase 3 — Catalogus vervangen (aanpak A)
```
# 3a. Geïmporteerde catalogus op prod wissen
npm run catalog:reset -- --production --target=production --confirm-reset-imported-catalog

# 3b. Config-basis (categorieën, leveranciers, servicekosten, template, importprofielen) NL-native
npm run catalog:prod:bootstrap

# 3c. Importpreview bouwen uit de bron-Excels (lokaal, schrijft preview-bestand)
npm run catalog:preview        # of catalog:preview:check eerst (dry)

# 3d. Schone catalogus-batch importeren naar prod
npm run catalog:import:prod

# 3e. Statuscontrole
npm run catalog:status
```
> Controleer na 3e dat het productaantal in lijn ligt met dev (~11.008) en niet de oude ~20.000.

## Fase 4 — Ontbrekende onderdelen aanvullen
- `wasteProfiles` (leeg op prod, nodig voor de inmeet-calculators): draai `seedDefaultWasteProfiles`
  voor de tenant (admin-actor). Bevestig of `catalog:prod:bootstrap` dit al dekt; zo niet, los draaien.
- Eventuele andere referentiedata die dev wél heeft en prod niet → via `seed.run` (idempotent, wist niets).
  Vereist tijdelijk `ALLOW_CONVEX_TOOLING=true` op prod; **daarna weer uit**.

## Fase 5 — Schema dichtzetten + herdeploy
1. Zet `schemaValidation: true` terug in `convex/schema.ts`.
2. ```
   npx convex deploy --prod
   ```
> Deze deploy faalt als er nog één EN-veld rest → harde garantie dat de migratie volledig is.

## Fase 6 — Frontend (Vercel-productie)
- Pas **nadat** Convex-prod groen is: `feat/consolidate-nl` → `main` mergen.
  Dat triggert de Vercel-prod-deploy. Eerder mergen geeft een frontend(NL)↔backend(EN)-mismatch
  (exact de sessie-bug van eerder, dan op prod).

## Fase 7 — Post-checks
- [ ] Inloggen op prod-portal werkt (sessie-sync OK).
- [ ] Dossiers: 31 klanten zichtbaar, namen/adres intact.
- [ ] Catalogus: filtert, juiste aantallen, geen dubbelen.
- [ ] `npm run catalog:status` schoon.
- [ ] Steekproef: 1 klant openen, project/offerte/factuur-flow rendert.

## Rollback
- Bij twijfel/fout vóór Fase 5: herstel uit de Fase 0-backup:
  ```
  npx convex import --prod --replace <backup>.zip
  ```
- Frontend (`main`) pas mergen na groen → rollback frontend = revert merge-commit.

---

## Rolverdeling
| Stap | Wie |
|---|---|
| Backup, alle `--prod` deploys, migrate-apply, catalogus-reset/import, schema-toggle, main-merge | **Eigenaar** |
| Spec valideren, dev dry-run, runbook/commando's aanleveren, meekijken, post-checks-analyse | **Claude** |

---

## UITGEVOERD 2026-06-15 (avond) — bevindingen & afwijkingen

De migratie is uitgevoerd (met toestemming, in een staf-only onderhoudsvenster). Resultaat: **geslaagd**.

**Stand vooraf (gemeten):** prod = volledig oud Engels schema, 31 echte klanten + 1 project + 1 quote,
catalogus ≈20.000 oude/rommelige producten. Login is staf-only (5 gebruikers @henkewonen.nl/@laventecare.nl),
geen klant-logins → impact = intern portal ~20 min onbeschikbaar, geen klant-impact.

**Wat afweek van het plan:**
1. **Migratiescope:** alle 30 spec-tabellen behalve de 5 die `catalog:reset` tóch wist
   (products, productPrices, priceLists, productCollections, brands). Gemigreerd: **38.946 docs** over 25 tabellen
   (grotendeels oude `productImportRows`-historie). Verify groen (0 EN-velden).
2. **`catalog:prod:bootstrap`** maakt de config-basis aan; categories/suppliers/importProfiles werden in stap 2
   gemigreerd (reset raakt ze niet) zodat de eind-validatie slaagt.
3. **BUG gevonden + gefixt:** `tools/upload_catalog_batch_import.mjs` stuurde nog Engelse mutatie-args
   (`fileType`/`fileName`/…) terwijl de NL-rename de Convex-functies had vernederlandst (`bestandsType`/…).
   Eerste NL-import faalde op `createPreviewBatch` → tool gefixt (commit `cfb80dc`), daarna import OK
   (54 batches, 0 fouten). **Latent gebleven** omdat dev's catalogus vóór de rename was geïmporteerd.
4. **Volgorde reset↔import:** reset slaagde, import faalde (bug) → korte interim met lege catalogus; na de
   toolfix opnieuw geïmporteerd (reset niet nodig, catalogus was al leeg).
5. **Frontend-build vooraf lokaal geverifieerd** (`npm install --engine-strict=false && npm run build` →
   0 errors) omdat de laptop node 25 draait i.p.v. de vereiste 24.x.

**Catalogus-aantallen (let op):** prod heeft na de import ≈20k producten (de huidige 32-bestanden canonieke
preview), dev ≈11k. Dit zijn **verschillende builds**, geen "prod = dev + extra" — per categorie wijken de
aantallen beide kanten op af (bv. Behang dev 2878 / prod 143; PVC Dryback dev 48 / prod 176). De
`cleanup_catalog`-scripts verwijderen **hele** categorieën/leveranciers en zijn dus NIET geschikt om prod
"gelijk aan dev" te trekken. Parity vereist een bewuste keuze welke preview/bronset de waarheid is — niet blind opschonen.

**Open follow-ups:** stale `productImportRows`-historie (~38k, cosmetisch) en de catalogus-bron-keuze.
