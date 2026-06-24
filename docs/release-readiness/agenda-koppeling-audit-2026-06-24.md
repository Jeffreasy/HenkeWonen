# Agenda — koppeling-/integratie-audit (2026-06-24)

> Multi-agent audit (6 naden, adversarieel geverifieerd tegen de huidige code ná #44/#45/#46): agenda↔dossier/
> measurement, plan-modal↔capaciteit-guard, agenda↔team/users, agenda↔buitendienst/field, frontend↔backend-
> contract, schema/index-integriteit. Bouwt voort op de compleetheids-review (`agenda-module-review-2026-06-24.md`).

## Oordeel: **leeskern robuust, schrijfkant niet dicht**

De agenda-**lees- en handhavingskern is integer**: `agendaWeek`, `inmeetBeschikbaarheid` én de plan-guard delen
één rekenfunctie (`berekenInmeetBeschikbaarheid`) en één match-functie (`hoortBijMonteur`, userId-primair). Hint,
weergave en server-guard kunnen daardoor **niet uiteenlopen** — DRY, single-source, geverifieerd sterk. Tenant-/
identiteitsscoping (alleenEigen via token, zichtbaarheid, backfill) is veilig. Geen data-corruptie, geen tenant-lek.

**Maar:** de #44-plan-guard zit **uitsluitend in `startOrPlanMeasurement`**, terwijl **drie andere paden**
`measurement.inmeetdatum` (en dus de agenda) muteren zónder die guard. Na #45 is "datum zónder monteur" nu de
*normale* tussentoestand — en zo'n inmeting valt **stil** uit de week-agenda. Pilot-waardig mét de must-fixes.

---

## 🔧 Must-fix (3)

1. **S1 — Inmeting met datum maar zónder monteur valt STIL uit de week-agenda én de capaciteitstelling → dubbelboeking mogelijk** *(hoog — enige echte operationele breuk)*
   `agendaWeek` ([agenda.ts:461-516](convex/beheer/agenda.ts:461)) itereert alleen per-monteur via `hoortBijMonteur`;
   een measurement met `inmeetdatum` maar zonder herleidbare monteur matcht niemand en zit in **geen** restbucket.
   `berekenInmeetBeschikbaarheid` telt capaciteit alleen over `eigen` metingen → zo'n bezoek telt bij **niemand**
   mee, dus de guard van een ánder dossier ziet die bezetting niet. Na #45 is dit de normale tussentoestand.
   → **Fix:** `agendaWeek` geeft een aparte `nietToegewezen`-lijst terug (datum-in-window, geen monteur-match) + de
   UI toont die als waarschuwing; overweeg de capaciteit/conflict-check ook over niet-toegewezen metingen.

2. **S2 — Office/field "Inmeting samenvatting"-form omzeilt de plan-guard + laat `gemetenDoorUserId` leeg** *(middel)*
   `saveMeasurementMeta` ([MeasurementPanel.tsx:644](src/components/projects/MeasurementPanel.tsx:644)) → `updateMeasurement`
   ([measurements.ts:458-516](convex/projecten/measurements.ts:458)) zet vrij `inmeetdatum` + vrije-tekst `gemetenDoor`,
   synct de datum naar het dossier, maar **zonder** `isInmeetdag`/capaciteit-guard en **nooit** `gemetenDoorUserId`.
   → **Fix:** planning uit dit form halen (alléén via de plan-modal), óf de guard delen + `gemetenDoorUserId` synchroon zetten.

3. **S3 — `updateProject` synct inmeetdatum naar de agenda-measurement zonder guard** *(middel)*
   `updateProject` ([core.ts:328](convex/projecten/core.ts:328), [337-345](convex/projecten/core.ts:337)) patcht
   `project.inmeetdatum` + de latestMeasurement vanuit het generieke dossier-bewerkformulier (`ProjectEditForm`,
   ongebonden date-input) — geen `isInmeetdag`-check. Geen monteur, dus geen capaciteitsverschuiving (vandaar middel).
   → **Fix:** dezelfde `isInmeetdag`-guard (met `force`-optie) vóór de measurement-sync, óf het inmeetdatum-veld uit
   het generieke dossierformulier halen zodat planning één geguarde ingang houdt.

> **Structurele fix die S2+S3 in één klap dicht:** één gedeelde guard-helper (`assertInmeetBoeking`) die **elk**
> measurement-schrijfpad verplicht passeert (`startOrPlanMeasurement`, `updateMeasurement`, `updateProject`,
> `createForProject`) — zo kan er geen vierde bypass ontstaan.

---

## 🛡️ Hardening-backlog (post-pilot)

- **`force`-override in de UI:** PlanMeasurementModal mist een "Toch inplannen (buiten de regels)"-bevestiging die
  `force=true` meestuurt → de bewust ingebouwde server-escape is nu **dode UI-code**. (Of `force` verwijderen.)
- **Specifieke guard-foutmelding:** `planMeasurementVisit`-catch toont een generieke "Inplannen mislukt"-toast;
  lees `error.data` zodat de operator de echte reden ziet (niet-inmeetdag / afwezig / vol).
- **Whitelist-congruentie:** plan-modal `monteurOpties` filtert op viewers, niet op `toonInAgenda` → een toegewezen
  monteur buiten de whitelist krijgt een onzichtbaar bezoek. Filter op `toonInAgenda`, of geef `agendaWeek` een
  union van whitelist + monteurs-met-bezoek-in-week.
- **Server-side viewer-check** in `startOrPlanMeasurement`: weiger `gemetenDoorUserId` met `role==='viewer'` (nu enkel UI-conventie).
- **Dubbele-naam-fragiliteit** (twee `jeffrey`-accounts): naam-fallback alleen matchen als de naam tenant-uniek is.
- **Invariant "één measurement per project"** expliciet bewaken (test/comment) — de `latest`-aanname verbindt updateProject-sync en agenda-lezing.
- **Week-weergave (cosmetisch):** omvang + resterende capaciteit ("1/2 geboekt") tonen; ma/vr niet als groene "Vrij" tonen (gedeelde `isInmeetdag`).
- **Post-deploy smoke-test** (ook DEV) op `agendaWeek`/`inmeetBeschikbaarheid` om deploy-drift te vangen — precies de "Could not find public function"-bug van vandaag.

---

## ✅ Sterke koppelingen

- **Hint = guard:** `inmeetBeschikbaarheid` én `startOrPlanMeasurement` delen exact `berekenInmeetBeschikbaarheid`
  (inmeetdag-set, afwezigheid-overlap, capaciteit, `excludeProjectId`). De UI kan nooit "groen" tonen terwijl de server weigert.
- **userId-primaire monteur-match** consistent over alle agenda-lezers + de guard; hoofd-schrijver houdt naam+userId strikt synchroon.
- **Field + winkel delen één plan-pad** (PlanMeasurementModal + startOrPlanMeasurement) — geen divergerend field-schrijfpad.
- **`alleenEigen`** resolvet de eigen monteur server-side via het geverifieerde token (geen parameter-manipulatie); bij geen match `[]`, geen lek.
- **`setAgendaZichtbaarheid`** correct authz (editor/admin) + tenant-gescopet; **backfill** koppelt alleen bij eenduidige naam-match.
- **`portal.ts` re-export-surface dekt alle agenda-aanroepen** — de eerdere "Could not find public function" was **deploy-drift op DEV**, geen ontbrekende export.

> **Kernconclusie:** de koppelingen zijn **data-integer** maar **niet dicht qua domeinregels** — er is geen enkele
> afgedwongen single-source planningsroute. De aanbevolen structurele fix (één gedeelde guard-helper) sluit dat.
