# Quote Template En Behangcalculator - 2026-04-30

## Samenvatting

Simone Henke heeft een offertevoorbeeld aangeleverd met vaste offerteblokken,
uitvoeringsvoorwaarden en factureringsregels. De portal had al een eerste
`quoteTemplates`-basis. Die is veilig uitgebreid met secties, template-regelmetadata
en aparte payment terms, zonder bestaande offerteberekeningen of importlogica te wijzigen.

Daarnaast is een losse behangcalculator voorbereid. De calculator bepaalt indicatief
het aantal rollen en kan dat aantal invullen als quantity voor de regel "Behang merk, kleur".
Aanbrengen behang blijft bewust een aparte arbeidsregel per rol.

## Analyse Offertevoorbeeld

Het Excelbestand "Offerte voorbeeld - kopie.xlsx" bevat een bruikbare template op Blad1.
Blad2 en Blad3 zijn leeg. De relevante vaste blokken zijn:

- Zwevende zelfklevende ondervloer tbv pvc
- Primeren en egaliseren
- Pvc/tapijt/vinyl fabrikant, naam, kleur
- Legkosten pvc visgraat/rechte plank/tapijt/vinyl
- Plinten maat kleur
- Gordijnen fabrikant, stof en kleur
- Gordijnrails merk, kleur
- Plisses fabrikant, kleur
- Houten/Bamboe Jaloezieen fabrikant, kleur
- Duettes fabrikant, kleur
- Traprenovatie PVC fabrikant, kleur, kleur strip
- Wandpanelen merk, kleur
- Behang merk, kleur
- Aanbrengen behang

## Template Secties

De standaardtemplate heet:

`Standaard offerte woninginrichting`

Toegevoegde secties:

- Vloeren
- Plinten
- Gordijnen & raamdecoratie
- Traprenovatie
- Wandafwerking
- Behang
- Voorwaarden
- Facturering

De bestaande `quoteTemplates`-tabel is behouden. Er zijn geen nieuwe losse template-tabellen
toegevoegd, omdat embedded secties en regels al aansluiten op de bestaande app en minder
migratierisico geven.

## Template Lines

Template-regels bewaren nu minimaal:

- `sectionKey`
- `title`
- `description`
- `lineType`
- `unit`
- `defaultQuantity`
- `sortOrder`
- `optional`
- `defaultEnabled`
- `categoryHint`
- `productKindHint`

De offertebuilder kan template-regels laden in de bestaande regel-editor. De gebruiker kan
omschrijving, beschrijving, hoeveelheid, eenheid, prijs, btw en korting aanpassen voordat de
regel aan de offerte wordt toegevoegd.

## Voorwaarden En Facturering

Standaardvoorwaarden zijn apart gehouden van factureringsregels.

Voorwaarden:

- Prijzen zijn inclusief 21% btw.
- Ruimtes moeten leeg zijn bij aanvang.
- Vloeren moeten droog en vrij van olie of vet zijn.
- Temperatuur minimaal 18 graden Celsius.
- Vensterbanken en ramen vrij, met minimaal 1 meter ruimte.
- Muren behangklaar en vrij van spijkers, schroeven en pluggen.
- Water en stroom beschikbaar.
- Parkeergelegenheid binnen 25 meter van de hoofdingang.

Facturering:

- 100% bij oplevering.
- Boven EUR 10.000 wordt 30% aanbetaling gevraagd.
- Bij meubels wordt 50% aanbetaling gevraagd.
- Contant tot EUR 3000, daarboven overschrijving of PIN.
- PIN betaling heeft 2% toeslag.
- Overschrijving heeft een betalingstermijn van 8 dagen.

`/portal/instellingen/offertetemplates` toont en beheert deze regels. Nieuwe offertes nemen
de templatevoorwaarden over. Een bestaande offerte kan haar eigen voorwaarden en payment terms
opslaan zonder het template aan te passen.

## Behangcalculator Formule

Bestand:

`src/lib/wallpaperCalculator.ts`

Inputs:

- `wallWidthM`
- `wallHeightM`
- `rollWidthCm`, default 53
- `rollLengthM`, default 10.05
- `patternRepeatCm`, default 0
- `wastePercent`, default 10

Berekening:

```txt
banenNeeded = ceil((wallWidthM * 100) / rollWidthCm)
baanLengteM = wallHeightM + (patternRepeatCm / 100)
banenPerRol = floor(rollLengthM / baanLengteM)
baseRollsNeeded = ceil(banenNeeded / banenPerRol)
rollsNeeded = ceil(baseRollsNeeded * (1 + wastePercent / 100))
```

Guardrails:

- Geldige invoer levert minimaal 1 rol op.
- Als `banenPerRol < 1`, toont de UI een validatiefout.
- Alle rolhoeveelheden worden naar boven afgerond.
- De uitkomst wordt als indicatief getoond.

## Bewust Niet Aangepakt

- Geen PDF redesign.
- Geen factuurtemplate of boekhoudflow.
- Geen wijziging aan offerteprijsberekening.
- Geen wijziging aan btw-berekening.
- Geen importarchitectuur of VAT mapping guardrails.
- Geen catalogusimport of productprijslogica.

## Seed Status

De seed-code is bijgewerkt zodat `seed:run` de template `Standaard offerte woninginrichting`
aanmaakt of de oudere `Henke Wonen standaard offerte` veilig hernoemt en aanvult.

Een live seed-run is geprobeerd met:

```txt
npx convex dev --once --tail-logs disable --env-file .env.local --run seed:run
```

Convex weigerde de run omdat de deployment boven de spending limit zit. Zodra Convex opnieuw
actief is, kan dezelfde seed-run worden herhaald.

## Risico's

- Bestaande offertes zonder `paymentTerms` blijven geldig; het veld is optioneel.
- Oude templates zonder `sections` blijven geldig; de UI toont dan alleen de beschikbare regels.
- Template-regels worden nog niet als bulk-set toegevoegd; ze worden bewust via de editor geladen
  zodat de gebruiker ze eerst kan aanpassen.

## Vervolg

- Factuurvoorbeeld verwerken zodra Simone dat aanlevert.
- Later eventueel bulk "voeg geselecteerde template-regels toe" bouwen met duidelijke preview.
- Later offerte-PDF/template-output laten aansluiten op dezelfde secties en voorwaarden.

