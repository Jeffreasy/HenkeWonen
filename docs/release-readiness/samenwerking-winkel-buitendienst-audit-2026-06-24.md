# Samenwerking Winkel ↔ Buitendienst — audit (2026-06-24)

> Gerichte multi-agent audit (6 dimensies, adversarieel geverifieerd) van de **naden tussen de twee kanalen**:
> Winkel (`workspaceMode: general`, `/portal/*`) en Buitendienst (`field`, `/portal/buitendienst/*`), die één
> gedeeld `projects`-dossier delen. Focus: waar lekt of dupliceert data bij de overdracht, en is de mode-grens
> consistent?

## Eindoordeel: **opgelost → pilot-klaar** (was: 1 blocker + 2 hoog)

> **Status-update 2026-06-24:** de blocker (#1) en het dashboard-lek (#3) zijn **gefixt + getest** (PR #37).
> Voor #2 besliste de eigenaar dat **buitendienst offertes bewust mág finaliseren** — geen codewijziging, de
> "winkel finaliseert"-aanname was achterhaald. Daarmee is de samenwerking pilot-klaar.

Het fundament is solide en de happy-path werkt; de risico's zaten in **onomkeerbare/lekkende randgevallen** —
die zijn nu gedicht.

## Naden-kaart (de handoff-keten)

| Overdracht | Status | Naad |
|---|---|---|
| **Klant → afspraak** | ⚠️ flow-gat | Intake-snelroute "maten bekend" bestaat **niet** als geïntegreerde flow; dossier blijft in "plan inmeting" terwijl er niets te plannen valt |
| **Afspraak → inmeting** | ✅ grotendeels | Goed gebouwd (userId-monteurmatch, bidirectionele inmeetdatum-sync). Naden: capaciteit puur advies (overboeken kan); winkel-knop "Inmeting starten" koppelt **geen monteur** → bezoek onzichtbaar in agenda |
| **Inmeting → conceptofferte** | ⚠️ asymmetrie | Meetregels netjes `ready_for_quote` + prijsreview-gate. Lekt: ruimte-**notities syncen niet**; winkel kan dossier-maten overschrijven die de inmeting nooit terugziet; inmeetacties **loggen geen workflow-event** → winkel ziet voortgang niet |
| **Conceptofferte → offerte** | 🔴 **grootste naad** | Import is transactioneel + één-keer. MAAR: ruwe meetinvoer wordt niet gesnapshot; **🔴 terugdraai-gat** (zie #1); buitendienst kan zelf finaliseren (zie #2) |
| **Offerte → factuur** | ✅ dichtgetimmerd | De **enige** echt server-side afgedwongen mode-muur (`ensureNotFieldMode` 6×). Buitendienst kan geen facturen |

---

## 🔴 Blocker + 🟠 Hoog (3, bevestigd)

1. **🔴 [BLOCKER] Afgewezen/geannuleerde offerte maakt buitendienst-inmeetwerk permanent onbruikbaar.**
   Bij `rejected`/`cancelled` (en automatisch bij `accepted` van een concurrerende offerte → auto-cancel) blijven
   de geïmporteerde `measurementLines` op status **`converted`** staan → ze verdwijnen **voorgoed** uit de import-
   picker; er is geen UI-knop om ze te bevrijden (alleen `deleteQuoteLine` herstelt, `updateQuoteStatus` niet).
   In een pilot waar offertes afwijzen/herzien routine is, **vernietigt dit stil het inmeetwerk** en dwingt opnieuw
   meten af. `convex/offertes/core.ts` (updateQuoteStatus 805-812 + auto-cancel 728-747 vs herstel alleen in
   deleteQuoteLine 485). **Fix:** gedeelde helper `restoreMeasurementLinesForQuote(quoteId)` (zet terug op
   `ready_for_quote`, wis geconverteerde-offerte-refs), aanroepen vanuit updateQuoteStatus (rejected/cancelled) +
   de auto-cancel-lus. Klein, gericht. **✅ GEFIXT + getest (PR #37):** helper toegevoegd; 3 convex-tests
   (rejected/cancelled/auto-cancel).

2. **✅ Buitendienst mág offertes finaliseren — bewuste keuze (geen bug).** De code laat het toe
   ([QuoteBuilder.tsx:775](src/components/quotes/QuoteBuilder.tsx:775) fieldAllowedStatuses +
   [offertes/core.ts:641](convex/offertes/core.ts:641) geen workspaceMode-gate). **Eigenaarsbesluit 2026-06-24:**
   Wim/Simone sluiten deals ter plekke (klant akkoord tijdens de inmeting), dus buitendienst finaliseert bewust.
   De "winkel finaliseert"-aanname was achterhaald → **geen codewijziging**; alleen de factuur blijft winkel-exclusief.

3. **🟠 Dashboard lekt openstaande/achterstallige factuurbedragen naar field-mode.**
   `portal:dashboard` `invoiceStats` ([portal.ts:205](convex/portal.ts:205)) gaf openstaand bedrag + achterstallig
   terug **zonder** field-grens — exact de data die op facturen bewust geblokkeerd is. Bereikbaar via
   `/portal?full=1` → DashboardShell. **✅ GEFIXT + getest (PR #37):** voor `workspaceMode='field'` worden de
   factuurbedragen op 0 genormaliseerd; 2 convex-tests (winkel ziet bedrag, buitendienst niet).

---

## 🟧 Middel (14, geclusterd)

**Mode-grens (de grootste structurele zwakte):**
- `workspaceMode` wordt server-side **alleen op facturen** afgedwongen → het label "field-mode wordt server-side
  afgedwongen" dekt feitelijk alleen facturen; mode-afdwinging hangt af van of een dev er per mutatie aan denkt.
- Winkel-routes blokkeren field-users **niet op routeniveau** (alleen `!session`).
- Winkel-knop "Inmeting starten" (`createForProject`) zet `gemetenDoor` op de kantoornaam **zonder
  `gemetenDoorUserId`** → het bezoek mist in elke monteur-weekagenda (werk bestaat maar is onzichtbaar).

**Handoff (data-onderbouwing):**
- Ruwe meetwaarden (exacte maten, invoer/resultaat) gaan **verloren bij import** — alleen `aantal`/`eenheid`/prijs
  blijft; de onderbouwing is na meetwijziging onherleidbaar. → compacte onveranderlijke snapshot in `quoteLines.metadata`.
- Snapshot mist versheid/herkomst (geen `indicatiefVastgelegdOp`) → winkel ziet niet hoe oud de richtprijs is.
- Intake-snelroute "maten bekend" bestaat niet als geïntegreerde flow.

**Gedeeld dossier (consistentie):**
- Geen app-level optimistic-concurrency (last-write-wins); `updateProjectRoom` schrijft maten/notities **onvoorwaardelijk**
  (geen hasArg-guard) → kan stil leegmaken/overschrijven.
- Ruimte-notities syncen niet tussen inmeting en dossier; intern vs klant loopt door elkaar.
- Winkel kan gemeten maten overschrijven die de inmeting nooit terugziet (asymmetrische eenrichtings-sync).
- Buitendienst-inmeetacties loggen **geen workflow-event** → winkel-tijdlijn toont de voortgang niet.

**Agenda/planning:**
- Capaciteit (2 plekken/dag) wordt **nergens server-side afgedwongen** → overboeken altijd mogelijk.
- Buitendienst ziet via `alleenEigen` alleen de eigen week → geen team-capaciteit bij (her)plannen.
- Verwijderde monteur-user laat dangling `gemetenDoorUserId` achter en **breekt de week-agenda** (requireMonteur throwt).
- `inmeetBeschikbaarheid` negeert `heleDag` → halve-dag-afwezigheid blokkeert ten onrechte het inmeetvenster (afwijkend van de week-agenda).

---

## ✅ Wat robuust is

- **Inkoop/marge-grens is degelijk:** alle richtprijs-/picker-paden lopen via `selectCustomerFacingPrice` (alleen
  advies/retail) — geen inkoop/marge/commissie lekt naar buitendienst.
- **Factuur-grens werkt** (de enige echt afgedwongen mode-muur, `ensureNotFieldMode` 6×).
- **Prijsreview-gate werkt:** ongecontroleerde €0-/richtprijs-regels glippen niet door naar verstuurd/akkoord.
- **Convex-serializability** dekt de afwezigheid van app-level OCC grotendeels (geen stil interleaving-verlies).
- **Agenda-kern robuust:** userId-primaire monteurmatch + naam-fallback, bidirectionele inmeetdatum-sync, tenant-isolatie.
- **Meetregel-import** transactioneel + één-keer; richtprijs-snapshot blijft bewaard; gedeelde MeasurementPanel (geen winkel/field-drift).

---

## Aanbevolen volgorde

**Vóór pilot (klein, gericht):**
1. **`restoreMeasurementLinesForQuote`-helper** in updateQuoteStatus (rejected/cancelled) + auto-cancel — **de blocker**.
2. **Dashboard `ensureNotFieldMode`** — het factuurbedrag-lek dichten.
3. **Finalisatie-beslissing:** gate `updateQuoteStatus` voor field, óf corrigeer de documentatie (de stille mismatch is het gevaarlijkst).

**Korte-termijn-backlog (mag als bekende beperking mee in de pilot):** capaciteit-handhaving, monteur-koppeling bij
winkel-start, notitie-sync, ruwe-meetwaarde-snapshot, team-zichtbaarheid bij plannen, dangling-monteur-tolerantie,
`heleDag`-fix, hasArg-guards op updateProjectRoom, workflow-events voor inmeetvoortgang.
