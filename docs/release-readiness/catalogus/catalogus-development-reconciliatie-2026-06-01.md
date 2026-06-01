# Catalogus development-reconciliatie - 2026-06-01

Datum: 1 juni 2026
Scope: kandidaatcatalogus opnieuw opbouwen en importeren naar Convex development.

## Uitkomst

De volledige lokale kandidaatpreview is opnieuw gegenereerd en daarna schoon geimporteerd in Convex development. Productie is niet geraakt.

Eindresultaat:

- Preview: 32 bronbestanden totaal, 26 bronbestanden met productregels.
- Preview: 40.604 audit-/importregels.
- Preview: 27.880 productregels.
- Preview: 88.291 prijsregels.
- Preview: 16.203 prijsregels met onbekende btw-modus.
- Development-import: 27 unieke importgroepen/batches.
- Development-import: 40.604 rows verwerkt.
- Development-import: 27.880 product rows verwerkt.
- Btw-review na import: 55/55 prijskolommen opgelost, 0 open.
- Production import status op development: `READY`.

Het verschil tussen 32 preview-bronbestanden en 27 importgroepen is verwacht: de preview telt ook exacte dubbele bronbestanden mee als bronbestand voordat ze worden overgeslagen, en de import groepeert op unieke `sourceFileName`.

## Uitgevoerde acties

1. Volledige preview opnieuw gegenereerd met Node 24.
2. Previewtellingen vergeleken met het bronbesluit; de aantallen bleven gelijk.
3. Duplicate `sourceKey` collisions lokaal opgespoord voordat opnieuw werd geimporteerd.
4. Parser aangescherpt:
   - ZTAHL price sourceKeys bevatten nu ook sheet, rij en kolom.
   - Lamelio productidentiteit gebruikt nu EAN plus productnaam, omdat dezelfde EAN op verschillende varianten voorkomt.
   - Lamelio price sourceKeys bevatten nu ook sheet, rij en kolom.
5. Importtool aangescherpt:
   - standaard commit-limit verlaagd naar 25 rows per Convex mutation;
   - `--commit-limit` toegevoegd als expliciete override.
6. Resettool aangescherpt:
   - gebruikt summary-only catalogusstatistiek, zodat reset niet stukloopt op grote catalogussen.
7. Convex development catalogus schoon gereset.
8. Volledige kandidaatpreview opnieuw naar Convex development geimporteerd.
9. Actuele btw-current-state opnieuw geexporteerd.

## Reset

Voor de schone import is development-catalogusdata verwijderd:

| Tabel | Verwijderd |
| --- | ---: |
| `productPrices` | 88.193 |
| `products` | 25.053 |
| `priceLists` | 66 |
| `productCollections` | 1.091 |
| `brands` | 25 |

Importbatches en importregels zijn niet door deze resettool opgeschoond. Dat is bestaande toolsemantiek; de nieuwe succesvolle importbatchreeks is daardoor wel leidend voor de actuele catalogusdata, maar de oude batchhistorie blijft aanwezig.

## Verificatie

`npm run catalog:status` na de import:

- target: `development`
- deployment: `dev:kindly-greyhound-592`
- production import status: `READY`
- btw-mappings: 55 totaal, 55 opgelost, 0 open
- review rows: 55
- price lists: 28
- brands: 23
- product collections: 1.034

Let op: `latestImportRun` in `catalog:status` is batchniveau, niet de aggregate van de volledige 27-batch import. Gebruik de importoutput of dit reconciliatiedocument als totaalbeeld van de volledige run.

## Duplicate-EAN

De bestaande Convex duplicate-EAN sync/review schaalt niet meer op de volledige catalogus. Na de volledige import loopt `catalogReview.syncDuplicateEanIssues` stuk op de Convex read-byte limiet, omdat de mutation alle producten in een keer verzamelt.

Daarom is de duplicate-EAN stand lokaal uit de gerepareerde preview bepaald:

| Leverancier | Groepen | Producten |
| --- | ---: | ---: |
| ZTAHL | 1 | 2 |
| Floorlife | 4 | 8 |
| Unilin Flooring | 17 | 34 |
| Lamelio | 4 | 8 |
| Casadeco | 402 | 954 |
| Caselio | 456 | 1.256 |
| Casamance | 937 | 2.016 |
| **Totaal** | **1.821** | **4.278** |

De oude Convex-status `duplicateEanIssues.open = 4` is daarom niet betrouwbaar als releasepoort voor de volledige catalogus. De bulk van de EAN-herhaling zit in Texdecor/Casadeco/Caselio/Casamance-bronnen en lijkt vaak collectie-/artikelnummerhergebruik rond dezelfde EAN te zijn. Dit moet niet automatisch worden gemerged.

## Releasebetekenis

Development is nu bruikbaar als actuele volledige catalogusbaseline voor portaltesten en featureontwikkeling.

Productie-import blijft nog niet vrijgegeven totdat een van deze twee paden expliciet gekozen is:

1. Duplicate-EAN tooling schaalbaar maken en de 1.821 kandidaatgroepen formeel beoordelen.
2. Met businessakkoord vastleggen dat duplicate-EAN voor Texdecor/verwante bronnen als waarschuwing wordt geaccepteerd en geen harde productieblokkade is.
