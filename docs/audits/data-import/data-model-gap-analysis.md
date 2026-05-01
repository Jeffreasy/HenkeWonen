# Henke Wonen Data Model Gap Analysis

Deze notitie koppelt de lokale Excel-audit aan de huidige portalcode. Het auditrapport zelf staat in `docs/data-audit.md`; de volledige machineleesbare output staat in `docs/data-audit.json`.

## Bevindingen die nu in code zijn verwerkt

- Legacy `.xls` blijft expliciet onderdeel van de importarchitectuur via het Interfloor-importprofiel. Artikelnummers en supplier codes blijven strings.
- Prijsregels zijn uitgebreid met bronvelden: `sourceSheetName`, `sourceColumnName`, `sourceRowNumber` en `sourceValue`.
- Producten ondersteunen nu extra identifiers: `supplierCode`, `commercialCode` en `supplierProductGroup`.
- Producten ondersteunen logistieke/verpakkingsvelden zoals `salesUnit`, `purchaseUnit`, `orderUnit`, `minimumOrderQuantity`, `orderMultiple`, `palletQuantity`, `trailerQuantity` en `bundleSize`.
- Karpetten en horren zijn toegevoegd als categorieen, en `rug` is toegevoegd als productkind.
- Importprofielen zijn uitgebreid van globale buckets naar 16 workbookfamilies, waaronder Headlam stoffen, Interfloor legacy, Roots, Co-pro plinten/lijm/entree, Ambiant tapijt/vinyl, traprenovatie, karpetten, wandpanelen, douchepanelen/tegels en palletcollectie.
- De audittool splitst prijsvelden en logistieke velden. Kolommen zoals `Aantal pakken per pallet` worden niet langer als prijs gemarkeerd.
- Exact dubbele workbookkopieen worden in de cataloguspreview overgeslagen op basis van bestands-hash.
- PVC-categorieen worden nu bepaald op sheetniveau: `Drbyack/Dryback` wordt `PVC Dryback`, `SRC/Click` wordt `PVC Click`. Secties zoals `Tegel decoren` in PVC-bestanden worden niet meer verkeerd als categorie `Tegels` geimporteerd.
- Het bestand `Prijslijst Douchepanelen en tegels` splitst nu echte tegelregels naar `Tegels` en paneel/toebehorenregels naar `Douchepanelen`.
- Co-pro lijm/kit/egaline-regels worden niet meer door woorden als `trap` of `plint` naar productgroepen `Traprenovatie` of `Plinten` getrokken; kit/lijm/egaline houden hun materiaalcategorie.
- Technische productkolommen zoals `Planken per pak`, `Pakinhoud`, `Dikte`, `Toplaag`, `Lengte`, `Garantie`, `Klasse`, `Structuur`, `V-groef` en vergelijkbare velden worden nu als pakket-/dimensieveld of attribute meegenomen.
- `Roots` prijsregels met `vanaf 01/05/2026` krijgen nu `validFrom`; priceLists krijgen `year`/`validFrom` waar dit uit brondata afleidbaar is.
- `priceLists` worden niet meer alleen op bestandsnaam + sheetnaam herkend; de import kijkt ook naar file-hash zodat toekomstige gelijknamige maar inhoudelijk andere prijslijsten niet samenvallen.

## Belangrijkste data-risico's

- 12.994 genormaliseerde prijsregels hebben `vatMode=unknown`; de import-preview moet dit altijd laten bevestigen voordat import definitief is.
- 24 sheets bevatten sectierijen. `sectionLabel` moet worden onthouden en toegepast op opvolgende productregels.
- 500 codecellen kwamen numeriek uit Excel. Importcode moet alle codes serialiseren als tekst, inclusief EAN en artikelcodes.
- 20 Interfloor-codevoorbeelden beginnen met een punt, zoals `.007609`; trimmen of casten naar number beschadigt deze codes.
- Vier bestanden komen als exacte kopie op meerdere locaties voor. De preview slaat deze nu over; bestaande Convex-data die eerder met duplicaten is gevuld moet bij een herimport/cleanup worden opgeschoond.
- 58 logistieke/verpakkingskolom-observaties moeten buiten `productPrices` blijven.
- De huidige Convex Cloud-data is nog gebaseerd op een eerdere importpreview. Voor de gecorrigeerde categorisatie en exacte-kopie-skip is een bewuste herimport/opschoning nodig.

## Later nodig bij echte import-parser

- Per importprofiel concrete header-normalisatie maken voor spelfouten zoals `commisieprijs` en `verpakkking`.
- Validatie toevoegen die prijsvelden met `vatMode=unknown` blokkeert totdat een gebruiker de btw-modus kiest.
- Productdeduplicatie uitvoeren op `tenantId + supplierId + articleNumber` en als fallback `supplierCode`/EAN, zonder bestaande productprijzen te overschrijven.
- Productprijzen apart historiseren per `priceListId`, `priceType`, `priceUnit`, bronkolom en geldigheidsdatum.
- Headlam gordijnstoffen als made-to-measure catalogus importeren met attributes voor samenstelling, wasvoorschrift, patroonmaten en suitability flags.
- PVC commercial names per merklabel bewaren voor Ambiant/Floorlife in plaats van plat te slaan naar een enkele naam.
