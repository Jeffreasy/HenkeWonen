# Quote PDF Export - Fase 3 Plan

Datum: 2026-05-01

## Doel

Dit document bereidt Fase 3 van de offerte/PDF-flow voor. Het doel is een veilige exportstrategie
op basis van het bestaande `QuoteDocumentModel`, zonder nu een factuurflow, boekhoudkoppeling,
automatische productkeuze, automatische verkoopprijskeuze of automatische btw-keuze toe te voegen.

## Onderzoek bestaande codebase

Gecontroleerd:

- `package.json`
- `package-lock.json`
- `astro.config.mjs`
- `src/pages/portal/offertes/index.astro`
- `src/pages/portal/offertes/[id].astro`
- `src/components/quotes/QuoteWorkspace.tsx`
- `src/components/quotes/QuoteBuilder.tsx`
- `src/components/quotes/QuoteDocumentPreview.tsx`
- `src/lib/quotes/quoteDocumentModel.ts`
- `src/lib/quotes/quoteDocumentFormatting.ts`
- `tools/`
- `tests/`

Bevindingen:

- Er is geen bestaande PDF-library gevonden.
- Er is geen Playwright, Puppeteer, React PDF, jsPDF, pdf-lib, pdfkit of html-pdf dependency gevonden.
- Er is geen bestaande print/export utility voor offertes gevonden.
- Er is geen bestaande PDF-downloadroute of export-endpoint gevonden.
- De app draait als Astro server output met `@astrojs/vercel`.
- De offertepagina's laden `QuoteWorkspace` als React island via `client:load`.
- Fase 2 rendert de preview al uit `QuoteDocumentModel` en toont manual-review waarschuwingen.
- `npm run build` gebruikt `astro check && astro build`; er is geen apart PDF- of exportscript.

## Route-opties

### 1. HTML/print CSS naar browser print

Status: beste eerste stap.

Deze aanpak gebruikt de bestaande `QuoteDocumentPreview` en voegt later printspecifieke CSS en een
expliciete concept-exportknop toe die de browserprint opent. De gebruiker kan via de browser opslaan
als PDF. Er is geen server-side PDF-binary, geen nieuwe dependency en geen opslag.

Waarom passend:

- sluit direct aan op Astro + React Islands;
- gebruikt de bestaande read-only preview;
- houdt `QuoteDocumentModel` als enige documentinput;
- vermijdt Vercel/Chromium-runtime risico's;
- vereist geen database writes;
- is goed te testen met bestaande server-render tests plus later browser smoke checks.

Beperking:

- dit is geen echte server-side PDF-download;
- layoutkwaliteit hangt deels af van browserprint;
- audit/versionering van gegenereerde bestanden bestaat nog niet.

### 2. Playwright HTML-to-PDF

Status: niet kiezen zonder aparte infra-beslissing.

Playwright kan HTML naar PDF renderen, maar de codebase heeft nu geen Playwright dependency of
browser runtime. In Vercel Serverless Functions is headless Chromium bovendien een serieuze
packaging/runtime-keuze. Dit past pas als er expliciet wordt gekozen voor een aparte renderomgeving,
queue, worker of externe rendering service.

Risico's:

- nieuwe zware dependency;
- runtime-size en cold-start risico;
- mogelijk niet geschikt binnen de huidige Vercel serverless bundling;
- extra beveiliging nodig voor renderbare HTML en toegang tot quote-data.

### 3. React PDF

Status: niet kiezen voor de eerstvolgende stap.

React PDF kan een echte PDF genereren, maar introduceert een tweede renderer naast de bestaande
HTML-preview. Daardoor ontstaat risico dat preview en export visueel of inhoudelijk uit elkaar lopen.
Omdat de huidige preview al bestaat, is het verstandiger die eerst printbaar te maken.

Risico's:

- nieuwe dependency;
- duplicatie van layoutcomponenten;
- aparte testdekking nodig voor renderer-output;
- minder hergebruik van bestaande CSS.

### 4. Bestaande projectstandaard

Status: niet aanwezig.

Er is geen bestaande standaard of dependency gevonden voor PDF-export in deze codebase.

## Gekozen strategie

Kies voor Fase 3a: **HTML/print CSS vanuit `QuoteDocumentPreview`**.

Deze fase levert een veilige concept-exportervaring: de offertepreview wordt printbaar gemaakt en
een knop kan later de browserprint openen. De PDF ontstaat dan via de browserfunctie "Opslaan als
PDF". Dat is de kleinste stap die bij de bestaande architectuur past en geen product-, prijs- of
btw-beslissingen toevoegt.

Een echte server-side PDF-download hoort in Fase 3b of later, pas nadat expliciet is gekozen voor
een rendering stack en runtime.

## Benodigde bestanden en routes voor Fase 3a

Voorgestelde wijzigingen:

- `src/components/quotes/QuoteDocumentPreview.tsx`
  - blijft de centrale documentweergave.
  - krijgt eventueel een `mode?: "screen" | "print"` prop als scherm- en printweergave later licht
    moeten verschillen.
- `src/components/quotes/QuoteBuilder.tsx`
  - kan een guarded knop tonen, bijvoorbeeld `Concept printen`.
  - de knop roept alleen `window.print()` aan en schrijft niets naar Convex.
- `src/styles/global.css`
  - voegt `@media print` regels toe voor A4, marges, niet-document UI verbergen en page breaks.
- `tests/quoteDocumentPreview.test.tsx`
  - kan worden uitgebreid met checks dat `Concept preview`, het btw-label en manual-review
    waarschuwingen in printbare markup aanwezig blijven.

Optioneel later:

- `src/pages/portal/offertes/[id]/preview.astro`
  - aparte read-only previewroute voor printen, als de offertebuilder te veel omliggende UI heeft.
  - deze route moet dezelfde read-only data ophalen en hetzelfde `QuoteDocumentModel` bouwen.

## Benodigde bestanden en routes voor echte Fase 3b PDF-download

Alleen toevoegen na stackkeuze:

- `src/pages/api/quotes/[id]/pdf.ts` of een vergelijkbare serverroute.
- Een read-only query/projection helper die quote, customer, project, quoteLines en template ophaalt.
- Een renderer die uitsluitend `QuoteDocumentModel` accepteert.
- Een filename helper, bijvoorbeeld `buildQuotePdfFilename(model)`.
- Tests voor:
  - geen mutations of opslag;
  - `QuoteDocumentModel` is de enige rendererinput;
  - manual-review gedrag;
  - conceptstatus zichtbaar in de PDF;
  - filename sanitization.

Geen Fase 3b toevoegen voordat runtime en dependencykeuze expliciet zijn vastgelegd.

## QuoteDocumentModel blijft de enige input

De exportlaag mag niet zelf:

- producten matchen;
- verkoopprijzen kiezen;
- btw kiezen;
- regeltotalen herberekenen;
- quoteLines corrigeren;
- customer/project/quote-data muteren;
- Convex mutations uitvoeren.

De renderstroom moet zijn:

1. bestaande quote-, customer-, project-, quoteLine- en template-data ophalen;
2. `buildQuoteDocumentModel(input)` aanroepen;
3. renderen vanuit het resulterende `QuoteDocumentModel`;
4. exporteren of printen zonder database writes.

## Read-only exportgedrag

Voor Fase 3a:

- de printknop leeft in de client;
- de knop voert geen mutation uit;
- de knop wijzigt geen quote status;
- de knop maakt geen factuurstatus;
- de knop maakt geen exportrecord;
- de knop start alleen browserprint voor de bestaande preview.

Voor Fase 3b:

- een serverroute mag alleen read-only queries doen;
- geen opslag van PDF-bestanden in deze subfase;
- geen definitieve "verzonden" status zonder apart ontwerp;
- geen auditrecord totdat audit/versionering bewust is ontworpen.

## Bestandsnaam

Voorgesteld format voor Fase 3b:

```text
Henke-Wonen-offerte-{quoteNumber}-{customerName}-{quoteDate}-concept.pdf
```

Regels:

- gebruik `model.quote.quoteNumber`;
- gebruik `model.customer.name`;
- gebruik `model.quote.quoteDate`;
- voeg `concept` toe zolang er geen definitieve export/auditflow is;
- vervang spaties door `-`;
- verwijder tekens buiten letters, cijfers, streepjes en underscores;
- beperk lengte, bijvoorbeeld tot 120 tekens inclusief `.pdf`.

Voorbeeld:

```text
Henke-Wonen-offerte-OFF-2026-001-Familie-Jansen-01-05-2026-concept.pdf
```

## Conceptstatus zichtbaar houden

De export moet altijd zichtbaar maken dat het om een concept/offertepreview gaat zolang er geen
definitieve exportflow is. Minimaal:

- badge of tekst `Concept preview`;
- `model.quote.status`;
- eventueel voettekst `Conceptexport - controleer offerte voor verzending`.

Dit mag niet automatisch de offerte naar `sent`, `accepted` of een factuurstatus zetten.

## Manual-review waarschuwingen

Aanbevolen gedrag:

- Fase 3a browserprint: waarschuwingen zichtbaar laten in de print/PDF.
- Fase 3b server-side echte PDF: export blokkeren of expliciet als concept markeren als
  `requiresManualReview` aanwezig is.

Zolang er geen handmatige controle-status bestaat, is blokkeren voor definitieve export veiliger.
Een conceptexport mag de waarschuwingen tonen, maar mag niet stil corrigeren.

## Audit en versionering later

Niet in deze spike bouwen. Later ontwerpen:

- `quotePdfExports` of vergelijkbaar auditmodel;
- generatedAt;
- generatedByExternalUserId;
- quoteId;
- quoteNumber;
- quote status op render-moment;
- hash of snapshot van `QuoteDocumentModel`;
- template versie of template snapshot;
- render-engine versie;
- bestandsgrootte en opslaglocatie als bestanden worden bewaard.

Belangrijk: audit/versionering mag pas worden toegevoegd als duidelijk is of PDF-export concept,
definitief, verzonden of klantgedeeld betekent.

## Factuurflow buiten scope

Deze PDF-flow gaat alleen over offertes. Facturen vereisen een eigen ontwerp met:

- factuurnummers;
- factuurstatussen;
- factuurregels;
- betaalstatussen;
- fiscale controles;
- correcties/creditering;
- boekhoudexport;
- audit en bewaartermijnen.

Daarom mag de offerte-PDF-export geen factuurnummer, factuurmoment of boekhoudstatus maken.

## Smoke checks voor Fase 3a/3b

Voor Fase 3a:

- `npm run test:quote-document` blijft groen.
- Previewtest controleert dat `Concept preview`, btw-label en manual-review waarschuwing in markup staan.
- Browser smoke check: klik `Concept printen`, controleer dat er geen Convex mutation wordt aangeroepen.

Voor Fase 3b:

- unit test voor `buildQuotePdfFilename(model)`;
- unit test dat renderer alleen een `QuoteDocumentModel` accepteert;
- smoke test dat manual-review regels export blokkeren of zichtbaar als concept renderen;
- code search check op afwezigheid van `mutation` in PDF-renderroute;
- build check onder de gekozen runtime.

## Advies

Fase 3a is **READY** voor een kleine, guarded browser-print implementatie op basis van de bestaande
preview.

Echte server-side PDF-download/export is **NOT READY** voor implementatie in Fase 3b zolang er geen
expliciete keuze is gemaakt voor rendering stack, runtime, auditgedrag en manual-review blokkade.
