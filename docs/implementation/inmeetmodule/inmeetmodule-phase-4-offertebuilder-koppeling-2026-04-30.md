# Inmeetmodule fase 4: offertebuilder-koppeling

Datum: 30 april 2026  
Status: geïmplementeerd

## Samenvatting

Fase 4 voegt in de offertebuilder de actie **Uit inmeting laden** toe. Meetregels met status `ready_for_quote` kunnen worden bekeken, geselecteerd en pas na expliciete bevestiging als gewone offerteregels worden toegevoegd.

Er is geen automatische conversie zonder bevestiging. Prijs, product en btw blijven onder controle van de bestaande offertebuilder.

## Toegevoegde UI

### `MeasurementLinePicker`

Bestand:

- `src/components/quotes/MeasurementLinePicker.tsx`

Deze component toont:

- meetregels klaar voor offerte
- ruimte
- productgroep
- berekeningstype
- hoeveelheid
- eenheid
- snijverlies
- notitie
- indicatief label
- selectie via checkboxen
- bevestigingsdialoog

Belangrijke waarschuwing in de UI:

> Deze regels nemen alleen hoeveelheden en omschrijvingen over. Controleer prijs, product en btw voordat je de offerte verstuurt.

### Integratie in `QuoteBuilder`

Bestand:

- `src/components/quotes/QuoteBuilder.tsx`

De picker staat onder de handmatige regel-editor. De bestaande regel-editor en offertevoorwaarden blijven ongewijzigd werken.

### `QuoteWorkspace`

Bestand:

- `src/components/quotes/QuoteWorkspace.tsx`

`addQuoteLine` geeft nu het aangemaakte `quoteLineId` terug. Dat ID wordt gebruikt om de oorspronkelijke meetregel pas na succes als verwerkt te markeren.

## Query- en mutationwijzigingen

### `measurements:listReadyForQuoteByProject`

Bestand:

- `convex/measurements.ts`

Haalt voor een project alle meetregels op met:

- `quotePreparationStatus = ready_for_quote`

Retourneert per regel:

- meetregel
- bijbehorende inmeting
- eventuele meetruimte

De query maakt geen offerteregels aan.

### `measurements:markMeasurementLineConverted`

Bestand:

- `convex/measurements.ts`

Markeert een meetregel als verwerkt nadat de offerteregel succesvol is aangemaakt.

Velden die worden gezet:

- `quotePreparationStatus = converted`
- `convertedQuoteId`
- `convertedQuoteLineId`
- `updatedAt`

Guardrails:

- tenant check
- meetregel moet bestaan
- meetregel moet `ready_for_quote` zijn
- quote moet bij dezelfde tenant en hetzelfde project horen
- quoteLine moet bij dezelfde quote horen

### `portal:addQuoteLine`

Bestand:

- `convex/portal.ts`

Kleine uitbreiding:

- optioneel `projectRoomId`
- projectruimte wordt tenant- en project-scoped gevalideerd
- mutation blijft de bestaande quoteLine flow gebruiken
- bestaande recalculation blijft verantwoordelijk voor totalen

## Conversieflow

1. Offertebuilder opent een offerte.
2. `MeasurementLinePicker` haalt meetregels op die klaarstaan voor het gekoppelde project.
3. Gebruiker opent **Uit inmeting laden**.
4. Gebruiker selecteert een of meer meetregels.
5. Gebruiker bevestigt via dialoog.
6. Voor elke geselecteerde meetregel wordt via `portal:addQuoteLine` een gewone offerteregel aangemaakt.
7. Pas na succes wordt de meetregel via `measurements:markMeasurementLineConverted` gemarkeerd als verwerkt.

## Offerteregel mapping

Per meetregel wordt aangemaakt:

- `projectRoomId` indien herleidbaar uit de meetruimte
- `lineType` uit `quoteLineType`
- `title` uit productgroep, berekeningstype en ruimte
- `description` met meetnotitie, snijverlies en indicatieve waarschuwing
- `quantity` uit `measurementLine.quantity`
- `unit` uit `measurementLine.unit`
- `unitPriceExVat = 0`
- `vatRate = 21` voor niet-tekstregels
- `metadata.source = "measurement"`
- `metadata.measurementId`
- `metadata.measurementLineId`
- `metadata.measurementRoomId`
- `metadata.productGroup`
- `metadata.calculationType`
- `metadata.wastePercent`
- `metadata.isIndicative = true`

## Guardrails

Niet gewijzigd:

- prijslogica
- btw-logica
- offerteberekening
- importarchitectuur
- cataloguslogica
- auth
- Convex schema

Belangrijk gedrag:

- geen automatische conversie
- gebruiker moet selecteren en bevestigen
- prijzen worden niet gekozen
- btw wordt alleen met bestaande veilige standaard gevuld
- totalen worden door bestaande quote recalculation verwerkt

## Bewust niet gebouwd

Niet gebouwd:

- bulkmutation voor quoteLines
- productpicker vanuit meetregels
- catalogusprijsselectie
- automatische prijskeuze
- automatische btw-keuze
- undo-flow voor geconverteerde meetregels
- terugzetten van `converted` naar `ready_for_quote`

## Verificatie

Uitgevoerde checks:

- `npx convex codegen`
- `npx convex dev --once --tail-logs disable --env-file .env.local`
- `npm run check`
- `npm run build`
- `npm run test:calculators`
- `npm run test:portal`
- `npm run test:a11y`

Resultaat:

- `npm run check`: geslaagd, 0 errors, 0 warnings
- `npm run build`: geslaagd
- `npm run test:calculators`: geslaagd
- `npm run test:portal`: geslaagd
- `npm run test:a11y`: geslaagd

Build-opmerking:

- de bestaande Vercel-waarschuwing blijft zichtbaar omdat lokaal Node 25 draait en Vercel Serverless Functions Node 24 gebruikt. De build is wel geslaagd.

Functionele check:

- demo project met meetregel 22 m2 klaar voor offerte
- offerte voor dat project aanmaken indien nodig
- meetregel toevoegen via bestaande quote mutation
- meetregel als converted markeren
- controleren dat offerteregel quantity 22 en unit m2 heeft
- controleren dat unitPriceExVat 0 blijft
- controleren dat totalen via bestaande quote calculation op 0 blijven voor deze regel

Uitgevoerd met:

- tenantId: `md7f9ecc27at3eqn5wvbshgrnx85sen9`
- projectId: `kn7drc2c79vjw94h17z7e7e7f585tqra`
- measurementId: `nh7eryhgfdaz8qm542fvz73tg185vy10`
- measurementLineId: `n97a49mg7tz3c6ptymncrreeg585vfmx`
- aangemaakte quoteId: `kx7cwgd02r1qy4rph5d79abx5n85vd21`
- aangemaakte quoteLineId: `ks79hffcx8bjcmwabwtgjn51nx85t7t8`

Controle-uitkomst:

- `measurements:listReadyForQuoteByProject` retourneerde de meetregel vóór conversie
- `portal:createQuote` maakte een offerte voor het meetproject aan
- `portal:addQuoteLine` maakte een gewone offerteregel aan
- `measurements:markMeasurementLineConverted` zette de meetregel op `converted`
- offerteregel heeft `quantity: 22`
- offerteregel heeft `unit: m2`
- offerteregel heeft `unitPriceExVat: 0`
- offerteregel heeft `vatRate: 21`
- offerteregel heeft `lineTotalIncVat: 0`
- meetregel heeft `convertedQuoteId` en `convertedQuoteLineId`

## Vervolgadvies

Volgende logische stap:

- UI-polish voor de picker na praktijkgebruik
- optionele filter op productgroep
- waarschuwing als een meetregel al geconverteerd is
- later: productkeuze/catalogusprijs handmatig koppelen vanuit de offertebuilder
