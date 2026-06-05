# Offertesjablonen pagina-audit - 2026-04-30

## Samenvatting

De pagina `/portal/instellingen/offertetemplates` laadt echte Convex-data en toont de template **Standaard offerte woninginrichting**. De basis was functioneel, maar voelde nog deels technisch en te weinig scanbaar voor dagelijks gebruik.

Ik heb alleen kleine veilige UI- en copy-fixes gedaan. Er is geen offerteberekening, prijslogica, importarchitectuur, VAT mapping, auth of schema gewijzigd.

## Huidige status na fixes

- Route `/portal/instellingen/offertetemplates`: HTTP 200.
- Template zichtbaar: `Standaard offerte woninginrichting`.
- Secties zichtbaar: Vloeren, Plinten, Gordijnen & raamdecoratie, Traprenovatie, Wandafwerking, Behang, Voorwaarden, Facturering.
- Sjabloonregels zichtbaar en gegroepeerd per inhoudelijke sectie.
- Voorwaarden en betalingsafspraken staan duidelijk gescheiden.
- Technische enumwaarden zoals `lineType`, `paymentTerms`, `defaultLines`, `categoryHint`, `productKindHint` zijn niet zichtbaar voor gebruikers.
- Offertebuilder blijft sjabloonregels laden en toont dezelfde nette Nederlandse labels.

## Gevonden issues

1. **Copy was deels ruwe seedtekst**
   - Voorbeelden: `Plisses`, `Jaloezieen`, `tbv pvc`, `EUR 3000`.
   - Dit voelde niet professioneel en zou zichtbaar worden in instellingen en in de offertebuilder.

2. **Actieve sjabloonstatus was niet duidelijk**
   - De pagina liet het type `Standaard` zien, maar niet expliciet dat het sjabloon actief is.

3. **Sjabloonregels waren minder scanbaar**
   - Alle regels stonden in één lijst/grid.
   - De relatie met secties zoals Vloeren, Raamdecoratie en Behang was daardoor minder duidelijk.

4. **Effect van wijzigingen was onvoldoende expliciet**
   - Medewerkers moesten kunnen zien dat wijzigingen gelden voor nieuwe offertes en bestaande offertes niet stil worden aangepast.

5. **Betalingsafspraken misten eigen summary**
   - De pagina telde voorwaarden, maar betalingsafspraken waren niet als apart beheerd onderdeel zichtbaar.

## Direct uitgevoerde fixes

| Bestand | Wijziging | Reden | Business logic geraakt |
| --- | --- | --- | --- |
| `src/components/settings/QuoteTemplatesSettings.tsx` | Sjabloonregels gegroepeerd per sectie, met compacte metadata en Nederlandse labels. | Betere scanbaarheid en minder technisch gevoel. | Nee |
| `src/components/settings/QuoteTemplatesSettings.tsx` | Info-alert toegevoegd: wijzigingen gelden voor nieuwe offertes; bestaande offertes bewaren eigen teksten. | Veiligere UX en duidelijk effect van beheeractie. | Nee |
| `src/components/settings/QuoteTemplatesSettings.tsx` | Summary uitgebreid met betalingsafspraken en actieve statusbadge. | Pagina maakt sneller duidelijk wat beheerd wordt. | Nee |
| `src/components/settings/QuoteTemplatesSettings.tsx` | Loading/error states vervangen door bestaande UI-components. | Consistent design-system en betere toegankelijkheid. | Nee |
| `src/lib/quoteTemplateCopy.ts` | Centrale copy-polish helper toegevoegd. | Eén plek voor zichtbare sjablooncopy uit oudere seeddata. | Nee |
| `src/components/quotes/QuoteLineEditor.tsx` | Sjabloonregel-keuzelijst gebruikt dezelfde Nederlandse copy-polish. | Offertebuilder toont geen ruwe templatekopij. | Nee |
| `src/components/quotes/QuoteBuilder.tsx` | Voorwaarden/betalingsafspraken worden met dezelfde copy-polish getoond. | Bestaande offertes met oude tekst blijven leesbaar/professioneel. | Nee |
| `src/lib/i18n/statusLabels.ts` | Units `stairs` en `tekst` kregen Nederlandse labels. | Geen technische eenheden zichtbaar. | Nee |
| `convex/portal.ts` | `status` meegestuurd in `listQuoteTemplates`. | UI kan actief/inactief tonen zonder schemawijziging. | Nee |
| `convex/seed.ts` | Seed-copy gecorrigeerd voor accenten, btw/eurobedragen en PVC/m². | Nieuwe of opnieuw geseede data blijft netjes. | Nee |
| `src/styles/global.css` | Kleine styling voor summary, badges en sectiegroepen. | Rustigere layout en betere mobiele scanbaarheid. | Nee |
| `tools/test_portal_a11y.mjs` | Offertetemplates-route toegevoegd aan a11y-smoke en extra technische termen bewaakt. | Regressie op deze pagina sneller zichtbaar. | Nee |

## Nederlandse copy

Gecorrigeerd of bewaakt:

- `Plisses` naar `Plissés`
- `Jaloezieen` naar `jaloezieën`
- `tbv pvc` naar `t.b.v. PVC`
- `Pvc` naar `PVC`
- `m2` naar `m²`
- `EUR 10.000` naar `€10.000`
- `EUR 3000` naar `€3.000`
- `PIN betaling` naar `pinbetaling`

## UX en logica

De pagina legt nu beter uit:

- welke sjablonen beschikbaar zijn;
- welk sjabloon actief is;
- hoeveel sjabloonregels, voorwaarden en betalingsafspraken er zijn;
- dat sjabloonregels in de offertebuilder geladen en aangepast kunnen worden;
- dat bestaande offertes hun eigen teksten bewaren.

Voorwaarden en betalingsafspraken zijn gescheiden:

- Voorwaarden: voorbereiding en uitvoering.
- Betalingsafspraken: aanbetaling, betaaltermijn en betaalwijze.

## Relatie met offertebuilder

Gecontroleerd op een bestaande offerte:

- `/portal/offertes/kx7d3g5w3dnp0v6x6cn6vse4ad85vq1z`

De sjabloonregel-keuzelijst blijft werken en gebruikt nu dezelfde professionele Nederlandse labels. Er is geen berekening, totaal of prijslogica gewijzigd.

## Toegankelijkheid

Verbeterd of gecontroleerd:

- duidelijke h1 via bestaande PageHeader;
- secties met logische h2/h3-structuur;
- alerts en loading/error states uit het design system;
- tekstlabels in plaats van alleen kleur;
- geen technische enumwaarden zichtbaar;
- `test:a11y` controleert de offertetemplates-route nu ook.

## Bewust niet aangepast

- Geen nieuw CRUD-beheer voor sjabloonregels gebouwd.
- Geen PDF/offerte-output aangepast.
- Geen offerteberekening of btw-berekening gewijzigd.
- Geen Convex schema gewijzigd.
- Geen bestaande Convex-template direct gemuteerd; de UI toont oude seedcopy netjes gepolijst en de seed is voor toekomstige runs gecorrigeerd.

## Verificatie

| Check | Resultaat |
| --- | --- |
| Browserroute `/portal/instellingen/offertetemplates` | OK |
| Convex-data: standaardtemplate zichtbaar | OK |
| Browser console errors | 0 |
| Technische enumwaarden zichtbaar | Nee |
| Offertebuilder sjabloonlabels | OK |
| `npm run check` | OK |
| `npm run build` | OK |
| `npm run test:portal` | OK |
| `npm run test:a11y` | OK |

Build-opmerking:

- De lokale Node.js versie is 25; Vercel gebruikt Node.js 24 als serverless runtime. Build blijft succesvol.

## Resterende adviezen

1. Bouw later een expliciete bewerkmodus voor sjabloonregels, met bevestiging dat wijzigingen alleen voor nieuwe offertes gelden.
2. Overweeg een read-only preview van “zo komt dit op de offerte” naast de tekstvelden.
3. Voeg bij toekomstige PDF/offerte-output dezelfde copy-polish of datamigratie toe, zodat oude templatecopy nergens terugkomt.
