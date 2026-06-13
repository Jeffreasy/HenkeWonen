# Volgende stappen — geprioriteerde aanbeveling (2026-06-13)

> **Bron:** multi-agent onderzoek over 5 dimensies (testdekking, security/secrets, data-/ops-schuld,
> tooling/CI/DevEx, product/feature-gereedheid), gegrond in de echte repo-staat, na de volledige
> Convex-code-audit + fixes van deze sessie. Aanbevelingen gewogen op waarde × inspanning × risico.

## Aanbevolen volgende stap

### Roteer AUTHZ_TOKEN_SECRET op dev én prod (verifier-first)

De enige openstaande blootstelling met een direct hoog-impact exploit-pad: dit secret draagt de volledige
Convex-mutatie-autorisatie, de waarde is gelekt (in chat geplakt) én gelijk aan de dev-secret. Wie de waarde
kent kan nu geldige actor-tokens tekenen voor elke rol/gebruiker op de prod-tenant — inclusief de financiële
module. De code-/CI-kant is al opgeschoond (commit `e1220aa`); rotatie is de énige resterende mitigatie en
zuiver operationeel. De feature is net live en de pilot start — draai geen live tenant met echte klantdata op
een sleutel waarvan je weet dat hij gelekt is.

- **Waarde:** hoog · **Inspanning:** S (~15 min) · **Risico:** medium (korte ~40s verifier/signer-mismatch tijdens redeploy → verifier-first)

**Eigenaarsactie** (een AI mag prod-env niet schrijven/deployen):
1. `openssl rand -hex 32`
2. **Eerst** Convex prod (verifier): `npx convex env set AUTHZ_TOKEN_SECRET <nieuw> --prod`
3. Dan Vercel Production (signer) → `vercel --prod` redeploy
4. Verifieer met één kleine mutatie op de live portal
5. Herhaal voor dev + werk `.env.local` / `.env.prod.local` bij
6. Vink de runbook-checklist af (`docs/release-readiness/security/secret-rotation-runbook-2026-06-13.md` §1b–1f)

Combineer in hetzelfde security-blok: Vercel-token verifiëren/revoken, en de LaventeCare-rotatie plannen.

## Sterke runner-ups
1. **Backup- & restore-strategie vastleggen + 1 restore testen** (data-ops · hoog/S/laag) — prod-herstel hangt nu af van één handmatige zip; een ongeteste backup is geen backup. Check Convex auto-snapshots + retentie, documenteer, doe één proef-restore naar dev.
2. **ESLint + Prettier (flat-config) + CI-lint-gate** (tooling · hoog/M/laag) — 48,7k LOC zonder statische vangrail buiten type-checking. `no-floating-promises` op `convex/**` vangt vergeten `await`s (stille geld-/data-bugs); `react-hooks` beschermt de nieuwe richtprijs-UI. Gedragsneutrale baseline.
3. **convex-test harness: factuurnummering + idempotentie eerst** (test · hoog/M/laag) — de net-gewijzigde geld-kritieke mutaties zijn alleen source-grepped. `nextInvoiceNumber` (gatloze reeks) + idempotentie (geen dubbele facturen) = hoogste regressierisico. Basis voor latere tests.

## Later / lage prioriteit
- Vercel-token revoken + Preview-env herstellen (security · S/laag — meeneem met AUTHZ-rotatie)
- LAVENTECARE_JWT_SECRET roteren (security · M/hoog — vereist LaventeCare; bekend-risico-met-datum)
- Veilige delete-op-`_id`-mutatie + 13 cascade-wezen opruimen (data-ops · M/laag)
- Node pinnen op 24 + `.nvmrc` (tooling · S/laag — meeneem met ESLint)
- Convex-deploy automatiseren in CI met deploy-key (tooling · M/medium)
- Raamdecoratie-richtprijs: FlexColours-matrix importeren (product · L/medium — vervolgsprint ná pilotstabilisatie)
- Lichte staleness-/samenwerkings-vangrails in MeasurementPanel (product · M/laag)
- productImportRows-bloat + dossierAttachments expliciet parkeren (data-ops · S/laag)

## Alle aanbevelingen (waarde × inspanning × risico)

| Titel | Dimensie | Waarde | Inspanning | Risico |
|---|---|---|---|---|
| **Roteer AUTHZ_TOKEN_SECRET (dev+prod)** | security | hoog | S | medium |
| Backup-/restore-strategie + 1 restore testen | data-ops | hoog | S | laag |
| ESLint + Prettier + CI-lint-gate | tooling | hoog | M | laag |
| convex-test harness: factuur + idempotentie | test | hoog | M | laag |
| recalculateQuote + calculateLineTotals edge-cases | test | hoog | S | laag |
| Verifieer/revoke Vercel-token + Preview-env | security | medium | S | laag |
| Plan rotatie LAVENTECARE_JWT_SECRET (extern) | security | hoog | M | hoog |
| Delete-op-`_id`-mutatie + 13 cascade-wezen | data-ops | medium | M | laag |
| Node pinnen op 24 (.nvmrc + CI) | tooling | medium | S | laag |
| Convex-deploy automatiseren in CI | tooling | medium | M | medium |
| prijs-import-dedup convex-test | test | medium | M | laag |
| Raamdecoratie-richtprijs (FlexColours) | product | hoog | L | medium |
| MeasurementPanel staleness-vangrails | product | medium | M | laag |
| productImportRows-bloat parkeren | data-ops | laag | S | laag |
