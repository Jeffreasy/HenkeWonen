# Henke Wonen Data Reaudit - 2026-04-29

Doel: de ruwe Exceldata opnieuw naast de huidige Convex/importcode leggen en expliciet markeren waar nog data verloren kan gaan.

## Kerncijfers

- Excelbestanden in `DATA`: 22
- Sheets: 33
- Genormaliseerde catalogusrijen: 10291
- Genormaliseerde prijsregels: 13015
- Unieke importKeys in preview: 7775
- Prijsregels met `vatMode=unknown`: 12984
- Genormaliseerde rijen zonder prijs: 10

## Belangrijkste nieuwe/blijvende aandachtspunten

- **HOOG** - btw-modus is meestal onbekend: 12984 prijsregels hebben vatMode=unknown. Definitieve import moet mapping blokkeren of expliciet laten bevestigen.
- **MIDDEL** - catalogusrijen zonder prijs: 10 rijen normaliseren wel als product maar krijgen geen prijsregel; deze moeten in preview als warning zichtbaar zijn.
- **INFO** - deduplicatie verklaart lager productaantal: 10291 previewrijen leveren 7775 unieke importKeys op; Convex productaantal lager dan rijaantal is dus verwacht, maar prijzen moeten per priceList/sourceKey blijven bestaan.

## Rijdekking per sheet

| Bron | Sheet | Audit productrijen | Genormaliseerd | Delta |
| --- | --- | ---: | ---: | ---: |
| `DATA\Henke Wonen Jeffrey.xlsx` | `Producten overzicht` | 5 | 0 | 5 |
| `DATA\Henke Wonen Jeffrey.xlsx` | `Werkzaamheden kosten totaal` | 10 | 0 | 10 |
| `DATA\Henke Wonen Jeffrey.xlsx` | `Klantcontactformulier voorbeeld` | 0 | 0 | 0 |
| `DATA\Henke Wonen Jeffrey.xlsx` | `Offerte voorbeeld` | 0 | 0 | 0 |
| `DATA\Henke Wonen Jeffrey.xlsx` | `Factuur voorbeeld` | 0 | 0 | 0 |
| `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` | `Collectie Compleet` | 8215 | 8215 | 0 |
| `DATA\Leveranciers\HenkeWonen\henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls` | `henke-swifterbant-artikeloverzi` | 988 | 988 | 0 |
| `DATA\Leveranciers\HenkeWonen\Prijslijst Douchepanelen en tegels 2025-04.xlsx` | `Blad1` | 24 | 23 | 1 |
| `DATA\Leveranciers\HenkeWonen\Prijslijst EVC 2025 click en dryback apart.xlsx` | `Drbyack` | 37 | 36 | 1 |
| `DATA\Leveranciers\HenkeWonen\Prijslijst EVC 2025 click en dryback apart.xlsx` | `Click` | 21 | 20 | 1 |
| `DATA\Leveranciers\HenkeWonen\Prijslijst PVC 11-2025 click dryback apart.xlsx` | `Floorlife PVC Dryback` | 143 | 142 | 1 |
| `DATA\Leveranciers\HenkeWonen\Prijslijst PVC 11-2025 click dryback apart.xlsx` | `Floorlife PVC SRC` | 121 | 120 | 1 |
| `DATA\Leveranciers\HenkeWonen\Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx` | `Prijslijst - vtwonen PVC drybac` | 27 | 26 | 1 |
| `DATA\Leveranciers\HenkeWonen\Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx` | `Prijslijst - vtwonen PVC click` | 15 | 14 | 1 |
| `DATA\Leveranciers\HenkeWonen\Prijslijst Wandpanelen 2025-05.xlsx` | `Blad1` | 25 | 24 | 1 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Co-pro Entreematten 2025.xlsx` | `Ambiant Entreematten` | 111 | 111 | 0 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Co-pro prijslijst lijm kit en egaline 2025-04.xlsx` | `Blad1` | 37 | 31 | 6 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Co-pro prijslijst Plinten 2025-07.xlsx` | `juli 2025` | 68 | 67 | 1 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst Ambiant Tapijt 2025-04.xlsx` | `Tapijt` | 46 | 45 | 1 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst Ambiant Vinyl 07-2024.xlsx` | `Vinyl` | 24 | 23 | 1 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst EVC 2025 click en dryback apart.xlsx` | `*` | 0 | 0 | 0 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst PVC 11-2025 click dryback apart.xlsx` | `*` | 0 | 0 | 0 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst Traprenovatie Floorlife 2025.xlsx` | `Prijslijst ` | 16 | 15 | 1 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst VT Wonen Karpetten 2024.xlsx` | `Blad1` | 26 | 26 | 0 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx` | `*` | 0 | 0 | 0 |
| `DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\PVC - palletcollectie op palletafname_2025 2025-06-11 07_31_31 (005).xlsx` | `Collectie overzicht` | 65 | 54 | 11 |
| `DATA\Leveranciers\HenkeWonen\PVC - palletcollectie op palletafname_2025 2025-06-11 07_31_31 (005).xlsx` | `*` | 0 | 0 | 0 |
| `DATA\Leveranciers\HenkeWonen\PVC 11-2025 click dryback apart floorlife.xlsx` | `Floorlife PVC Dryback` | 143 | 142 | 1 |
| `DATA\Leveranciers\HenkeWonen\PVC 11-2025 click dryback apart floorlife.xlsx` | `Floorlife PVC SRC` | 121 | 120 | 1 |
| `DATA\Leveranciers\HenkeWonen\PVC 11-2025 click dryback apart floorlife.xlsx` | `Blad1` | 0 | 0 | 0 |
| `DATA\Leveranciers\HenkeWonen\Roots collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 1.05.2026 - A.xlsx` | `ROOTS 2026 VANAF Q2` | 59 | 59 | 0 |
| `DATA\Leveranciers\HenkeWonen\Roots collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 1.05.2026 - A.xlsx` | `Sheet1` | 0 | 0 | 0 |

## Prijstypes

| Type | Aantal |
| --- | ---: |
| `advice_retail` | 10510 |
| `commission` | 891 |
| `pallet` | 840 |
| `cut_length` | 235 |
| `roll` | 235 |
| `trailer` | 120 |
| `purchase` | 96 |
| `net_purchase` | 59 |
| `step` | 15 |
| `package` | 14 |

## Prijseenheden

| Eenheid | Aantal |
| --- | ---: |
| `m1` | 9709 |
| `m2` | 2083 |
| `meter` | 268 |
| `piece` | 244 |
| `custom` | 207 |
| `pack` | 169 |
| `trailer` | 120 |
| `roll` | 99 |
| `package` | 93 |
| `pallet` | 23 |

## Btw-modus

| vatMode | Aantal |
| --- | ---: |
| `unknown` | 12984 |
| `inclusive` | 31 |

## Top ongemapte headers

| Header | Gevulde cellen |
| --- | ---: |
| `Leverancier` | 59 |
| `Size` | 59 |
| `H` | 59 |
| `Artikel` | 10 |
| `Verfmethode` | 10 |
| `Omschrijving stof` | 5 |
| `Samenstelling` | 5 |
| `Wasvoorschrift` | 5 |

## Verdachte ongemapte headers

| Header | Gevulde cellen |
| --- | ---: |
| `Artikel` | 10 |

## PriceList samenvoeg-risico

- Geen bronpad-duplicaten met dezelfde bestandsnaam/sheet gevonden.

## Rijen zonder prijs in normalisatie

- `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` / `Collectie Compleet` rij 1325: DAHLIA 140CM 61 BEIGE Overgordijn (Gordijnen)
- `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` / `Collectie Compleet` rij 2033: EXTERNE STOFLEVERING 00 Overgordijn (Gordijnen)
- `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` / `Collectie Compleet` rij 2034: EXTERNE STOFLEVERING VOERING Overgordijn (Gordijnen)
- `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` / `Collectie Compleet` rij 2116: FIRE FR+DIMOUT 73 Overgordijn (Gordijnen)
- `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` / `Collectie Compleet` rij 2122: FIRE FR+DIMOUT 86 ALPACA FR Overgordijn (Gordijnen)
- `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` / `Collectie Compleet` rij 5569: VIRAGO FR 305CM ZLB 60MV LACE Vitrage (Gordijnen)
- `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` / `Collectie Compleet` rij 5755: VOERING RAINBOW 280 49 Overgordijn (Gordijnen)
- `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` / `Collectie Compleet` rij 6865: FIRE FR+DIMOUT 73 Overgordijn (Gordijnen)
- `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` / `Collectie Compleet` rij 6871: FIRE FR+DIMOUT 86 ALPACA FR Overgordijn (Gordijnen)
- `DATA\Leveranciers\HenkeWonen\Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` / `Collectie Compleet` rij 8071: VOERING RAINBOW 280 49 Overgordijn (Gordijnen)

## Categorieen in preview

| Categorie | Rijen |
| --- | ---: |
| Gordijnen | 8205 |
| Tapijt | 1033 |
| PVC Dryback | 320 |
| PVC Click | 274 |
| Entreematten | 111 |
| PVC Vloeren | 85 |
| Plinten | 67 |
| Palletcollectie PVC | 54 |
| Karpetten | 26 |
| Wandpanelen | 24 |
| Vinyl | 23 |
| Egaline | 16 |
| Douchepanelen | 15 |
| Traprenovatie | 15 |
| Lijm | 9 |
| Tegels | 8 |
| Kit | 6 |
