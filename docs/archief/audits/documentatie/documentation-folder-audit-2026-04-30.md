# Documentatiemap audit en professionaliseringsplan

Datum: 30 april 2026  
Scope: `docs/` volledig doorgenomen op structuur, doelgroep, actualiteit, overlap, gegenereerde artefacten en professionaliseringsrisico's  
Status: audit en plan, nog geen herstructurering uitgevoerd

## Samenvatting

De documentatiemap bevat veel waardevolle inhoud, maar is nu gegroeid als werklogboek tijdens ontwikkeling. Daardoor staan klantgerichte handleidingen, technische mappings, audits, generated JSON, beslisrapporten en QA-screenshots allemaal grotendeels in een platte map.

Huidige stand:

| Type | Aantal | Grootte |
| --- | ---: | ---: |
| Markdown | 39 | 324,3 KB |
| JSON | 13 | 816,4 KB |
| PNG screenshots | 20 | 894,5 KB |
| Totaal | 72 | 2.035,2 KB |

Belangrijkste conclusie:

- De inhoud is sterk genoeg om te professionaliseren.
- Er ontbreekt een duidelijke ingang, zoals `docs/README.md`.
- Er ontbreekt scheiding tussen klantdocumentatie, technische documentatie, audits, gegenereerde rapporten en QA-artefacten.
- Een aantal bestanden zijn historische auditlogs en moeten niet naast actuele klantdocumentatie blijven staan.
- Grote JSON-rapporten horen niet allemaal op het hoogste docs-niveau.
- Sommige Engelse titels/termen zijn acceptabel voor technische audits, maar niet voor klantgerichte documentatie.

## Wat is gecontroleerd

Gecontroleerd:

- alle bestanden onder `docs/`
- Markdown H1/H2-structuur
- JSON-bestanden en hoofdsleutels
- QA-screenshotmap
- bestandsnamen, datums en doelgroepen
- overlap tussen audits, implementatierapporten en handleidingen
- gegenereerde catalogusrapporten
- actieve versus historische documenten

Niet uitgevoerd:

- geen bestanden verplaatst
- geen scripts aangepast
- geen inhoudelijke herschrijving van bestaande auditdocs
- geen codewijzigingen
- geen import-, prijs-, btw- of businesslogicwijzigingen

## Huidige documentclusters

### 1. Klantgerichte workflowdocumentatie

Bestanden na Fase 2:

- `klant/README.md`
- `klant/henke-wonen-portal-workflow-handleiding-2026-04-30.md`
- `klant/henke-wonen-portal-quickstart-2026-04-30.md`

Beoordeling:

- Dit zijn de belangrijkste klantdocumenten.
- Ze zijn Nederlands, praktisch en niet technisch.
- Ze verdienen een prominente plek, bijvoorbeeld `docs/klant/`.

Advies:

- Promoveer deze documenten tot primaire documentatie.
- Voeg een duidelijke startpagina toe die hiernaar verwijst.

### 2. Technische workflow- en codebase-mapping

Bestanden:

- `workflow-codebase-inventory-2026-04-30.md`
- `workflow-codebase-inventory-2026-04-30.json`
- `henke-wonen-portal-workflow-technical-map-2026-04-30.md`
- `workflow-documentation-generation-report-2026-04-30.md`

Beoordeling:

- Goed als technische onderbouwing voor Jeffrey/onderhoud.
- Niet bedoeld voor medewerkers.

Advies:

- Plaats in `docs/technisch/workflows/` of `docs/technical/workflows/`.
- Laat de klantgerichte handleiding hier niet direct tussen staan.

### 3. Catalogus, import en data-audits

Bestanden:

- `data-audit.md`
- `data-audit.json`
- `data-model-gap-analysis.md`
- `data-reaudit-2026-04-29.md`
- `data-reaudit-2026-04-29.json`
- `catalog-import-run-2026-04-29.md`
- `catalog-reconciliation-2026-04-29.md`
- `catalog-validation-2026-04-29.json`
- `import-production-audit-2026-04-29.md`
- `import-production-audit-2026-04-29.json`
- `catalog-import-summary.md`
- `catalog-import-summary.json`
- `catalog-import-sample.md`

Beoordeling:

- Inhoudelijk belangrijk.
- Mix van actuele generated summaries en historische auditrapporten.
- `catalog-import-summary.md/json` is actueel en wordt door `npm run catalog:preview` bijgewerkt.
- Grote JSON-bestanden zoals `import-production-audit-2026-04-29.json` en `data-audit.json` zijn artefacten en horen niet als gewone leesdocumenten in de root.

Advies:

- Houd `catalog-import-summary.md` als primaire actuele reviewbron zichtbaar.
- Verplaats historische audits later naar `docs/audits/data-import/`.
- Verplaats grote JSON-artefacten later naar `docs/generated/` of `docs/artifacts/json/`, maar alleen als scripts en verwijzingen worden bijgewerkt.

### 4. Btw-mapping en production readiness

Bestanden:

- `import-vat-mapping-review-2026-04-29.md`
- `import-vat-mapping-review-2026-04-29.json`
- `vat-mapping-current-state-2026-04-30.md`
- `vat-mapping-current-state-2026-04-30.json`
- `vat-mapping-human-decision-table-2026-04-30.md`
- `vat-mapping-decisions.json`
- `vat-mapping-apply-result-2026-04-30.md`
- `vat-mapping-production-readiness-2026-04-30.md`
- `vat-mapping-production-readiness-2026-04-30.json`
- `production-readiness-review-2026-04-29.md`

Beoordeling:

- Dit is een actieve releaseblokkade-documentatieset.
- De status is duidelijk: productie-import is nog correct geblokkeerd door 54 open btw-mappings.
- `vat-mapping-decisions.json` is vrijwel leeg en fungeert als input/template voor apply-script.
- De set is functioneel, maar als rootbestanden voelt het rommelig.

Advies:

- Maak een apart dossier: `docs/release-readiness/vat-mapping/`.
- Voeg een korte `README.md` toe met: huidige status, welke bestanden input/output zijn en wat handmatig ingevuld moet worden.
- Label `vat-mapping-decisions.json` expliciet als beslis-inputbestand.

### 5. Duplicate EAN / datakwaliteit

Bestanden:

- `catalog-duplicate-ean-review-2026-04-29.md`
- `catalog-duplicate-ean-review-2026-04-29.json`

Beoordeling:

- Goede datakwaliteitsrapportage.
- Historisch/actueel afhankelijk van laatste sync.
- Hoort bij cataloguskwaliteit, niet los in root.

Advies:

- Verplaatsen naar `docs/audits/catalogus/` of `docs/release-readiness/catalog-data-issues/`.
- In klantdocumentatie alleen samenvatten, niet alle technische product-ID's tonen.

### 6. Design-system en UI/UX-traject

Bestanden:

- `ui-ux-design-system-audit-2026-04-30.md`
- `ui-ux-design-system-audit-2026-04-30.json`
- `design-system-phase-1-2026-04-30.md`
- `design-system-phase-2-2026-04-30.md`
- `design-system-phase-3-2026-04-30.md`
- `design-system-phase-4-2026-04-30.md`
- `design-system-phase-5-2026-04-30.md`
- `design-system-phase-6-2026-04-30.md`
- `design-system-phase-7-2026-04-30.md`
- `nederlandse-ui-copy-audit-2026-04-30.md`
- `nederlandse-ui-copy-audit-2026-04-30.json`

Beoordeling:

- Sterk ontwikkelspoor.
- Fasebestanden zijn nuttig als implementatielogboek, maar niet als primaire documentatie voor klant of onderhoud.
- De fasebestanden kunnen worden samengevat in een design-system index.

Advies:

- Verplaatsen naar `docs/audits/ui-ux/` en `docs/implementation/design-system/`.
- Maak één actuele `docs/technisch/design-system.md` met huidige componenten, tokens en afspraken.
- Archiveer faseverslagen als geschiedenis.

### 7. Inmeetmodule en offertevoorbereiding

Bestanden:

- `inmeetmodule-en-materiaalverlies-plan-2026-04-30.md`
- `inmeetmodule-phase-1-calculators-2026-04-30.md`
- `inmeetmodule-phase-2-datamodel-2026-04-30.md`
- `inmeetmodule-phase-3-projectdetail-ui-2026-04-30.md`
- `inmeetmodule-phase-4-offertebuilder-koppeling-2026-04-30.md`
- `inmeetmodule-styling-layout-mobile-audit-2026-04-30.md`

Beoordeling:

- Duidelijke faseopbouw.
- Goede technische projectgeschiedenis.
- Voor klantdocumentatie is de relevante uitleg inmiddels opgenomen in de workflowhandleiding.

Advies:

- Maak een compacte actuele modulepagina: `docs/technisch/inmeetmodule.md`.
- Archiveer faseverslagen onder `docs/implementation/inmeetmodule/`.

### 8. Offertesjablonen en behangcalculator

Bestanden:

- `quote-template-and-wallpaper-calculator-2026-04-30.md`
- `quote-template-seed-verification-2026-04-30.md`
- `offertetemplates-page-audit-2026-04-30.md`

Beoordeling:

- Nuttig als implementatie- en validatiegeschiedenis.
- De H1's zijn deels Engels en Title Case, minder consistent met de rest.

Advies:

- Archiveer audit/seedrapporten onder `docs/implementation/offertes/`.
- Maak eventueel een actuele korte beheerpagina voor offertesjablonen.

### 9. Leverancierspagina

Bestand:

- `leveranciers-page-audit-2026-04-30.md`

Beoordeling:

- Pagina-audit is nuttig en actueel.
- Hoort bij UI/page audits of module-documentatie.

Advies:

- Verplaatsen naar `docs/audits/pages/`.
- Samenvatting opnemen in technische module-index.

### 10. QA-screenshots

Map:

- `docs/qa-screenshots/phase-6/`

Beoordeling:

- Waardevol als QA-artefact.
- Grootste categorie qua opslag: 20 PNG's, 894,5 KB.
- Staat al in submap, maar niet duidelijk gekoppeld aan een index of rapport.

Advies:

- Houd screenshots in `docs/artifacts/qa-screenshots/`.
- Voeg een korte `README.md` toe met route, viewport en datum.
- Verwijder later dubbele `after/fixed/final` varianten als ze geen extra waarde meer hebben.

## Grootste bestanden

De grootste bestanden zijn vooral artefacten:

| Bestand | Grootte |
| --- | ---: |
| `import-production-audit-2026-04-29.json` | 296,1 KB |
| `data-audit.json` | 258,1 KB |
| `laptop-import-profiles.png` | 119,9 KB |
| `desktop-project-detail.png` | 97,5 KB |
| `desktop-quote-detail.png` | 87,1 KB |
| `desktop-customer-detail.png` | 85,2 KB |
| `desktop-portal.png` | 82,9 KB |
| `catalog-validation-2026-04-29.json` | 64,7 KB |
| `vat-mapping-current-state-2026-04-30.json` | 62,3 KB |

Advies:

- Grote JSON-bestanden niet als gewone docs-rootbestanden behandelen.
- Niet verwijderen zonder eerst te bepalen of ze nog als auditbewijs nodig zijn.
- Verplaatsen naar artifacts/generated is veilig, mits scripts/verwijzingen bijgewerkt worden.

## Structuurproblemen

### 1. Geen centrale index

Er is geen `docs/README.md`.

Effect:

- Nieuwe gebruiker ziet niet wat actueel is.
- Klantdocumentatie is moeilijk te onderscheiden van auditlogs.
- De map oogt als ontwikkelgeschiedenis in plaats van productdocumentatie.

### 2. Platte map met te veel doelen

Root bevat:

- klantdocumenten
- technische documenten
- auditrapporten
- JSON-artefacten
- generated catalogusrapporten
- release-readiness dossiers
- implementatiefaseverslagen

Effect:

- Zoeken is lastig.
- Kans op verkeerde document gebruiken is groot.
- Klant kan per ongeluk technische of historische docs lezen.

### 3. Taal en naamgeving inconsistent

Voorbeelden:

- `Catalog Import Run`
- `Quote Template Seed Verification`
- `Production readiness review`
- `Design-system Fase`
- `Btw-mapping`

Beoordeling:

- Voor technische auditdocs is Engels gemengd acceptabel.
- Voor klantgerichte documentatie moet Nederlands leidend blijven.

Advies:

- Nederlandse namen voor klantdocs.
- Technische docs mogen Engelstalige termen houden, maar moeten in eigen technische sectie.

### 4. Historische en actuele status staan naast elkaar

Voorbeelden:

- rapporten van 2026-04-29 naast actuele 2026-04-30 docs
- design-system fase 1 t/m 7 naast actuele handleiding
- oude data-audits naast actuele catalog-import-summary

Effect:

- Onhelder wat de waarheid van vandaag is.

Advies:

- Gebruik `current/`, `archive/`, of duidelijke indexlabels.

### 5. Generated output en handmatige docs staan door elkaar

Voorbeelden:

- `catalog-import-summary.md/json`
- `catalog-import-sample.md`
- `vat-mapping-current-state-*.json`
- `import-production-audit-*.json`

Advies:

- Markeer generated docs expliciet.
- Zet machine-readable output in `docs/generated/` of `docs/artifacts/json/`.
- Houd eventueel `catalog-import-summary.md` als root of symlink-achtig stabiel hoofdrapport, omdat dit nu de afgesproken primaire reviewbron is.

## Voorgestelde professionele doelstructuur

Voorstel zonder nu al te verplaatsen:

```txt
docs/
  README.md

  klant/
    henke-wonen-portal-handleiding.md
    henke-wonen-portal-quickstart.md

  technisch/
    workflow-technical-map.md
    codebase-inventory.md
    design-system.md
    inmeetmodule.md
    importstraat.md

  release-readiness/
    catalogus-import/
      catalog-import-summary.md
      catalog-import-sample.md
    vat-mapping/
      README.md
      current-state.md
      human-decision-table.md
      production-readiness.md
      decisions.template.json
    data-issues/
      duplicate-ean-review.md

  audits/
    data-import/
    ui-ux/
    pages/
    accessibility/

  implementation/
    design-system/
    inmeetmodule/
    offertes/
    leveranciers/

  generated/
    json/
    catalog/

  artifacts/
    qa-screenshots/

  archive/
    2026-04-29/
```

## Belangrijke compatibiliteitswaarschuwingen

Niet zomaar verplaatsen zonder scriptcontrole:

- `catalog-import-summary.md`
- `catalog-import-summary.json`
- `catalog-import-sample.md`

Deze worden geschreven door `tools/build_catalog_import.py` en zijn gekoppeld aan `npm run catalog:preview`.

Niet zomaar verwijderen:

- `vat-mapping-decisions.json`

Dit lijkt leeg, maar is bedoeld als inputbestand voor het apply-script.

Niet zomaar archiveren zonder verwijzingen bij te werken:

- recente workflowdocumentatie
- inmeetmodule fase 1 t/m 4 rapporten
- production readiness/vat mapping rapporten

## Prioriteitenplan

### Fase 1: index en labels, geen verplaatsingen

Doel:

- Direct professionele ingang maken zonder scripts te breken.

Acties:

- Maak `docs/README.md`.
- Voeg categorieen toe:
  - Voor medewerkers
  - Voor beheer/ontwikkeling
  - Actuele importstatus
  - Audits en geschiedenis
  - Gegenereerde artefacten
- Markeer wat actueel is en wat historisch is.

Risico:

- Laag. Geen paden wijzigen.

### Fase 2: klantdocumentatie apart zetten

Doel:

- Medewerkers zien alleen relevante documenten.

Acties:

- Maak `docs/klant/`.
- Verplaats of kopieer handleiding en quickstart.
- Laat root README naar nieuwe locatie verwijzen.

Risico:

- Laag tot middel. Externe verwijzingen moeten worden bijgewerkt.

### Fase 3: technische docs en implementatiegeschiedenis scheiden

Doel:

- Jeffrey/onderhoud vindt technische context snel.

Acties:

- Maak `docs/technisch/`.
- Maak `docs/implementation/`.
- Verplaats design-system phase docs naar implementation/design-system.
- Verplaats inmeetmodule phase docs naar implementation/inmeetmodule.
- Maak compacte actuele technische samenvattingen.

Risico:

- Middel. Veel interne verwijzingen kunnen breken.

### Fase 4: import/release-readiness dossier maken

Doel:

- Btw-mapping en productie-importstatus begrijpelijk houden.

Acties:

- Maak `docs/release-readiness/`.
- Bundel VAT mapping docs.
- Bundel duplicate EAN docs.
- Houd `catalog-import-summary.md` bereikbaar als primaire reviewbron.

Risico:

- Middel. Scripts en eerder genoemde rapportpaden controleren.

### Fase 5: generated/artifacts opruimen

Doel:

- Grote JSON en screenshots uit gewone docs-root halen.

Acties:

- Verplaats grote JSON naar `docs/generated/json/` of `docs/artifacts/json/`.
- Verplaats screenshots naar `docs/artifacts/qa-screenshots/`.
- Voeg README's toe bij artifacts.
- Update scripts indien outputpaden veranderen.

Risico:

- Middel tot hoog als scripts naar vaste paden schrijven.

### Fase 6: archiveren historische auditdocs

Doel:

- Actuele documentatie en geschiedenis scheiden.

Acties:

- Maak `docs/archive/2026-04-29/`.
- Verplaats oude data/import auditrapporten.
- Maak index met “historisch bewijs, niet actuele handleiding”.

Risico:

- Middel. Nuttig, maar alleen na akkoord.

## Aanbevolen eerste concrete stap

Begin met Fase 1:

1. maak `docs/README.md`
2. maak geen bestandsverplaatsingen
3. label de huidige documenten naar doelgroep en status
4. verwijs prominent naar:
   - klant-handleiding
   - quickstart
   - catalog-import-summary
   - vat-mapping productie-readiness
   - workflow technical map

Waarom:

- Direct professioneel effect.
- Geen scriptbreuk.
- Geen risico op kapotte links.
- Geeft houvast voor latere verplaatsingen.

## Acceptatiecriteria voor professionalisering

De docs-map is professioneel genoeg als:

- er een duidelijke `docs/README.md` is
- klantdocumentatie direct vindbaar is
- technische en historische auditdocs niet door elkaar staan met klantdocs
- generated JSON en screenshots als artefacten herkenbaar zijn
- actuele statusdocumenten duidelijk als actueel zijn gemarkeerd
- verplaatsingen scripts niet breken
- `npm run catalog:preview` nog steeds de afgesproken summary schrijft
- oude auditdocs bewaard blijven maar niet als actuele waarheid worden gepresenteerd
