# Henke Wonen documentatie

Centrale ingang voor alle documentatie van de Henke Wonen portal.

## Snel kiezen

| Ik wil... | Lees dit |
| --- | --- |
| De portal gebruiken als medewerker | [Klantdocumentatie](./klant/README.md) |
| Snel starten met de dagelijkse flow | [Quickstart](./klant/henke-wonen-portal-quickstart-2026-04-30.md) |
| De volledige gebruikershandleiding lezen | [Workflowhandleiding](./klant/henke-wonen-portal-workflow-handleiding-2026-04-30.md) |
| De technische opbouw begrijpen | [Technische documentatie](./technisch/README.md) |
| Releaseblokkades en btw-mapping volgen | [Release-readiness](./release-readiness/README.md) |
| Gegenereerde importbestanden bekijken | [Generated](./generated/README.md) |
| Historische audits en faseverslagen vinden | [Archief](./archief/README.md) |

## Mappenstructuur

| Map | Doel |
| --- | --- |
| [technisch](./technisch/README.md) | Actuele technische samenvattingen en workflowmapping |
| [klant](./klant/README.md) | Handleiding en quickstart voor Henke Wonen-medewerkers |
| [release-readiness](./release-readiness/README.md) | Btw-mapping, productieblokkades en datakwaliteitsreviews |
| [generated](./generated/README.md) | Automatisch gegenereerde import- en auditbestanden (niet handmatig aanpassen) |
| [artifacts](./artifacts/README.md) | QA-screenshots en pilot-documenten |
| [PilotLaunch](./PilotLaunch/) | Pilot-launchpakketten per versie (V1.0, V1.1, V2.0) met print-PDF's en HTML-bronnen |
| [archief](./archief/README.md) | Historische audits, faseverslagen en gearchiveerde versies |

## Huidige hoofdstatus

- De portal heeft klant-, project-, offerte-, catalogus-, leveranciers-, import- en inmeetflows.
- De inmeetmodule bereidt hoeveelheden en omschrijvingen voor; prijzen, producten en btw blijven in de offerte gecontroleerd.
- Productie-import blijft geblokkeerd zolang verplichte btw-mappings openstaan.
- Dubbele EAN-waarschuwingen zijn review-only en worden nooit automatisch samengevoegd.

## Locatiegevoelige bestanden

Onderstaande bestanden worden aangestuurd door scripts — niet handmatig verplaatsen:

- `docs/generated/catalog-import-preview.json` — batch-import input
- `docs/generated/catalog-import-summary.md` — primaire output catalog-preview
- `docs/generated/catalog-import-summary.json` — machine-readable output
- `docs/generated/catalog-import-sample.md` — sample output
- `docs/release-readiness/vat-mapping/vat-mapping-decisions.json` — input voor apply-script
- `docs/archief/audits/reconciliation/02_source_inventory.md` — gegenereerd door reconciliatiescript

Zie [docs/generated/README.md](./generated/README.md) voor volledige details.
