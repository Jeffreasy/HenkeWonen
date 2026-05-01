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
| [implementation](./implementation/README.md) | Faseverslagen en implementatiegeschiedenis |
| [audits](./audits/README.md) | Data-, import-, UI-, pagina- en documentatieaudits |
| [artifacts](./artifacts/README.md) | QA-screenshots en overige artefacten |

## Actuele gegenereerde bestanden

Deze drie bestanden blijven bewust in de root van `docs`, omdat `npm run catalog:preview` ze hier genereert.

| Bestand | Functie |
| --- | --- |
| [catalog-import-summary.md](./catalog-import-summary.md) | Primaire compacte cataloguspreview voor review |
| [catalog-import-summary.json](./catalog-import-summary.json) | Machine-readable cataloguspreview |
| [catalog-import-sample.md](./catalog-import-sample.md) | Kleine sample met product-, warning- en btw-regels |

Belangrijk: verplaats deze bestanden pas als het previewscript ook wordt aangepast.

## Huidige hoofdstatus

- De portal heeft klant-, project-, offerte-, catalogus-, leveranciers-, import- en inmeetflows.
- De inmeetmodule bereidt hoeveelheden en omschrijvingen voor; prijzen, producten en btw blijven in de offerte gecontroleerd.
- Productie-import blijft geblokkeerd zolang verplichte btw-mappings openstaan.
- Dubbele EAN-waarschuwingen zijn review-only en worden nooit automatisch samengevoegd.
- De cataloguspreview blijft de primaire bron voor importtellingen.

## Niet zomaar verplaatsen

Deze bestanden zijn gekoppeld aan scripts, releasebeslissingen of actuele review:

- `catalog-import-summary.md`
- `catalog-import-summary.json`
- `catalog-import-sample.md`
- `release-readiness/vat-mapping/vat-mapping-decisions.json`
- `release-readiness/vat-mapping/vat-mapping-current-state-2026-04-30.json`
