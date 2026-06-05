# Quote Template Seed Verification - 2026-04-30

## Samenvatting

De seed-verificatie voor `Standaard offerte woninginrichting` is uitgevoerd nadat Convex
weer actief was. De architectuur, importstraat, VAT mapping, prijslogica en PDF/factuurflow
zijn niet gewijzigd.

Status: **geslaagd**.

## Seed Run

Uitgevoerd:

```txt
npx convex dev --once --tail-logs disable --env-file .env.local --run seed:run
```

Resultaat:

```txt
categories: 24
suppliers: 27
serviceCostRules: 19
quoteTemplates: 1
importProfiles: 16
tenantId: md7f9ecc27at3eqn5wvbshgrnx85sen9
```

## Template Controle

Convex-query:

```txt
npx convex run portal:listQuoteTemplates '{"tenantSlug":"henke-wonen"}' --env-file .env.local
```

Gevonden template:

```txt
name: Standaard offerte woninginrichting
id: n176qcc4m5cv2whgy8yw019dx985s6mz
type: default
template lines: 14
default terms: 8
payment terms: 6
```

Gecontroleerde secties:

- Vloeren
- Plinten
- Gordijnen & raamdecoratie
- Traprenovatie
- Wandafwerking
- Behang
- Voorwaarden
- Facturering

Gecontroleerde behangregels:

- `Behang merk, kleur`, lineType `product`, unit `roll`
- `Aanbrengen behang`, lineType `labor`, unit `roll`

Conclusie: behang geleverd en aanbrengen behang blijven gescheiden regels.

## Nieuwe Offerte Overname

Er is een verificatie-offerte aangemaakt via bestaande portal mutation:

```txt
title: Verificatie - standaard offerte woninginrichting
quoteId: kx745k2n2y49521vmvhf74q2dd85tjzt
```

Controle:

```txt
quote terms: 8
template terms: 8
termsMatch: true
quote paymentTerms: 6
template paymentTerms: 6
paymentTermsMatch: true
subtotalExVat: 0
vatTotal: 0
totalIncVat: 0
lines: 0
```

Conclusie: nieuwe offertes nemen voorwaarden en payment terms correct over. Offertetotalen
blijven gelijk zolang er geen regels zijn toegevoegd.

## QuoteLineEditor Controle

`portal:listQuotesWorkspace` retourneert de actieve template mee naar de offerteworkspace.
Daarmee krijgt `QuoteBuilder` de template en geeft deze de 14 `defaultLines` door aan
`QuoteLineEditor`.

Conclusie: de regel-editor heeft de template-regels beschikbaar om te laden en daarna handmatig
aan te passen voordat ze aan de offerte worden toegevoegd.

## Behangcalculator Controle

Uitgevoerde calculatorcase:

```txt
wallWidthM: 4
wallHeightM: 2.6
rollWidthCm: 53
rollLengthM: 10.05
patternRepeatCm: 0
wastePercent: 10
```

Resultaat:

```txt
banenNeeded: 8
baanLengteM: 2.6
banenPerRol: 3
baseRollsNeeded: 3
rollsNeeded: 4
wasteExtraRolls: 1
isIndicative: true
```

Conclusie: de calculator rondt naar boven af, verwerkt snijverlies indicatief en kan de quantity
voor een behangregel vullen.

## Routechecks

```txt
/portal                               HTTP 200
/portal/instellingen/offertetemplates HTTP 200
/portal/offertes                      HTTP 200
```

## Regressiechecks

```txt
npm run check          OK, 0 errors, 0 warnings
npm run build          OK, 0 errors, 0 warnings
npm run catalog:preview OK
```

Catalog preview bleef onveranderd:

```txt
productRows: 10291
previewRows: 10691
priceRules: 13015
unknownVatModePriceRules: 12984
fullPreview: null
```

## Conclusie

De seed en functionele verificatie zijn geslaagd. De template is beschikbaar in Convex,
offertes nemen voorwaarden en payment terms over, template-regels zijn beschikbaar in de
offertebuilder, de behangcalculator rekent logisch, en de import/catalogusbaseline is niet
geraakt.

