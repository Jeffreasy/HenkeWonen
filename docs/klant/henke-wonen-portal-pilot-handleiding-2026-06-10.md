# Henke Wonen Portal - Pilot Handleiding

Datum: 10 juni 2026  
Doelgroep: Henke Wonen winkel-, backoffice- en buitendienstmedewerkers  
Status: Definitieve pilot-documentatie

---

## 1. Inleiding & Doel van de Pilot

Welkom bij de pilotfase van de **Henke Wonen Portal**. Deze portal is ontworpen om de dagelijkse workflow van klantcontact tot uiteindelijke offerte en facturatie te stroomlijnen. Het systeem koppelt backoffice-taken (zoals prijslijsten, btw-controle en offerteteksten) naadloos aan buitendienst-taken (zoals inmetingen op locatie).

Tijdens deze pilot testen we de volledige keten:
$$\text{Klant} \rightarrow \text{Project} \rightarrow \text{Inmeting} \rightarrow \text{Conceptofferte} \rightarrow \text{Klantversie} \rightarrow \text{Akkoord} \rightarrow \text{Factuur}$$

---

## 2. Toegang tot de Portal

De portal is opgesplitst in twee werkplekken die elk zijn geoptimaliseerd voor hun specifieke gebruiksomgeving:

1. **Winkel & Backoffice (Desktop)**:  
   * **URL**: `/portal` (of direct na inloggen).
   * **Doel**: Volledig beheer van klanten, projecten, catalogus, prijslijsten, btw-controle en offerteteksten.
2. **Buitendienst Werkplek (Mobiel & Tablet)**:  
   * **URL**: `/portal/buitendienst/vandaag`
   * **Doel**: Geoptimaliseerd voor gebruik onderweg of bij de klant thuis. Geen afleiding door complexe catalogus- of beheersinstellingen. Zorgt voor snelle invoer van metingen, routebepaling en direct overleg met de klant.

---

## 3. Winkel & Backoffice (Desktop-omgeving)

### 3.1 Het Dashboard & Pipeline
Het dashboard geeft direct inzicht in de voortgang:
* **Tellingen**: Aantal actieve projecten, conceptoffertes en openstaande taken.
* **Werklijst (Work Items)**: Acties die direct aandacht vereisen (bijv. "Offerte afmaken" of "Inmeting voorbereiden").
* **Productiegereedheid**: Geeft aan of de productcatalogus klaar is voor gebruik of geblokkeerd is door openstaande acties (zoals btw-mappings).

### 3.2 Snelactie FAB (Floating Action Button)
Rechtsonder in de hoek van de desktop-portal bevindt zich de paarse **Actie-knop (FAB)**. Hiermee kun je vanaf elke pagina direct een snelle actie starten:
1. **Nieuwe aanvraag (Klant vastleggen)**: Opent direct de klant-aanmaakpagina (`/portal/klanten?open=nieuw`).
2. **Werk starten (Project aanmaken)**: Start direct een nieuw projectdossier (`/portal/projecten?open=nieuw`).

*Opmerking: Medewerkers met een "Viewer"-rol zien deze knop niet, omdat zij geen schrijfrechten hebben.*

### 3.3 Klanten & Dossiers
* **Klant aanmaken**: Vul naam, type (particulier/zakelijk), contactgegevens en adres in.
* **Contactmomenten**: Registreer elk contact (telefoon, e-mail, winkelbezoek, afspraak).
* **Uitgeleend item**: Registreer wanneer een klant een staal, behangboek of monster mee naar huis neemt via het contacttype **Uitgeleend**. Dit blijft apart zichtbaar in het dossier totdat het item retour is gemeld.

### 3.4 Projecten & Statusworkflow
Een project bundelt alle documenten en acties van een specifieke klantvraag (bijv. "PVC benedenverdieping"). Het doorloopt de volgende statussen via de statusbalk bovenin:
`Lead` $\rightarrow$ `Inmeting gepland` $\rightarrow$ `Offerteconcept` $\rightarrow$ `Offerte verzonden` $\rightarrow$ `Offerte akkoord` $\rightarrow$ `Bestellen` $\rightarrow$ `Uitvoering gepland` / `In uitvoering` $\rightarrow$ `Gefactureerd` $\rightarrow$ `Betaald` $\rightarrow$ `Gesloten`.

Belangrijk: **Offerte akkoord** is geen losse tekstnotitie. De portal verwerkt deze stap alleen als er al een echte offerte bij het project bestaat. **Factuur aanmaken** kan alleen als die offerte geaccepteerd is.

---

## 4. De Buitendienst Werkplek (Mobiele omgeving)

De mobiele weergave is ontworpen om snel en zonder ruis op een telefoon of tablet te bedienen.

### 4.1 Navigatietabs
In de buitendienst wissel je snel tussen drie weergaven:
* **Vandaag**: Je geplande bezoeken van vandaag en eventuele directe opvolgdeadlines.
* **Inmeten**: Alle lopende inmeetdossiers waarvoor metingen moeten worden ingevoerd.
* **Conceptoffertes**: Dossiers waarin meetregels of een conceptofferte klaarstaan om om te zetten naar een nette klantversie.

### 4.2 De Buitendienst FAB (Snelle Acties)
Op de mobiele weergave past de FAB zich aan je locatie in de app aan:
* **In het lijstscherm (`/vandaag`)**: Klik op de FAB om direct een **Nieuwe klant / lead** aan te maken bij een onverwacht bezoek of snelle aanvraag onderweg.
* **Binnen een projectdossier**: De FAB toont contextacties om snel door het dossier te springen:
  * **Inmeten**: Direct scrollen naar het inmeetgedeelte.
  * **Conceptofferte**: Direct scrollen naar de offerteposten.
  * **Route openen**: Opent Google Maps in een nieuw tabblad met het adres van de klant ingevuld om direct te navigeren.

### 4.3 Inmeten & Rekenhulp-wizards
Binnen de inmeetsectie voeg je ruimtes toe (woonkamer, gang, trap, etc.). Gebruik de ingebouwde rekenhulpen om hoeveelheden te berekenen:
* **Vloer berekenen**: Voer lengte, breedte, legrichting en snijverlies in. Berekent het netto en bruto oppervlak in $m^2$.
* **Plinten berekenen**: Voer de omtrek in en trek deuropeningen af. Berekent strekkende meters.
* **Behang berekenen**: Voer wandafmetingen, rolmaten en het patroonrapport (rapportverlies) in. Berekent het benodigde aantal rollen.
* **Wandpanelen berekenen**: Voer wand- en paneelafmetingen in. Berekent het aantal panelen.
* **Trap berekenen**: Voer het type trap (open/dicht), aantal treden en stootborden in.

> [!WARNING]
> **Meten is geen prijzen bepalen!**  
> De inmeting stelt puur de hoeveelheden en omschrijvingen vast. Er worden hier nog geen prijzen, kortingen of btw-tarieven gekozen. Dit gebeurt pas bij de volgende stap (de offerte).

### 4.4 Klaarzetten voor Offerte
Zodra een meetregel is gecontroleerd en klopt, klik je op **Klaarzetten voor offerte**. De status van de regel verandert van *Concept* naar *Klaar voor offerte*. De medewerker in de winkel of jijzelf kunt deze regels vervolgens in de offerte laden.

### 4.5 Conceptoffertes in het Veld
Gebruik **Conceptofferte maken** om een echte offerte bij het project aan te maken. Daarna kun je meetregels die op **Klaar voor offerte** staan overnemen.
1. Klik in de offerte op **Uit inmeting laden**.
2. Selecteer de meetregels.
3. Bevestig de invoer. De meetregels worden omgezet naar offerteposten.
4. **PRIJS- EN BTW-CONTROLE**: Omdat meetregels geen prijzen bevatten, moet je nu per regel het juiste product koppelen, de verkoopprijs controleren/invoeren en het btw-percentage toewijzen.
5. Pas de offertestatus pas aan naar **Geaccepteerd** nadat de klant akkoord heeft gegeven. Pas daarna kan er een factuur worden aangemaakt.

---

## 5. Datakwaliteit & Catalogus-Guardrails

Om fouten in offertes en bestellingen te voorkomen, kent de portal een aantal strikte regels:

### 5.1 Btw-mapping (Harde blokkade)
Wanneer een leverancier een nieuwe prijslijst aanlevert, is de btw-status van sommige kolommen soms onbekend (bijv. staat er "prijs" zonder vermelding incl./excl. btw).
* **Blokkade**: De portal blokkeert de productie-import van de catalogus zolang er openstaande btw-mappings zijn.
* **Oplossing**: Ga in de backoffice naar **Btw controle** $\rightarrow$ **Te beoordelen** en specificeer per kolom handmatig of de prijzen inclusief of exclusief btw zijn. Zodra alle mappings op `READY` staan, wordt de import vrijgegeven.

### 5.2 Dubbele EAN-nummers (Waarschuwing)
Soms gebruiken leveranciers hetzelfde EAN-nummer voor verschillende varianten of producten. 
* **Regel**: De portal voegt producten met hetzelfde EAN-nummer **nooit** automatisch samen om dataverlies te voorkomen.
* **Beoordeling**: Onder **Productcontrole** staan alle openstaande EAN-waarschuwingen. Je kunt hier handmatig bepalen of producten gescheiden moeten blijven, of dat er sprake is van een bronfout.

### 5.3 PVC-Click Uitsluiting & Selectieve Verberging
* **Automatische Uitsluiting**: Alle producten die onder de categorie of het type `pvc-click` vallen worden tijdens import genegeerd (`ignored`) en niet getoond.
* **Pilot-Verberging**: Producten met type `click` worden tijdens de pilot automatisch verborgen in de portal-catalogus om verwarring te voorkomen.

### 5.4 Rebranding & Weergave-rules
In de code van de catalogus (`pilot.ts`) zijn specifieke regels ingesteld om de productweergave voor gebruikers te optimaliseren:
* **Moduleo (Roots) Rebranding**: De leverancier **Roots** en alle producten met "Roots" in de naam worden in de portal automatisch getoond als **Moduleo**.
* **Floorlife PVC Producten**: PVC-producten die een commerciële merknaam van **Floorlife** hebben, gebruiken automatisch deze merknaam als display-naam in de portal.
* **Ambiant Filter**: Bij PVC-producten worden commerciële namen onder het merk **Ambiant** uitgefilterd om dubbele merkaanduidingen en rommelige weergaven te voorkomen.

---

## 6. Pilot Administratie & Testdata Opschonen (Reset)

Voorafgaand aan de officiële start van de pilot is het wenselijk om alle testdata (zoals fictieve klanten en proefinmetingen) te wissen, zodat iedereen met een schone lei start. De portal bevat hiervoor een veilige beheersmutatie: `clearTenantData`.

### Wat wordt bewaard?
* De volledige productcatalogus (leveranciers, merken, producten en prijzen).
* Instellingen (productgroepen, standaardtarieven/werkzaamheden en offerteteksten).
* Btw controle en importprofielen.

### Wat wordt verwijderd?
* Alle klanten (`customers`) en contactmomenten (`customerContacts`).
* Alle projecten (`projects`) en bijbehorende projectruimtes (`projectRooms`).
* Alle inmetingen (`measurements`), meetruimtes en meetregels.
* Alle offertes (`quotes`) en offerteregels (`quoteLines`).
* Alle facturen (`invoices`), taken (`projectTasks`) en leveranciersbestellingen.

### Hoe voer je de reset uit?
Deze actie kan alleen direct via het Convex Dashboard of via beheertools worden aangeroepen en vereist twee beveiligingssleutels:
1. De omgevingsvariabele `ALLOW_CONVEX_TOOLING` moet in Convex op `true` staan.
2. De argument-parameter `confirmPhrase` moet exact de waarde `"JA_VERWIJDER_TESTDATA"` bevatten.

---

## 7. Dagelijkse Checklists voor Medewerkers

### Checklist: Voor het inmeten op locatie (Buitendienst)
* [ ] Is het klantadres correct ingevoerd in het klantdossier? (Test de Maps-link via de FAB).
* [ ] Staan er openstaande opvolgingstaken klaar in het actieplan?
* [ ] Zijn de ruimtes al globaal aangemaakt als projectruimtes?

### Checklist: Na het inmeten op locatie
* [ ] Zijn alle meetregels berekend en voorzien van de juiste snijverliespercentages?
* [ ] Staan alle afgeronde meetregels op de status **Klaar voor offerte**?
* [ ] Is de inmeetstatus in het dossier bijgewerkt naar *Reviewed*?

### Checklist: Bij het opstellen van de offerte (Winkel)
* [ ] Zijn alle benodigde meetregels succesvol ingeladen?
* [ ] Is voor elke regel een product of dienst gekoppeld?
* [ ] Zijn de prijzen gecontroleerd tegen de actuele catalogus?
* [ ] Is het btw-percentage (21% of 9% of 0%) correct toegewezen?
* [ ] Staan de juiste uitvoerings- en betalingsvoorwaarden geselecteerd?
