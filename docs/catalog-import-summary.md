# Catalogusimport samenvatting

`docs/catalog-import-summary.md` is de primaire reviewbron voor de catalogusvoorvertoning.
De grote rij-preview wordt standaard niet gegenereerd. Gebruik `npm run catalog:preview -- --full` of `CATALOG_PREVIEW_FULL=1` alleen voor debug/ontwikkeling.

## Samenvatting

- Productregels: 27880
- Voorvertonings-/auditregels: 40604
- Prijsregels: 88291
- Prijsregels met onbekende btw-modus: 16203
- Rijen met waarschuwing over onbekende btw-modus: 13996
- Bronbestanden totaal: 32
- Bronbestanden met productregels: 26
- Rijen zonder bruikbare prijs: 10
- Ontbrekende btw-mappings: niet beschikbaar in lokale Excel-voorvertoning

## ZTAHL btw-bron

- De btw-bevestiging voor ZTAHL komt uit de Excel print-header, niet uit een cel.
- `Verkoopprijslijst ZTAHL 2026 - NL.xlsx`: `ZTAHL verkoopprijslijst incl. BTW - 2026`.
- `D-Inkoopprijslijst ZTAHL 2026 - NL.xlsx`: `ZTAHL inkooppprijslijst excl. BTW - 2026`.

## Per categorie

| Categorie | Rijen |
| --- | ---: |
| Gordijnen | 15958 |
| Overig | 6991 |
| Wandpanelen | 2042 |
| Tapijt | 1101 |
| Verlichting | 826 |
| PVC Dryback | 320 |
| PVC Vloeren | 147 |
| Behang | 143 |
| Entreematten | 111 |
| Plinten | 67 |
| Palletcollectie PVC | 54 |
| Karpetten | 26 |
| Vinyl | 23 |
| Egaline | 16 |
| Douchepanelen | 15 |
| Traprenovatie | 15 |
| Lijm | 9 |
| Tegels | 8 |
| Kit | 8 |

## Per bronbestand

| Bestand | Productregels |
| --- | ---: |
| `Nomenclature_prix_CAS CAM_2026 BNL .xlsx` | 10171 |
| `Advies Verkoop Gordijnen Complete Collectie (Incl. MV) 2026 PRIJZEN Headlam.xlsx` | 8205 |
| `Nomenclature_prix_CAD_CAL_2026 PBA.xlsx` | 6662 |
| `henke-swifterbant-artikeloverzicht-24-04-2026 Interfloor.xls` | 988 |
| `D-Inkoopprijslijst ZTAHL 2026 - NL.xlsx` | 413 |
| `Verkoopprijslijst ZTAHL 2026 - NL.xlsx` | 413 |
| `Prijslijst PVC 11-2025 click dryback apart.xlsx` | 142 |
| `PVC 11-2025 click dryback apart floorlife.xlsx` | 142 |
| `Co-pro Entreematten 2025.xlsx` | 111 |
| `Lamelio B2B website CSV File incl Allure.xlsx` | 74 |
| `Co-pro prijslijst Plinten 2025-07.xlsx` | 67 |
| `Roots collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 1.05.2026 - A.xlsx` | 59 |
| `PVC - palletcollectie op palletafname_2025 2025-06-11 07_31_31 (005).xlsx` | 54 |
| `Prijslijst Ambiant Tapijt 2025-04.xlsx` | 45 |
| `Lay Red collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 1.05.2026 - A.xlsx` | 42 |
| `Prijslijst EVC 2025 click en dryback apart.xlsx` | 36 |
| `Prijslijst Hebeta Tapijt 2026.pdf` | 35 |
| `Adviesverkoopprijslijst Montinique Tapijt 2026.pdf` | 33 |
| `Co-pro prijslijst lijm kit en egaline 2025-04.xlsx` | 31 |
| `Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx` | 26 |
| `Prijslijst VT Wonen Karpetten 2024.xlsx` | 26 |
| `Prijslijst Wandpanelen 2025-05.xlsx` | 24 |
| `Prijslijst Douchepanelen en tegels 2025-04.xlsx` | 23 |
| `Prijslijst Ambiant Vinyl 07-2024.xlsx` | 23 |
| `Moods collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 01.05.2026 - A .xlsx` | 20 |
| `Prijslijst Traprenovatie Floorlife 2025.xlsx` | 15 |

## Regeltypes

| Regeltype | Rijen |
| --- | ---: |
| Productregel | 27880 |
| Genegeerde regel | 10012 |
| Lege regel | 2318 |
| Sectieregel | 357 |
| Kopregel | 37 |

## Statussen

| Status | Rijen |
| --- | ---: |
| Waarschuwing | 14002 |
| Geldig | 13878 |
| Genegeerd | 12724 |

## Dubbele/overgeslagen exacte kopieën

- DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst EVC 2025 click en dryback apart.xlsx is een exacte kopie van DATA\Leveranciers\HenkeWonen\Prijslijst EVC 2025 click en dryback apart.xlsx en is overgeslagen.
- DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst PVC 11-2025 click dryback apart.xlsx is een exacte kopie van DATA\Leveranciers\HenkeWonen\Prijslijst PVC 11-2025 click dryback apart.xlsx en is overgeslagen.
- DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx is een exacte kopie van DATA\Leveranciers\HenkeWonen\Prijslijst vtwonen pvc 11-2023 click en dryback apart.xlsx en is overgeslagen.
- DATA\Leveranciers\HenkeWonen\PVC - palletcollectie op palletafname_2025 2025-06-11 07_31_31 (005).xlsx is een exacte kopie van DATA\Leveranciers\HenkeWonen\prijslijsten Floorlife\PVC - palletcollectie op palletafname_2025 2025-06-11 07_31_31 (005).xlsx en is overgeslagen.
- DATA\Leveranciers\Unilin Flooring\Roots collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 1.05.2026 - A.xlsx is een exacte kopie van DATA\Leveranciers\HenkeWonen\Roots collectie NL 2026 incl. adviesverkoopprijs per pak vanaf 1.05.2026 - A.xlsx en is overgeslagen.

## Volledige preview

- Standaard wordt geen rij-previewbestand geschreven.
- Debugpad: `docs\generated\catalog-import-preview.full.jsonl`
- Volledige output is JSONL: één auditbare JSON-regel per voorvertoningsregel.
