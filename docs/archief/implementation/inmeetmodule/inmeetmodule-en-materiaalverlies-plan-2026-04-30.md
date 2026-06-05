# Inmeetmodule en materiaalverlies plan

Datum: 30 april 2026  
Status: ontwerp en implementatieplan, nog niet gebouwd

## Samenvatting

De Henke Wonen portal heeft al een goede basis voor inmeten, maar nog geen aparte inmeetmodule. Projecten hebben ruimtes, oppervlaktes, omtrek, inmeetstatussen en workflow events. Offertes kunnen al regels koppelen aan projectruimtes en vrije metadata bewaren. Daardoor kan de inmeetmodule veilig als aparte laag tussen project en offerte worden ontworpen.

Advies: begin de inmeetmodule als sectie of tab binnen het projectdetail. Dat beperkt routing- en navigatierisico. Pas later, als de module zwaarder wordt, is een aparte route zoals `/portal/projecten/[id]/inmeting` logisch.

Belangrijkste ontwerpregel: een meting bereidt hoeveelheden, eenheden en omschrijvingen voor. De meting bepaalt geen verkoopprijs, wijzigt geen btw-logica en rekent geen offertetotalen uit.

## Wat al bestaat

### Projectruimtes

In `convex/schema.ts` bestaat de tabel `projectRooms` al met:

- `tenantId`
- `projectId`
- `name`
- `floor`
- `widthCm`
- `lengthCm`
- `heightCm`
- `areaM2`
- `perimeterMeter`
- `notes`
- `sortOrder`
- `createdAt`
- `updatedAt`

De domeintypes in `src/lib/portalTypes.ts` kennen deze velden ook. De UI in `src/components/projects/ProjectDetail.tsx` gebruikt op dit moment vooral:

- ruimtenaam
- oppervlakte in m2
- omtrek in meter
- notities

Breedte, lengte en hoogte bestaan dus al in het model, maar worden in de huidige projectdetail-flow nog niet volledig benut.

### Inmeten in workflow

Projectstatussen ondersteunen al:

- `measurement_planned`
- `execution_planned`

Projecten hebben ook datum- en workflowvelden:

- `measurementDate`
- `measurementPlannedAt`
- `executionDate`
- `executionPlannedAt`

De workflow events ondersteunen onder andere:

- `measurement_requested`
- `measurement_planned`

In `ProjectWorkflowRail` is "Inmeting" al een zichtbare stap in het werkproces. In `ProjectDetail` kan de status naar inmeting gepland worden gezet en kan daarbij een workflow event worden aangemaakt.

### Offertekoppeling

`quoteLines` ondersteunen al:

- `projectRoomId`
- `lineType`
- `title`
- `description`
- `quantity`
- `unit`
- `unitPriceExVat`
- `vatRate`
- `metadata`

Dit is voldoende om later meetregels veilig als voorstel naar de offertebuilder te brengen. De bestaande offertefunctie rekent pas op basis van de definitieve offerteregel. De inmeetmodule hoeft dus geen prijslogica te wijzigen.

### Behangcalculator

Er bestaat al een pure utility:

- `src/lib/wallpaperCalculator.ts`

En een UI-component:

- `src/components/quotes/WallpaperCalculator.tsx`

Deze calculator gebruikt Nederlandse labels, rekent rollen indicatief uit en laat de uitkomst als hoeveelheid gebruiken voor een behangregel. Dit is een goed patroon voor toekomstige calculators.

## Wat ontbreekt

Er ontbreekt nog een aparte, traceerbare meetlaag. Daardoor is er nu geen duidelijke plek voor:

- meerdere inmeetmomenten per project
- conceptmetingen versus gecontroleerde metingen
- meetregels per productgroep
- snijverlies per productgroep
- calculatorinput en calculatorresultaat bewaren
- "klaar voor offerte" markeren
- herleiden welke offertepost uit welke meting kwam

Ook ontbreken nog standaardprofielen voor materiaalverlies. Op dit moment kan snijverlies alleen binnen de behangcalculator worden ingevoerd.

## Voorgesteld datamodel

Dit is een voorstel voor een latere schemafase. Nu nog niet doorvoeren zonder aparte implementatiestap.

### `measurements`

Doel: hoofdrecord voor een inmeting bij een project.

Velden:

- `tenantId`
- `projectId`
- `customerId`
- `status`: `draft` | `measured` | `reviewed` | `converted_to_quote`
- `measurementDate`
- `measuredBy`
- `notes`
- `createdAt`
- `updatedAt`

Aanbevolen indexes:

- `by_project`: `tenantId`, `projectId`
- `by_status`: `tenantId`, `status`
- `by_measurement_date`: `tenantId`, `measurementDate`

Waarom apart van `projects`: een project kan later meerdere meetmomenten krijgen, bijvoorbeeld eerste inmeting, correctiemeting of nacontrole.

### `measurementRooms`

Doel: snapshot van ruimtes binnen een specifieke meting.

Velden:

- `tenantId`
- `measurementId`
- `projectRoomId` optioneel
- `name`
- `floor`
- `widthM`
- `lengthM`
- `heightM`
- `areaM2`
- `perimeterM`
- `notes`
- `sortOrder`
- `createdAt`
- `updatedAt`

Aanbevolen indexes:

- `by_measurement`: `tenantId`, `measurementId`
- `by_project_room`: `tenantId`, `projectRoomId`

Waarom snapshot: projectruimtes kunnen later aangepast worden. Een offerte of inmeetrapport moet kunnen blijven herleiden welke maatvoering op dat moment is gebruikt.

### `measurementLines`

Doel: calculaties en meetregels per ruimte of project vastleggen.

Velden:

- `tenantId`
- `measurementId`
- `roomId`
- `productGroup`: `flooring` | `plinths` | `wallpaper` | `wall_panels` | `curtains` | `rails` | `stairs` | `other`
- `calculationType`: `area` | `perimeter` | `rolls` | `panels` | `stairs` | `manual`
- `input`
- `result`
- `wastePercent`
- `quantity`
- `unit`
- `notes`
- `quoteLineType`
- `quotePreparationStatus`: `draft` | `ready_for_quote` | `converted`
- `convertedQuoteId` optioneel
- `convertedQuoteLineId` optioneel
- `createdAt`
- `updatedAt`

Aanbevolen indexes:

- `by_measurement`: `tenantId`, `measurementId`
- `by_room`: `tenantId`, `roomId`
- `by_quote_status`: `tenantId`, `quotePreparationStatus`
- `by_product_group`: `tenantId`, `productGroup`

`input` en `result` kunnen in Convex als object worden opgeslagen, maar in TypeScript moeten hiervoor per calculator duidelijke types bestaan. Zo blijft de database flexibel en de frontend betrouwbaar.

### `wasteProfiles`

Doel: standaard snijverlies per productgroep beheren.

Velden:

- `tenantId`
- `productGroup`
- `name`
- `defaultWastePercent`
- `description`
- `status`: `active` | `inactive`
- `createdAt`
- `updatedAt`

Aanbevolen indexes:

- `by_product_group`: `tenantId`, `productGroup`
- `by_status`: `tenantId`, `status`

Optioneel later:

- `minWastePercent`
- `maxWastePercent`
- `patternType`
- `categoryId`

## Materiaalverlies en snijverlies

Standaardprofielen moeten als advies worden behandeld, niet als harde waarheid.

Voorgestelde startprofielen:

| Productgroep | Profiel | Standaard snijverlies | Opmerking |
| --- | --- | ---: | --- |
| PVC | Rechte plank | 5-8% | Afhankelijk van ruimtevorm en legrichting |
| PVC | Visgraat | 10-15% | Meer verlies door patroon en zaagstukken |
| Tapijt | Standaard | 10% | Rolbreedte en kamermaat zijn bepalend |
| Vinyl | Standaard | 10% | Rolbreedte en naden controleren |
| Behang | Standaard | 10% | Patroonrapport kan extra rollen vragen |
| Wandpanelen | Standaard | 5-10% | Paneelmaat en zaagsnedes controleren |
| Plinten | Standaard | 5% | Deuropeningen en zaagverlies meenemen |
| Handmatig | Door gebruiker | Vrij invulbaar | Voor uitzonderingen |

UI-waarschuwing bij elke calculator:

> Indicatief. Controleer altijd inmeting, legrichting, patroon, productafmetingen en snijverlies.

## Voorgestelde calculators

Plaats nieuwe calculators als pure utilities in:

`src/lib/calculators/`

De bestaande `wallpaperCalculator.ts` kan later worden verplaatst of via een re-export beschikbaar blijven. Dat moet backwards compatible gebeuren, zodat de huidige offertebuilder blijft werken.

### Flooring calculator

Bestand:

`src/lib/calculators/flooringCalculator.ts`

Inputs:

- `lengthM`
- `widthM`
- `wastePercent`
- `patternType`: `straight` | `herringbone` | `tile` | `custom`

Output:

- `areaM2`
- `wasteM2`
- `totalM2`
- `isIndicative`
- `validationError`

Formule:

- `areaM2 = lengthM * widthM`
- `wasteM2 = areaM2 * wastePercent / 100`
- `totalM2 = areaM2 + wasteM2`

Ronding: offertehoeveelheid mag naar boven afgerond worden op twee decimalen of op verpakkingseenheid zodra een product gekozen is. De calculator zelf moet nog geen verpakkingseenheden afdwingen.

### Plinth calculator

Bestand:

`src/lib/calculators/plinthCalculator.ts`

Inputs:

- `perimeterM`
- `doorOpeningM`
- `wastePercent`

Output:

- `netMeter`
- `wasteMeter`
- `totalMeter`
- `isIndicative`
- `validationError`

Formule:

- `netMeter = max(perimeterM - doorOpeningM, 0)`
- `wasteMeter = netMeter * wastePercent / 100`
- `totalMeter = netMeter + wasteMeter`

### Wall panel calculator

Bestand:

`src/lib/calculators/wallPanelCalculator.ts`

Inputs:

- `wallWidthM`
- `wallHeightM`
- `panelWidthM`
- `panelHeightM`
- `wastePercent`

Output:

- `wallAreaM2`
- `panelsNeeded`
- `wastePanels`
- `totalPanels`
- `isIndicative`
- `validationError`

Formule:

- `wallAreaM2 = wallWidthM * wallHeightM`
- `panelAreaM2 = panelWidthM * panelHeightM`
- `panelsNeeded = ceil(wallAreaM2 / panelAreaM2)`
- `totalPanels = ceil(panelsNeeded * (1 + wastePercent / 100))`

Let op: dit is indicatief. Paneelrichting, zichtzijde, patroon en snijlijnen kunnen het werkelijke aantal veranderen.

### Stair calculator

Bestand:

`src/lib/calculators/stairCalculator.ts`

Inputs:

- `stairType`: `straight` | `quarter_turn` | `half_turn` | `open` | `closed`
- `treadCount`
- `riserCount`
- `stripLengthM` optioneel

Output:

- `treadCount`
- `riserCount`
- `quoteQuantity`
- `notes`
- `isIndicative`
- `validationError`

De trapcalculator moet vooral aantallen en omschrijving voorbereiden. Traprenovatie heeft in Henke Wonen vaak vaste prijsregels; de calculator mag die prijsregels niet automatisch bepalen.

## UI-flow

### Startpunt

Begin geïntegreerd in `ProjectDetail` als tab of sectie:

`Projectdetail > Inmeting`

Dat past bij de bestaande projectworkflow en houdt de eerste implementatie klein. Een aparte route `/portal/projecten/[id]/inmeting` kan later als de inmeetmodule veel eigen schermen krijgt.

### Opbouw van de sectie

Aanbevolen structuur:

1. Inmeting samenvatting
   - status
   - datum
   - ingemeten door
   - aantal ruimtes
   - aantal meetregels
   - aantal regels klaar voor offerte

2. Ruimtes
   - ruimte toevoegen
   - bestaande projectruimtes hergebruiken
   - breedte, lengte, hoogte, oppervlakte en omtrek tonen

3. Calculaties per ruimte
   - vloer berekenen
   - plinten berekenen
   - behang berekenen
   - wandpanelen berekenen
   - trap berekenen
   - handmatige meetregel

4. Meetregels
   - productgroep
   - berekeningstype
   - hoeveelheid
   - eenheid
   - snijverlies
   - notitie
   - status: concept, klaar voor offerte, verwerkt

5. Offertevoorbereiding
   - alleen regels tonen die klaar zijn voor offerte
   - actie: "Als offertepost voorbereiden"

### Knoppen en labels

Gebruik Nederlands en vermijd technische termen:

- Ruimte toevoegen
- Vloer berekenen
- Plinten berekenen
- Behang berekenen
- Wandpanelen berekenen
- Trap berekenen
- Meetregel opslaan
- Klaarzetten voor offerte
- Uit inmeting laden

## Offerte-koppeling

Geen automatische offerteposten toevoegen zonder bevestiging.

Voorgestelde flow:

1. Medewerker maakt of opent een meting.
2. Medewerker berekent per ruimte hoeveelheden.
3. Medewerker markeert meetregels als "klaar voor offerte".
4. In de offertebuilder verschijnt een actie "Uit inmeting laden".
5. De gebruiker ziet een preview:
   - titel
   - productgroep
   - ruimte
   - hoeveelheid
   - eenheid
   - snijverlies
   - notitie
6. Pas na bevestiging wordt een gewone offerteregel aangemaakt.

De offerteregel gebruikt bestaande velden:

- `projectRoomId`
- `lineType`
- `title`
- `description`
- `quantity`
- `unit`
- `metadata`

De prijsvelden blijven onder controle van de bestaande offertebuilder:

- `unitPriceExVat`
- `vatRate`
- `discountExVat`

Aanbevolen metadata op de offerteregel:

```ts
{
  source: "measurement",
  measurementId: "...",
  measurementLineId: "...",
  productGroup: "flooring",
  calculationType: "area",
  wastePercent: 10,
  isIndicative: true
}
```

Zo blijft de koppeling traceerbaar zonder schemawijziging aan `quoteLines`.

## Logica die niet gewijzigd mag worden

De inmeetmodule mag niet:

- verkoopprijzen kiezen
- productprijzen wijzigen
- btw bepalen
- offertetotalen herberekenen buiten de bestaande quote functies om
- importdata aanpassen
- catalogusprijzen interpreteren
- automatisch EAN/productduplicaten samenvoegen

De module mag wel:

- hoeveelheden voorbereiden
- eenheden voorstellen
- omschrijvingen genereren
- meetdata en calculatorinput bewaren
- offerteposten klaarzetten voor menselijke bevestiging

## Risico's

### Dubbele bron van ruimtematen

`projectRooms` bevat al maten. `measurementRooms` zou een snapshot toevoegen. Dat is bewust, maar moet duidelijk zijn in de UI:

- projectruimte = huidige projectstructuur
- meetruimte = vastgelegde maatvoering binnen een inmeting

### Eenheden en afronding

Projectruimtes gebruiken deels centimeters, calculators gebruiken meters. De UI moet eenheidconversie expliciet en consequent doen.

### Snijverlies is contextafhankelijk

Standaardpercentages zijn handig, maar kunnen fout zijn bij patroon, legrichting, rolbreedte of paneelmaat. Daarom moet elke calculator duidelijk "indicatief" tonen.

### Meerdere keren converteren naar offerte

Meetregels moeten een conversiestatus krijgen. Anders kan een gebruiker dezelfde meetregel per ongeluk meerdere keren als offerteregel toevoegen.

### Prijsverwarring

Gebruikers kunnen verwachten dat een berekening direct prijs geeft. De UI moet helder maken dat inmeting alleen hoeveelheden voorbereidt. Prijzen komen uit de offertebuilder/catalogus.

### Mobiele invoer

Inmeten gebeurt mogelijk op locatie. Formulieren moeten later goed werken op tablet en mobiel, met grote invoervelden en duidelijke focus states.

## Gefaseerde implementatie

### Fase 0: akkoord op ontwerp

Doel:

- dit plan beoordelen
- bepalen of inmeting als projecttab start
- bepalen welke calculators als eerste nodig zijn

Acceptatie:

- geen codewijzigingen nodig
- scope voor fase 1 duidelijk

### Fase 1: pure calculators

Bestanden:

- `src/lib/calculators/flooringCalculator.ts`
- `src/lib/calculators/plinthCalculator.ts`
- `src/lib/calculators/wallPanelCalculator.ts`
- `src/lib/calculators/stairCalculator.ts`
- eventueel re-export voor bestaande `wallpaperCalculator.ts`

Doel:

- berekeningen los van UI en database maken
- unit tests toevoegen als testsetup dit ondersteunt

Risico:

- laag, zolang bestaande behangcalculator import intact blijft

Acceptatie:

- bestaande offertebuilder blijft werken
- calculators geven alleen hoeveelheden, geen prijzen

### Fase 2: schema en Convex functies

Tabellen:

- `measurements`
- `measurementRooms`
- `measurementLines`
- `wasteProfiles`

Functies:

- meting ophalen per project
- meting aanmaken
- ruimte toevoegen aan meting
- meetregel toevoegen
- meetregel markeren als klaar voor offerte
- waste profiles ophalen

Risico:

- middel, door nieuwe datalaag

Acceptatie:

- alles tenant-scoped
- geen bestaande project/offertefuncties breken

### Fase 3: Projectdetail inmeting sectie

Bestanden:

- `src/components/projects/ProjectDetail.tsx`
- nieuw: `src/components/projects/MeasurementPanel.tsx`
- nieuw: calculatorformulieren waar nodig

Doel:

- inmeting zichtbaar maken binnen projectdetail
- ruimtes en meetregels beheren
- calculators gebruiken

Risico:

- middel, vooral layout en formuliercomplexiteit

Acceptatie:

- projectdetail blijft werken
- bestaande ruimtes blijven zichtbaar
- inmeting is duidelijk gescheiden van offerteprijzen

### Fase 4: offertebuilder koppeling

Bestanden:

- `src/components/quotes/QuoteBuilder.tsx`
- eventueel `src/components/quotes/MeasurementLinePicker.tsx`

Doel:

- actie "Uit inmeting laden"
- preview van meetregels
- na bevestiging gewone offerteregels aanmaken

Risico:

- middel, want hier raakt de flow de offertebuilder

Acceptatie:

- bestaande offerteregels blijven werken
- totalen blijven door bestaande quote logic berekend
- geen automatische prijskeuze

### Fase 5: polish en QA

Doel:

- responsive/tablet-invoer controleren
- Nederlandse copy nalopen
- accessibility controleren
- workflow events koppelen aan belangrijke meetacties

Acceptatie:

- bruikbaar op laptop en tablet
- focus states zichtbaar
- duidelijke waarschuwing bij indicatieve berekeningen

## Advies

Start niet met een aparte volledige route. Begin met een compacte inmeting-sectie in `ProjectDetail`, omdat:

- project en inmeting inhoudelijk sterk gekoppeld zijn
- workflowstatus "Inmeting" al bestaat
- projectruimtes al in projectdetail zichtbaar zijn
- offertebuilder later veilig kan laden uit deze meetlaag

De eerste technische bouwstap moet alleen bestaan uit pure calculators en types. Daarna pas schema en UI. Zo blijft de bestaande offerte- en prijslogica onaangeraakt.

