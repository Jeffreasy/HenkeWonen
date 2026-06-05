# Henke Wonen offerte/PDF-template analyse

Datum: 1 mei 2026  
Bronbestand: `DATA/Henke Wonen Jeffrey.xlsx`  
Geanalyseerd werkblad: `Offerte voorbeeld` (`A1:H93`)  
Scope: ontwerp voor toekomstige offerte/PDF-flow, zonder factuurflow, boekhoudkoppeling of productie-PDF-download

## Samenvatting

Het Excelvoorbeeld is vooral een offertebrief-template met vaste Henke Wonen huisstijltekst, vaste offertepostgroepen, klant/adresvelden, datum/onderwerp, voorwaarden, factureringsafspraken en afsluiting.

De bestaande portal heeft al de kern voor de offerte-inhoud:

- `quotes`: offerte-identiteit, titel, status, intro/slottekst, voorwaarden, betalingsafspraken en totalen.
- `quoteLines`: aantallen, eenheden, omschrijvingen, verkoopprijs excl. btw, btw-percentage en regeltotalen.
- `quoteTemplates`: secties, standaardregels, voorwaarden en betalingsafspraken.
- `customers` en `projects`: klant- en projectcontext.

De veilige eerste stap is daarom geen PDF-generator, maar een mappinglaag die bestaande quote-data omzet naar een renderbaar documentmodel. Die mapping mag niets kiezen wat zakelijk gecontroleerd moet worden: geen product, geen verkoopprijs, geen btw en geen factuurstatus.

## Gecontroleerde code

Bekeken onderdelen:

- `convex/schema.ts`: `quotes`, `quoteLines`, `quoteTemplates`, `customers`, `projects`, `tenants`.
- `convex/portal.ts`: `listQuotesWorkspace`, `createQuote`, `addQuoteLine`, `updateQuoteTerms`, `listQuoteTemplates`, `updateQuoteTemplateContent`, totalenberekening.
- `convex/quotes.ts`: oudere/generieke quote CRUD en totalenberekening.
- `convex/quoteTemplates.ts`: generieke template `list` en `upsert`.
- `src/components/quotes/QuoteWorkspace.tsx`: offerte aanmaken, geselecteerde offerte laden, regels toevoegen/verwijderen, voorwaarden opslaan.
- `src/components/quotes/QuoteBuilder.tsx`: regels, voorwaarden, betalingsafspraken en inmeting-koppeling.
- `src/components/quotes/QuoteTotals.tsx`: subtotaal excl. btw, btw en totaal incl. btw.
- `src/components/settings/QuoteTemplatesSettings.tsx`: huidige beheer-UI voor voorwaarden en betalingsafspraken.

Belangrijke observatie: `createQuote` kopieert `introText`, `closingText`, `defaultTerms` en `paymentTerms` uit het actieve default template naar de nieuwe offerte. Daardoor worden bestaande offertes niet stil aangepast als het template later wijzigt. Dat gedrag past bij de PDF-flow en moet behouden blijven.

## Excelstructuur

Het werkblad `Offerte voorbeeld` bevat deze logische blokken:

| Excelgebied | Inhoud | Type voor toekomstige flow |
| --- | --- | --- |
| `A8:A9` / `B9` | Henke Wonen adres, telefoon, e-mail, bank, btw-nummer, KvK | Bedrijfs-/briefhoofd-template |
| `A11:A13` | Naam, adres, postcode/woonplaats | Klantadresblok |
| `A15:B16` | Datum en onderwerp | Quote metadata |
| `A18:A19` | Aanhef en introzin | Quote/template tekst |
| `A21:H64` | Vaste offertepostgroepen met regels en totalen | Quote lines gegroepeerd voor weergave |
| `H64:H65` | Totaal en tekst “prijzen inclusief 21% btw” | Quote totals + klantvriendelijk btw-label |
| `A67:A74` | Voorwaarden | `quote.terms` / `quoteTemplates.defaultTerms` |
| `A76:A85` | Facturering/betaling | `quote.paymentTerms` / `quoteTemplates.paymentTerms` |
| `A87:A93` | Afsluiting en ondertekening | Quote/template closing text |

De Excel-formules berekenen per regel `aantal * prijs` en vervolgens een totaal over de regeltotalen. In de portal moet de PDF-preview deze bedragen niet opnieuw als Excel-logica uitvinden, maar renderen vanuit bestaande `quoteLines.lineTotalExVat`, `lineVatTotal`, `lineTotalIncVat` en `quotes.totalIncVat`.

## Data mappings

### Briefhoofd en bedrijfsgegevens

| Excelveld | Bestaande data | Mappingadvies |
| --- | --- | --- |
| Bedrijfsnaam `Henke Wonen` | `tenants.name` bevat alleen tenantnaam | Voor PDF niet genoeg; voeg later tenant/brand profile of template letterhead toe. |
| Adres `Zuidsingel 44, 8255 CH, Swifterbant` | Niet in `tenants` | Template/content, geen business logic. |
| Telefoon/e-mail | Niet in `tenants`; gebruikers hebben wel e-mail | Template/content voor Henke Wonen bedrijfsprofiel. |
| IBAN, btw-nummer, KvK | Niet in schema | Template/content/tenant legal profile. Niet in quoteLines opslaan. |

Advies: maak in fase 1 een read-only `companyProfile` of `quotePdfTemplate.letterhead` configuratie. Hardcode dit niet in een renderer als business logic.

### Klantblok

| Excelveld | Bestaande data | Mappingadvies |
| --- | --- | --- |
| Naam | `customers.displayName`; schema heeft ook `firstName`, `lastName`, `companyName` | Gebruik `displayName` als veilige fallback. Voor nette aanhef later `firstName/lastName/companyName` exposen in portal projection. |
| Adres | `customers.street`, `houseNumber` | Samenvoegen als presentatieveld. |
| Postcode woonplaats | `customers.postalCode`, `city`; schema heeft `country` | Samenvoegen als presentatieveld. Country alleen tonen indien nodig. |
| E-mail/telefoon | `customers.email`, `phone` | Niet zichtbaar in Excel-offerte, eventueel intern of optioneel in PDF. |

Let op: `PortalCustomer` exposeert nu niet alle schema-velden zoals `customerNumber`, `firstName`, `lastName`, `companyName` en `country`. Een PDF-previewquery kan die velden gecontroleerd toevoegen zonder de hoofd-UI te veranderen.

### Quote/project metadata

| Excelveld | Bestaande data | Mappingadvies |
| --- | --- | --- |
| Datum | `quotes.createdAt` of `updatedAt`; `validUntil` bestaat optioneel | Voeg later expliciet `quoteDate` toe of gebruik `createdAt` als fallback. |
| Onderwerp | `quotes.title` en/of `projects.title` | Gebruik `quote.title`; projecttitel kan subtekst zijn. |
| Offertenummer | `quotes.quoteNumber` | Niet zichtbaar in voorbeeld maar wel noodzakelijk voor PDF. |
| Projectomschrijving | `projects.description`, `customerNotes` | Optioneel, niet automatisch in brief opnemen zonder templatekeuze. |
| Geldigheid | `quotes.validUntil` bestaat maar wordt niet in huidige UI beheerd | Voor PDF ontbreekt beheer/validatie. |

### Aanhef, intro en afsluiting

| Excelblok | Bestaande data | Mappingadvies |
| --- | --- | --- |
| Aanhef | Niet expliciet in quote/customer | Template token, bijvoorbeeld `Beste {{customer.salutationName}}`; fallback handmatig. |
| Introzin | `quote.introText`, `quoteTemplates.introText` | Bestaand veld, maar huidige beheer-UI past dit niet aan. |
| Afsluiting | `quote.closingText`, `quoteTemplates.closingText` | Bestaand veld, maar huidige beheer-UI past dit niet aan. |
| Ondertekening `W. Henke` | Niet in schema | Template/content of later `companyProfile.signatoryName`. |

Aanhef mag geen harde business rule worden. Een nette aanhef is deels taal/relatie-afhankelijk; houd dit overschrijfbaar.

## Offertepostgroepen

Het Excelvoorbeeld gebruikt vaste groepen met een kopregel en daaronder een regel met aantal, eenheid, omschrijving, prijs en bedrag. De bestaande `quoteTemplates.defaultLines` sluiten hier al grotendeels op aan.

| Excelgroep | Huidige quote-template / line type | Productgroep / categoriehint | Opmerking |
| --- | --- | --- | --- |
| Zwevende zelfklevende ondervloer t.b.v. PVC | `material` | `Ondervloer`, `underlay` | Template-regel aanwezig. Geen automatische prijs. |
| Primeren en egaliseren | `labor` of `service` | `Egaline` / werkzaamheden | Template-regel aanwezig; bestaande seed gebruikt `labor`. Servicekosten bestaan apart als raadpleegdata. |
| PVC/tapijt/vinyl fabrikant, naam, kleur | `product` | `PVC Vloeren / Tapijt / Vinyl` | Template-regel aanwezig; productkeuze blijft handmatig/catalogusgestuurd. |
| Legkosten PVC/tapijt/vinyl | `labor` | `Werkzaamheden` | Template-regel aanwezig. |
| Plinten maat kleur | `product` of `material` | `Plinten`, `plinth` | Template-regel aanwezig. |
| Gordijnen fabrikant, stof en kleur | `manual` | `Gordijnen`, `curtain_fabric` | Maatwerkregel; geen automatische productmatch. |
| Gordijnrails merk, kleur | `product` | `Roedes/Railsen`, `rail` | Template-regel aanwezig. |
| Plissés fabrikant, kleur | `manual` of `product` | `Raambekleding`, `plisse` | Template-regel aanwezig als raamdecoratie-regel. |
| Houten/Bamboe Jaloezieën | `manual` of `product` | `Raambekleding`, `jaloezie` | Template-regel aanwezig als raamdecoratie-regel. |
| Duettes | `manual` of `product` | `Raambekleding`, `duette` | Template-regel aanwezig als raamdecoratie-regel. |
| Traprenovatie PVC | `manual` | `Traprenovatie` | Template-regel aanwezig; vaste werkzaamhedenprijzen bestaan maar mogen niet automatisch gekozen worden. |
| Wandpanelen merk, kleur | `product` / `material` | `Wandpanelen`, `panel` | Template-regel aanwezig. |
| Behang merk, kleur | `product` | `Behang`, `wallpaper` | Template-regel aanwezig. |
| Aanbrengen behang | `labor` | `Behang` / werkzaamheden | Template-regel aanwezig. |

Voor PDF-weergave is het belangrijk om groepstitels te renderen vanuit `quoteTemplates.sections` en/of `quoteLine.metadata.sectionKey`. Als een regel handmatig wordt toegevoegd zonder template-metadata, moet de renderer een veilige fallback hebben: bijvoorbeeld sorteer op `sortOrder` en toon geen kunstmatige groep.

## Vaste tekstblokken naar quoteTemplates

Deze blokken horen primair in `quoteTemplates`:

- Standaard intro: “Hierbij mijn vrijblijvende offerte.”
- Secties/postgroepen: vloeren, plinten, gordijnen/raamdecoratie, traprenovatie, wandafwerking, behang.
- Standaard offerteregels met titel, unit, line type, optionele categoriehint en productKindHint.
- Voorwaarden:
  - ruimtes leeg bij aanvang;
  - vloeren droog/vrij van olie of vet;
  - minimale temperatuur;
  - vensterbanken/ramen vrij;
  - muren behangklaar;
  - water en stroom beschikbaar;
  - parkeergelegenheid.
- Betalingsafspraken:
  - 100% bij oplevering;
  - aanbetaling boven een bedrag;
  - aanbetaling meubels;
  - betaalwijzen;
  - betalingstermijn bij overschrijving;
  - contante betaling max;
  - pintoelage.
- Afsluiting en ondertekening.

Deze teksten zijn content. Ze mogen geen verborgen prijs-, btw-, bestel-, factuur- of boekhoudregels worden. De actuele preview gebruikt daarom een neutraal btw-label: `Btw wordt berekend op basis van de offerteregels.` Deze tekst mag geen automatische btw-keuze impliceren; de werkelijke tarieven blijven per `quoteLine.vatRate` zichtbaar.

## Bestaande quoteTemplates: voldoende of uitbreiden?

De huidige `quoteTemplates` zijn voldoende als basis voor:

- standaardregels;
- sectie-indeling;
- voorwaarden;
- betalingsafspraken;
- intro/closing opslag op schema-niveau;
- kopieren van template-teksten naar nieuwe offertes.

Uitbreiding is wel nodig voor een nette PDF-flow:

- beheer-UI voor `introText` en `closingText`, want die velden bestaan maar worden nu niet aangepast via `QuoteTemplatesSettings`;
- expliciete template/layout metadata, bijvoorbeeld `letterhead`, `footer`, `signatoryName`, `showVatMode`, `showQuoteNumber`, `showValidUntil`;
- betere sectie-retentie op `quoteLines`, bijvoorbeeld `metadata.sectionKey` consequent vullen of later een echt `sectionKey` veld;
- dedicated read-only PDF projection query die quote, quoteLines, customer, project, template snapshot en company profile samen ophaalt;
- optionele btw-specificatie per percentage als offertes later gemengde btw kunnen bevatten.

Advies: breid `quoteTemplates` gecontroleerd uit of introduceer een aparte `quoteDocumentTemplates` laag. Voor fase 1 is een pure mapper met bestaande velden genoeg, aangevuld met een kleine statische/template-config voor het Henke Wonen briefhoofd.

## Ontbrekende velden voor volledige PDF-flow

Minimaal ontbrekend of nog niet volledig aangesloten:

- bedrijfsprofiel: adres, telefoon, e-mail, IBAN, btw-nummer, KvK, website, logo, huisstijl, ondertekenaar;
- expliciete offerte-datum los van `createdAt`;
- geldigheid/beheer van `validUntil`;
- klant-aanhef of contactpersoon voor zakelijke klanten;
- volledige klantnaamdelen in de portal projection (`firstName`, `lastName`, `companyName`, `country`, eventueel `customerNumber`);
- quote-level beheer van `introText` en `closingText` in UI;
- PDF-layout definitie: paginaformaat, marges, fonts, logo/briefhoofd, voettekst, paginanummering;
- renderstatus/versionering: concept-preview versus definitieve export;
- opslag/audit van gegenereerde PDF-bestanden, als download/export later productiefunctionaliteit wordt;
- btw-specificatie per tarief voor mixed-rate offertes;
- optionele regels voor “prijzen inclusief btw” die niet hardcoded 21% aannemen;
- handmatige controle-status dat product, prijs en btw zijn nagekeken voordat PDF definitief wordt.

Niet toevoegen in deze fase:

- factuurnummers;
- factuurstatus;
- boekhoudexportstatus;
- betaalregistratie;
- automatische productmatch;
- automatische verkoopprijs;
- automatische btw-keuze.

## Template/content versus business logic

Alle onderstaande onderdelen zijn template/content en mogen geen business logic worden:

- Henke Wonen briefhoofdtekst, KvK/btw/IBAN en contactregels;
- aanhef en afsluiting;
- standaardvoorwaarden en betalingsafspraken;
- vaste postgroepnamen;
- standaardomschrijvingen zoals “maat gordijnen 0,00 x 0,00”;
- ondertekening;
- PDF-typografie, marges, volgorde en labels;
- tekst “prijzen inclusief 21% btw”, tenzij dynamisch gevalideerd tegen de quote lines.

Business logic blijft in de bestaande quote-laag:

- `addQuoteLine` berekent regeltotalen uit aantal, prijs excl. btw, korting en btw;
- `recalculateQuote` telt quote totals opnieuw op;
- `QuoteBuilder`/offertebuilder blijft de plek waar product, prijs en btw bewust worden gecontroleerd;
- inmeting levert alleen hoeveelheden/omschrijvingen en mag geen product, prijs of btw kiezen.

## Veilig documentmodel voor fase 1

Voorstel voor een pure mappinglaag, nog zonder PDF-renderer:

```ts
type QuoteDocumentModel = {
  company: {
    name: string;
    addressLines: string[];
    contactLine: string;
    legalLine: string;
    signatoryName: string;
  };
  customer: {
    name: string;
    addressLines: string[];
    salutation: string;
  };
  quote: {
    quoteNumber: string;
    quoteDate: string;
    validUntil?: string;
    subject: string;
    introText?: string;
    closingText?: string;
    status: string;
  };
  sections: Array<{
    key?: string;
    title?: string;
    lines: Array<{
      quantity: number;
      unit: string;
      description: string;
      unitPriceExVat: number;
      vatRate: number;
      lineTotalIncVat: number;
      requiresManualReview?: boolean;
    }>;
  }>;
  totals: {
    subtotalExVat: number;
    vatTotal: number;
    totalIncVat: number;
    vatLabel: string;
  };
  terms: string[];
  paymentTerms: string[];
};
```

Deze mapper moet deterministisch zijn: alleen lezen en vormgeven, geen nieuwe bedragen kiezen of status wijzigen.

## Minimale implementatieplanning

### Fase 1: offerte-template data mapping

- Maak een pure mapper van bestaande `PortalQuote`, `PortalCustomer`, `PortalProject` en `QuoteTemplate` naar `QuoteDocumentModel`.
- Voeg tests toe voor:
  - bestaande quote totalen worden overgenomen;
  - geen prijswijziging in mapping;
  - geen btw-keuze in mapping;
  - mixed-vat label wordt niet hardcoded “21%”;
  - template-secties worden alleen gebruikt voor weergave.
- Voeg eventueel een kleine Henke Wonen `companyProfile` config toe.
- Geen PDF-download en geen factuur.

### Fase 2: PDF preview rendering

- Bouw een previewroute of component die het `QuoteDocumentModel` renderbaar toont.
- Start met HTML/print preview of server-side preview; nog geen definitieve download.
- Toon duidelijke conceptstatus.
- Check layout met echte quote data, lange omschrijvingen en lege optionele velden.

### Fase 3: PDF download/export

- Pas na stabiele preview: genereer PDF vanuit hetzelfde documentmodel.
- Voeg audit/versionering toe: gegenereerd op, door wie, quoteId, templateversie.
- Download/export mag alleen bestaande quote-data renderen.
- Geen automatische prijs-, product- of btw-correcties tijdens export.

### Fase 4: factuurflow later apart ontwerpen

- Ontwerp factuurflow pas nadat offerte/PDF-preview en export betrouwbaar zijn.
- Gebruik het werkblad `Factuur voorbeeld` niet om nu factuurfunctionaliteit te claimen.
- Factuur vereist eigen nummers, statussen, betaaltermijnen, boekhoudregels en controles.
- Boekhoudkoppeling/export blijft buiten scope totdat die apart is ontworpen.

## Conclusie

De bestaande quote-data en quoteTemplates zijn geschikt als fundament voor een toekomstige PDF-offerteflow. De eerstvolgende veilige stap is een documentmodel/mappinglaag die bestaande data projecteert naar de Excel-structuur. De huidige templates moeten vooral worden uitgebreid met document-/layoutcontent en beheer van intro/slottekst; de offerteberekeningen en zakelijke keuzes blijven in de bestaande offertebuilder.
