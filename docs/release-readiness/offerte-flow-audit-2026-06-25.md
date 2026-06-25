# Offerte-flow — volledige audit (2026-06-25)

> Multi-agent audit (6 dimensies, adversarieel geverifieerd): status-machine · regelderivatie · prijzen/btw ·
> document/klantversie · conversie naar factuur · performance/authz/UX. Bouwt voort op de samenwerkings-audit
> (de blocker die toen gefixt is) en de multilaags-audit.

## Oordeel: **rekenkern solide, status-/conversielaag gespleten — niet launch-klaar zonder fix-batch**

De **rekenkern is launch-klaar**: één regel-rekenkern (`calculateLineTotals`, alle invoerpaden), btw-consistentie sluit
volledig (offerte → factuur → document, sum-of-rounded-lines), inkoop/marge lekt niet naar de klant
(`selectCustomerFacingPrice`), de bulk-import uit de inmeting is atomair + idempotent, en er is geen XSS-oppervlak.

**Maar** de status-/conversielaag heeft **twee parallelle paden** die niet geconsolideerd zijn:
- **Portaalpad** (`updateQuoteStatus`, `offertes/core.ts`) — draagt **alle** gates (prijs/richtprijs/leeg) + herstellogica
  (sibling-auto-cancel + measurementLines-restore + reopen-gate).
- **Winkel-dossierpad** (`processProjectAction`, `projecten/core.ts`, vanuit `ProjectDetail`) — **omzeilt** ze.

Daardoor leeft de samenwerkings-blocker deels op én is de richtprijs-gate maar half afgedekt. Geld- en data-integriteit
zijn geraakt, geen cosmetiek. De kern eronder is al solide; de fix is **consolidatie**.

---

## 🔧 Must-fix (6)

1. **Winkel-accept omzeilt de prijs-/richtprijs-/leeg-gates** *(hoog, bevestigd)*
   `processProjectAction('quote_accepted')` ([core.ts:948-955](convex/projecten/core.ts:948)) patcht status `accepted`
   **zonder** de 3 checks die `updateQuoteStatus` ([offertes/core.ts:738-770](convex/offertes/core.ts:738)) wél doet
   (geen €0-regel, geen `requiresManualPriceReview`, ≥1 geprijsde regel). → een offerte met ongecontroleerde richtprijs
   of €0-regels kan via de winkel-UI geaccepteerd **en gefactureerd** worden. De richtprijs-blocker dekt maar één pad.
   → **Fix:** gedeelde helper `assertQuoteAcceptable(ctx, tenantId, quoteId)` in beide accept-paden (+ defense-in-depth in `createInvoiceFromQuote`).
2. **Dossier-annulering bevrijdt de meetregels niet** *(middel — reproduceert de blocker)*
   `processProjectAction('cancelled')` ([core.ts:1016-1024](convex/projecten/core.ts:1016)) roept geen
   `restoreMeasurementLinesForQuote` aan → geïmporteerde meetregels blijven permanent `converted`.
   → **Fix:** de helper exporteren + aanroepen (overweeg expliciete `quoteId` i.p.v. latest).
3. **`expired`-status bevrijdt de meetregels niet** *(middel)*
   `updateQuoteStatus` heeft geen `expired`-tak ([offertes/core.ts:866-879](convex/offertes/core.ts:866)); `statusMap`
   mist 'm. → **Fix:** behandel `expired` identiek aan cancelled/rejected (restore + statusMap). Zet cancelled/rejected/expired
   in één terminal-set zodat een nieuwe terminale status nooit een restore-pad mist. *(Nu alleen handmatig bereikbaar — geen cron.)*
4. **Winkel-accept annuleert sibling-offertes niet** *(middel)*
   `processProjectAction('quote_accepted')` mist de auto-cancel + restore-lus die `updateQuoteStatus`
   ([offertes/core.ts:787-808](convex/offertes/core.ts:787)) wél heeft → twee "levende" offertes op één geaccepteerd dossier + `converted` siblings.
5. **Factuur is header-only, geen regelsnapshot** *(conversie)*
   `invoiceDetail` ([facturen/core.ts:143-198](convex/facturen/core.ts:143)) leest regels **live** uit de offerte → een
   uitgereikte/betaalde factuur is niet immutabel. → **Fix:** snapshot de regels bij conversie, óf blokkeer elke
   quote-/totaal-mutatie zodra `existingInvoiceForQuote` truthy is (nu alleen op `status==='draft'`).
6. **Twee factuur-aanmaakpaden + niet-atomaire duplicaatgate**
   `createInvoiceFromQuote` ([facturen/core.ts:299-379](convex/facturen/core.ts:299)) + `processProjectAction('invoice_created')`
   ([core.ts:991-1014](convex/projecten/core.ts:991)). → **Fix:** `by_quote`-index op invoices + consolideer (invoice_created
   roept createInvoiceFromQuote aan i.p.v. eigen `?? 0`-inserts).

> **Rode draad:** must-fix 1/2/4 (en deels 6) komen uit **dezelfde wortel** — `processProjectAction` heeft een parallelle
> offerte-status-logica die om de canonieke `updateQuoteStatus` heen loopt. Eén consolidatie dicht ze samen.

---

## 🚀 Backlog (post-launch, geprioriteerd)

- **Expliciete toestandsmachine** (`allowedTransitions`-map) in `updateQuoteStatus` + spiegelen in de UI; weiger ongeldige sprongen. *(middel)*
- **Btw-uitsplitsing per tarief** (grondslag + btw per 9/21/0%) in document + factuur — vereist voor een formeel NL-conforme factuur bij gemengde tarieven. *(middel)*
- **Korting zichtbaar** op het klantdocument (nu verzoent regeltotaal niet met aantal×prijs). *(middel)*
- **Print-only "CONCEPT"-markering** wanneer de status niet sent/accepted is (relevant nu buitendienst mag finaliseren). *(middel)*
- **service_rule-richtprijs symmetrisch** maken bij import (komt nu op €0 binnen). *(middel)*
- **Tenant-scoped bedrijfsgegevens** (IBAN/KvK/btw-nr nu hardcoded in `henkeCompanyProfile`) — **blokkerend vóór een 2e tenant**. *(laag nu)*
- Winkel-accept expliciete `quoteId` i.p.v. "laatst gewijzigde" · `by_quote`-index voor `existingInvoiceForQuote` · `clearedPriceReviewMetadata`-hardening · metadata-whitelist naar client · dode legacy-mutaties (`create`/`addLine`) opruimen · prijs-snapshot-timestamp. *(laag)*

---

## ✅ Sterke punten (launch-klaar)

- **Eén regel-rekenkern** (`calculateLineTotals`) over álle invoerpaden — geen divergerende tweede implementatie; NaN/Infinity geweerd, btw 0-100 begrensd.
- **Btw-consistentie sluit volledig**: sum-of-rounded-lines (NL-correct); factuur kopieert offertetotalen letterlijk + valideert binnen €0,01; document toont diezelfde opgeslagen totalen.
- **Geen marge-/inkoop-lek**: `selectCustomerFacingPrice` whitelist alleen advice_retail/retail met besliste btw; bij twijfel `null` (liever geen richtprijs dan een verkeerde).
- **Atomaire, idempotente bulk-import** uit de inmeting (alles-of-niets, dedup, ready_for_quote-gate, volledige relatie-validatie).
- **De blocker is correct gedicht op het updateQuoteStatus-pad** (alleen niet doorgetrokken naar processProjectAction); reopen-gate correct; handmatige prijs overleeft recalculate; geen XSS; document-randgevallen netjes.

> **Kernconclusie:** de fix is **consolidatie van twee paden**, geen herontwerp — gedeelde `assertQuoteAcceptable` +
> `restoreMeasurementLinesForQuote` over beide accept/annuleer-paden, een `expired`-tak, en factuur-hardening.
