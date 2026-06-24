# Agenda-module — compleetheids- & optimalisatie-review (2026-06-24)

> Gerichte multi-agent review (6 dimensies, adversarieel geverifieerd): compleetheid, bugs, consistentie,
> performance, UX/a11y, tests. Scope: `convex/beheer/agenda.ts`, `src/lib/agenda.ts`,
> `src/components/agenda/*`, `PlanMeasurementModal`, `startOrPlanMeasurement`/`createForProject`, de schema-
> tabellen + tests.

## Oordeel: **voorwaardelijk pilot-klaar**

Technisch solide en fundamenteel klaar voor een gecontroleerde pilot met een kleine, vertrouwde groep —
**geen security- of dataverlies-blockers**. Maar de module mist de **afdwingbare laag**: capaciteit/inmeetdag/
afwezigheid zijn puur advies, de winkel-route koppelt bezoeken fragiel op naam, en er zijn een paar UX-gaten.
Met de 5 must-fixes hieronder is het pilot-waardig; de afronding is een kwestie van **handhaving**, niet herontwerp.

---

## 🔧 Must-fix vóór pilot (5, bevestigd)

1. **Capaciteit/inmeetdag/afwezigheid niet server-side afgedwongen — overboeken kan.**
   `startOrPlanMeasurement` ([core.ts:629-764](convex/projecten/core.ts:629)) valideert alleen tenant + projectstatus;
   géén weekdag-check (di/wo/do), géén afwezigheids-check, géén capaciteitsoptelling. De inmeet-regelset bestaat
   alléén als read-only *advies* in `inmeetBeschikbaarheid`. Een planner (of een race) kan op maandag plannen, een
   zieke monteur volboeken, of 3 klussen op één dag zetten. → **Fix:** herbruik in `startOrPlanMeasurement` (+ `createForProject`)
   de berekening uit `inmeetBeschikbaarheid` (weekdag in `INMEET_DAGEN`, hele-dag-afwezigheid, capaciteit via
   `omvangUnits`-som met `excludeProjectId`), met optionele `force`-override + audit-event voor bewuste uitzonderingen.

2. **`createForProject` zet geen `gemetenDoorUserId` — winkel-bezoek hangt fragiel op naam.**
   De winkel-knop "Inmeting starten" ([MeasurementPanel.tsx:606](src/components/projects/MeasurementPanel.tsx:606))
   zet `gemetenDoor = session.name` en stuurt geen userId; `createForProject` ([measurements.ts:375](convex/projecten/measurements.ts:375))
   accepteert 'm niet eens. Het bezoek matcht dan alleen op naam (`hoortBijMonteur`) → breekt bij hernoemen/dubbele
   namen, en valt buiten de monteur-whitelist. → **Fix:** `gemetenDoorUserId`-arg toevoegen (tenant-gecheckt), UI
   resolvet de gekozen monteur naar een user-id; of laat de monteur-toewijzing volledig aan de plan-modal.

3. **`inmeetBeschikbaarheid` negeert `heleDag` — inconsistent met de week-agenda.**
   [agenda.ts:480-485](convex/beheer/agenda.ts:480) markeert "afwezig" bij élke datum-overlap, terwijl
   `dagStatusVoorMonteur` ([lib/agenda.ts:140](src/lib/agenda.ts:140)) alleen `heleDag` blokkeert. Een ochtend-
   afwezigheid blokkeert zo ten onrechte de hint voor 16:30-17:30 → de twee schermen spreken elkaar tegen.
   → **Fix:** bij `heleDag=true` altijd blokkeren; anders alleen bij overlap met het inmeetvenster. Uitlijnen + test.

4. **Weekrooster mist inline starttijd<eindtijd-validatie.**
   Afwezigheid heeft wél een inline-validatie + disabled knop, het rooster niet ([BeschikbaarheidPanel.tsx:300](src/components/agenda/BeschikbaarheidPanel.tsx:300));
   de gebruiker krijgt pas een vage server-toast. → **Fix:** per rij `start<eind`, inline fout (`aria-invalid`) + "Rooster opslaan" disabled bij een ongeldige rij.

5. **Stille fouten in de zichtbaarheid-toggle + team-laden** (door mij geïntroduceerd in PR #42).
   `toggleZichtbaar`/`loadTeam` ([AgendaWorkspace.tsx:107-139](src/components/agenda/AgendaWorkspace.tsx:107)) loggen
   alleen `console.error`; bij fout springt het vinkje terug of verdwijnt de hele sectie zonder uitleg.
   → **Fix:** `showToast` bij toggle-fout + laad-/foutstatus voor het team.

---

## 🚀 Optimalisatie-backlog (post-pilot, geprioriteerd)

**Operationele afwerking (middel):** overboeking-badge in de week-agenda · annuleren-actie voor een ingepland
bezoek (wist inmeetdatum bidirectioneel) · team-/capaciteitsoverzicht voor buitendienst bij plannen · tenant-brede
feestdag-/bouwvak-blokkade (afwezigheid met optionele userId).

**A11y (middel):** plan-hint als `role=status`/`aria-live` + duidelijker rem bij "vol" · resultaatgebied `aria-live`/
`aria-busy` bij weekwissel · whitelist-modus expliciet tonen ("Iedereen zichtbaar" vs "Alleen geselecteerden").

**Performance (middel→laag):** afwezigheid venster-gebonden lezen i.p.v. ongebonden `.collect()` ([agenda.ts:405](convex/beheer/agenda.ts:405));
de N+1 over monteurs parallelliseren of tenant-breed lezen (zoals measurements al doet).

**Laag/latent:** verwijderde-monteur-tolerantie (naam-fallback + graceful — pas relevant zodra user-archivering
bestaat) · inmeetdagen/-venster per tenant configureerbaar · afwezigheid bewerken + overlap-detectie + dubbele-
weekdag-rijen voorkomen · datum/DST-helper-consolidatie · notificatie/herinnering (Convex cron) · focusherstel na
sluiten van het beschikbaarheidspaneel · gedeelde bezig-flag splitsen + delete-guard op afwezigheid.

---

## ✅ Sterke punten

- **userId-primaire monteurmatch** met naam-fallback + ambiguïteit-veilige backfill (robuust tegen hernoemen/dubbele namen, getest).
- **Capaciteitsmodel** klein=1/volledig=2 met `excludeProjectId` voor herplannen — helder en getest (incl. de overboeking-edge).
- **Venster-gebonden** measurements-reads via `by_measurement_date` — leesvolume groeit niet met de inmeet-historie.
- **Project/klant-caches** voorkomen N+1 in `agendaWeek`; tenant-isolatie consequent (getest tegen gelijknamige monteur in andere tenant).
- **Whitelist-zichtbaarheid** met no-empty-state-garantie (getest op alle 3 gevallen).
- Nette frontend-fundamenten: race-guard op weeknavigatie, optimistische toggle met rollback, focus-trap + scroll-lock, `aria-current` op vandaag.

> **Kernconclusie:** de fundamenten (userId-match, capaciteitsmodel, venster-indexering, tenant-isolatie) zijn er;
> wat ontbreekt is **handhaving + operationele afwerking**, niet herontwerp.
