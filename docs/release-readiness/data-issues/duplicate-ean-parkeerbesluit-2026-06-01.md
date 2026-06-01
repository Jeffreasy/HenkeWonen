# Duplicate-EAN parkeerbesluit - 2026-06-01

Datum: 1 juni 2026
Status: professioneel geparkeerd als bekend datakwaliteitspunt
Scope: volledige Henke Wonen development-catalogus na importreconciliatie.

## Besluit

De duplicate-EAN signalen worden geparkeerd als bekende datakwaliteitswaarschuwing. Ze worden niet opgelost verklaard, niet verborgen en niet automatisch samengevoegd.

Dit besluit maakt verdere portalontwikkeling en catalogustesten mogelijk zonder eerst 1.821 groepen handmatig af te werken. Voor productie blijft de waarschuwing zichtbaar in release-readiness en moet het releasebericht expliciet vermelden dat EAN niet als unieke productidentiteit wordt gebruikt.

## Stand

| Status | Aantal |
| --- | ---: |
| Actieve duplicate-EAN groepen | 1.821 |
| Producten in actieve groepen | 4.278 |
| Open Convex review issues | 1.816 |
| Eerder/stale resolved issues | 21 |

De bulk zit in Texdecor-gerelateerde bronnen:

| Leverancier | Groepen | Producten |
| --- | ---: | ---: |
| Casadeco | 402 | 954 |
| Caselio | 456 | 1.256 |
| Casamance | 937 | 2.016 |

Kleinere restgroepen blijven zichtbaar:

| Leverancier | Groepen | Producten |
| --- | ---: | ---: |
| ZTAHL | 1 | 2 |
| Floorlife | 4 | 8 |
| Unilin Flooring | 17 | 34 |
| Lamelio | 4 | 8 |

## Waarom parkeren verantwoord is

- De signalen zijn gesynchroniseerd naar `catalogDataIssues` en blijven auditbaar in de portal.
- De import gebruikt geen EAN als enige productidentiteit.
- Er is geen automatische merge- of delete-logica voor duplicate-EAN.
- Het patroon zit vooral in collectie-/artikelnummerhergebruik binnen leverancierbestanden.
- Een bulkmatige automatische correctie zou risicovoller zijn dan het signaal gecontroleerd laten staan.

## Guardrails

1. EAN mag niet als unieke productkey worden gebruikt.
2. Duplicate-EAN mag geen automatische merge triggeren.
3. Offerte-, zoek- en catalogusflows moeten productnaam, artikelnummer, collectie, leverancier en importkey blijven tonen of gebruiken waar relevant.
4. Bij productie-release moet dit als bekend datakwaliteitspunt in de release notes staan.
5. De volledige export blijft bewaard in `catalog-duplicate-ean-review-2026-06-01.json`.

## Heropenen

Pak dit dossier opnieuw op als een van deze situaties ontstaat:

1. Er komt een barcode-/scanflow waarbij EAN leidend wordt.
2. Een leverancier levert gecorrigeerde bestanden.
3. Gebruikers melden verwarring of verkeerde productselectie door dezelfde EAN.
4. Er wordt productdeduplicatie, automatische merge of voorraadkoppeling gebouwd.
5. Productie-release vereist volledige datakwaliteitsafhandeling in plaats van expliciete acceptatie.

## Praktische status

Voor nu is dit geen blokkade voor verdere ontwikkeling, demo of interne test op de development-catalogus.

Voor productie is dit alleen acceptabel als bekende waarschuwing met expliciete release-acceptatie. Zonder die acceptatie blijft het een productiepoort.
