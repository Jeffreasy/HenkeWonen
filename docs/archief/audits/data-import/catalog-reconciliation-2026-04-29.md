# Henke Wonen Catalog Reconciliation - 2026-04-29

## Conclusie

De aangeleverde telling `7782 actieve producten / 13025 prijsregels` was de stand voor de laatste kwaliteitscorrectie.

Tijdens validatie zijn twee concrete issues gecorrigeerd:

- `10` Headlam prijsregels met `amount = 0` zijn verwijderd uit de import.
- Co-pro entreematten gebruikten de eerste kolom als productnaam; deze wordt nu als `articleNumber` opgeslagen.

De actuele gecontroleerde Convex-stand is:

| Metric | Verwacht uit import-preview | Werkelijk in Convex | Verschil | Verklaring |
| --- | ---: | ---: | ---: | --- |
| Geldige bronregels | 10291 | n.v.t. | n.v.t. | Previewregels na header/section/zero-price filtering |
| Actieve producten | 7775 | 7775 | 0 | Deduplicatie op importKey/article/supplierCode |
| Prijsregels | 13015 | 13015 | 0 | Prijsregels per sourceKey/priceList/type/unit/vatMode |
| Prijslijsten | 21 | 21 | 0 | Per unieke file/sheet na duplicate workbook skip |

## Actieve Producten

### Per leverancier

| Leverancier | Producten |
| --- | ---: |
| Headlam | 5954 |
| Interfloor | 988 |
| Floorlife | 376 |
| Co-pro | 209 |
| Ambiant | 67 |
| vtwonen | 66 |
| Roots | 59 |
| EVC | 56 |

### Per categorie

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
| Karpetten | 26 |
| Wandpanelen | 24 |
| Vinyl | 23 |
| Egaline | 16 |
| Douchepanelen | 15 |
| Traprenovatie | 15 |
| Lijm | 9 |
| Tegels | 8 |
| Kit | 6 |

### Per productKind

| productKind | Producten |
| --- | ---: |
| curtain_fabric | 5954 |
| carpet | 1032 |
| dryback | 176 |
| click | 92 |
| src | 120 |
| mat | 111 |
| other | 96 |
| panel | 39 |
| adhesive | 31 |
| plinth | 67 |
| rug | 26 |
| vinyl | 23 |
| tile | 8 |

## Prijsregels

### Per priceType

| priceType | Prijsregels |
| --- | ---: |
| advice_retail | 10510 |
| commission | 891 |
| pallet | 840 |
| cut_length | 235 |
| roll | 235 |
| trailer | 120 |
| purchase | 96 |
| net_purchase | 59 |
| step | 15 |
| package | 14 |

### Per vatMode

| vatMode | Prijsregels |
| --- | ---: |
| unknown | 12984 |
| inclusive | 31 |

### Per unit

| priceUnit | Prijsregels |
| --- | ---: |
| m1 | 9709 |
| m2 | 2083 |
| meter | 268 |
| piece | 244 |
| custom | 207 |
| pack | 169 |
| roll | 99 |
| package | 93 |
| trailer | 120 |
| pallet | 23 |

### Per bronbestand

| Bronbestand | Producten | Prijzen |
| --- | ---: | ---: |
| Headlam gordijnen 2026 | 5954 | 8205 |
| Interfloor artikeloverzicht `.xls` | 988 | 988 |
| PVC 11-2025 click/dryback | 260 | 786 |
| PVC 11-2025 floorlife | 260 | 786 |
| Co-pro plinten | 67 | 469 |
| Co-pro entreematten | 111 | 420 |
| Ambiant tapijt | 44 | 270 |
| EVC click/dryback | 56 | 168 |
| Co-pro lijm/kit/egaline | 31 | 162 |
| Roots 2026 | 59 | 146 |
| Ambiant vinyl | 23 | 138 |
| vtwonen PVC | 40 | 120 |
| PVC palletcollectie | 54 | 108 |
| Wandpanelen | 24 | 72 |
| Douchepanelen en tegels | 23 | 69 |
| Traprenovatie Floorlife | 15 | 57 |
| VT Wonen karpetten | 26 | 51 |

## Datakwaliteit

| Check | Resultaat | Beoordeling |
| --- | ---: | --- |
| Actieve producten zonder prijsregels | 0 | Goed |
| Prijsregels zonder bestaand product | 0 | Goed |
| Duplicate actieve producten op supplier + articleNumber | 0 groepen | Goed |
| Duplicate actieve producten op supplier + supplierCode | 0 groepen | Goed |
| Duplicate actieve producten op supplier + EAN | 25 groepen | Aandachtspunt: EAN is niet betrouwbaar uniek in deze bestanden |
| Prijsregels met amount <= 0 | 0 | Gefixt |
| Duplicate price sourceKeys | 0 groepen | Goed |
| Producten zonder articleNumber, EAN en supplierCode | 69 | Bronbestanden missen codes voor o.a. Ambiant tapijt/vinyl |
| Prijsregels met vatMode unknown | 12984 | Nog mapping nodig voor productie |

## Specifieke Checks

- Headlam: `8205` geldige prijsregels, `5954` actieve producten en `5954` unieke supplier codes. De eerdere verwachting `~5961` was inclusief `7` unieke nulprijs-producten; die worden nu bewust niet als actieve catalogusproducten geimporteerd.
- Interfloor `.xls`: `988` actieve producten en `988` unieke artikelnummerwaarden. Art.nr. blijft string.
- Dubbele PVC/Floorlife-bestanden: beide bronnen hebben `260` producten en `786` prijsregels; `260` producten overlappen bewust, terwijl prijzen per bronbestand/prijslijst gescheiden blijven.
- Co-pro lijm/kit/egaline: dubbele commissie-kolommen zijn bewust afzonderlijk opgeslagen via `sourceColumnIndex`; totaal `69` commission-prijsregels in dit bestand.
- Sectierijen zoals `Tegel decoren`, `Bouclé` en `Traprenovatie PVC Floorlife`: `0` matches als product.

## Import Batches

Er staan momenteel `0` records in `productImportBatches`. De huidige catalogus is direct via `tools/upload_catalog_import.mjs` geïmporteerd. Dat is functioneel correct voor dev, maar voor productie hoort de upload flow batchrecords en import rows aan te maken voor audit trail, warnings en rollback.

## Concrete Fixes

Al toegepast:

- Zero-price rows worden niet meer als prijsregel/productregel geïmporteerd.
- Co-pro entreematten krijgen `articleNumber` uit kolom 1 en productnaam uit kolom 2.
- Dubbele prijskolommen krijgen unieke `sourceKey` via `sourceColumnIndex`.
- EAN-only dedupe is verwijderd; EAN blijft attribuut/herkenning, maar niet enige productsleutel.

Nog te doen voor productie:

- Btw-mapping in import-preview afdwingen voor `vatMode=unknown`.
- Voor `69` producten zonder artikel/EAN/supplierCode een bewuste fallback vastleggen, bijvoorbeeld `sourceFile + sheet + row` of een `sourceIdentity` veld.
- `productImportBatches` en `productImportRows` vullen tijdens de importflow.
