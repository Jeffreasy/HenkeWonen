# UI/UX en design-system audit - 2026-04-30

## Samenvatting

De Henke Wonen portal heeft een bruikbare basis: een rustige warme kleurstelling, een vaste sidebar, consistente Astro paginaheaders en een beperkt setje globale CSS-klassen voor panelen, kaarten, tabellen, badges, velden en knoppen. De applicatie voelt al meer als een backoffice dan als een losse website.

De grootste beperking is dat er nog geen echt design-system is. Domeincomponenten bouwen tabellen, formulieren, empty states, filters, bulkacties en statusweergave telkens opnieuw met losse CSS-klassen en inline styles. Daardoor zijn complexe schermen zoals imports, importprofielen, duplicate-EAN issues en offertes functioneel, maar visueel druk en moeilijker te scannen dan nodig.

Advies: niet eerst redesignen, maar eerst tokens en basiscomponenten stabiliseren. Daarna gefaseerd de portal shell, DataTable patronen en de belangrijkste operationele flows polijsten.

## Huidige UI-status

### Geinspecteerde structuur

- `src/pages/portal/**`: 16 portalpagina's.
- `src/components/**`: 26 componentbestanden.
- `src/styles/global.css`: enige globale stylingbron.
- `src/components/layout/PortalLayout.astro` en `Sidebar.tsx`: portal shell.
- `src/components/imports/**`: import batches, VAT mapping, production readiness.
- `src/components/catalog/**`: catalogus en duplicate-EAN data issues.
- `src/components/customers/**`, `projects/**`, `quotes/**`, `suppliers/**`, `settings/**`.
- `src/lib/portalTypes.ts` en `src/lib/**`.
- Geen Tailwind config gevonden; Tailwind staat wel in devDependencies, maar styling gebeurt momenteel via globale CSS.

### Route spotcheck

Alle gecontroleerde routes gaven HTTP 200:

| Route | Status |
| --- | --- |
| `/portal` | 200 |
| `/portal/klanten` | 200 |
| `/portal/projecten` | 200 |
| `/portal/offertes` | 200 |
| `/portal/catalogus` | 200 |
| `/portal/imports` | 200 |
| `/portal/import-profielen` | 200 |
| `/portal/catalogus/data-issues` | 200 |
| `/portal/leveranciers` | 200 |
| `/portal/instellingen/werkzaamheden` | 200 |
| `/portal/instellingen/categorieen` | 200 |
| `/portal/instellingen/offertetemplates` | 200 |

## Algemene layout audit

### Huidige layoutstructuur

- `PortalLayout.astro` laadt `global.css`, rendert een vaste `Sidebar` en een `<main class="portal-main">`.
- Sidebar is fixed op desktop, 272px breed, donker warm charcoal.
- Main content gebruikt `margin-left: 272px` en `padding: 28px`.
- Onder 980px wordt sidebar statisch boven de content geplaatst en vallen grid layouts terug naar 1 kolom.
- Page headers zijn per pagina handmatig opgebouwd met `.page-header`, `.eyebrow` en `h1`.
- Er is geen topbar, breadcrumb, global search, user action zone of current-page highlighting in de sidebar.

### Sterke punten

- Warme, rustige basisstijl past bij woninginrichting.
- Vaste sidebar maakt de hoofdmodules makkelijk vindbaar.
- Astro pagina's zijn compact en consistent: bijna elke route heeft een `page-header` en React island.
- CSS gebruikt al tokens via `:root`, zoals `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`.
- Responsiveness is minimaal aanwezig via breakpoint op 980px.

### Zwakke punten

- Geen maximale contentbreedte of data-layout strategie. Op brede schermen kunnen tabellen en panels erg breed en lastig scanbaar worden.
- Geen topbar of breadcrumbs. Detailpagina's zoals klant, project, offerte en import batch missen context en terugnavigatie.
- Sidebar heeft geen actieve state, geen modulegroepen en geen collapsible behavior.
- Mobiel is functioneel maar niet optimaal: tabellen blijven gewone tabellen en kunnen horizontaal/verticaal zwaar worden.
- Belangrijke acties staan wisselend links, rechts, in cards, in forms of in toolbars.
- Inline styles worden veel gebruikt voor layoutdetails, bijvoorbeeld `marginTop`, `gridColumn`, `minWidth`, `alignSelf`.

### Concrete verbeteringen

1. Introduceer `PortalShell`/`PageHeader`/`Breadcrumbs` als vaste layoutlaag.
2. Voeg actieve navigatiestate en groepering toe aan `Sidebar`.
3. Voeg een optionele `Topbar` toe voor breadcrumbs, tenant/context, quick search en globale acties.
4. Definieer pagina-layout varianten: `single`, `split`, `workbench`, `data`.
5. Geef data-heavy pagina's een `max-width: none` data-workbench, maar gewone CRM/offerte pagina's een betere leesbreedte.
6. Bouw responsive table cards of horizontale scroll wrappers als standaard patroon.

## Belangrijkste UX-risico's

1. **Data-heavy schermen worden te zwaar.** Catalogus, imports, VAT mapping en duplicate-EAN issues gebruiken gewone tabellen zonder echte DataTable componenten.
2. **Productieblokkades zijn technisch zichtbaar, maar nog cognitief zwaar.** Production readiness is aanwezig, maar moet visueel een release checklist worden.
3. **Offertebuilder is te basaal voor winkelgebruik.** Totalen staan rechts, maar niet sticky. Regeltypes zijn tekstueel, niet visueel genoeg onderscheiden.
4. **Klant- en projectdossiers missen dossierstructuur.** Contactmomenten, uitgeleende items, workflow en notities staan als losse cards zonder tijdlijn/detailpanelen.
5. **Geen centrale feedbacklaag.** Errors en loading states zijn inline `empty-state`; er zijn geen alerts/toasts/modals voor veilige destructieve of bulkacties.
6. **Responsiveness is technisch, niet ontworpen.** Grids vallen terug naar 1 kolom, maar tabellen en toolbars zijn niet mobiel-specifiek ontworpen.

## Design-system gaps

### Componenten die impliciet bestaan

| Component/patroon | Huidige vorm | Opmerking |
| --- | --- | --- |
| Button | `.button`, `.button.primary`, `.button.secondary`, `.button.ghost` | CSS-only, geen React component, geen size/loading variants |
| IconButton | `.icon-button` | Alleen CSS, weinig toegepast |
| Input/Textarea/Select | `.field input/select/textarea` | Redelijk consistent, geen error/help text component |
| Badge | `.badge`, `.success`, `.warning`, `.danger` | Basis goed, mist neutral/info/outline/status mapping |
| Card/Panel | `.card`, `.panel` | Veel gebruikt, maar soms nested cards en hover op alle cards |
| Table | `.table`, `.table-wrap` | Basistabel, mist pagination, density, sticky header, row actions |
| EmptyState | `.empty-state` | Bestaat als class, geen component/variants |
| Tabs | `.tabs`, `.tab` | Aanwezig in CSS, lokaal gebruikt in VAT filters |
| PageHeader | `.page-header` | Bestaat als patroon in Astro, geen component |
| StatCard | `.card metric` en losse readiness cards | Niet generiek |
| SearchInput | `ProductSearch` | Alleen catalogus |

### Componenten die ontbreken

- `Button.tsx` met variant, size, icon, loading, disabled semantics.
- `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Checkbox.tsx`, `Switch.tsx`, `RadioGroup.tsx`.
- `Badge.tsx` en `StatusBadge.tsx` met domeinstatus-mapping.
- `Card.tsx`, `Panel.tsx`, `StatCard.tsx`.
- `PageHeader.tsx` met title, eyebrow, description, actions.
- `Breadcrumbs.tsx`.
- `Alert.tsx`, `ErrorState.tsx`, `LoadingState.tsx`, `EmptyState.tsx`.
- `DataTable.tsx` met column config, pagination, density, row actions, empty/loading/error.
- `FilterBar.tsx`, `SearchInput.tsx`, `Pagination.tsx`.
- `Modal/Dialog`, `Drawer/Sidepanel` voor details en bevestigingen.
- `Toast/Notification` voor save/import feedback.
- `Tooltip` voor icon buttons en risk labels.
- `Command/Quick search` op termijn voor klanten, projecten, offertes en catalogus.

### Dubbele patronen

- Meerdere componenten bouwen eigen loading/error/empty messages.
- Meerdere tabellen hebben dezelfde table markup.
- Formulieren herhalen field/label/input structuur.
- Statussen worden soms als gewone badge getoond en soms via `ProjectStatusBadge`.
- Page headers worden in elke Astro pagina herhaald.
- Toolbar layout wordt overal met `.toolbar` plus inline styles aangepast.

## Component inventory

| Map | Componenten | Observatie |
| --- | --- | --- |
| `layout` | `PortalLayout`, `Sidebar` | Goede basis, mist topbar/breadcrumb/active nav |
| `dashboard` | `DashboardShell` | Metrics en pipeline, nog weinig actionable readiness/alerts |
| `customers` | `CustomerWorkspace`, `CustomerForm`, `CustomerList`, `CustomerDetail` | Functioneel, mist search/filter/timeline/detailstructuur |
| `projects` | `ProjectWorkspace`, `ProjectForm`, `ProjectDetail`, `ProjectStatusBadge` | Workflow aanwezig, UX nog te knopmatig en niet als proces zichtbaar |
| `quotes` | `QuoteWorkspace`, `QuoteBuilder`, `QuoteLineEditor`, `QuoteTotals` | Basisflow aanwezig, builder mist winkel-ergonomie |
| `catalog` | `ProductList`, `ProductSearch`, `CatalogDataIssues` | Catalogus werkt, maar heeft echte DataTable/filtering nodig |
| `imports` | `ImportPreview`, `ImportProfiles`, `ProductionReadiness`, `ImportWarnings` | Sterk functioneel, zwaarste UI-complexiteit in codebase |
| `settings` | categorieen, werkzaamheden, templates | Simpele lijsten, geen gedeeld settings layout |
| `suppliers` | `SupplierWorkspace` | Basis CRUD, mist leveranciersdossier/statusflow |

Gemeten patronen in componenten:

- 10 tabellen.
- 8 formulieren.
- Circa 47 inline style occurrences.
- Geen `src/components/ui` map.
- Geen generieke DataTable of form field componenten.

## Pagina/module analyse

### Dashboard

Sterk:
- Duidelijke metrics voor klanten, projecten, offertes, catalogus.
- Pipeline sectie geeft actieve projecten.

Risico:
- Niet direct duidelijk wat vandaag actie nodig heeft.
- Importstatus is een enkele badge, niet gekoppeld aan production readiness of blokkades.
- Geen quick actions zoals nieuwe klant, nieuw project, nieuwe offerte, import review.

Verbetering:
- Maak dashboard operationeel: `Vandaag`, `Open acties`, `Blocked imports`, `Offertes opvolgen`, `Inmeten gepland`.
- Zet production readiness als compacte waarschuwing wanneer BLOCKED.

### Klanten

Sterk:
- Klant aanmaken en lijst staan naast elkaar.
- Klantdetail toont basisgegevens, projecten en contact/uitgeleend.

Risico:
- Geen zoeken/filteren in klantenlijst.
- Contactmomenten zijn cards zonder datum, typekleur, zichtbaarheid of timeline.
- Uitgeleende items missen expected return/returned status in UI.

Verbetering:
- Customer list als DataTable met search en status/type filters.
- Customer detail als dossier: profielpaneel, projecten, tijdlijn, uitgeleend, interne notities.

### Projecten

Sterk:
- Projecten zijn gekoppeld aan klanten.
- Projectdetail ondersteunt ruimtes en workflow events.

Risico:
- Workflow is geen duidelijke statusrail of checklist.
- Statusovergangen zijn losse buttons.
- Interne en klantzichtbare notities zijn nog niet visueel gescheiden.
- Planning/inmeetmoment/uitvoering zijn niet als datums/agenda zichtbaar.

Verbetering:
- Project detail met workflow rail: lead, offerte, inmeten, bestellen, uitvoeren, factuur, betaald, gesloten.
- Split notes in `Intern` en `Op offerte/klantzichtbaar`.

### Offertes

Sterk:
- Offerte aanmaken, selecteren, regels toevoegen en totalen berekenen werkt.
- Regeltypes zijn in data aanwezig.

Risico:
- Builder is nog te technisch voor winkelgebruik naast een klant.
- Product/service/labor/material/text/manual zijn alleen tekstbadges.
- Totalen zijn niet sticky.
- Geen cataloguszoeker/product picker in de offertebuilder.
- Btw-modus en prijs herkomst zijn niet zichtbaar.

Verbetering:
- Builder als workbench: links offerte/ruimtes, midden regels, rechts sticky totalen/voorwaarden.
- Regeltype templates met iconen en vooringevulde labels.
- Product picker via drawer.

### Catalogus

Sterk:
- Live Convex catalogus, zoeken en categorie filter.
- Toont leverancier, categorie, labels, unit en prijs.

Risico:
- 7.775 producten vragen om server-side filters op leverancier, category, productKind, status en prijsbron.
- Geen pagination, alleen `Meer laden`.
- Prijsdetails zijn plat: geen priceType/vatMode/sourceFile inzicht.
- Mobiele tabel wordt snel onbruikbaar.

Verbetering:
- DataTable met server-side filtering en paginering.
- Detaildrawer voor productprijzen, bronbestanden, commercial names.

### Imports

Sterk:
- Import batches, detail, counters en commit-flow bestaan.
- Production readiness is zichtbaar.

Risico:
- Veel counters zonder duidelijke prioriteit.
- Batchdetail toont rows maar geen filter op rowKind/status.
- Create batch form bevat hardcoded sourceFiles en supplier field.

Verbetering:
- Imports als audit-dashboard: laatste run, blokkades, batches, row errors.
- Batchdetail met tabs: summary, rows, warnings/errors, reconciliation.

### Importprofielen / VAT review

Sterk:
- Toont 54 unresolved mappings.
- Filters en bulkacties zijn toegevoegd.
- Production readiness maakt duidelijk waarom import BLOCKED is.

Risico:
- Bulkactie `inclusive`/`exclusive` is risicovol en vraagt bevestiging.
- Reason teksten zijn lang in tabellen.
- `allowUnknownVatMode` moet visueel als uitzondering/risico voelen.

Verbetering:
- Confirmation modal voor bulk VAT mapping.
- Groepeer kolommen per profiel met compacte summary.
- Toon risk banner bij `allowUnknownVatMode=true`.

### Catalog data issues

Sterk:
- Duplicate-EAN issues zijn apart zichtbaar.
- Beslissingen en notities worden opgeslagen.
- Geen automatische merge.

Risico:
- Grote tekstblokken in tabelcellen maken scanning zwaar.
- Productvergelijking is beter als side-by-side compare card of drawer.
- Statusbeslissing mist uitleg bij keuzes.

Verbetering:
- Maak duplicate issue cards met product comparison.
- Voeg decision help text toe.
- Filter op open/reviewed/resolved/supplier.

## Data-heavy UI analyse

De applicatie heeft meerdere zware datasets:

- Catalogus: 7.775 actieve producten.
- Prijsregels: 13.015.
- Import preview rows: 10.691.
- Product rows: 10.291.
- VAT mapping columns: 55.
- Duplicate EAN issues: 25 groepen.

Huidige aanpak:

- Catalogus gebruikt limit en `Meer laden`.
- Import batch rows worden beperkt tot 300 in detailquery.
- ImportPreview toont max 80 rows lokaal.
- Veel filtering is client-side binnen geladen data.
- Tabellen zijn gewone HTML tables zonder generiek pagination/filter/sort pattern.

Aanbevolen DataTable standaard:

- Server-side `query`, `filters`, `sort`, `limit`, `cursor`.
- Sticky header en compacte density.
- Kolomconfig met `key`, `label`, `width`, `priority`, `hideOnMobile`.
- Loading skeleton, empty state en error state.
- Row actions en detail drawer.
- FilterBar boven tabel.
- Saved views op termijn voor imports/catalogus.

Prioriteit voor DataTable:

1. Catalogus.
2. Import batches.
3. Product import rows.
4. VAT mapping review.
5. Duplicate-EAN data issues.
6. Klanten/projecten/offertes lijsten.

## Accessibility analyse

Sterk:

- Formulieren gebruiken meestal labels met `htmlFor`.
- Tabellijsten gebruiken semantische `<table>`, `<thead>`, `<tbody>`.
- Iconen hebben vaak `aria-hidden="true"`.
- Buttons zijn echte `<button>` elementen.

Verbeterpunten:

- Focus states zijn beperkt. `.nav-link` heeft focus-visible, maar `.button`, `.tab`, inputs en selects hebben geen duidelijke focusring.
- Status wordt vaak alleen via kleur aangegeven. Voeg tekst/icoonvarianten en aria labels toe.
- Empty/error/loading states delen dezelfde `.empty-state`, waardoor foutmeldingen niet visueel/semantisch genoeg verschillen.
- Icon-only buttons hebben soms `title`, maar geen expliciet `aria-label`.
- Bulkacties hebben geen confirm dialog of aria-live feedback.
- Tab controls gebruiken buttons met styling, maar geen `role="tablist"`/`aria-selected`.
- Lange tabellen hebben geen responsive of accessible summaries.
- Disabled states zijn niet apart gestyled.
- Contrast lijkt grotendeels voldoende, maar `--muted` op warme achtergronden moet worden doorgemeten voor kleine tekst.

Concrete accessibility fixes:

1. Globale `:focus-visible` ring voor buttons, links, inputs, selects, textareas.
2. `Alert` component met `role="alert"` voor errors.
3. `LoadingState` met `aria-live="polite"`.
4. `IconButton` verplicht `aria-label`.
5. `StatusBadge` met tekstlabel en niet alleen kleur.
6. Confirm dialog voor bulk VAT changes.
7. Tabellen voorzien van captions of `aria-label` waar context niet vanzelf spreekt.

## Designrichting voorstel

Gewenste uitstraling:

- Warm neutral, professioneel en rustig.
- Dagelijks bruikbaar, niet marketingachtig.
- Interieur/wonen passend zonder decoratieve overdaad.
- Duidelijke datahierarchie, weinig visuele ruis.
- Compact genoeg voor backoffice, maar niet benauwd.

Huidige stijl past deels al:

- Achtergrond `#f5f2ec`, surface `#fffdf8` en dark sidebar passen bij warm/interieur.
- Accent brons/amber past bij Henke Wonen.
- Radius 8px is goed voor backoffice.

Bijsturen:

- Minder overal cards; meer full-width panels en data surfaces.
- Shadows subtieler en consistenter.
- Badgekleuren iets gedempter en met betere borders.
- Typography schaal strakker: dashboard headings niet te groot in compacte panels.
- Meer structuur via section headers, dividers en sticky action bars.

## Design tokens voorstel

### Kleuren

```css
:root {
  --color-bg: #f6f2ea;
  --color-bg-subtle: #efe7da;
  --color-surface: #fffdf8;
  --color-surface-raised: #ffffff;
  --color-surface-muted: #f1eadf;

  --color-text: #211f1c;
  --color-text-muted: #6d655b;
  --color-text-subtle: #8a8073;

  --color-border: #d8d0c3;
  --color-border-strong: #bfb3a2;

  --color-accent: #9a5f1b;
  --color-accent-strong: #7a4310;
  --color-accent-soft: #f4e6cf;

  --color-success: #166534;
  --color-success-bg: #dcfce7;
  --color-warning: #9a6507;
  --color-warning-bg: #fef3c7;
  --color-danger: #b91c1c;
  --color-danger-bg: #fee2e2;
  --color-info: #1d4e89;
  --color-info-bg: #dbeafe;
}
```

### Spacing

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

### Radius

```css
--radius-xs: 4px;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
```

Cards blijven bij voorkeur `8px`; modals/drawers mogen `12px`.

### Shadows

```css
--shadow-xs: 0 1px 2px rgba(31, 26, 18, 0.06);
--shadow-sm: 0 6px 16px rgba(31, 26, 18, 0.06);
--shadow-md: 0 14px 32px rgba(31, 26, 18, 0.10);
```

### Typography

```css
--font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-md: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.35rem;
--text-2xl: 1.75rem;
--text-3xl: 2.25rem;
--line-tight: 1.15;
--line-normal: 1.5;
```

### Status badge varianten

- `neutral`: concept, onbekend, draft.
- `info`: preview, mapped, planned.
- `success`: accepted, imported, paid, active, ready.
- `warning`: needs_mapping, blocked, review, overdue soon.
- `danger`: failed, rejected, error, cancelled.

## Componentarchitectuur voorstel

### Generiek UI

Nieuwe map:

```txt
src/components/ui/
  Alert.tsx
  Badge.tsx
  Button.tsx
  Card.tsx
  Checkbox.tsx
  DataTable.tsx
  Drawer.tsx
  EmptyState.tsx
  Field.tsx
  FilterBar.tsx
  IconButton.tsx
  Input.tsx
  LoadingState.tsx
  Modal.tsx
  PageHeader.tsx
  Pagination.tsx
  SearchInput.tsx
  Select.tsx
  StatCard.tsx
  StatusBadge.tsx
  Tabs.tsx
  Textarea.tsx
  Tooltip.tsx
```

### Layout

```txt
src/components/layout/
  PortalLayout.astro
  PortalShell.tsx
  Sidebar.tsx
  Topbar.tsx
  Breadcrumbs.tsx
```

### Domeinspecifiek houden

- `customers/*`: klantdossier, contactmomenten, uitgeleend.
- `projects/*`: workflow, ruimtes, planning.
- `quotes/*`: quote builder, line editor, totals.
- `catalog/*`: product search, product details, data issues.
- `imports/*`: production readiness, import batches, VAT mapping.
- `settings/*`: instellingen per domein.

### Eerst bouwen

1. `Button`, `Badge`, `StatusBadge`, `Field`, `Input`, `Select`, `Textarea`, `Checkbox`.
2. `PageHeader`, `Alert`, `EmptyState`, `LoadingState`, `StatCard`.
3. `DataTable`, `FilterBar`, `Pagination`, `SearchInput`.
4. `Modal`, `Drawer`, `Tabs`, `Tooltip`.
5. `PortalShell`, `Topbar`, `Breadcrumbs`.

## Gefaseerd implementatieplan

### Fase 1: design tokens en basis UI componenten

Doel:
- Tokens formaliseren en CSS classes vervangen door kleine herbruikbare componenten.

Bestanden:
- `src/styles/global.css`
- `src/components/ui/Button.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Field.tsx`
- `src/components/ui/Alert.tsx`
- `src/components/ui/EmptyState.tsx`

Risico:
- Lage technische risico's, maar veel kleine class-migraties.

Impact:
- Hoog. Verbetert consistentie in alle modules.

Acceptatiecriteria:
- Geen regressie in `npm run check`/`build`.
- Alle knoppen hebben consistente focus/disabled/loading states.
- Errors gebruiken `Alert`, niet generieke empty state.

### Fase 2: portal shell, navigatie en page headers

Doel:
- Navigatiecontext en paginaopbouw professioneel maken.

Bestanden:
- `src/components/layout/PortalLayout.astro`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Topbar.tsx`
- `src/components/layout/Breadcrumbs.tsx`
- `src/components/ui/PageHeader.tsx`

Risico:
- Middel. Layout raakt alle pagina's.

Impact:
- Hoog. De app voelt meteen samenhangender.

Acceptatiecriteria:
- Actieve sidebar state.
- Breadcrumbs op detailpagina's.
- Page actions consistent rechts in header.
- Mobiele navigatie bruikbaar.

### Fase 3: DataTable, filter en search patterns

Doel:
- Grote datasets beheersbaar maken.

Bestanden:
- `src/components/ui/DataTable.tsx`
- `src/components/ui/FilterBar.tsx`
- `src/components/ui/Pagination.tsx`
- `src/components/ui/SearchInput.tsx`
- `convex/catalog.ts`, `convex/imports.ts`, relevante portal queries waar server-side paging nodig is.

Risico:
- Middel tot hoog. Query-contracten kunnen wijzigen.

Impact:
- Zeer hoog voor catalogus/imports.

Acceptatiecriteria:
- Catalogus heeft server-side search/filter/pagination.
- Import rows hebben rowKind/status filters.
- Tabellen hebben loading, empty, error en responsive behavior.

### Fase 4: imports/importprofielen/data-issues polish

Doel:
- Productie-vrijgave flow veilig en scanbaar maken.

Bestanden:
- `src/components/imports/ProductionReadiness.tsx`
- `src/components/imports/ImportProfiles.tsx`
- `src/components/imports/ImportPreview.tsx`
- `src/components/catalog/CatalogDataIssues.tsx`

Risico:
- Middel. Bulkacties moeten veilig blijven.

Impact:
- Hoog voor productiegebruik.

Acceptatiecriteria:
- BLOCKED/READY status is in 3 seconden duidelijk.
- Bulk VAT mapping vraagt bevestiging.
- Duplicate-EAN review heeft filters en compacte productvergelijking.
- Geen auto-merge.

### Fase 5: klanten/projecten/offertes UX polish

Doel:
- Dagelijkse backoffice workflows ergonomisch maken.

Bestanden:
- `src/components/customers/*`
- `src/components/projects/*`
- `src/components/quotes/*`

Risico:
- Middel. Domeinflows worden intensiever.

Impact:
- Hoog voor winkelgebruik.

Acceptatiecriteria:
- Klantdossier heeft tijdlijn/contact/uitgeleend overzicht.
- Projectdetail heeft workflow rail.
- Offertebuilder heeft sticky totalen, duidelijke regeltypes en product picker.

### Fase 6: responsive en accessibility pass

Doel:
- App betrouwbaar maken op laptop/tablet/mobiel en keyboard.

Bestanden:
- Alle UI components.
- `global.css`
- Data-heavy modules.

Risico:
- Laag tot middel.

Impact:
- Middel tot hoog.

Acceptatiecriteria:
- Keyboard focus overal zichtbaar.
- Alle icon-only buttons hebben aria-label.
- Tables hebben mobile pattern.
- Error/loading states zijn semantisch.
- Contrast gecontroleerd voor muted text en badges.

## Concrete acceptatiecriteria totaal

- `src/components/ui` bestaat met basiscomponenten.
- Geen nieuwe inline layout styles voor standaard spacing.
- Alle portalpagina's gebruiken een gedeelde `PageHeader`.
- Sidebar toont actieve route.
- Data-heavy tabellen gebruiken `DataTable`.
- Catalogus en imports hebben server-side pagination/filtering.
- Errors gebruiken `Alert`, loading gebruikt `LoadingState`, lege lijsten gebruiken `EmptyState`.
- Bulk VAT mapping gebruikt confirmation dialog.
- Duplicate-EAN review blijft review-only en merge-vrij.
- `npm run check` en `npm run build` blijven groen.

## Kleine veilige fixes uitgevoerd

Geen. Deze audit heeft alleen documentatie toegevoegd.
