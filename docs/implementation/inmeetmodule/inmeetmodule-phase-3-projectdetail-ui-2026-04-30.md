# Inmeetmodule fase 3: ProjectDetail UI

Datum: 30 april 2026  
Status: geïmplementeerd

## Samenvatting

Fase 3 maakt de inmeetmodule zichtbaar en bruikbaar binnen het projectdetail. De nieuwe UI gebruikt de bestaande Convex functies uit `convex/measurements.ts` en de pure calculators uit `src/lib/calculators`.

Er is geen automatische conversie naar offerteregels gebouwd. Meetregels kunnen alleen worden opgeslagen en gemarkeerd als "Klaar voor offerte". Prijzen, btw en offertetotalen blijven volledig buiten deze fase.

## Toegevoegde componenten

### `MeasurementPanel`

Bestand:

- `src/components/projects/MeasurementPanel.tsx`

Functies in de UI:

- inmeting laden voor een project
- inmeting starten als er nog geen inmeting bestaat
- inmeting samenvatting tonen
- status, inmeetdatum, ingemeten door en notities bijwerken
- meetruimtes tonen
- meetruimte toevoegen
- bestaande projectruimte als basis gebruiken
- meetregels tonen
- meetregel markeren als "Klaar voor offerte"
- calculatorresultaten als meetregel opslaan

Gebruikte Convex functies:

- `measurements:getForProject`
- `measurements:createForProject`
- `measurements:updateMeasurement`
- `measurements:addMeasurementRoom`
- `measurements:addMeasurementLine`
- `measurements:updateMeasurementLineStatus`

`getForProject` levert ook actieve snijverliesprofielen mee. Daarom is geen extra query nodig voor de calculatorformulieren.

## Integratie in ProjectDetail

Bestand:

- `src/components/projects/ProjectDetail.tsx`

De component is toegevoegd als sectie onderaan het projectdetail. De bestaande projectdetails, workflow rail, projectruimtes, notities en werkprocesacties blijven intact.

Er zijn geen statusmutations of bestaande projectfuncties aangepast.

## UI-flow

### Geen inmeting

De gebruiker ziet:

- uitleg dat er nog geen inmeting is
- knop "Inmeting starten"

Bij starten wordt een conceptinmeting aangemaakt met:

- project
- klant
- ingemeten door
- externe gebruiker
- status `draft`

### Inmeting aanwezig

De gebruiker ziet:

- status
- inmeetdatum
- ingemeten door
- aantal meetruimtes
- aantal meetregels
- aantal regels klaar voor offerte
- waarschuwing dat prijzen en btw pas in de offerte worden bepaald

### Meetruimtes

Meetruimtes worden als snapshot binnen de inmeting opgeslagen.

De gebruiker kan:

- een bestaande projectruimte als basis kiezen
- naam invullen
- verdieping invullen
- breedte, lengte en hoogte invullen
- oppervlakte laten voorstellen via breedte x lengte
- omtrek laten voorstellen via 2 x (breedte + lengte)
- notitie toevoegen

### Meetregels

Meetregels tonen:

- productgroep
- ruimte
- berekening
- hoeveelheid
- eenheid
- snijverlies
- status
- notitie
- actie

Bij status `Concept` kan de gebruiker kiezen voor:

- "Klaarzetten"

Dit zet alleen `quotePreparationStatus` naar `ready_for_quote`. Er wordt geen offerteregel aangemaakt.

## Calculatorintegratie

Toegevoegde calculatorformulieren:

- Vloer berekenen
- Plinten berekenen
- Behang berekenen
- Wandpanelen berekenen
- Trap berekenen
- Handmatige meetregel

Gebruikte calculators:

- `calculateFlooring`
- `calculatePlinths`
- `calculateWallpaperRolls`
- `calculateWallPanels`
- `calculateStairs`

Elke calculator toont:

- Nederlandse labels
- snijverliesprofiel indien beschikbaar
- berekeningsresultaat
- waarschuwing: "Indicatief. Controleer altijd inmeting, legrichting, patroon, productafmetingen en snijverlies."
- knop "Meetregel opslaan"

Opslaan maakt een `measurementLine` aan met:

- productgroep
- berekeningstype
- input
- result
- snijverlies
- hoeveelheid
- eenheid
- notitie
- offerteregeltype als voorbereiding

## Tenant-scope gebruik

De frontend krijgt vanuit de sessie de tenant-slug. `MeasurementPanel` lost deze via `tenants:getBySlug` op naar de echte Convex tenant-ID, en gebruikt die ID vervolgens bij alle `measurements:*` functies.

Alle data blijft daarmee tenant-scoped via de bestaande guardrails uit Fase 2.

## Nederlandse UI-copy

Toegevoegd aan `src/lib/i18n/statusLabels.ts`:

- `formatMeasurementStatus`
- `formatMeasurementProductGroup`
- `formatMeasurementCalculationType`
- `formatQuotePreparationStatus`

Hierdoor worden technische waarden zoals `ready_for_quote`, `wall_panels` en `calculationType` niet zichtbaar als ruwe enumwaarden.

## Bewust niet gebouwd

Niet gebouwd in deze fase:

- automatische conversie naar offerteregels
- offertebuilder-koppeling "Uit inmeting laden"
- prijsselectie
- btw-selectie
- offerteberekening
- PDF- of factuurflow
- import- of cataloguswijzigingen
- nieuwe projectstatuslogica
- Convex schemawijzigingen

## Verificatie

Uitgevoerde checks:

- `npm run check`
- `npm run build`
- `npm run test:calculators`
- `npm run test:portal`
- `npm run test:a11y`

Resultaat:

- `npm run check`: geslaagd, 0 errors, 0 warnings
- `npm run build`: geslaagd
- `npm run test:calculators`: geslaagd
- `npm run test:portal`: geslaagd, hoofdportalroutes HTTP 200
- `npm run test:a11y`: geslaagd, smoke checks HTTP 200

Build-opmerking:

- de bestaande Vercel-waarschuwing blijft zichtbaar omdat lokaal Node 25 draait en Vercel Serverless Functions Node 24 gebruikt. De build is wel geslaagd.

Functionele routecheck:

- `/portal/projecten`
- `/portal/projecten/kn7drc2c79vjw94h17z7e7e7f585tqra`
- `/portal/offertes`
- `/portal`

Resultaat detailroute:

- `/portal/projecten/kn7drc2c79vjw94h17z7e7e7f585tqra`: HTTP 200

Verwachte demo-inmeting uit Fase 2:

- ruimte: Wachtruimte
- meetregel: 22 m2
- status: Klaar voor offerte

Convex-check:

- `measurements:getForProject` retourneert de bestaande inmeting
- `rooms[0].name`: Wachtruimte
- `lines[0].quantity`: 22
- `lines[0].unit`: m2
- `lines[0].quotePreparationStatus`: ready_for_quote

Belangrijke controle:

- er ontstaat geen nieuwe offerteregel
- offertetotalen blijven onaangeraakt

## Vervolg naar Fase 4

Fase 4 kan de offertebuilder-koppeling toevoegen:

- actie "Uit inmeting laden"
- preview van meetregels die klaarstaan
- gebruiker kiest expliciet welke regels naar de offerte gaan
- offerteregel wordt pas aangemaakt na bevestiging
- prijs en btw blijven handmatig/catalogusgestuurd binnen de bestaande offertebuilder
