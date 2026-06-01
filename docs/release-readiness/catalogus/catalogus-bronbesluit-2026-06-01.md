# Catalogus bronbesluit - 2026-06-01

Datum: 1 juni 2026
Scope: Henke Wonen catalogusimport richting release/productie.

## Besluit

Convex development is vanaf deze stabilisatieronde de operationele applicatiebaseline voor demo, portaltesten en featureontwikkeling.

De lokale 32-bronbestanden-preview in `docs/catalog-import-summary.json` is de kandidaatbron voor een volgende volledige catalogusverversing, maar is nog niet de productiebron. Productie-import blijft dicht totdat deze kandidaatpreview opnieuw volledig is gegenereerd, eerst naar Convex development is geimporteerd en daarna aantoonbaar overeenkomt met de live catalogusstatus.

Gebruik oude release-readiness btw-rapporten niet als enige waarheid voor productie. De live status van 1 juni 2026 wijkt af van de laatste vastgelegde btw-current-state uit mei.

## Bewijsstand

| Bron | Stand |
| --- | --- |
| `npm run catalog:status` op Convex development | target `development`, deployment `dev:kindly-greyhound-592`, `productionImportStatus: READY`, 55/55 btw-mappings opgelost, 0 open btw-mappings |
| Laatste live import-run | 17 bronbestanden, 10.291 productregels, 13.015 prijsregels, 10.291 rows met unknown-vat mode in de run-samenvatting |
| Live datakwaliteit | 4 open duplicate-EAN issues |
| Laatste live imported batch in catalog stats | 413 product rows, 413 updated products, 413 imported prices |
| Lokale preview `docs/catalog-import-summary.json` | 32 bronbestanden, 26 met productregels, 27.880 productregels, 88.291 prijsregels, 16.203 prijsregels met onbekende btw-modus |
| Laatste vastgelegde btw-current-state doc uit mei | meldt nog `BLOCKED` en open btw-mappings; dit is niet meer gelijk aan live Convex development |

De mismatch betekent niet automatisch dat data fout is, maar wel dat de releasevraag nog niet beantwoord is. De app kan veilig doorontwikkelen op de huidige Convex development baseline; catalogusproductie mag pas na een expliciete bronreconciliatie.

## Releasepoort

Productie-import is pas toegestaan als alle onderstaande punten groen zijn:

1. De kandidaatpreview is opnieuw volledig gegenereerd met Node 24.
2. De gegenereerde preview dekt de verwachte bronset. Richtwaarde vanuit huidige lokale preview: 32 bronbestanden totaal, 26 bronbestanden met productregels, 27.880 productregels.
3. De kandidaatpreview is eerst naar Convex development geimporteerd, niet direct naar productie.
4. `npm run catalog:status` is na de development-import opnieuw uitgevoerd en de live tellingen zijn naast de previewtelling gelegd.
5. De btw-current-state documenten zijn opnieuw geexporteerd met dezelfde datumstempel als de releasekandidaat.
6. De 4 open duplicate-EAN issues zijn bewust beoordeeld als accepteren, oplossen of release-waarschuwing.
7. Productie-import wordt alleen uitgevoerd met expliciete production target, production bevestigingsflag en zonder `--allow-unknown-vat`.

## Aanbevolen uitvoering

Gebruik de projectruntime:

```powershell
.\tools\use-node24.ps1 npm run catalog:status
```

Genereer de volledige kandidaatpreview bewust met voldoende timeout:

```powershell
.\tools\use-node24.ps1 npm run catalog:preview
```

Als de volledige preview te traag is voor een snelle check, draai eerst gerichte parser-smokes via de directe Node wrapper. Gebruik `--source=...` zodat filters met spaties niet door npm-argumentparsing worden opgebroken.

```powershell
.\tools\use-node24.ps1 node tools/run_python_tool.mjs tools/build_catalog_import.py --no-write --source=ZTAHL
.\tools\use-node24.ps1 node tools/run_python_tool.mjs tools/build_catalog_import.py --no-write --source=Prijslijst
```

Importeer de volledige kandidaat daarna eerst naar development:

```powershell
.\tools\use-node24.ps1 npm run catalog:import:dev
.\tools\use-node24.ps1 npm run catalog:status
```

Exporteer de actuele btw-review opnieuw:

```powershell
.\tools\use-node24.ps1 npm run catalog:vat:export -- --date-stamp 2026-06-01
```

Pas daarna mag productie worden voorbereid. De productie-import zelf hoort een apart, expliciet akkoordmoment te blijven.
