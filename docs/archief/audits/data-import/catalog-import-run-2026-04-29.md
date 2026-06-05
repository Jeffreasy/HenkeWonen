# Catalog Import Run - 2026-04-29

Doel: de Henke Wonen catalogus in Convex opnieuw opbouwen vanuit de grondig gecontroleerde Excel-preview.

## Bronnen

- Data-root: `DATA`
- Preview: `docs/catalog-import-preview.json`
- Convex deployment: `dev:kindly-greyhound-592`
- Convex URL: `https://kindly-greyhound-592.eu-west-1.convex.cloud`

## Vooraf gecorrigeerd

- Exact dubbele workbooks worden overgeslagen op basis van `fileHash`.
- PVC sheet/sectielogica heeft voorrang op algemene woorden zoals `tegel`.
- `Dryback`, `Click` en `SRC` worden uit sheet/context bepaald, niet alleen uit bestandsnaam.
- Co-pro kit/lijm/egaline blijft materiaalcategorie en wordt niet foutief als trap/plint gecategoriseerd.
- Prijs-sourceKeys bevatten nu ook de fysieke kolomindex, zodat dubbele kolomkoppen niet op elkaar vallen.
- EAN wordt bewaard als attribuut/herkenningswaarde, maar niet meer als enige deduplicatiesleutel.

## Preview

- Genormaliseerde product-/prijsrijen na kwaliteitsfilter: `10.291`
- Prijsregels na nulprijsfilter: `13.015`
- Unieke sourceKeys: `13.015`
- Skips door exacte dubbele workbooks: `4`

## Convex resultaat

- Actieve producten: `7.775`
- Prijsregels: `13.015`
- Prijslijsten: `21`
- Merken: `9`
- Collecties: `624`

## Categorieen in Convex

| Categorie | Producten |
| --- | ---: |
| Gordijnen | 5954 |
| Tapijt | 1032 |
| PVC Dryback | 176 |
| PVC Click | 154 |
| Entreematten | 111 |
| PVC Vloeren | 85 |
| Plinten | 67 |
| Palletcollectie PVC | 54 |
| Egaline | 16 |
| Lijm | 9 |
| Kit | 6 |
| Karpetten | 26 |
| Wandpanelen | 24 |
| Vinyl | 23 |
| Douchepanelen | 15 |
| Traprenovatie | 15 |
| Tegels | 8 |

## Nog bewust open

- `12.984` prijsregels hebben `vatMode=unknown`. Dit is in dev geimporteerd, maar voor productie moet de import-preview nog expliciete btw-bevestiging/mapping afdwingen.
- `10` Headlam-regels met Consumer Price `0` zijn niet als prijs/productregel geimporteerd.
- Co-pro entreematten gebruiken nu de eerste kolom als `articleNumber` in plaats van als productnaam.
