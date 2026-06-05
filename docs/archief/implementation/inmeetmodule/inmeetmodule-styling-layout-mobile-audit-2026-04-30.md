# Inmeetmodule styling-, layout-, mobile- en toegankelijkheidsaudit

Datum: 30 april 2026  
Scope: Projectdetail > Inmeting en Offertebuilder > Uit inmeting laden

## Samenvatting

De inmeetmodule is functioneel volwassen genoeg voor praktisch gebruik: de gebruiker ziet binnen enkele seconden dat de inmeting alleen hoeveelheden en omschrijvingen voorbereidt, en dat prijzen, producten en btw pas in de offertebuilder worden gecontroleerd. De route met demo-data toont de bestaande meetruimte `Wachtruimte` en de meetregel van `22 m²` als `Verwerkt`. De offertebuilder toont voor dezelfde demo correct een lege staat, omdat de meetregel al naar een offerteregel is verwerkt.

Er zijn alleen kleine UI-, copy-, mobile- en toegankelijkheidsfixes uitgevoerd. Er zijn geen wijzigingen gedaan aan prijslogica, btw-logica, offerteberekening, importarchitectuur, cataloguslogica, auth of Convex schema.

## Gecontroleerde routes

| Route | Resultaat |
| --- | --- |
| `/portal` | OK |
| `/portal/projecten` | OK |
| `/portal/projecten/kn7drc2c79vjw94h17z7e7e7f585tqra` | OK, inmeting zichtbaar |
| `/portal/offertes` | OK |
| `/portal/offertes/kx7cwgd02r1qy4rph5d79abx5n85vd21` | OK, picker zichtbaar |

## Gecontroleerde viewports en methode

De in-app browser stond op een smalle/mobile-achtige viewport. Daarop zijn screenshots en DOM-controles uitgevoerd voor:

- Projectdetail met inmeting
- Meetruimtes als mobile cards
- Meetregels als mobile cards
- Offertebuilder met `Uit inmeting laden`
- Lege picker-state na verwerkte demo-meetregel

Daarnaast is de responsive CSS statisch gecontroleerd:

- `two-column`, `three-column`, `quote-workbench` stapelen naar 1 kolom.
- `responsive-form-row` stapelt naar 1 kolom.
- `DataTable` ondersteunt `mobileMode="cards"`.
- `mobile-card-actions` maakt acties op mobiel full-width.
- `panel`, `card`, `table-wrap` hebben `min-width: 0` tegen overflow.

Beperking: er is geen Playwright dependency in dit project aanwezig, dus er is geen echte geautomatiseerde multi-viewport screenshotmatrix op 1440, 1280, 768, 390 en 360 px gedraaid. De bestaande smoke-tests zijn wel uitgebreid met detailroutes.

## UX-flow audit

De beoogde flow is logisch herkenbaar:

Project -> Inmeting -> Meetruimte -> Rekenhulp -> Meetregel -> Klaar voor offerte -> Offertebuilder -> Uit inmeting laden -> Bevestigen -> Offerteregel

Sterk:

- De waarschuwing `Geen prijsberekening` staat bovenaan de inmeting.
- Status, aantal meetruimtes en klaar-voor-offerte tellers staan bovenaan.
- Meetregels tonen status met tekst, niet alleen kleur.
- De offertepicker waarschuwt dat prijs, product en btw gecontroleerd moeten worden.
- De demo-meetregel staat na Fase 4 bewust op `Verwerkt`.

Verbeterd:

- De calculatorsectie heeft nu een eigen kop `Rekenhulpen`.
- De technische tekst `snapshots` is vervangen door normale Nederlandse uitleg.
- Mobiele meetregelkaarten tonen nu ook de actie `Klaarzetten voor offerte` voor conceptregels.

## Styling en layout

Geen groot redesign uitgevoerd. De bestaande design-system componenten worden goed gebruikt:

- `SectionHeader`
- `Card`
- `StatCard`
- `Alert`
- `DataTable`
- `StatusBadge`
- `SummaryList`
- `Field`, `Input`, `Select`, `Textarea`

Kleine knelpunten die nu opgelost zijn:

| Issue | Fix |
| --- | --- |
| Rekenhulpen stonden direct onder meetregels zonder eigen context. | Extra panel met `Rekenhulpen` en guardrailtekst toegevoegd. |
| Meetruimtes copy gebruikte het technische woord `snapshots`. | Vervangen door `Een meetruimte is de vastgelegde maatvoering binnen deze inmeting.` |
| Mobiele meetregelkaart miste de draft-actie. | `Klaarzetten voor offerte` toegevoegd aan mobile card. |
| Calculatorfouten kwamen pas als algemene foutmelding na opslaan. | Inline waarschuwing `Controleer invoer` toegevoegd zodra invoer deels ongeldig is. |

## Calculator UI audit

Gecontroleerd:

- Vloer berekenen
- Plinten berekenen
- Behang berekenen
- Wandpanelen berekenen
- Trap berekenen
- Handmatige meetregel

Goed:

- Labels zijn Nederlands.
- Numerieke velden gebruiken `inputMode="decimal"` of `inputMode="numeric"`.
- Resultaten tonen offertehoeveelheid zonder prijsinformatie.
- Elke calculator toont de indicatieve waarschuwing.
- Snijverliesprofielen zijn zichtbaar en handmatig overschrijfbaar.

Verbeterd:

- De groep heet nu `Rekenhulpen` in plaats van `Calculators`.
- Inline validatie geeft eerder richting zonder technische fouttekst te tonen.

## Meetregels en meetruimtes mobile audit

Meetruimtes:

- Mobile cards tonen ruimte, oppervlakte, omtrek en notitie.
- De bestaande projectruimte kan als basis worden gebruikt.
- De uitleg is nu minder technisch.

Meetregels:

- Mobile cards tonen productgroep, status, ruimte, hoeveelheid en notitie.
- Verwerkte regels zijn herkenbaar als `Verwerkt`.
- Conceptregels kunnen nu ook op mobiel worden klaargezet voor offerte.

## Offertebuilder picker audit

`Uit inmeting laden` is duidelijk maar niet te dominant. De picker toont:

- Samenvatting hoeveel meetregels klaarstaan.
- Waarschuwing dat alleen hoeveelheden en omschrijvingen worden overgenomen.
- Empty state als er geen regels klaarstaan.
- Bevestiging voordat regels als offerteregel worden aangemaakt.

Verbeterd:

- Selectiefeedback toegevoegd: bij regels wordt zichtbaar hoeveel meetregels geselecteerd zijn.

Bewust niet gewijzigd:

- Geen automatische productkeuze.
- Geen automatische prijskeuze.
- Geen automatische btw-keuze.
- Geen automatische conversie zonder bevestiging.

## Nederlandse copy audit

Geen zichtbare technische enumwaarden gevonden in de hoofdflow:

- Geen `ready_for_quote`
- Geen `converted`
- Geen `quotePreparationStatus`
- Geen `measurementLine`
- Geen `unitPriceExVat`

Verbeterde termen:

- `snapshots` -> `vastgelegde maatvoering`
- `Calculators` -> `Rekenhulpen`

## Accessibility audit

Gecontroleerd:

- H1/H2-structuur via paginaheaders en sectiekoppen
- Form labels via `Field`
- Iconen hebben `aria-hidden` waar decoratief
- Knoppen hebben zichtbare Nederlandse namen
- Statussen tonen tekst
- Alerts zijn tekstueel duidelijk
- DataTables hebben `ariaLabel`
- Picker-checkboxen hebben een toegankelijke naam

Verbeterd:

- `ConfirmDialog` sluit nu met Escape.
- Route- en a11y-smoke-tests controleren nu ook project- en offerte-detailroutes.
- Script/style-inhoud wordt uit de zichtbare-tekstcontrole gefilterd, zodat verborgen island-data niet als UI-copy wordt beoordeeld.

## Guardrailcontrole

Bevestigd:

- `MeasurementPanel` maakt geen offerteregels aan.
- `MeasurementLinePicker` maakt offerteregels alleen na expliciete bevestiging.
- `unitPriceExVat` blijft `0` voor geïmporteerde meetregels.
- Metadata `source: "measurement"` blijft aanwezig.
- `markMeasurementLineConverted` wordt pas na succesvolle offerteregelcreatie aangeroepen.
- Geen prijs-, btw-, catalogus- of importlogica aangepast.
- Geen Convex schema gewijzigd.

## Direct uitgevoerde fixes

| Bestand | Wijziging | Reden | Business logic geraakt |
| --- | --- | --- | --- |
| `src/components/projects/MeasurementPanel.tsx` | Technische meetruimtecopy vervangen. | Minder developerachtig, beter voor winkel/backoffice. | Nee |
| `src/components/projects/MeasurementPanel.tsx` | Mobiele meetregelkaart kreeg `Klaarzetten voor offerte`. | Draft meetregels moeten ook mobiel bruikbaar zijn. | Nee |
| `src/components/projects/MeasurementPanel.tsx` | `Rekenhulpen`-sectie met guardrailtekst toegevoegd. | Flow sneller begrijpelijk maken. | Nee |
| `src/components/projects/MeasurementPanel.tsx` | Inline invoerwaarschuwing toegevoegd bij deels ongeldige calculatorinvoer. | Minder verwarring bij opslaan. | Nee |
| `src/components/quotes/MeasurementLinePicker.tsx` | Selectieaantal toegevoegd. | Meer controle bij meerdere meetregels. | Nee |
| `src/components/ui/ConfirmDialog.tsx` | Escape sluit dialoog. | Toegankelijkheid en toetsenbordbediening. | Nee |
| `tools/test_portal_routes.mjs` | Detailroutes toegevoegd. | Regressies op inmeet- en offerteflow eerder vinden. | Nee |
| `tools/test_portal_a11y.mjs` | Detailroutes toegevoegd en script/style uit visible text gefilterd. | Betere a11y-smoke zonder false positives. | Nee |

## Verificatie

Uitgevoerd:

- `npm run check` - OK
- `npm run build` - OK
- `npm run test:calculators` - OK
- `npm run test:portal` - OK, inclusief detailroutes
- `npm run test:a11y` - OK, inclusief detailroutes
- `npm run catalog:preview` - OK

Cataloguspreview bleef gelijk:

- Productregels: 10.291
- Previewregels: 10.691
- Prijsregels: 13.015
- Onbekende btw-prijsregels: 12.984

Build-opmerking:

- Astro/Vercel meldt alleen dat lokale Node.js versie 25 niet de Vercel Serverless runtime is; Vercel gebruikt Node.js 24. Dit is geen inmeetmodule-regressie.

## Resterende adviezen

1. Voeg later echte Playwright/axe screenshottests toe als dependency en CI daar klaar voor zijn.
2. Overweeg een compacte tabstructuur in ProjectDetail als de projectpagina verder groeit.
3. Overweeg calculatorresultaten visueel nog rustiger te maken met een klein `Indicatieve berekening` label per resultaatkaart.
4. Overweeg later een aparte `MeasurementCalculatorCard` component als de calculatorsectie verder uitbreidt.

## Conclusie

De Inmeetmodule voelt na deze pass rustiger, professioneler en beter bruikbaar op mobiel. De belangrijkste guardrail blijft helder: inmeting bereidt hoeveelheden en omschrijvingen voor; product, prijs, btw en offertetotalen blijven in de offertebuilder.
