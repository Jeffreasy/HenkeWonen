# Pilot-launch documentatie

Klant-gerichte launchpakketten voor de Henke Wonen portal, per versie.

## Versies

| Versie | Status | Inhoud |
| --- | --- | --- |
| [V2.0](./V2.0/) | **Actief** (juni 2026, code-geverifieerd) | Quickstart, Pilot Handleiding, Workflow Handleiding, Vrijgave & Datakwaliteit + Changelog — gebrande print-PDF's én HTML-bron (`assets/brand.css`) |
| [V1.0](./V1.0/) | Historisch record (apr/jun 2026) | De vier oorspronkelijke launch-PDF's |

> De **actieve** set is V2.0. De V1.0-PDF's en de V1-markdown in [`docs/klant/`](../klant/README.md) zijn historische records (gemarkeerd als vervallen).

## V2.0 — documenten

| Document | PDF | HTML-bron |
| --- | --- | --- |
| Quickstart | [PDF](./V2.0/henke-wonen-portal-quickstart-Print.pdf) | [HTML](./V2.0/henke-wonen-portal-quickstart.html) |
| Pilot Handleiding | [PDF](./V2.0/henke-wonen-portal-pilot-handleiding-Print.pdf) | [HTML](./V2.0/henke-wonen-portal-pilot-handleiding.html) |
| Workflow Handleiding | [PDF](./V2.0/henke-wonen-portal-workflow-handleiding-Print.pdf) | [HTML](./V2.0/henke-wonen-portal-workflow-handleiding.html) |
| Vrijgave & Datakwaliteit | [PDF](./V2.0/henke-wonen-portal-vrijgave-en-datakwaliteit-Print.pdf) | [HTML](./V2.0/henke-wonen-portal-vrijgave-en-datakwaliteit.html) |
| Wijzigingen (changelog) | [PDF](./V2.0/henke-wonen-portal-changelog-v2-Print.pdf) | [HTML](./V2.0/henke-wonen-portal-changelog-v2.html) |

## Bron renderen naar PDF

De HTML-bronnen renderen naar print-PDF met headless Chrome:

```
chrome --headless --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=12000 \
  --print-to-pdf="<bestand>-Print.pdf" "<bestand>.html"
```

Styling staat in [`V2.0/assets/brand.css`](./V2.0/assets/brand.css); het Inter-lettertype wordt via Google Fonts geladen.
