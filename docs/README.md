# Henke Wonen documentatie

Dit is de centrale ingang voor alle documentatie van de Henke Wonen portal.

De map is geconsolideerd: klantdocumentatie staat apart, actuele technische samenvattingen staan apart, en oude faseverslagen/audits zijn bewaard als naslag. Er is niets inhoudelijks weggegooid.

## Snel kiezen

| Ik wil... | Lees dit |
| --- | --- |
| De portal gebruiken als medewerker | [Klantdocumentatie](./klant/README.md) |
| Snel starten met de dagelijkse flow | [Quickstart](./klant/henke-wonen-portal-quickstart-2026-04-30.md) |
| De volledige gebruikershandleiding lezen | [Workflowhandleiding](./klant/henke-wonen-portal-workflow-handleiding-2026-04-30.md) |
| De technische opbouw begrijpen | [Technische documentatie](./technisch/README.md) |
| De huidige import- en catalogusstatus bekijken | [Importstraat en catalogus](./technisch/importstraat-catalogus.md) |
| De inmeetmodule begrijpen | [Inmeetmodule](./technisch/inmeetmodule.md) |
| De UI/design-system status bekijken | [Design-system](./technisch/design-system.md) |
| Releaseblokkades en btw-mapping volgen | [Release-readiness](./release-readiness/README.md) |
| Oude faseverslagen terugvinden | [Implementatiegeschiedenis](./implementation/README.md) |
| Auditrapporten terugvinden | [Audits](./audits/README.md) |
| Zien wat er geconsolideerd is | [Documentatieconsolidatie](./audits/documentatie/documentatie-consolidatie-2026-04-30.md) |

## Mappenstructuur

| Map | Doel |
| --- | --- |
| [klant](./klant/README.md) | Handleiding en quickstart voor Henke Wonen-medewerkers |
| [technisch](./technisch/README.md) | Actuele technische samenvattingen en workflowmapping |
| [release-readiness](./release-readiness/README.md) | Btw-mapping, productieblokkades en datakwaliteitsreviews |
| [generated](./generated/README.md) | Automatisch gegenereerde import- en auditbestanden |
| [implementation](./implementation/README.md) | Faseverslagen en implementatiegeschiedenis |
| [audits](./audits/README.md) | Data-, import-, UI-, pagina- en documentatieaudits |
| [archief](./archief/README.md) | Gearchiveerde oudere versies van documenten |
| [artifacts](./artifacts/README.md) | QA-screenshots, pilot-documenten en overige artefacten |

## Actuele gegenereerde bestanden

Alle automatisch gegenereerde review- en previewbestanden zijn georganiseerd in de map [generated](./generated/).

| Bestand | Functie |
| --- | --- |
| [catalog-import-summary.md](./generated/catalog-import-summary.md) | Primaire compacte cataloguspreview voor review |
| [catalog-import-summary.json](./generated/catalog-import-summary.json) | Machine-readable cataloguspreview |
| [catalog-import-sample.md](./generated/catalog-import-sample.md) | Kleine sample met product-, warning- en btw-regels |
| [catalog-import-preview.json](./generated/catalog-import-preview.json) | Volledige catalogus payload voor de Node batch-import tool |
| [data-audit.md](./generated/data-audit.md) | Overzicht en risicoanalyse van de lokale Excel bronbestanden |

## Huidige hoofdstatus

- De portal heeft klant-, project-, offerte-, catalogus-, leveranciers-, import- en inmeetflows.
- De inmeetmodule bereidt hoeveelheden en omschrijvingen voor; prijzen, producten en btw blijven in de offerte gecontroleerd.
- Productie-import blijft geblokkeerd zolang verplichte btw-mappings openstaan.
- Dubbele EAN-waarschuwingen zijn review-only en worden nooit automatisch samengevoegd.
- De cataloguspreview blijft de primaire bron voor importtellingen.

## Locatiegevoelige bestanden

Deze bestanden zijn gekoppeld aan de verwerkings- en importscripts:

- `docs/generated/catalog-import-summary.md` — primaire output catalog-preview
- `docs/generated/catalog-import-summary.json` — machine-readable output
- `docs/generated/catalog-import-sample.md` — sample output
- `docs/generated/catalog-import-preview.json` — batch-import input
- `docs/audits/reconciliation/02_source_inventory.md` — gegenereerd door reconciliatiescript
- `docs/release-readiness/vat-mapping/vat-mapping-decisions.json` — input voor apply-script

Zie [docs/generated/README.md](./generated/README.md) voor volledige details.
