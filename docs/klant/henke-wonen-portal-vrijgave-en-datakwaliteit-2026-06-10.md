# Henke Wonen Portal - Vrijgave- & Datakwaliteitgids

Datum: 10 juni 2026  
Doelgroep: Beheerders en directie Henke Wonen  
Status: Definitieve statusrapportage en toelichting voor pilot-vrijgave

---

## 1. Introductie

Voordat de portal officieel in gebruik wordt genomen, zijn er kritische controles uitgevoerd op de **productcatalogus**, de **btw-bepalingen van de prijslijsten**, de **datakwaliteit (EAN-barcodes)** en de **beveiliging van de serveromgevingen**. 

Dit document vat de resultaten van deze audits samen en legt uit hoe het systeem hiermee omgaat om de operationele betrouwbaarheid op de winkelvloer en in de buitendienst te garanderen.

---

## 2. Catalogus & Btw-mappings (100% Resolved)

Voor een betrouwbare prijsberekening in de offertes moeten alle geïmporteerde prijskolommen een bekende btw-status hebben (inclusief of exclusief btw). Indien deze status onbekend is, blokkeert het systeem de productie-import om foutieve klantprijzen te voorkomen.

### Actuele status (Stand per juni 2026)
* **Aantal importprofielen**: 16 actieve profielen.
* **Totaal aantal prijskolommen**: 55 kolommen.
* **Opgeloste (Resolved) mappings**: **55 van de 55 kolommen**.
* **Openstaande (Unresolved) mappings**: **0 kolommen**.
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
| **Headlam gordijnstoffen 2026** | Headlam | Gordijnen | 1 kolom | Inclusief btw (adviesverkoop) |
| **Interfloor legacy overzicht** | Interfloor | Tapijt | 1 kolom | Inclusief btw (adviesverkoop) |
| **PVC palletcollectie 2025** | Floorlife | PVC | 2 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **Roots collectie NL 2026** | Roots | PVC | 3 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **Traprenovatie Floorlife 2025** | Floorlife | Traprenovatie | 4 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **vtwonen karpetten 2024** | vtwonen | Karpetten | 2 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |
| **vtwonen PVC click dryback** | vtwonen | PVC | 3 kolommen | Exclusief btw (pallet/commissie) / Inclusief btw (advies) |
| **Wandpanelen 2025** | Floorlife | Wandpanelen | 3 kolommen | Exclusief btw (inkoop) / Inclusief btw (advies) |

---

## 3. Datakwaliteit: Dubbele EAN-nummers (Texdecor & behang)

Tijdens de data-analyse is vastgesteld dat leveranciers soms hetzelfde EAN-nummer (de barcode) toewijzen aan verschillende producten of productvarianten. Dit komt met name voor bij behangcollecties van Texdecor-labels.

### Omvang van de dubbelingen
* **Totaal aantal duplicate-EAN groepen**: 1.821 groepen.
* **Totaal aantal betrokken producten**: 4.278 producten.
* **Belangrijkste veroorzakers (Behang)**:
  * **Casamance**: 937 groepen (2.016 producten)
  * **Caselio**: 456 groepen (1.256 producten)
  * **Casadeco**: 402 groepen (954 producten)
* **Kleine restgroepen**: Floorlife (4), Unilin Flooring (17), Lamelio (4), ZTAHL (1).

### Het Parkeerbesluit: Waarom dit geen operationeel risico is
Om te voorkomen dat we de pilot-start moesten uitstellen om 1.821 groepen handmatig uit te pluizen, is er een formeel **parkeerbesluit** genomen. Dit is veilig omdat de portal de volgende principes hanteert:

1. **Geen unieke sleutel**: Het systeem gebruikt het EAN-nummer **nooit** als primaire unieke sleutel om producten te identificeren.
2. **Geen automatische samenvoeging**: Producten met dezelfde EAN worden **nooit automatisch samengevoegd of overschreven**. Ze blijven als losse, unieke kaarten in de catalogus bestaan.
3. **Duidelijke weergave**: In zoekresultaten en offertes toont de portal altijd de combinatie van **productnaam, artikelnummer, collectienaam en leverancier**. De verkoper en de klant zien dus altijd exact welk specifiek product is geselecteerd, ongeacht een eventueel gedeelde barcode.

---

## 4. Beveiliging- & Omgevingsstatus

De portal draait in verschillende geïsoleerde omgevingen. De status van de beveiligingsinstellingen is als volgt gecontroleerd:

### 4.1 Productie-omgeving (Vercel Production & Convex Production)
* **Status**: **GROEN (Veilig)**.
* **Toelichting**: De cryptografische tokensleutel (`AUTHZ_TOKEN_SECRET`) is correct geconfigureerd en komt exact overeen tussen Vercel en Convex. Dit garandeert dat alle database-wijzigingen cryptografisch zijn beveiligd. 
* **Guardrail**: Ontwikkelingsvlaggen (`ALLOW_DEV_AUTHZ_TOKENS` en `ALLOW_DEV_AUTH`) en beheer-tooling (`ALLOW_CONVEX_TOOLING`) staan in de productieomgeving **strikt uitgeschakeld** om ongeoorloofde toegang te blokkeren.

### 4.2 Test- & Preview-omgeving (Vercel Preview)
* **Status**: **ORANJE (Aandacht vereist)**.
* **Toelichting**: De test- en preview-deployments (die automatisch worden gebouwd bij codewijzigingen) missen op dit moment de juiste omgevingsvariabelen voor de LaventeCare-koppeling en de tokensleutels.
* **Actiepunt**: Gebruik de preview-omgeving **niet** voor acceptatietesten met echte klantgegevens totdat de systeembeheerder deze variabelen heeft aangevuld. Lokale tests op de ontwikkelcomputers werken wel volledig en correct.

---

## 5. Richtlijnen voor Catalogusbeheer tijdens de Pilot

Als er tijdens de pilot nieuwe prijslijsten van leveranciers moeten worden toegevoegd, volg dan deze stappen:
1. **Importeer altijd eerst naar de testomgeving (Development)** via het importprofiel.
2. **Los eventuele blokkades op**: Als er nieuwe kolommen bij zijn gekomen met de status `unknown`, ga dan naar de beheerpagina om de btw-modus toe te wijzen.
3. **Voer de definitieve import pas uit** als de dashboardkaart **Productiegereedheid** op **READY** staat.
