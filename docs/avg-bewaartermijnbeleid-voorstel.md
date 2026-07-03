# AVG-bewaartermijnbeleid — voorstel

_Status: **concept ter besluitvorming** — voor te leggen aan Wim & Simone._
_Opgesteld: 2026-07-03 (AVG-audit, punt 3). Termijnen zijn een voorstel; laat de fiscale
termijnen bevestigen door de boekhouder._

## 1. Waarom dit nodig is

De AVG verplicht om persoonsgegevens **niet langer te bewaren dan noodzakelijk** voor het doel
waarvoor ze zijn verzameld (opslagbeperking, art. 5 lid 1e AVG). Tegelijk geldt voor de
**administratie een fiscale bewaarplicht van 7 jaar** (art. 52 AWR) — facturen mag je dus niet
zomaar wissen. Een bewaartermijnbeleid legt per soort gegeven vast: **hoe lang bewaren, en wat
gebeurt er daarna (verwijderen of anonimiseren), automatisch of handmatig.**

Dit document is deels een **beleidskeuze voor de eigenaar**. De onderstaande termijnen zijn een
onderbouwd voorstel; de definitieve keuze ligt bij Wim/Simone (en waar het de administratie
raakt: de boekhouder).

## 2. Voorgestelde bewaartermijnen per gegevenssoort

| Gegevenssoort (tabel) | Voorstel bewaartermijn | Daarna | Grondslag |
|---|---|---|---|
| **Facturen** (`invoices`) | **7 jaar** na factuurdatum | Verwijderen/anonimiseren | Fiscale bewaarplicht (vast — geen keuze) |
| **Leveranciersbestellingen** (`supplierOrders`, `-Lines`) | 7 jaar | Verwijderen | Onderdeel inkoopadministratie |
| **Klantgegevens** (`customers`) | Zolang klantrelatie + **2 jaar** na laatste project/contact; mét facturen: gekoppeld aan de 7-jaarstermijn | Verwijderen; bij facturen → anonimiseren tot stub | AVG opslagbeperking |
| **Contactmomenten** (`customerContacts`) | 2 jaar na laatste contact | Verwijderen | AVG opslagbeperking |
| **Dossierstukken/foto's/scans** (`dossierAttachments` + storage) | 2 jaar na afronding project (langer bij garantie/klacht) | Verwijderen (incl. storage) | AVG opslagbeperking |
| **Projecten & offertes** (`projects`, `quotes`, `quoteLines`) | Offerte zónder opdracht: **1 jaar**; uitgevoerd project: gekoppeld aan factuur (7 jaar) | Verwijderen | AVG / administratie |
| **Inmetingen** (`measurements`, `-Rooms`, `-Lines`) — tevens agenda-items | 1 jaar na uitvoering | Verwijderen | AVG opslagbeperking |
| **Tijdlijn & workflow-events** (`timelineEvents`, `projectWorkflowEvents`, `projectTasks`) | Gelijk met het project | Verwijderen | Operationele historie |
| **Portaalgebruikers** (`users`) | Zolang in dienst / actief | Verwijderen of op inactief | Toegangsbeheer |

> **Kernprincipe bij facturen:** zolang de 7-jaarstermijn loopt moet op een bewaarde factuur
> zichtbaar blijven **aan wie** die is uitgereikt. Daarom wordt een klant mét facturen niet
> verwijderd maar **geanonimiseerd tot een minimale stub** (naam + adres blijven, de rest wordt
> gewist). Pas ná 7 jaar mag ook die stub volledig weg.

## 3. Openstaande beleidskeuzes (voor Wim & Simone)

- [ ] Bevestig de **7-jaarstermijn** voor facturen/administratie met de boekhouder (10 jaar geldt
      alleen voor gegevens rond onroerende zaken — vermoedelijk niet van toepassing).
- [ ] Kies de termijn voor **niet-gewonnen offertes** (voorstel: 1 jaar).
- [ ] Kies de termijn voor **dossierfoto's/scans** na oplevering (voorstel: 2 jaar; wil je langer
      i.v.m. garantie/nazorg?).
- [ ] Kies de termijn voor **inactieve klanten/leads zonder facturen** (voorstel: 2 jaar na laatste
      activiteit).
- [ ] Bepaal of opschonen **automatisch** mag (periodieke job) of **altijd handmatig** met
      controle. Aanbeveling: **eerst handmatig** met de rapportage hieronder, automatiseren pas als
      de termijnen definitief zijn.

## 4. Wat automatisch kan vs. handmatig

- **Automatiseerbaar** (zodra termijnen vaststaan): een periodieke opschoonjob (Convex cron) die
  data ouder dan de gekozen termijn verwijdert/anonimiseert. Dit vraagt eerst een **beleidskeuze**
  (welke termijn, wel/niet automatisch) en is daarom **bewust nog niet gebouwd**.
- **Nu al mogelijk zonder beleidskeuze** (in deze PR geïmplementeerd): een **read-only
  retentie-rapportage** die laat zien hoeveel data de gekozen grens (standaard 7 jaar) al
  passeert. Puur informatief — er wordt niets verwijderd.

## 5. Wat er al is geïmplementeerd

1. **Recht op vergetelheid** (punt 2, aparte PR): een admin-only actie die een klant met alle
   gekoppelde gegevens + bestanden verwijdert, of — bij facturen — anonimiseert tot een stub. Dit
   is het handmatige mechanisme om een individueel verwijderverzoek uit te voeren.
2. **Retentie-rapportage** (deze PR): een interne, read-only Convex-functie
   `beheer/retention:retentionReport` die per omgeving telt:
   - facturen ouder dan de bewaargrens (kandidaat voor afronding ná de bewaarplicht);
   - geanonimiseerde klanten waarvan alle facturen de grens zijn gepasseerd (de stub mag dan weg);
   - inactieve/gearchiveerde klanten zónder facturen die de grens zijn gepasseerd;
   - afgesloten/geannuleerde projecten ouder dan de grens.

   Aanroepen (met deploy-key/dashboard, niet via het portaal):

   ```bash
   npx convex run beheer/retention:retentionReport '{"tenantSlug":"henke-wonen"}'
   # optioneel een andere termijn: '{"tenantSlug":"henke-wonen","bewaartermijnJaren":2}'
   ```

   De uitkomst geeft Wim/Simone een concreet beeld van wat een opschoonbeleid zou raken — input
   voor de keuzes in §3.

## 6. Voorgestelde vervolgstappen

1. Termijnen in §2/§3 bevestigen (eigenaar + boekhouder).
2. Rapportage draaien op productie om de omvang te zien.
3. Pas daarna: beslissen over automatisering (Convex cron) en die bouwen als aparte PR met dezelfde
   dubbele-bevestiging/veiligheidsprincipes als het recht-op-vergetelheid-pad.
