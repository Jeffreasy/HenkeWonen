# Henke Wonen portal - workflowhandleiding

Datum: 30 april 2026  
Doelgroep: Henke Wonen medewerkers  
Status: gebaseerd op de huidige portalfunctionaliteit

## 1. Inleiding

De Henke Wonen portal is bedoeld als dagelijkse backoffice voor klanten, projecten, inmetingen, offertes, productdata, leveranciers en importcontrole.

De hoofdroute in het werk is:

**klant -> project -> inmeting -> offerte -> uitvoering/factuurmoment**

De portal helpt met overzicht, dossiervorming, hoeveelheden, offerteposten, catalogusdata en opvolging. Het systeem neemt niet alle zakelijke beslissingen automatisch over.

Belangrijk:

- Een inmeting bereidt hoeveelheden en omschrijvingen voor.
- Product, prijs en btw controleer je later in de offerte.
- Catalogusimport wordt geblokkeerd zolang verplichte btw-mappings ontbreken.
- Dubbele EAN-waarschuwingen worden nooit automatisch samengevoegd.
- Factuur/PDF/boekhouding zijn nog geen volledige uitgewerkte flows in de portal.

## 2. Hoofdnavigatie

De portal heeft deze hoofdonderdelen:

- **Dashboard**: overzicht, pipeline en productiegereedheid.
- **Klanten**: klanten zoeken, aanmaken en klantdossiers openen.
- **Projecten**: projecten aanmaken, volgen en inmetingen beheren.
- **Offertes**: offertes maken, offerteposten beheren en totalen controleren.
- **Catalogus**: producten zoeken en prijsinformatie raadplegen.
- **Leveranciers**: leveranciers en productlijststatussen opvolgen.
- **Imports**: importbatches en importcontrole bekijken.
- **Importprofielen**: btw-mappings per prijskolom beoordelen.
- **Instellingen**: werkzaamheden, categorieen en offertesjablonen.

## 3. Dashboard

Het dashboard is het startpunt van de portal.

Je ziet hier onder andere:

- aantal klanten
- actieve projecten
- offertes
- catalogusregels
- pipeline-informatie
- productiegereedheid van de catalogusimport

### Productiegereedheid

De kaart **Productiegereedheid** laat zien of de productie-import klaar is.

Mogelijke status:

- **Productie-import geblokkeerd**: er zijn nog harde blokkades, meestal ontbrekende btw-mappings.
- **Productie-import gereed**: alle harde blokkades zijn opgelost.

Dubbele EAN-waarschuwingen zijn zichtbaar als waarschuwing. Ze blokkeren de productie-import niet automatisch, maar moeten wel zakelijk worden beoordeeld.

## 4. Klanten

Gebruik **Klanten** om klanten te zoeken, nieuwe klanten aan te maken en klantdossiers te openen.

### Klant aanmaken

1. Ga naar **Klanten**.
2. Vul de klantgegevens in.
3. Kies het type klant, bijvoorbeeld particulier of zakelijk.
4. Sla de klant op.

In de huidige portal is klant aanmaken beschikbaar. Een uitgebreide klant-bewerkflow of verwijderflow is niet als hoofdactie zichtbaar.

### Klant zoeken

Gebruik het zoekveld en de filters om snel een klant te vinden. Je kunt zoeken op klantnaam en zichtbare klantinformatie.

### Klantdossier openen

Open een klant om het dossier te bekijken.

In het klantdossier zie je:

- basisgegevens
- projecten van de klant
- contactmomenten
- uitgeleende items

### Contactmoment toevoegen

1. Open het klantdossier.
2. Kies het type contactmoment, bijvoorbeeld notitie, telefoon, e-mail, bezoek of afspraak.
3. Vul titel en eventueel omschrijving in.
4. Sla het contactmoment op.

### Uitgeleend item registreren

Als er een staal, boek of ander item wordt uitgeleend:

1. Open het klantdossier.
2. Voeg een contactmoment toe met type **Uitgeleend**.
3. Vul de naam van het uitgeleende item in.
4. Sla het contactmoment op.

Uitgeleende items worden apart getoond in het klantdossier. Als retourinformatie in de data aanwezig is, wordt de status ook zichtbaar.

## 5. Projecten

Een project is het werkdossier rondom een klantvraag, bijvoorbeeld een PVC-vloer, raamdecoratie, behang of een combinatie daarvan.

### Project aanmaken

1. Ga naar **Projecten**.
2. Kies een bestaande klant.
3. Vul projectnaam en omschrijving in.
4. Sla het project op.

Een project hoort altijd bij een klant.

### Project zoeken

Gebruik zoeken en statusfilter om projecten terug te vinden.

### Workflowstatussen

Projecten kunnen onder andere deze statussen hebben:

- Lead
- Offerteconcept
- Offerte verzonden
- Offerte akkoord
- Inmeting gepland
- Uitvoering gepland
- Bestellen
- In uitvoering
- Gefactureerd
- Betaald
- Gesloten

De workflowrail in het project laat zien waar het project ongeveer staat.

### Ruimtes toevoegen

In projectdetail kun je projectruimtes toevoegen.

Voorbeelden:

- Woonkamer
- Hal
- Trap
- Slaapkamer

Bij een ruimte kun je oppervlakte en omtrek invullen. Deze projectruimte kan later als basis dienen voor een meetruimte in de inmeting.

### Werkprocesmomenten

Projectdetail bevat snelle acties voor werkprocesmomenten, zoals:

- akkoord
- bestelling aangemaakt
- factuur aangemaakt
- export naar boekhouder

Let op: dit zijn dossiermomenten. Een volledige factuur- of boekhoudflow is nog niet gebouwd.

## 6. Inmeten

De inmeetmodule staat in het projectdetail.

Belangrijke waarschuwing:

> Een inmeting bereidt hoeveelheden en omschrijvingen voor. Product, prijs en btw controleer je later in de offerte.

### Inmeting starten

1. Open een project.
2. Ga naar de sectie **Inmeting**.
3. Klik op **Inmeting starten** als er nog geen inmeting bestaat.

Daarna kun je inmeetdatum, ingemeten door en notities invullen.

### Meetruimtes toevoegen

Een meetruimte is de maatvoering zoals vastgelegd tijdens deze inmeting.

Je kunt:

- een nieuwe meetruimte toevoegen
- een bestaande projectruimte als basis gebruiken
- breedte, lengte, hoogte, oppervlakte en omtrek invullen
- notities toevoegen

Verschil tussen projectruimte en meetruimte:

- **Projectruimte**: globale ruimte in het projectdossier.
- **Meetruimte**: vastgelegde maatvoering binnen een specifieke inmeting.

### Snijverlies en materiaalverlies

Snijverlies is extra materiaal dat nodig kan zijn door zagen, snijden, patroon, legrichting of productafmetingen.

De standaardprofielen zijn bedoeld als startpunt. Controleer altijd:

- maatvoering
- legrichting
- patroon
- productafmetingen
- verpakkingseenheden
- praktijkervaring

### Rekenhulp: vloer berekenen

Gebruik **Vloer berekenen** voor vloeroppervlak.

Je vult in:

- lengte
- breedte
- snijverlies
- patroon/legrichting

De uitkomst is een indicatieve hoeveelheid in m2.

### Rekenhulp: plinten berekenen

Gebruik **Plinten berekenen** voor strekkende meters plint.

Je vult in:

- omtrek
- deuropeningen
- snijverlies

De uitkomst is een indicatieve hoeveelheid in meters.

### Rekenhulp: behang berekenen

Gebruik **Behang berekenen** voor het aantal rollen.

Je vult in:

- wandbreedte
- wandhoogte
- rolbreedte
- rollengte
- patroonrapport
- snijverlies

De uitkomst is indicatief. Controleer altijd patroonrapport, rolmaat en snijverlies.

### Rekenhulp: wandpanelen berekenen

Gebruik **Wandpanelen berekenen** voor het aantal panelen.

Je vult in:

- wandbreedte
- wandhoogte
- paneelbreedte
- paneelhoogte
- snijverlies

De uitkomst is een indicatief aantal panelen.

### Rekenhulp: trap berekenen

Gebruik **Trap berekenen** om traprenovatie-aantallen voor te bereiden.

Je vult in:

- traptype
- aantal treden
- aantal stootborden
- eventuele striplengte

De uitkomst bereidt aantallen en omschrijving voor. Er wordt geen prijs gekozen.

### Handmatige meetregel

Gebruik **Handmatige meetregel** als een situatie niet goed in een standaard rekenhulp past.

Voorbeelden:

- afwijkende wand
- maatwerkpost
- extra arbeid
- bijzondere notitie voor offerte

### Meetregel opslaan

Na een berekening kun je het resultaat opslaan als meetregel.

Een meetregel bevat:

- productgroep
- berekeningstype
- hoeveelheid
- eenheid
- snijverlies
- notitie

### Klaarzetten voor offerte

Als een meetregel gecontroleerd is, klik je op **Klaarzetten voor offerte**.

Daarmee staat de meetregel klaar om later in de offertebuilder te laden.

Statussen:

- **Concept**: nog niet klaar voor offerte.
- **Klaar voor offerte**: kan worden geladen in de offertebuilder.
- **Verwerkt**: is al overgenomen naar een offerte.

## 7. Offertes

Gebruik **Offertes** om offertes aan te maken, te openen en te beheren.

### Offerte aanmaken

1. Ga naar **Offertes**.
2. Kies een project.
3. Vul een offertenaam in.
4. Sla de offerte op.

Nieuwe offertes nemen standaardvoorwaarden en betalingsafspraken over vanuit het actieve offertesjabloon.

### Offerte openen

Selecteer een offerte uit de lijst. De offertebuilder verschijnt met:

- offertegegevens
- regel toevoegen
- uit inmeting laden
- offerteregels
- voorwaarden
- totalen

### Handmatige offertepost toevoegen

Gebruik **Regel toevoegen** voor een nieuwe offertepost.

Je kiest een regeltype:

- Productregel
- Serviceregel
- Arbeidsregel
- Materiaalregel
- Korting
- Tekstregel
- Handmatige regel

Vul daarna omschrijving, aantal, eenheid, prijs excl. btw en btw-percentage in.

### Sjabloonregel laden

Bij **Sjabloonregel laden** kun je een standaardregel uit het offertevoorbeeld kiezen.

De regel wordt ingevuld als concept. Je kunt de tekst, hoeveelheid, eenheid, prijs en btw daarna aanpassen voordat je hem toevoegt.

### Uit inmeting laden

Gebruik **Uit inmeting laden** om meetregels over te nemen die klaarstaan voor offerte.

Flow:

1. Klik op **Uit inmeting laden**.
2. Bekijk de meetregels die klaarstaan.
3. Selecteer een of meer regels.
4. Bevestig dat je ze wilt toevoegen.
5. Controleer daarna product, prijs en btw in de offertepost.

Belangrijk:

> Meetregels uit de inmeting nemen geen verkoopprijs over. Controleer altijd product, prijs en btw.

Na toevoegen krijgt de meetregel de status **Verwerkt**.

### Offertepost verwijderen

Bij een offerteregel staat een verwijderknop. Verwijderen past de offerte aan en de totalen worden opnieuw berekend.

### Voorwaarden en betalingsafspraken

In de offertebuilder kun je de voorwaarden en betalingsafspraken voor deze offerte aanpassen.

Dit geldt voor de geopende offerte. Bestaande offertes bewaren hun eigen teksten.

### Totalen controleren

De totalen tonen:

- subtotaal excl. btw
- btw
- totaal incl. btw

Controleer altijd of de regels, prijzen, btw en kortingen kloppen voordat je een offerte verstuurt.

## 8. Offertesjablonen

Ga naar **Instellingen -> Offertesjablonen** om het standaard offertesjabloon te bekijken.

Het belangrijkste sjabloon is:

**Standaard offerte woninginrichting**

Het sjabloon bevat standaardblokken voor:

- Vloeren
- Plinten
- Gordijnen & raamdecoratie
- Traprenovatie
- Wandafwerking
- Behang
- Voorwaarden
- Facturering

Je kunt op deze pagina:

- sjabloonregels bekijken
- voorwaarden aanpassen
- betalingsafspraken aanpassen

Wijzigingen gelden voor nieuwe offertes. Bestaande offertes worden niet stil aangepast.

## 9. Catalogus

De catalogus bevat producten en prijsinformatie uit de geimporteerde prijslijsten.

Je kunt:

- zoeken op product, artikelnummer, kleur of leverancier
- filteren op categorie
- productinformatie bekijken
- leverancier en categorie bekijken
- eenheid en prijs excl. btw bekijken
- meer resultaten laden

Let op:

- Catalogusprijzen moeten altijd worden gecontroleerd bij gebruik in een offerte.
- Sommige prijskolommen hebben pas productie-status als de btw-mapping definitief is beoordeeld.

## 10. Leveranciers

De leverancierspagina is bedoeld voor opvolging van productlijsten en prijslijsten.

Je ziet:

- leverancier
- productlijststatus
- contactgegevens
- opvolgdata
- gekoppelde producten
- importprofielen
- bronbestanden
- laatste importstatus

### Productlijststatussen

Mogelijke statussen:

- **Onbekend**: status is nog niet duidelijk.
- **Opgevraagd**: productlijst is opgevraagd, opvolging nodig.
- **Ontvangen**: productlijst is binnen.
- **Download beschikbaar**: lijst kan worden gedownload of is beschikbaar.
- **Niet beschikbaar**: leverancier levert geen lijst.
- **Alleen handmatig**: verwerking gebeurt handmatig.

### Leverancier toevoegen

1. Ga naar **Leveranciers**.
2. Vul naam, contactgegevens, productlijststatus en notities in.
3. Sla de leverancier op.

### Productlijststatus bijwerken

In het overzicht kun je per leverancier de productlijststatus aanpassen.

De pagina maakt duidelijk welke leveranciers opvolging nodig hebben.

## 11. Imports

Imports zijn bedoeld om product- en prijslijstdata veilig te controleren voordat data definitief verwerkt wordt.

Je ziet:

- importbatches
- bronbestand
- leverancier
- status
- voorvertoningsregels
- productregels
- prijsregels
- waarschuwingen/fouten
- onbekende btw-modus

### Voorvertoning

Een voorvertoning is een gecontroleerde importvoorbereiding. Rijen worden gelabeld als bijvoorbeeld productregel, sectieregel, kopregel, waarschuwing of fout.

### Batchdetail

In batchdetail zie je:

- samenvatting
- auditregels
- waarschuwingen/fouten
- controle/reconciliation

### Definitief verwerken

Definitief verwerken is alleen mogelijk als de guardrails dat toestaan.

De import blijft geblokkeerd bij:

- foutregels
- dubbele bronsleutels
- onbekende btw-modus zonder bewuste uitzondering

## 12. Importprofielen en btw-mapping

Een importprofiel beschrijft hoe een bepaald leveranciersbestand gelezen moet worden.

Bij btw-mapping bepaal je per prijskolom of bedragen:

- inclusief btw zijn
- exclusief btw zijn
- of, alleen bij bewuste uitzondering, onbekend mogen blijven

Waarom dit belangrijk is:

- De portal mag niet zomaar aannemen of prijzen inclusief of exclusief btw zijn.
- Productie-import blijft geblokkeerd zolang verplichte btw-mappings ontbreken.

### Open mappings oplossen

1. Ga naar **Importprofielen**.
2. Filter op **Te beoordelen**.
3. Bekijk bronkolom, prijstype, eenheid, voorstel en reden.
4. Kies **Inclusief btw** of **Exclusief btw**.
5. Gebruik bulkacties alleen als je zeker weet dat alle geselecteerde kolommen dezelfde btw-betekenis hebben.

### Onbekende btw-modus toestaan

Gebruik dit alleen als bewuste uitzondering. Dit moet zichtbaar blijven als risico.

## 13. Dubbele EAN-waarschuwingen

Ga naar **Catalogus -> Datakwaliteit** voor dubbele EAN-waarschuwingen.

Belangrijk:

> EAN is een hulpmiddel, geen primaire sleutel. Producten worden niet automatisch samengevoegd.

Je kunt per waarschuwing:

- producten vergelijken
- status bekijken
- reviewbeslissing kiezen
- interne notitie opslaan

Mogelijke beslissingen:

- Gescheiden houden
- Later beoordelen voor samenvoegen
- Bronfout
- Bewust dubbel toegestaan
- Opgelost

Deze controle helpt de cataloguskwaliteit, maar blokkeert de productie-import niet automatisch.

## 14. Instellingen

Onder **Instellingen** staan:

- **Werkzaamheden**: overzicht van werkzaamheden en prijzen excl. btw.
- **Categorieen**: overzicht van cataloguscategorieen.
- **Offertesjablonen**: sjabloonregels, voorwaarden en betalingsafspraken.

Werkzaamheden en categorieen zijn in de huidige UI vooral raadpleegschermen. Offertesjablonen kunnen deels beheerd worden via voorwaarden en betalingsafspraken.

## 15. Veelvoorkomende situaties

### Nieuwe klant komt in de winkel

1. Ga naar **Klanten**.
2. Zoek of de klant al bestaat.
3. Maak de klant aan als die nog niet bestaat.
4. Maak daarna een project aan.

### Klant wil offerte voor PVC-vloer

1. Maak klant en project aan.
2. Voeg projectruimtes toe.
3. Start eventueel een inmeting.
4. Bereken vloer en plinten.
5. Zet meetregels klaar voor offerte.
6. Maak een offerte.
7. Laad meetregels uit inmeting.
8. Controleer product, prijs en btw.

### Er moet eerst ingemeten worden

1. Open projectdetail.
2. Klik op **Inmeten plannen** als het moment gepland is.
3. Start de inmeting.
4. Voeg meetruimtes en meetregels toe.
5. Zet gecontroleerde meetregels klaar voor offerte.

### Meetregel is klaar voor offerte

1. Open de gekoppelde offerte.
2. Kies **Uit inmeting laden**.
3. Selecteer de meetregel.
4. Bevestig toevoegen.
5. Controleer de nieuwe offertepost.

### Productlijst van leverancier is nog niet ontvangen

1. Ga naar **Leveranciers**.
2. Filter op **Opgevraagd** of **Onbekend**.
3. Neem contact op met de leverancier.
4. Werk de productlijststatus bij.

### Productie-import is geblokkeerd door btw-mapping

1. Ga naar **Importprofielen**.
2. Filter op **Te beoordelen**.
3. Beoordeel de prijskolommen.
4. Zet iedere kolom op inclusief of exclusief btw.
5. Controleer het dashboard opnieuw.

### Dubbele EAN-waarschuwing staat open

1. Ga naar **Catalogus -> Datakwaliteit**.
2. Open de waarschuwing.
3. Vergelijk producten.
4. Kies een reviewbeslissing.
5. Sla een notitie op.

### Offertevoorwaarden aanpassen

Voor een specifieke offerte:

1. Open de offerte.
2. Pas voorwaarden of betalingsafspraken aan.
3. Sla op.

Voor nieuwe offertes:

1. Ga naar **Instellingen -> Offertesjablonen**.
2. Pas voorwaarden of betalingsafspraken aan.
3. Sla op.

## 16. Veilig werken

Gebruik deze controles voordat je een offerte of import afrondt:

- Controleer alle maten en snijverlies.
- Controleer altijd product, prijs en btw.
- Gebruik interne notities voor bijzonderheden.
- Zet meetregels pas klaar voor offerte na controle.
- Verwerk imports pas na controle van waarschuwingen en btw-mappings.
- Voeg producten met dezelfde EAN niet automatisch samen.
- Controleer voorwaarden en betalingsafspraken per offerte.

## 17. Wat doet het systeem bewust niet automatisch?

De portal doet bewust niet automatisch:

- verkoopprijs kiezen bij meetregels
- product kiezen bij meetregels
- btw kiezen bij onbekende prijskolommen
- producten samenvoegen op EAN
- bestaande offertes aanpassen als een sjabloon wijzigt
- productie-import verwerken als btw-mappings openstaan
- volledige factuur/PDF/boekhoudflow uitvoeren

Dit is bedoeld om zakelijke controle bij Henke Wonen te houden.

## 18. Begrippenlijst

**Klant**  
Persoon of bedrijf waarvoor Henke Wonen werkt.

**Project**  
Werkdossier rondom een klantvraag.

**Inmeting**  
Vastlegging van maten, hoeveelheden en notities voor een project.

**Meetruimte**  
Ruimte binnen een inmeting met vastgelegde maatvoering.

**Meetregel**  
Een berekende of handmatige hoeveelheid uit de inmeting.

**Snijverlies / materiaalverlies**  
Extra materiaal voor snijden, patroon, legrichting of productafmetingen.

**Offertepost**  
Een regel op een offerte, bijvoorbeeld product, arbeid, materiaal of tekst.

**Offertesjabloon**  
Standaardset met offerteblokken, regels, voorwaarden en betalingsafspraken.

**Catalogus**  
Product- en prijsdata uit leveranciersbestanden.

**Leverancier**  
Partij die producten, prijslijsten of productlijsten aanlevert.

**Importbatch**  
Een gecontroleerde importvoorbereiding of verwerking van productdata.

**Btw-mapping**  
Beslissing per prijskolom of bedragen inclusief of exclusief btw zijn.

**Dubbele EAN-waarschuwing**  
Waarschuwing dat meerdere producten bij dezelfde leverancier dezelfde EAN hebben.

**Klaar voor offerte**  
Meetregel is gecontroleerd en kan worden geladen in de offertebuilder.

**Verwerkt**  
Meetregel is overgenomen naar een offerte.

