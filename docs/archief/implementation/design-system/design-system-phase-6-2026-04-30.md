# Design-system Fase 6 - 2026-04-30

## Samenvatting

Fase 6 is uitgevoerd als responsive, accessibility en realistische QA-pass. Er zijn geen importarchitectuurwijzigingen, prijslogica-wijzigingen, offerteberekening-wijzigingen, auth-wijzigingen of nieuwe complexe domeinfeatures gedaan.

De belangrijkste verbetering is dat de portal nu testbaar is met realistische demo-data en dat detailroutes met echte ids zijn gecontroleerd.

## Demo-data aanpak

Toegevoegd:

- `convex/demoSeed.ts`
- `tools/seed_demo_portal_data.mjs`
- npm-script: `portal:demo-seed`

De seed is bedoeld voor development/demo en draait niet automatisch in productie.

Kenmerken:

- gebruikt bestaande Convex tabellen
- wijzigt geen productcatalogus
- wijzigt geen productprijzen
- wijzigt geen importbatches
- is idempotent op demo-namen/titels
- seedt herkenbare records met prefix `Demo -`

Geseede data:

- 3 klanten:
  - `Demo - Familie De Vries`
  - `Demo - Zorgpraktijk De Linde`
  - `Demo - Mevrouw Jansen`
- 3 projecten:
  - `Demo - PVC benedenverdieping`
  - `Demo - Praktijkruimte vloer en plinten`
  - `Demo - Traprenovatie en raamdecoratie`
- 2 offertes:
  - `Demo - Conceptofferte PVC beneden`
  - `Demo - Geaccepteerde offerte trap en raamdecoratie`
- ruimtes:
  - woonkamer
  - hal
  - trap
- contactmomenten:
  - telefoongesprek
  - winkelbezoek
  - uitgeleend item
  - afspraak
  - leadnotitie
- workflow events:
  - offerte aangemaakt
  - inmeting gepland
  - klantvraag
  - uitvoering ingepland
- offerteregels:
  - product
  - service
  - labor
  - material
  - discount
  - text
  - manual

Idempotency-check:

- `npm run portal:demo-seed` is twee keer uitgevoerd
- tweede run gaf dezelfde ids terug
- geen dubbele demo-klanten/projecten/offertes ontstaan

Belangrijke demo ids:

- klant: `jh72vk6g5fb44df252z1h74df985tmvr`
- project: `kn77j2f0gxjh3cnega79syb2vn85tew6`
- offerte: `kx7d3g5w3dnp0v6x6cn6vse4ad85vq1z`

## Geteste routes

HTTP routechecks:

- `/portal`: 200
- `/portal/klanten`: 200
- `/portal/klanten/jh72vk6g5fb44df252z1h74df985tmvr`: 200
- `/portal/projecten`: 200
- `/portal/projecten/kn77j2f0gxjh3cnega79syb2vn85tew6`: 200
- `/portal/offertes`: 200
- `/portal/offertes/kx7d3g5w3dnp0v6x6cn6vse4ad85vq1z`: 200
- `/portal/catalogus`: 200
- `/portal/imports`: 200
- `/portal/import-profielen`: 200
- `/portal/catalogus/data-issues`: 200

Browser content checks:

- klantdetail toont `Demo - Familie De Vries`
- klantdetail toont `Uitgeleende items`
- klantdetail toont `PVC stalenmap meegegeven`
- projectdetail toont `Demo - PVC benedenverdieping`
- projectdetail toont `Workflow`
- projectdetail toont `Offerte aangemaakt`
- projectdetail toont `Woonkamer`
- offertedetail toont `Demo - Conceptofferte PVC beneden`
- offertedetail toont `Offerteregels`
- offertedetail toont `Totalen`
- offertedetail toont `PVC dryback warm eiken`

## Responsive bevindingen

Gemaakte screenshots staan in:

- `docs/qa-screenshots/phase-6/`

Gecontroleerde viewports:

- desktop: `1440x1000`
- laptop: `1280x900`
- tablet: `768x1024`
- mobiel: `390x844`

Routes in screenshotset:

- `/portal`
- `/portal/klanten`
- `/portal/klanten/[id]`
- `/portal/projecten/[id]`
- `/portal/offertes/[id]`
- `/portal/catalogus`
- `/portal/imports`
- `/portal/import-profielen`
- `/portal/catalogus/data-issues`

Gevonden issue:

- Op tablet en mobiel nam de sidebar bijna de volledige eerste viewport in.
- Daardoor begon de werkruimte pas onderaan en was mobile gebruik niet professioneel genoeg.
- Door brede DataTable/min-content children kon page-header tekst ook horizontaal clippen.

Fixes:

- mobiele sidebar is compact gemaakt met horizontaal scrollbare navgroepen
- sessiekaart wordt op small screens verborgen
- `portal-main` en nav krijgen overflow guards
- grid children, panels, cards en DataTable wrappers krijgen `min-width: 0`
- DataTables blijven intern horizontaal scrollbaar

Resultaat:

- tablet en mobiel tonen nu direct werkruimte onder compacte navigatie
- page-header tekst wrapt correct
- geen blokkerende mobile overflow gezien in de gecontroleerde routes

## Accessibility bevindingen

Gecontroleerd:

- keyboard focus is zichtbaar via globale `:focus-visible`
- nav links zijn native links
- icon-only buttons gebruiken `IconButton` met verplicht `aria-label`
- alerts gebruiken `role="alert"` bij danger
- loading states gebruiken `aria-live="polite"`
- DataTable vereist `ariaLabel`
- Breadcrumbs gebruikt `nav aria-label="Breadcrumb"`
- StatusBadge toont tekst en gebruikt niet alleen kleur
- form controls zijn gekoppeld aan labels via `Field htmlFor`
- duplicate-EAN en VAT acties blijven tekstueel duidelijk, niet alleen kleurafhankelijk

Kleine observatie:

- Mobiele horizontale nav toont een browser-scrollbar. Dit is functioneel en maakt overflow discoverable, maar kan later visueel subtieler worden gemaakt.

## Visual polish fixes

Aangepast in `src/styles/global.css`:

- mobiele nav compacter
- session card verborgen op small screens
- page/header/grid min-width guards
- body/portal overflow-x guard
- DataTable wrapper max-width guard

Deze fixes zijn layout-only en wijzigen geen dataflow.

## Regressiechecks

Uitgevoerd:

- `npm run check`: OK
- `npm run build`: OK
- `npm run catalog:preview`: OK

`catalog:preview` resultaat:

- sourceFiles: 21
- product rows: 10.291
- preview rows: 10.691
- prices: 13.015

Convex dashboard/readiness na demo seed:

- catalogCount: 7.775
- customerCount: 3
- activeProjectCount: 3
- quoteCount: 2
- production import status: `BLOCKED`
- unresolved VAT mappings: 54
- duplicate EAN issues open: 25
- latest price rules: 13.015

Conclusie:

- demo seed heeft catalogusproducten niet gewijzigd
- demo seed heeft productprijzen niet gewijzigd
- import release-flow blijft geblokkeerd door dezelfde VAT guardrail
- duplicate-EAN review blijft review-only

## Openstaande issues

- Er is nog geen volwaardig mobile menu/collapsible sidebar patroon; de huidige compacte horizontale nav is bewust een kleine veilige fix.
- DataTables gebruiken nog horizontale scroll op small screens; een latere mobile-card variant kan prettiger zijn.
- Keyboard QA is smoke-testniveau; een volledige tabvolgorde-audit per route kan later met een dedicated a11y testtool.
- Chrome headless screenshots zijn bewaard als QA-artifact, maar er is nog geen geautomatiseerde screenshot diff pipeline.

## Advies volgende fase

Aanbevolen Fase 7:

- mobile navigation patroon bepalen: compacte topbar, hamburger of persistent horizontal nav
- DataTable mobile-card pattern voor de belangrijkste tabellen
- echte accessibility tooling toevoegen, bijvoorbeeld axe checks in een testscript
- eventueel Playwright/Vitest setup voor route smoke tests
- demo seed uitbreiden met reset/cleanup optie voor demo-records

## Build-notitie

De bestaande Vercel-waarschuwing blijft zichtbaar dat lokale Node.js 25 niet gelijk is aan Vercel Serverless runtime Node.js 24. De build is succesvol.
