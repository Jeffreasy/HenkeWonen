# Sporen-afronding — geconsolideerd (2026-06-24)

> Eén plek voor de resterende openstaande sporen na de prod-deploy van 24 jun. Geverifieerd tegen de
> huidige code (multi-agent audit). Splitsing: **eigenaars-checklist** (prod-mutaties/secrets/business —
> AI kan dit niet), **dev-hygiene post-pilot** (laag-risico code, bewust uitgesteld tot na de pilot om
> niet vlak vóór launch te churnen), en **feature go/no-go**. Calculator-regels: zie het aparte
> `calculator-bedrijfsregels-bevestiging-2026-06-24.md`.

---

## 1. Eigenaars-checklist (één-stap-klaar)

Volgorde: pilot-kritisch eerst. **Maak vóór elke prod-mutatie eerst een verse backup:**
`npx convex export --prod --path C:/Users/jeffrey/HenkeWonen-backups/prod-backup-<timestamp>.zip`.

### 🔴 Pilot-kritisch
- [ ] **Secret-rotatie `AUTHZ_TOKEN_SECRET` (prod + dev).** Verifier-first zodat niets breekt:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # <NIEUW-PROD>
  npx convex env set AUTHZ_TOKEN_SECRET <NIEUW-PROD> --prod                   # Convex prod = verifier eerst
  vercel env rm AUTHZ_TOKEN_SECRET production && vercel env add AUTHZ_TOKEN_SECRET production   # plak <NIEUW-PROD>
  vercel --prod                                                               # frontend pakt nieuwe env op
  npx convex env set AUTHZ_TOKEN_SECRET <NIEUW-DEV>                           # dev (gelekte = dev-secret)
  # .env.local -> <NIEUW-DEV>, .env.prod.local -> <NIEUW-PROD> (Set-Content met array-regels)
  ```
  Verifieer: login → projectpagina → veld opslaan slaagt. Runbook: `security/secret-rotation-runbook-2026-06-13.md`.
- [ ] **`LAVENTECARE_JWT_SECRET`** — **niet eenzijdig**: gecoördineerd met LaventeCare (extern) roteren, daarna Vercel (prod/preview/dev) + `.env.*` + redeploy; SSO end-to-end testen.
- [ ] **Vercel-access-token revoken** op https://vercel.com/account/tokens (OIDC-token is kortlevend → geen actie).
- [ ] **Vercel Preview-env** — 3 lege auth-vars zetten (eerst pull-check, mogelijk al deels gedaan):
  ```
  vercel env pull .env.preview.tmp --environment=preview   # CHECK eerst wat er staat
  vercel env add AUTHZ_TOKEN_SECRET preview                # = Convex DEV-secret
  vercel env add LAVENTECARE_API_URL preview               # dev API-url
  vercel env add LAVENTECARE_TENANT_ID preview             # dev tenant-id
  rm .env.preview.tmp                                       # bevat secrets
  ```
  Zorg dat `ALLOW_DEV_AUTH`/`ALLOW_DEV_AUTHZ_TOKENS` NIET gezet zijn. Runbook: `auth-env-status-2026-06-01.md`.
- [ ] **Echte LaventeCare-login-smoke** (login → `/portal` → `/portal/buitendienst` → `/portal/beheer` + `/portal/catalogus` → logout, incl. MFA; bevestig dat `/portal` na logout naar `/login` redirect). **Blokker:** vereist een echt LaventeCare-testaccount dat nog aangeleverd moet worden.
- [ ] **Reken-/arbeidswaarden** door Wim/Simone laten **verifiëren** — zie `calculator-bedrijfsregels-bevestiging-2026-06-24.md`. NB (na onderzoek): geen €0-arbeid-probleem; arbeid zit al in `serviceCostRules` en snijverlies in `wasteProfiles` (beide gevuld) → alleen verifiëren + 4 gordijn-/egaline-code-defaults bevestigen. De `calculatorRules`-tabel is inert (post-pilot droppen).

### 🟧 Prod-data-hygiëne (met verse backup vooraf)
- [ ] **13 cascade-wezen opruimen** (2 projectRooms, 3 projectTasks, 7 workflowEvents, 1 quoteLine):
  ```
  node tools/cleanup_orphan_records.mjs --env-file .env.prod.local --target=production --production            # DRY-RUN: verwacht matched=13
  node tools/cleanup_orphan_records.mjs --env-file .env.prod.local --target=production --production --apply --confirm-production-orphan-cleanup
  ```
  Bevestig met een herhaalde dry-run (matched=0). Runbook: `data-issues/prod-cleanup-analysis-2026-06-13.md`.
- [ ] **Backup/restore-proef** — restore een prod-backup naar **DEV** (`npx convex import --replace --path <backup>.zip`, nooit blind op prod), verifieer kerntellingen + 1 login; regel off-site + wekelijkse export in. Runbook: `backup-restore-runbook-2026-06-13.md`.

---

## 2. Dev-hygiene — post-pilot (laag-risico, bewust uitgesteld)

Geverifieerd: de twee zwaarste punten (ongebonden `.collect()` in `productionAudit.ts`/`validation.ts`) zijn
**al gefixt** (bounded `take(7000+1)` + `ConvexError`-guard). Wat rest is laag-risico en pilot-schaal-irrelevant
(prod = 31 klanten / 2 projecten). Bewust niet vlak vóór launch gedaan; exact uitvoerbaar wanneer gewenst:

| Onderwerp | Bestand | Fix | Risico/nut |
|---|---|---|---|
| Dashboard-`.collect()` ongebonden | `convex/portal.ts:22-47` | begrens customers/projects/quotes met `.take(N+1)` of status-index | laag; future-proofing hot path |
| `nextInvoiceNumber`-fallback ongebonden | `convex/portalUtils.ts:147-150` | **gevoelig (factuurnummering!)** — index-fix is minder robuust bij >999/jaar of toekomstige jaren; huidige code is correct, alleen koud + ongebonden. Laten of zorgvuldig herzien | laag; cold path 1×/jaar |
| ~12 dode indexen | `convex/schema.ts` | schrap echt-ongebruikte indexen (by_email/by_parent/by_brand×2/by_collection/by_price_list/by_source_file_column/by_price_type/by_row_kind/by_execution_date/by_quote_status/by_quote_number). **Behoud** by_invoice_number/by_due_date/by_ean. **Her-verifieer eerst** elke index (vooral `by_periode` op de net-gedeployde agenda-tabel) | middel; vereist prod-deploy; nut = minder write-overhead op 25k/74k catalogus |
| `validation.ts` per-batch collect | `convex/catalog/validation.ts:330-333` | begrens/summariseer de productImportRows-lus | laag; admin-only |
| `quoteLineFormToApi` NL-rename | `src/components/quotes/quote/quoteTypes.ts` | velden naar NL (cosmetisch); bundelen met bredere Fase-2 frontend-rename | laag; puur cosmetisch |

---

## 3. Feature go/no-go (beide: NIET voor de pilot bouwen)

- **(9) Leveranciersbestel-flow (`supplierOrders`)** — alleen schema (status-machine + indexen), **nul**
  mutations/queries/UI; schema is zelfs onvolledig (geen `supplierOrderLines`-regeltabel). Effort **L**.
  → **Uitstellen tot na de pilot**; inkoop kan in de pilotperiode handmatig. Schema laten staan (kost niets);
  bij bouw eerst datamodel afmaken.
- **(10) Echte PDF + e-mailverzending** — offertes hebben al een nette browser-print-naar-PDF
  (`QuoteDocumentPreview.tsx`); geen PDF-lib/mailprovider geïnstalleerd. Effort **M**.
  → **Uitstellen** (browser-print volstaat voor de pilot). Enige zinvolle kleine pilot-stap (S/M): de
  **factuur-printweergave** optrekken naar het bestaande offerte-print-patroon (facturen missen die nu).

---

## 4. Aanbevolen volgorde

1. **Eigenaar, pilot-kritisch:** secret-rotatie → Vercel Preview-env → LaventeCare-JWT (gecoördineerd) →
   login-smoke (zodra testaccount er is). Parallel: Wim/Simone bevestigen de 18 calculator-regels.
2. **Prod-data-hygiëne** (met backup vooraf): 13 wezen opruimen → backup/restore-proef naar dev + off-site.
3. **Na de pilot:** dev-hygiene-opruiming (één schema-PR voor de dode indexen, dev-getest), en de twee
   features (leveranciersbestel-flow, echte PDF/e-mail) op klantvraag. Optioneel vóór: factuur-printweergave.
