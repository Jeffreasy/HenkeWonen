# Documentatieconsolidatie 2026-04-30

## Samenvatting

De documentatiemap is geconsolideerd van een ontwikkelstapel met losse rapporten naar een vaste structuur met duidelijke ingangen.

Er is niets verwijderd. Historische faseverslagen, audits, JSON-rapporten en screenshots zijn verplaatst naar logische submappen. De root van `docs` bevat nu alleen:

- centrale README
- klantdocumentatie-map
- technische documentatie-map
- release-readiness-map
- implementatiegeschiedenis
- auditmap
- artefactenmap
- drie gegenereerde cataloguspreviewbestanden

## Nieuwe hoofdstructuur

| Pad | Doel |
| --- | --- |
| `docs/README.md` | Centrale ingang |
| `docs/klant` | Gebruikershandleiding en quickstart |
| `docs/technisch` | Actuele technische samenvattingen |
| `docs/release-readiness` | Productievrijgave, btw-mapping en datakwaliteit |
| `docs/implementation` | Faseverslagen en implementatiegeschiedenis |
| `docs/audits` | Auditrapporten |
| `docs/artifacts` | QA-screenshots en artefacten |

## Belangrijkste verplaatsingen

| Oude groep | Nieuwe locatie |
| --- | --- |
| `design-system-phase-*` | `docs/implementation/design-system` |
| `ui-ux-*` en `nederlandse-ui-copy-*` | `docs/audits/ui-ux` |
| `inmeetmodule-*` | `docs/implementation/inmeetmodule` |
| offerte-template en behangcalculator rapporten | `docs/implementation/offertes` |
| data-, catalogus- en importaudits | `docs/audits/data-import` |
| btw-mapping dossiers | `docs/release-readiness/vat-mapping` |
| duplicate EAN review | `docs/release-readiness/data-issues` |
| workflow inventory en technische map | `docs/technisch` |
| documentatiemap audit | `docs/audits/documentatie` |
| QA screenshots | `docs/artifacts/qa-screenshots` |

## Bewust in root gelaten

Deze bestanden blijven in `docs` omdat `npm run catalog:preview` ze daar genereert:

- `catalog-import-summary.md`
- `catalog-import-summary.json`
- `catalog-import-sample.md`

## Toegevoegde overzichtsdocumenten

| Document | Functie |
| --- | --- |
| `docs/technisch/design-system.md` | Geconsolideerde design-system stand |
| `docs/technisch/inmeetmodule.md` | Geconsolideerde inmeetmodule stand |
| `docs/technisch/importstraat-catalogus.md` | Geconsolideerde import/catalogus stand |
| `docs/implementation/*/README.md` | Index per implementatiebundel |
| `docs/audits/*/README.md` | Index per auditbundel |
| `docs/release-readiness/README.md` | Index voor releaseblokkades |

## Verificatie

- Root `docs` bevat alleen de centrale mappen en gegenereerde cataloguspreviewbestanden.
- Alle gecontroleerde README-links werken.
- Alle markdown-links binnen `docs` werken.
- Er is geen applicatiecode of business logic aangepast.

## Vervolgadvies

- Laat `catalog-import-summary.*` in root totdat het previewscript bewust wordt aangepast.
- Gebruik `docs/README.md` als enige startpunt.
- Voeg nieuwe auditrapporten voortaan direct toe aan de juiste submap.
- Schrijf nieuwe klantdocumentatie alleen in `docs/klant`.

