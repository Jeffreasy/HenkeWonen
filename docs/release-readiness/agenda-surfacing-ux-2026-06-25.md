# Agenda terugbrengen + UI/UX-review (2026-06-25)

> Multi-agent onderzoek (4 gebieden: nav/snelbalk, dashboard-widget, agenda-pagina-UX, buitendienst). Vraag:
> hoe/waar moet de agenda terugkomen (bv. dashboard), en hoe staat de UI/UX/layout ervan?

## Kernconclusie

De agenda **bestaat** (pagina + `agendaWeek`-backend) maar is **structureel verstopt**: alleen via de "Menu"-drawer
(geen `quickbar`-vlag), **niet op het dashboard**, en op **mobiel onleesbaar** (`15-features-agenda.css` heeft 0 media
queries → `repeat(7,1fr)` blijft 7 kolommen op een telefoon). Belangrijker nog: de agenda-pagina toont **misleidende
info** — de kernregel van Henke (inmeten alleen **di/wo/do**, slot 16:30-17:30, capaciteit 2) is volledig onzichtbaar:
alle 7 dagen ogen identiek, de groene **"Vrij"-badge verschijnt óók op niet-inmeetdagen**, en capaciteit (x/2) ontbreekt.
Dat zijn **correctheidsbugs**, geen cosmetica — die wegen zwaarder dan pure plaatsing.

## Plaatsingsplan (3 plekken)

1. **Snelbalk winkel** *(must, klein)* — `quickbar: true` op Agenda ([portalNavigation.ts:74](src/components/layout/portalNavigation.ts:74)),
   en weg bij **Catalogus** (opzoekwerk, ook via Dossiers/Offertes bereikbaar). Eindstand snelbalk: **Start · Dossiers · Offertes · Agenda** (blijft 4).
2. **Snelbalk buitendienst** *(must, klein)* — `quickbar: true` op Agenda ([FieldNavigation.tsx:108](src/components/layout/FieldNavigation.tsx:108)),
   weg bij **Conceptoffertes** (heeft al een eigen tab). Eindstand: **Vandaag · Inmeten · Agenda · Winkel**.
3. **Dashboard-widget** *(must, middel)* — een **geaggregeerde mini-weekstrip** (di/wo/do, x/2 vrij, niet-toegewezen-waarschuwing),
   gevoed uit de **bestaande** `dashboard`-query ([portal.ts:190-211](convex/portal.ts:190)) — géén extra round-trip;
   nieuw `DashboardAgendaWidget.tsx` als volle-breedte panel tussen de two-column en de recente projecten in `DashboardShell`.
   Field-mode hoeft niet gemaskeerd (inmeetdata bevat geen bedragen).
4. **Buitendienst Vandaag** *(should, middel)* — een compact "Deze week"-strookje met de eigen inmeetbezoeken, boven de kaartsecties in `FieldServiceWorkspace`.

## UI/UX-verbeteringen agenda-pagina (correctheid eerst)

- **[must]** Inmeetdagen di/wo/do **visueel markeren** + de misleidende **"Vrij"-badge alleen op inmeetdagen** tonen (nu ook op ma/vr/za/zo).
- **[must]** **Capaciteit x/2** per inmeetdag tonen (Badge "1/2" · "2/2 vol" · "0/2") — beantwoordt "kan ik hier nog inplannen?". `agendaWeek` levert de telling al-bijna (`berekenInmeetBeschikbaarheid`).
- **[must]** **Mobiel-first responsive**: media-breakpoint zodat `.agenda-week` van 7 kolommen naar gestapelde dag-rijen klapt. Voorwaarde vóór je 'm prominenter surfacet.
- **[should]** Inmeetvenster **16:30-17:30** als primaire tijd tonen op inmeetdagen (i.p.v. de brede 08:00-17:00 die suggereert dat de hele dag inmeetbaar is).
- **[should]** Weekend (za/zo) dempen/inklappen; mobiel: sticky dagkop + huidige dag bovenaan.
- **[nice]** Toolbar "Deze week"-actieve staat · niet-toegewezen-waarschuwing bóven de kaarten + "Wijs monteur toe"-actie · bezoek-kaartjes-hiërarchie (klant primair, project gedempt, omvang-indicator).

## Implementatievolgorde

1. *(klein)* Snelbalk-vlaggen winkel + buitendienst — goedkoopste, onafhankelijke zichtbaarheidswinst.
2. *(middel)* **Correctheid agenda-pagina**: inmeetdag-markering + "Vrij"-fix + capaciteit x/2 (backend `agendaWeek` per dag + frontend).
3. *(middel)* Agenda-pagina **mobiel-responsive**.
4. *(middel)* Dashboard-**data**: agenda-sectie in de `dashboard`-query.
5. *(middel)* **DashboardAgendaWidget** + niet-toegewezen-Alert.
6. *(middel)* Buitendienst "Deze week"-strookje.
7-8. *(klein)* Should/nice-poetslaag (16:30-venster, weekend dempen, sticky dagkop, toolbar-state, kaartje-hiërarchie, field-variant widget).

> **Advies:** begin met stap 1 (snelbalk, triviaal) + stap 2 (de correctheidsbugs — misleidende "Vrij"/capaciteit) vóór de bredere surfacing,
> want anders maak je een misleidende agenda prominenter. Daarna dashboard-widget (de "terug op het dashboard"-vraag) + buitendienst.
