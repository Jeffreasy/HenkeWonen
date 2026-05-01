# Catalogusimport samenvatting

`docs/catalog-import-summary.md` is de primaire reviewbron voor de catalogusvoorvertoning.
De grote rij-preview wordt standaard niet gegenereerd. Gebruik `npm run catalog:preview -- --full` of `CATALOG_PREVIEW_FULL=1` alleen voor debug/ontwikkeling.

## Samenvatting

- Productregels: 10291
- Voorvertonings-/auditregels: 10691
- Prijsregels: 13015
- Prijsregels met onbekende btw-modus: 12984
- Rijen met waarschuwing over onbekende btw-modus: 10291
- Bronbestanden totaal: 21
- Bronbestanden met productregels: 17
- Rijen zonder bruikbare prijs: 10
- Ontbrekende btw-mappings: niet beschikbaar in lokale Excel-voorvertoning

## Per categorie

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

## Per bronbestand

| Bestand | Productregels |
| --- | ---: |
| `Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` | 8205 |
| `henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls` | 988 |
| `Prijslijst PVC 11-2025 click dryback apart.xlsx` | 262 |
| `PVC 11-2025 click dryback apart floorlife.xlsx` | 262 |
| `Co-pro Entreematten 2025.xlsx` | 111 |
| `Co-pro prijslijst Plinten 2025-07.xlsx` | 67 |
| `Roots collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 1.05.2026 - A.xlsx` | 59 |
| `Prijslijst EVC 2025 click en dryback apart.xlsx` | 56 |
| `PVC - palletcollectie op palletafname_2025 2025-06-11 07_31_31 (005).xlsx` | 54 |
| `Prijslijst Ambiant Tapijt 2025-04.xlsx` | 45 |
| `Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx` | 40 |
| `Co-pro prijslijst lijm kit en egaline 2025-04.xlsx` | 31 |
| `Prijslijst VT Wonen Karpetten 2024.xlsx` | 26 |
| `Prijslijst Wandpanelen 2025-05.xlsx` | 24 |
| `Prijslijst Douchepanelen en tegels 2025-04.xlsx` | 23 |
| `Prijslijst Ambiant Vinyl 07-2024.xlsx` | 23 |
| `Prijslijst Traprenovatie Floorlife 2025.xlsx` | 15 |

## Regeltypes

| Regeltype | Rijen |
| --- | ---: |
| Productregel | 10291 |
| Lege regel | 257 |
| Sectieregel | 94 |
| Genegeerde regel | 28 |
| Kopregel | 21 |

## Statussen

| Status | Rijen |
| --- | ---: |
| Waarschuwing | 10291 |
| Genegeerd | 400 |

## Dubbele/overgeslagen exacte kopieën

- DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst EVC 2025 click en dryback apart.xlsx is een exacte kopie van DATA\Leveranciers\HenkeWonen\Prijslijst EVC 2025 click en dryback apart.xlsx en is overgeslagen.
- DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst PVC 11-2025 click dryback apart.xlsx is een exacte kopie van DATA\Leveranciers\HenkeWonen\Prijslijst PVC 11-2025 click dryback apart.xlsx en is overgeslagen.
- DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx is een exacte kopie van DATA\Leveranciers\HenkeWonen\Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx en is overgeslagen.
- DATA\Leveranciers\HenkeWonen\PVC - palletcollectie op palletafname_2025 2025-06-11 07_31_31 (005).xlsx is een exacte kopie van DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\PVC - palletcollectie op palletafname_2025 2025-06-11 07_31_31 (005).xlsx en is overgeslagen.

## Volledige preview

- Standaard wordt geen rij-previewbestand geschreven.
- Debugpad: `docs\generated\catalog-import-preview.full.jsonl`
- Volledige output is JSONL: één auditbare JSON-regel per voorvertoningsregel.
