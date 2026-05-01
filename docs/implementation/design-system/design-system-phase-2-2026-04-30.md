# Design-system Fase 2 - 2026-04-30

## Samenvatting

Fase 2 is uitgevoerd als portal-shell en paginaopbouwlaag. Er is geen DataTable gebouwd, geen importarchitectuur gewijzigd, geen catalogus/offerte/business logic aangepast en geen domeinflow herontworpen.

De portal heeft nu een centrale headerstructuur, breadcrumbs voor detailroutes, gegroepeerde sidebar-navigatie en actieve route highlighting.

## Toegevoegde componenten

Toegevoegd:

- `src/components/ui/PageHeader.tsx`
  - props: `eyebrow`, `title`, `description`, `actions`, `breadcrumbs`, `meta`
  - accepteert ook children als action-slot voor Astro-pagina's
  - rendert consistent met design tokens uit Fase 1

- `src/components/ui/SectionHeader.tsx`
  - props: `title`, `description`, `actions`, `compact`
  - bedoeld voor panelen, kaarten en latere domeinsecties

- `src/components/layout/Breadcrumbs.tsx`
  - props: `items: { label: string; href?: string }[]`
  - laatste item is current page
  - gebruikt `nav aria-label="Breadcrumb"`

## Aangepaste layout/sidebar

`src/components/layout/PortalLayout.astro`

- geeft `Astro.url.pathname` door aan de sidebar
- behoudt de bestaande fixed-sidebar/main-layout
- voegt een veilige `portal-content` wrapper toe voor consistente contentbreedte en spacing

`src/components/layout/Sidebar.tsx`

- navigatie gegroepeerd in:
  - Overzicht
  - Werkproces
  - Catalogus & imports
  - Instellingen
- actieve route highlighting toegevoegd
- exacte route gebruikt `aria-current="page"`
- actieve parent-route gebruikt `aria-current="location"`
- bestaande routes behouden en instellingen uitgebreid met directe link naar `Categorieen`

## CSS aanvullingen

`src/styles/global.css`

- `portal-content`
- active nav styling
- nav group labels/items
- `ui-page-header`
- `ui-section-header`
- breadcrumbs styling
- responsive stacking voor page/section header actions

De oude `.page-header` class is bewust behouden als fallback voor backwards compatibility.

## Gemigreerde pagina's

Lijstpagina's:

- `/portal`
- `/portal/klanten`
- `/portal/projecten`
- `/portal/offertes`
- `/portal/catalogus`
- `/portal/leveranciers`
- `/portal/imports`
- `/portal/import-profielen`
- `/portal/catalogus/data-issues`
- `/portal/instellingen/werkzaamheden`
- `/portal/instellingen/categorieen`
- `/portal/instellingen/offertetemplates`

Detailpagina's met breadcrumbs:

- `/portal/klanten/[id]`
- `/portal/projecten/[id]`
- `/portal/offertes/[id]`
- `/portal/imports/[batchId]`

## Bewust niet aangepakt

Conform opdracht niet gedaan:

- geen DataTable/filter/search component gebouwd
- geen tabellen herschreven
- geen VAT review logic aangepast
- geen import readiness logic aangepast
- geen duplicate-EAN merge- of reviewlogica aangepast
- geen offertebuilder redesign
- geen Convex schema, queries of mutations aangepast
- geen grote responsive herbouw

## Risico's

- `PageHeader` gebruikt Astro children als action-slot. `npm run check` en `npm run build` bevestigen dat dit compileert.
- De nieuwe `portal-content` wrapper brengt consistente spacing, maar sommige domeincomponenten hebben nog eigen interne margins en inline styles. Fase 3/4 moet dit verder normaliseren.
- Sidebar active state is gebaseerd op pathname-prefixes. Voor huidige routes is dat passend; bij toekomstige nested routes moet de routehiërarchie bewust gekozen blijven.
- `SectionHeader` is toegevoegd als primitive, maar nog niet breed uitgerold om domeinflows ongemoeid te laten.

## Verificatie

- `npm run check`: OK
- `npm run build`: OK

Build-notitie: de bestaande Vercel-waarschuwing blijft zichtbaar dat lokale Node.js 25 niet gelijk is aan Vercel Serverless runtime Node.js 24. De build is succesvol.

Route spotcheck:

- `/portal`: HTTP 200
- `/portal/klanten`: HTTP 200
- `/portal/projecten`: HTTP 200
- `/portal/offertes`: HTTP 200
- `/portal/catalogus`: HTTP 200
- `/portal/imports`: HTTP 200
- `/portal/import-profielen`: HTTP 200
- `/portal/catalogus/data-issues`: HTTP 200
- `/portal/instellingen/werkzaamheden`: HTTP 200
- `/portal/instellingen/categorieen`: HTTP 200
- `/portal/instellingen/offertetemplates`: HTTP 200

Extra checks:

- sidebar active state HTML aanwezig op `/portal/import-profielen`
- breadcrumbs renderen op detailroutes
- ProductionReadiness query geeft nog `BLOCKED`, met 54 unresolved VAT mappings en 25 open duplicate-EAN issues
- duplicate-EAN review blijft review-only; er is geen automatische merge toegevoegd

## Vervolgadvies Fase 3

Fase 3 kan nu gericht starten met data-heavy patronen:

- `DataTable`
- `FilterBar`
- `SearchInput`
- `Pagination`
- table density varianten
- server/client filterafspraken
- empty/loading/error table states

Begin bij importprofielen, imports en catalogus/data-issues, omdat daar de meeste tabellen en bulkacties zitten.
