# Henke Wonen Portal - Vrijgave- & Datakwaliteitgids

Datum: 10 juni 2026  
Doelgroep: Beheerders en directie Henke Wonen  
Status: Gecontroleerde productiestatus en toelichting voor pilot-vrijgave

---

## 1. Introductie

Voordat de portal officieel in gebruik wordt genomen, zijn er kritische controles uitgevoerd op de **productcatalogus**, de **btw-bepalingen van de prijslijsten**, de **datakwaliteit (EAN-barcodes)** en de **beveiliging van de serveromgevingen**. 

Dit document vat de resultaten van deze audits samen en legt uit hoe het systeem hiermee omgaat om de operationele betrouwbaarheid op de winkelvloer en in de buitendienst te garanderen.

---

## 2. Catalogus & Btw-mappings (100% opgelost)

Voor een betrouwbare prijsberekening in de offertes moeten alle geïmporteerde prijskolommen een bekende btw-status hebben (inclusief of exclusief btw). Indien deze status onbekend is, blokkeert het systeem de productie-import om foutieve klantprijzen te voorkomen.

### Actuele productiestatus (gecontroleerd op 10 juni 2026)
* **Aantal importprofielen**: 20 actieve profielen.
* **Totaal aantal prijskolommen**: 61 kolommen.
* **Opgeloste mappings**: **61 van de 61 kolommen**.
* **Openstaande mappings**: **0 kolommen**.
* **Productie-import status**: **READY** (Vrijgegeven).

Dit betekent dat alle prijsinformatie van de onderstaande leveranciers succesvol is geanalyseerd, handmatig is gecorrigeerd en gereed is voor gebruik:

| Importprofiel | Leverancier | Categorie | Aantal Prijskolommen | Btw-Modus in Portal |
| --- | --- | --- | ---: | --- |
| **Ambiant tapijt 2025** | Ambiant | Tapijt | 6 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **Ambiant vinyl 2024** | Ambiant | Vinyl | 6 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **Co-pro entreematten 2025** | Co-pro | Entreematten | 4 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **Co-pro lijm kit egaline 2025** | Co-pro | Egaline/Lijm | 5 kolommen | Exclusief btw (pallet/commissie) / Inclusief btw (advies) |
| **Co-pro plinten 2025** | Co-pro | Plinten | 5 kolommen | Exclusief btw (pallet/commissie) / Inclusief btw (advies) |
| **Douchepanelen en tegels 2025** | Floorlife | Douchepanelen | 3 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **EVC PVC click dryback** | EVC | PVC | 3 kolommen | Exclusief btw (pallet/commissie) / Inclusief btw (advies) |
| **Floorlife/Ambiant PVC 11-2025** | Floorlife | PVC | 4 kolommen | Exclusief btw (pallet/commissie/trailer) / Inclusief btw (advies) |
| **Headlam gordijnstoffen Complete Collectie 2026** | Headlam | Gordijnen | 1 kolom | Inclusief btw (adviesverkoop) |
| **Interfloor legacy artikeloverzicht** | Interfloor | Tapijt | 1 kolom | Inclusief btw (adviesverkoop) |
| **Lay Red collectie NL 2026** | Unilin Flooring | PVC | 2 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **Moods collectie NL 2026** | Unilin Flooring | PVC | 2 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **PVC palletcollectie 2025** | Floorlife | PVC | 2 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **Roots collectie NL 2026** | Roots | PVC | 3 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **Traprenovatie Floorlife 2025** | Floorlife | Traprenovatie | 4 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **vtwonen karpetten 2024** | vtwonen | Karpetten | 2 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **vtwonen PVC click dryback** | vtwonen | PVC | 3 kolommen | Exclusief btw (pallet/commissie) / Inclusief btw (advies) |
| **Wandpanelen 2025** | Floorlife | Wandpanelen | 3 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **ZTAHL inkoopprijslijst 2026** | ZTAHL | Verlichting | 1 kolom | Exclusief btw |
| **ZTAHL verkoopprijslijst 2026** | ZTAHL | Verlichting | 1 kolom | Inclusief btw |

---

## 3. Datakwaliteit: Dubbele EAN-nummers

Tijdens data-analyses is vastgesteld dat leveranciers soms hetzelfde EAN-nummer (de barcode) toewijzen aan verschillende producten of productvarianten. De portal behandelt EAN daarom bewust als hulpmiddel, niet als unieke sleutel.

### Actuele productiestatus (gecontroleerd op 10 juni 2026)
* **Openstaande productcontrole-issues**: 0.
* **Geregistreerde duplicate-EAN issues in productie**: 0.
* **Operationeel besluit**: toekomstige dubbele EAN-waarschuwingen worden zichtbaar gemaakt voor beoordeling, maar blokkeren de productie-import niet automatisch zolang de btw-keuzes gereed zijn.

### Waarom dit geen automatisch samenvoeg-risico is
De portal hanteert de volgende principes:

1. **Geen unieke sleutel**: Het systeem gebruikt het EAN-nummer **nooit** als primaire unieke sleutel om producten te identificeren.
2. **Geen automatische samenvoeging**: Producten met dezelfde EAN worden **nooit automatisch samengevoegd of overschreven**. Ze blijven als losse, unieke kaarten in de catalogus bestaan.
3. **Duidelijke weergave**: In zoekresultaten en offertes toont de portal altijd de combinatie van **productnaam, artikelnummer, collectienaam en leverancier**. De verkoper en de klant zien dus altijd exact welk specifiek product is geselecteerd, ongeacht een eventueel gedeelde barcode.

---

## 4. Beveiliging- & Omgevingsstatus

De portal draait in verschillende geïsoleerde omgevingen. De status van de beveiligingsinstellingen is als volgt gecontroleerd:

### 4.1 Productie-omgeving (Vercel Production & Convex Production)
* **Status**: **GROEN (Veilig)**.
* **Toelichting**: De cryptografische tokensleutel (`AUTHZ_TOKEN_SECRET`) is in Vercel Production en Convex Production geconfigureerd. Database-wijzigingen lopen via HMAC-ondertekende actor-tokens en rolcontrole.
* **Guardrail**: Ontwikkelingsvlaggen (`ALLOW_DEV_AUTHZ_TOKENS` en `ALLOW_DEV_AUTH`) en beheer-tooling (`ALLOW_CONVEX_TOOLING`) staan niet als actieve productievariabelen ingesteld. Beheer-tooling wordt alleen tijdelijk en bewust ingeschakeld voor gecontroleerde beheeracties.

### 4.2 Test- & Preview-omgeving (Vercel Preview)
* **Status**: **GEEL (alleen gecontroleerd gebruiken)**.
* **Toelichting**: De benodigde Vercel-variabelen zijn aanwezig voor Preview, maar preview-deployments blijven bedoeld voor technische controle en niet als vaste acceptatieomgeving met echte klantgegevens.
* **Actiepunt**: Gebruik Preview alleen na een bewuste smoke-test van login, Convex-verbinding en autorisatie. Gebruik Production voor de pilot met echte klantgegevens.

---

## 5. Richtlijnen voor Catalogusbeheer tijdens de Pilot

Als er tijdens de pilot nieuwe prijslijsten van leveranciers moeten worden toegevoegd, volg dan deze stappen:
1. **Importeer altijd eerst naar de testomgeving (Development)** via het importprofiel.
2. **Los eventuele blokkades op**: Als er nieuwe kolommen bij zijn gekomen met de status `unknown`, ga dan naar de beheerpagina om de btw-modus toe te wijzen.
3. **Voer de definitieve import pas uit** als de dashboardkaart **Productiegereedheid** op **READY** staat.
