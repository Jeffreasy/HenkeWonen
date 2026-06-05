# Inmeetmodule fase 2: datamodel en Convex functies

Datum: 30 april 2026  
Status: geïmplementeerd

## Samenvatting

Fase 2 voegt de datalaag toe voor inmetingen binnen projecten. De uitbreiding is tenant-scoped en staat los van offertes, prijzen, btw, catalogus en imports.

Er is geen automatische conversie naar offerteregels gebouwd. Meetregels bewaren alleen meetinput, resultaat, hoeveelheid, eenheid, productgroep en de status of een regel later klaarstaat voor offertevoorbereiding.

## Toegevoegde tabellen

### `measurements`

Hoofdrecord voor een inmeting bij een project.

Velden:

- `tenantId`
- `projectId`
- `customerId`
- `status`: `draft`, `measured`, `reviewed`, `converted_to_quote`
- `measurementDate`
- `measuredBy`
- `notes`
- `createdByExternalUserId`
- `createdAt`
- `updatedAt`

Indexes:

- `by_project`: `tenantId`, `projectId`
- `by_status`: `tenantId`, `status`
- `by_measurement_date`: `tenantId`, `measurementDate`

### `measurementRooms`

Snapshot van ruimtes binnen een specifieke inmeting.

Velden:

- `tenantId`
- `measurementId`
- `projectRoomId`
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

Indexes:

- `by_measurement`: `tenantId`, `measurementId`
- `by_project_room`: `tenantId`, `projectRoomId`

### `measurementLines`

Meetregels en calculatorresultaten per ruimte of project.

Velden:

- `tenantId`
- `measurementId`
- `roomId`
- `productGroup`
- `calculationType`
- `input`
- `result`
- `wastePercent`
- `quantity`
- `unit`
- `notes`
- `quoteLineType`
- `quotePreparationStatus`: `draft`, `ready_for_quote`, `converted`
- `convertedQuoteId`
- `convertedQuoteLineId`
- `createdAt`
- `updatedAt`

Indexes:

- `by_measurement`: `tenantId`, `measurementId`
- `by_room`: `tenantId`, `roomId`
- `by_quote_status`: `tenantId`, `quotePreparationStatus`
- `by_product_group`: `tenantId`, `productGroup`

### `wasteProfiles`

Standaardprofielen voor indicatief snijverlies.

Velden:

- `tenantId`
- `productGroup`
- `name`
- `defaultWastePercent`
- `description`
- `status`: `active`, `inactive`
- `createdAt`
- `updatedAt`

Indexes:

- `by_product_group`: `tenantId`, `productGroup`
- `by_status`: `tenantId`, `status`

## Toegevoegde Convex functies

Bestand:

- `convex/measurements.ts`

### `getForProject`

Haalt de laatste inmeting voor een project op met:

- `measurement`
- `rooms`
- `lines`
- `wasteProfiles`

Als er nog geen inmeting bestaat, komt `measurement: null` terug met lege `rooms` en `lines`.

Guardrails:

- project moet bestaan
- project moet bij dezelfde tenant horen

### `createForProject`

Maakt een conceptinmeting aan.

Guardrails:

- project moet bestaan
- project moet bij dezelfde tenant horen
- klant moet bestaan
- klant moet bij dezelfde tenant horen
- klant moet bij het project horen
- status start altijd als `draft`

### `updateMeasurement`

Werkt alleen toegestane velden bij:

- `status`
- `measurementDate`
- `measuredBy`
- `notes`

Guardrails:

- inmeting moet bij dezelfde tenant horen

### `addMeasurementRoom`

Voegt een meetruimte toe als snapshot.

Guardrails:

- inmeting moet bij dezelfde tenant horen
- gekoppelde projectruimte moet bij dezelfde tenant horen
- gekoppelde projectruimte moet bij hetzelfde project horen als de inmeting

### `addMeasurementLine`

Voegt een meetregel toe.

Guardrails:

- inmeting moet bij dezelfde tenant horen
- gekoppelde meetruimte moet bij dezelfde tenant en inmeting horen
- `quotePreparationStatus` start altijd als `draft`
- er wordt geen offerteregel aangemaakt
- er wordt geen prijs of btw bepaald

### `updateMeasurementLineStatus`

Wijzigt alleen de voorbereidingstatus van een meetregel:

- `draft`
- `ready_for_quote`
- `converted`

Guardrails:

- meetregel moet bij dezelfde tenant horen

### `listWasteProfiles`

Haalt alleen actieve snijverliesprofielen op, optioneel gefilterd op productgroep.

### `seedDefaultWasteProfiles`

Seedt de standaard snijverliesprofielen idempotent:

- PVC rechte plank: `flooring`, 7%
- PVC visgraat: `flooring`, 12%
- Tapijt standaard: `flooring`, 10%
- Vinyl standaard: `flooring`, 10%
- Behang standaard: `wallpaper`, 10%
- Wandpanelen standaard: `wall_panels`, 8%
- Plinten standaard: `plinths`, 5%
- Handmatig: `other`, 0%

De functie maakt geen dubbele profielen aan. Bestaande profielen met dezelfde productgroep en naam worden waar nodig bijgewerkt.

## Portal types

`src/lib/portalTypes.ts` is uitgebreid met:

- `MeasurementStatus`
- `MeasurementProductGroup`
- `MeasurementCalculationType`
- `QuotePreparationStatus`
- `PortalMeasurement`
- `PortalMeasurementRoom`
- `PortalMeasurementLine`
- `PortalWasteProfile`
- `PortalProjectMeasurementData`

Deze types bereiden Fase 3 UI voor, maar er is nog geen UI-flow gebouwd.

## Tenant-scope guardrails

Alle functies eisen `tenantId` als argument. Elke gekoppelde entiteit wordt gecontroleerd:

- project
- klant
- inmeting
- projectruimte
- meetruimte
- meetregel

Er wordt geen data tussen tenants gedeeld of opgehaald.

## Bewust niet gebouwd

Niet gebouwd in deze fase:

- ProjectDetail UI voor inmeting
- route `/portal/projecten/[id]/inmeting`
- offertebuilder actie "Uit inmeting laden"
- automatische quoteLine conversie
- prijsselectie
- btw-bepaling
- offerteberekening
- import- of cataloguswijzigingen
- authwijzigingen

## Vervolg naar Fase 3

Fase 3 kan de UI veilig toevoegen binnen `ProjectDetail`:

- sectie of tab "Inmeting"
- inmeting aanmaken of openen
- meetruimtes tonen en toevoegen
- calculators gebruiken om meetregels te maken
- meetregels markeren als "klaar voor offerte"

Belangrijk: ook in Fase 3 blijven offerteposten nog expliciet gescheiden. De offertebuilder-koppeling hoort pas in een aparte fase.

## Verificatie

Uitgevoerd:

- `npx convex codegen`
- `npx convex dev --once --tail-logs disable --env-file .env.local`
- `npm run check`
- `npm run build`
- `npm run test:calculators`
- `npm run test:portal`
- `npm run test:a11y`

Resultaat:

- schema compileert
- Astro check geeft 0 errors, 0 warnings
- build is geslaagd
- calculator tests zijn geslaagd
- portal route smoke test is geslaagd
- accessibility smoke test is geslaagd

Build-opmerking:

- de bestaande Vercel-waarschuwing blijft zichtbaar omdat lokaal Node 25 draait en Vercel Serverless Functions Node 24 gebruikt. De build is wel geslaagd.

## Functionele Convex check

Tenant:

- Henke Wonen: `md7f9ecc27at3eqn5wvbshgrnx85sen9`

Gebruikt demo-project:

- `Demo - Praktijkruimte vloer en plinten`
- projectId: `kn7drc2c79vjw94h17z7e7e7f585tqra`
- customerId: `jh73gpvzkm5twpjptgdpw3xwq185v1sf`

Uitgevoerde checks:

1. `measurements:seedDefaultWasteProfiles`
   - eerste run: 8 profielen toegevoegd
   - tweede run: 0 toegevoegd, 8 ongewijzigd
   - idempotency bevestigd

2. `measurements:createForProject`
   - aangemaakte measurementId: `nh7eryhgfdaz8qm542fvz73tg185vy10`
   - status: `draft`

3. `measurements:addMeasurementRoom`
   - aangemaakte roomId: `nd7akwdvq0f9pyr0znkw0d2p4h85veaj`
   - ruimte: Wachtruimte
   - maatvoering: 4 x 5 meter, 20 m2, 18 meter omtrek

4. `measurements:addMeasurementLine`
   - aangemaakte lineId: `n97a49mg7tz3c6ptymncrreeg585vfmx`
   - productGroup: `flooring`
   - calculationType: `area`
   - quantity: 22
   - unit: `m2`
   - quotePreparationStatus startte als `draft`

5. `measurements:updateMeasurementLineStatus`
   - lineId `n97a49mg7tz3c6ptymncrreeg585vfmx` bijgewerkt naar `ready_for_quote`

6. `measurements:getForProject`
   - retourneerde measurement, room, line en 8 actieve waste profiles

Belangrijke controle:

- er is geen offerteregel aangemaakt
- er is geen prijs bepaald
- er is geen btw-logica geraakt
- er is geen catalogus- of importdata aangepast
