# Design-system fase 7 - mobiele navigatie, mobile cards en smoke tests

## Samenvatting

Fase 7 voegt een professioneler mobiel navigatiepatroon, een optioneel DataTable mobile-card pattern en een eerste automatische route/accessibility smoke-laag toe. Er zijn geen wijzigingen gedaan aan importarchitectuur, btw-businesslogica, prijslogica, offerteberekeningen, auth, Convex schema of duplicate-EAN mergegedrag.

## Mobiele navigatie

De bestaande desktop-sidebar blijft inhoudelijk gelijk. Voor schermen onder 980px is de horizontaal scrollbare navigatie vervangen door een compacte mobiele topbar met menuknop.

Toegevoegd gedrag:

- `Menu openen` / `Menu sluiten` met Nederlandse aria-labels.
- Uitklapbaar navigatiepaneel met dezelfde groepen:
  - Overzicht
  - Werkproces
  - Catalogus & imports
  - Instellingen
- Actieve route blijft zichtbaar in de topbar.
- Actieve route wordt in het menu gemarkeerd.
- Escape sluit het menu.
- Klik op een route sluit het menu.
- Desktopgedrag blijft de vaste sidebar.

Aangepaste bestanden:

- `src/components/layout/Sidebar.tsx`
- `src/styles/global.css`

## DataTable mobile-card pattern

`DataTable` ondersteunt nu optioneel:

- `mobileMode?: "scroll" | "cards"`
- `renderMobileCard?: (row) => React.ReactNode`

De default blijft `scroll`, zodat bestaande tabellen backwards compatible blijven. Alleen als `mobileMode="cards"` en `renderMobileCard` aanwezig zijn, wordt op small screens een kaartlijst getoond. Op desktop blijft de tabelweergave actief.

Aangepaste bestanden:

- `src/components/ui/DataTable.tsx`
- `src/styles/global.css`

## Toegepaste mobile cards

De mobile-card pattern is bewust beperkt toegepast op drie veilige schermen:

1. `/portal/catalogus/data-issues`
   - Dubbele EAN-waarschuwingen als kaarten.
   - Toont leverancier, EAN, status, advies en korte productvergelijking.
   - Reviewstatus en interne notities blijven review-only.
   - Er is geen automatische merge toegevoegd.

2. `/portal/imports`
   - Importbatches als kaarten.
   - Toont bronbestand, leverancier/profiel, status, datum en kerncounters.
   - Detailactie blijft beschikbaar.

3. `/portal/klanten`
   - Klantenlijst als kaarten.
   - Toont klantnaam, status, klanttype, contactgegevens en actie naar klantdossier.

Niet alle tabellen zijn gemigreerd. Dat voorkomt brede regressie en houdt Fase 7 klein.

## Accessibility tooling

Toegevoegd:

- `tools/test_portal_a11y.mjs`
- npm script: `npm run test:a11y`

De test is bewust lightweight en dependency-vrij. Hij controleert:

- HTTP 200 op hoofdportalroutes.
- `html lang="nl"`.
- Documenttitel.
- `main` landmark.
- `nav` landmark met aria-label.
- Knoppen met toegankelijke naam.
- Form controls met label of aria-label.
- Geen zichtbare technische hoofdtermen zoals `READY`, `BLOCKED`, `unknown VAT`, `allowUnknownVatMode`.

Waarom nog geen axe:

- Playwright en `@axe-core/playwright` zijn nog geen dependencies van het project.
- Voor deze fase is gekozen voor nul dependency-impact.
- Axe kan later worden toegevoegd als Fase 7b of CI-stap.

## Route smoke tests

Toegevoegd:

- `tools/test_portal_routes.mjs`
- npm script: `npm run test:portal`

De test controleert:

- HTTP 200.
- Geen zichtbare runtime-fouttekst.
- `main` en `nav`.
- Verwacht Nederlands hoofdlabel per route.

Routes:

- `/portal`
- `/portal/klanten`
- `/portal/projecten`
- `/portal/offertes`
- `/portal/catalogus`
- `/portal/imports`
- `/portal/import-profielen`
- `/portal/catalogus/data-issues`
- `/portal/instellingen/offertetemplates`

Beide testscript gaan standaard uit van `http://localhost:4321`. Dit kan worden aangepast met:

```bash
PORTAL_TEST_BASE_URL=http://localhost:4321 npm run test:portal
PORTAL_TEST_BASE_URL=http://localhost:4321 npm run test:a11y
```

## Nederlandse copy check

Nieuwe zichtbare UI-copy is Nederlands gehouden:

- `Menu openen`
- `Menu sluiten`
- `Navigatie`
- `Bekijk details`
- `Open klantdossier`
- `Bronbestand`
- `Prijsregels`
- `Btw-modus onbekend`

Technische enumwaarden blijven alleen in code of machine-readable scriptcontext staan.

## Bewust niet aangepakt

- Geen volledige mobile-card migratie voor alle DataTables.
- Geen Drawer/Modal-systeem gebouwd.
- Geen Playwright/axe dependency toegevoegd.
- Geen responsive redesign van offertebuilder.
- Geen importcommit, btw-mapping, catalogusimport of duplicate-EAN businessregels gewijzigd.

## Risico's

- De nieuwe a11y-test is een smoke-test, geen volledige WCAG-audit.
- Mobile-card UI bevat bewust ook interactieve reviewvelden bij duplicate-EAN; dit is semantisch gelabeld, maar blijft een complex scherm voor heel smalle mobiel.
- De mobiele navigatie is React-hydrated. Zonder JavaScript blijft de desktopstructuur in HTML aanwezig, maar het mobiele menu opent niet interactief.

## Verificatie

Uit te voeren en uitgevoerd in deze fase:

- `npm run check`
- `npm run build`
- `npm run catalog:preview`
- `npm run test:portal`
- `npm run test:a11y`

Baseline die behouden moet blijven:

- Productregels: 10.291
- Voorvertonings-/auditregels: 10.691
- Prijsregels: 13.015
- Prijsregels met onbekende btw-modus: 12.984

## Vervolgadvies

Voor een volgende fase:

- Playwright + axe toevoegen zodra dependency-impact en CI-runner duidelijk zijn.
- Visual regression screenshots vastleggen voor desktop/tablet/mobile.
- Mobile cards gefaseerd uitbreiden naar catalogusproducten, offertes en importregel-detailtabellen.
- Kleine keyboard-flow test toevoegen voor mobiel menu: openen, tabben, Escape sluiten.
