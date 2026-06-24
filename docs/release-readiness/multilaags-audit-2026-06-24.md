# Multi-laags audit — HenkeWonen (2026-06-24)

> Zeer grondige audit over 8 lagen (security, backend, frontend, data, tests/CI, architectuur, performance,
> dependencies), multi-agent, met **adversariële verificatie per kritiek/hoog-bevinding** tegen de echte code.
> False positives en al-gefixte items (45-punts Convex-audit 13 jun, hygiene-sweep 17 jun) zijn eruit gefilterd.

## Oordeel: **pilot-launch-waardig — 0 kritiek, geen echte blockers**

De security/authz-kern is grondig gehard (rolchecks + tenant-scoping op alle gesamplede functies, field-mode
op facturen, timing-safe HMAC met tenant/sub/exp-binding, server-only tokens) en de geld-denormalisatie is
solide en getest (recalculateQuote na elke regelmutatie, gatloze factuurnummering, drievoudige dubbel-factuur-
guard). Wat resteert: **4 hoog** (allemaal beheersbaar) + **~14 middel** (vooral borging-achterstand + onderhoudsschuld).

---

## 🔴 Hoog (4)

1. **Supply-chain: Astro 6.1.10 — XSS + SSRF** *(dependencies)*. `npm audit` = 9 kwetsbaarheden (4 hoog).
   Astro heeft reflected XSS (unescaped slot name), XSS via spread-props attribute names, en host-header SSRF
   in de prerendered error page. Fix in **astro 6.4.8** (non-major, binnen v6). `package.json:70`.
   → Upgrade naar 6.4.8 + `npm run build && npm test`.
2. **Supply-chain: `ws`-override pint exact de kwetsbare versie** *(dependencies)*. `package.json:90`
   `overrides.ws = "8.20.1"` valt precies in de DoS-range (≥8.0.0 <8.21.0, GHSA-96hv-2xvq-fx4p). De override
   (06-01 voor dedup) **blokkeert actief de fix**. `convex 1.39.1` erft 'm ook. → Bump override naar `>=8.21.0`
   (of verwijder); overweeg `convex 1.42.0` ná de ws-fix.
3. **`verifyToken()` HMAC-productiepad heeft geen runtime-test** *(tests-ci)*. `convex/authz.ts:109-154`.
   De code is correct, maar niets vangt een regressie (omgekeerde `timingSafeEqual`, verwijderde `exp`-check) —
   die zou groen door CI komen. → Test met een echt `AUTHZ_TOKEN_SECRET`: accepteer geldig, wijs af bij
   manipulatie/expiry/verkeerde tenant-sub/rol/cross-tenant.
4. **`updateQuoteStatus` dwingt geen statusovergangen af** *(backend)*. `convex/offertes/core.ts:715-725`
   patcht status onvoorwaardelijk (geverifieerd). Heropenen naar `draft` ná facturering laat de offerte stil
   afwijken van de verstuurde factuur (geen dubbele facturatie — dedup-guard dekt dat). → Whitelist van
   overgangen + weiger heropenen-naar-draft als `existingInvoiceForQuote` een factuur teruggeeft.

---

## 🟧 Middel (geclusterd)

**Geld/status-machines (backend):**
- `updateInvoiceStatus` (`facturen/core.ts:406-461`) — geen factuur-status-machine; betaalde/geannuleerde
  factuur kan willekeurig wisselen. → toegestane transities afdwingen, `betaaldBedrag` resetten bij verlaten `paid`.
- `markInvoicePaid` (`facturen/core.ts:463-534`) — overbetaling niet gecapt; `betaaldBedrag` kan totaal
  overschrijden → lekt naar openstaand-rapportages. → cap op `totaalInclBtw` (0,01-tolerantie).

**Borging loopt achter op hardening (tests-ci):**
- Field-mode-afscherming op facturen heeft **geen test** → regressie als een nieuwe factuurfunctie de gate vergeet.
- Demo-seed heeft **geen prod-deployment-guard** in de functie (`seed/demo.ts:850`) — bij `ALLOW_CONVEX_TOOLING=true`
  op prod zou demo-data in de echte tenant landen. → confirm-literal/env-marker zoals de catalog-tools.
- Workflow-guardrails zijn **string-matching i.p.v. gedrag**, block-extractie is brittle → vals-positief "beveiligd".

**Frontend race-guards inconsistent:**
- `MeasurementPanel.loadMeasurement` (`:176-206`), `QuoteWorkspace.loadWorkspace` (`:66-103`),
  `FieldServiceWorkspace.loadWorkspace` (`:237-265`) missen de `lastRequestId`-race-guard die `AgendaWorkspace`
  wél heeft → out-of-order responses kunnen verse data overschrijven. → gedeelde request-guard-helper.

**Security (fragiele invarianten, vandaag veilig):**
- `ensureUser` vertrouwt client-aangeleverde `role`/`workspaceMode` (`beheer/users.ts:59-110`) → privilege-
  escalatie *als* het sync-token ooit client-side lekt. Vandaag veilig (token is server-only). → internalMutation
  of server-side afleiden; CI-guard dat het sync-token nooit in island-props belandt.

**Data-integriteit (delete):**
- Productverwijdering (`catalog/import.ts:1268-1282`, geverifieerd) laat **dangling `productId`-refs** achter in
  `measurementLines`/`quoteLines` + stale richtprijs-snapshots. Admin-only. → ref-check/blokkeer of snapshot wissen in dezelfde batch.

**Performance (groeit met tenant-historie, nu klein):**
- `listQuotesWorkspace` (`offertes/core.ts:818-863`), `dossierWorkspace`/`listProjects` (`projecten/core.ts:178-252`)
  laden de **volledige tenant-historie met `.collect()` + N+1** subqueries (rooms/lines per rij). → paginatie + batch-fetch.
- Admin-audits (`productionAudit.run`/`validateCatalog`) **falen op prod-schaal** (74k > 7000-limiet) → chunked/per-leverancier.

**Architectuur (onderhoudsschuld):**
- `calculatorRules` inert + `listForTenant` zonder callers (drift-risico) — post-pilot droppen of documenteren.
- Richtprijs-snapshot-velden als losse `v.string()` i.p.v. de bestaande `priceUnit`/`priceType`-enums (`schema.ts:832-833`).

---

## Cross-laag-thema's

1. **Ontbrekende status-machines** op géld-documenten (offertes + facturen) — terugkerend patroon; elke
   status-mutatie hoort een transitie-whitelist af te dwingen.
2. **Borging loopt achter op hardening** — HMAC-verificatie, field-mode en betaalmutaties zijn correct maar
   ónbeproefd; guardrails zijn string-matching → regressie komt groen door CI.
3. **`v.any()` op gevoelige (admin-gated) paden** — import-rows, quoteLine.metadata, measurement-invoer/resultaat.
4. **Frontend race-guards inconsistent** — alleen AgendaWorkspace heeft 'm.
5. **Cascade-/referentie-integriteit inconsistent** — product-delete guard't niet, andere delete-paden wel.
6. **Onderhoudsschuld na NL-migratie** — dode/inerte tabellen (supplierOrders, calculatorRules) + ~15 dode indexen.

---

## Aanbevolen volgorde

**Pre-launch (klein, hoge waarde):**
1. **Dependency-fix**: `ws`-override → `>=8.21.0`, `astro` → 6.4.8, daarna evt. `convex` → 1.42.0; `npm test` + build. (Lost de XSS/SSRF/DoS-highs op.)
2. **`verifyToken`-test** + field-mode-runtime-test (sluit de gevaarlijkste regressiegaten, goedkoop).
3. **`updateQuoteStatus`** heropenen-naar-draft blokkeren bij bestaande factuur (kleine gerichte guard).
4. **`markInvoicePaid`** overbetaling cappen.
5. Bij launch: houd het sync-token strikt server-only + zet `Cache-Control: private/no-store` op portal-HTML met authzToken.

**Post-pilot:** invoice-status-machine, frontend race-guard-helper, product-delete ref-guard, demo-seed-prod-guard,
performance-paginatie van de workspace-queries, dode-index/tabel-opruiming, `v.any()`-aanscherping, calculatorRules-beslissing.
