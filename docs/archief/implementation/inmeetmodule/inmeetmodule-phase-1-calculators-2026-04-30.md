# Inmeetmodule fase 1: calculators

Datum: 30 april 2026  
Status: afgerond

## Samenvatting

Fase 1 voegt alleen pure calculator utilities toe voor de toekomstige inmeetmodule. Er zijn geen Convex schemawijzigingen gedaan, geen project- of offerteflows aangepast en geen prijs-, btw- of offerteberekening gewijzigd.

De bestaande behangcalculator blijft bestaan op de oude locatie. Voor de nieuwe calculatorlaag is een re-export toegevoegd, zodat toekomstige code alles via `src/lib/calculators` kan gebruiken zonder bestaande imports te breken.

## Toegevoegde bestanden

- `src/lib/calculators/types.ts`
- `src/lib/calculators/number.ts`
- `src/lib/calculators/flooringCalculator.ts`
- `src/lib/calculators/plinthCalculator.ts`
- `src/lib/calculators/wallPanelCalculator.ts`
- `src/lib/calculators/stairCalculator.ts`
- `src/lib/calculators/wallpaperCalculator.ts`
- `src/lib/calculators/index.ts`
- `tools/test_calculators.mjs`

## Npm script

Toegevoegd:

```bash
npm run test:calculators
```

Dit script test de calculator utilities zonder extra dependencies.

## Algemene types

Toegevoegd in `src/lib/calculators/types.ts`:

- `CalculatorValidationResult`
- `IndicativeCalculationResult`
- `WasteInput`
- `ProductGroup`
- `PatternType`
- `StairType`

De calculators bevatten geen UI-copy of domeinflow. Ze geven technische result fields terug en eventueel een technische `validationError`.

## Behangcalculator compatibiliteit

Bestaand bestand blijft:

- `src/lib/wallpaperCalculator.ts`

Nieuwe re-export:

- `src/lib/calculators/wallpaperCalculator.ts`

Daarmee blijft de bestaande `WallpaperCalculator` UI en offertebuilder compatibel.

## Flooring calculator

Bestand:

- `src/lib/calculators/flooringCalculator.ts`

Input:

- `lengthM`
- `widthM`
- `wastePercent`
- `patternType`

Output:

- `areaM2`
- `wasteM2`
- `totalM2`
- `quoteQuantityM2`
- `isIndicative`
- `validationError`

Formule:

- `areaM2 = lengthM * widthM`
- `wasteM2 = areaM2 * wastePercent / 100`
- `totalM2 = areaM2 + wasteM2`
- `quoteQuantityM2 = totalM2` naar boven afgerond op twee decimalen

Guardrails:

- lengte moet groter zijn dan 0
- breedte moet groter zijn dan 0
- snijverlies mag niet negatief zijn
- geen prijslogica

## Plinth calculator

Bestand:

- `src/lib/calculators/plinthCalculator.ts`

Input:

- `perimeterM`
- `doorOpeningM`
- `wastePercent`

Output:

- `netMeter`
- `wasteMeter`
- `totalMeter`
- `quoteQuantityMeter`
- `isIndicative`
- `validationError`

Formule:

- `netMeter = max(perimeterM - doorOpeningM, 0)`
- `wasteMeter = netMeter * wastePercent / 100`
- `totalMeter = netMeter + wasteMeter`
- `quoteQuantityMeter = totalMeter` naar boven afgerond op twee decimalen

Guardrails:

- omtrek moet groter zijn dan 0
- deuropening mag niet negatief zijn
- snijverlies mag niet negatief zijn
- als deuropening groter is dan omtrek wordt `netMeter` op 0 gezet en komt er een validation warning
- geen prijslogica

## Wall panel calculator

Bestand:

- `src/lib/calculators/wallPanelCalculator.ts`

Input:

- `wallWidthM`
- `wallHeightM`
- `panelWidthM`
- `panelHeightM`
- `wastePercent`

Output:

- `wallAreaM2`
- `panelAreaM2`
- `panelsNeeded`
- `wastePanels`
- `totalPanels`
- `quoteQuantityPieces`
- `isIndicative`
- `validationError`

Formule:

- `wallAreaM2 = wallWidthM * wallHeightM`
- `panelAreaM2 = panelWidthM * panelHeightM`
- `panelsNeeded = ceil(wallAreaM2 / panelAreaM2)`
- `totalPanels = ceil(panelsNeeded * (1 + wastePercent / 100))`
- `wastePanels = totalPanels - panelsNeeded`

Guardrails:

- alle afmetingen moeten groter zijn dan 0
- snijverlies mag niet negatief zijn
- geen prijslogica

## Stair calculator

Bestand:

- `src/lib/calculators/stairCalculator.ts`

Input:

- `stairType`
- `treadCount`
- `riserCount`
- `stripLengthM`

Output:

- `treadCount`
- `riserCount`
- `quoteQuantity`
- `unit: "stairs"`
- `notes`
- `isIndicative`
- `validationError`

Gedrag:

- de calculator bepaalt geen vaste traprenovatieprijs
- `quoteQuantity` is 1 trap
- aantallen en traptype worden alleen als technische notities voorbereid

Guardrails:

- aantal treden moet groter zijn dan 0
- aantal stootborden mag niet negatief zijn
- striplengte mag niet negatief zijn als die is ingevuld
- geen prijslogica

## Testcases

Toegevoegd in `tools/test_calculators.mjs`:

- vloer: 4 x 5 meter met 10% snijverlies geeft 22 m2
- plinten: omtrek 20 meter, deuropening 2 meter, 5% snijverlies geeft 18,9 meter
- wandpanelen: wand 4 x 2,5 meter, paneel 0,6 x 2,6 meter, 10% snijverlies geeft 8 panelen
- trap: 13 treden geeft 1 trap als offertehoeveelheid
- invalid inputs geven `validationError`
- bestaande behangcalculator blijft via de nieuwe calculator-index werken

## Bewust niet aangepakt

Niet gedaan in deze fase:

- Convex schemawijzigingen
- nieuwe mutations of queries
- projectdetail UI
- offertebuilder UI
- automatische conversie naar offerteregels
- product- of prijsselectie
- btw-logica
- offerteberekening
- import- of cataloguslogica

## Vervolg naar fase 2

Fase 2 kan veilig starten met het datamodel:

- `measurements`
- `measurementRooms`
- `measurementLines`
- `wasteProfiles`

Daarna kunnen Convex functies worden toegevoegd voor:

- meting ophalen per project
- meting aanmaken
- meetruimte toevoegen
- meetregel opslaan
- meetregel markeren als klaar voor offerte
- waste profiles ophalen

Belangrijk voor fase 2: alle nieuwe data tenant-scoped houden en geen bestaande offerteberekening aanpassen.

