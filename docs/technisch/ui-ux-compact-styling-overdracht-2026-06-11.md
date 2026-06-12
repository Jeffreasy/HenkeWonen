# UI/UX compact styling overdracht - 2026-06-11

Dit document legt vast welke UI/UX-aanpassingen in deze workspace zitten rond kleinere
typografie, compactere knoppen, cards/panels en offerte/klantdossier-layout. Doel:
op een andere laptop of branch gericht kunnen overnemen zonder per ongeluk functionele
Convex- of productie-wijzigingen mee te trekken.

## Bron

- Branch: `codex/dossier-customer-flow`
- Remote: `origin/codex/dossier-customer-flow`
- Basis ter vergelijking: `origin/main` op `f6da311`
- Relevante commits:
  - `71dfdb7 Release dossier customer flow`
  - `6c1af46 Add Vercel upload guardrails`

Let op: `71dfdb7` bevat zowel styling als functionele klant/dossier-flow. Niet blind
cherry-picken als de laptopbranch functioneel verder is.

## Wat er visueel is geoptimaliseerd

### 1. Globale typografie

Bestand: `src/styles/layers/01-tokens.css`

Belangrijkste wijziging: de font-schaal is compacter gemaakt en de body gebruikt nu
expliciet de compacte basismaat.

- `--text-md`: `0.9375rem`
- `--text-lg`: `1.0625rem`
- `--text-xl`: `1.125rem`
- `--text-2xl`: `1.375rem`
- `--text-3xl`: `1.75rem`
- `--line-normal`: `1.42`
- `body`: `font-size: var(--text-md)` en `line-height: var(--line-normal)`

Dit is de basis waardoor schermen meer lucht krijgen zonder dat alles als losse
componentfix voelt.

### 2. Portal-layout en navigatie

Bestand: `src/styles/layers/02-portal-layout.css`

De sidebar, breadcrumbs en brand/header-elementen zijn minder zwaar gemaakt.
Vooral relevant:

- nav-items lagere min-height;
- minder zware font-weights;
- kleinere brand title;
- minder nadrukkelijke letter spacing.

Als deze laag mist, voelt de app op de laptop direct grover, zelfs als de contentcards
wel zijn meegenomen.

### 3. Page headers, section headers en dashboardcards

Bestand: `src/styles/layers/03-utilities.css`

Hier zitten de kleinere h1/h2-stijlen en compactere dashboard spacing.

- `.page-header h1` en `.section-title` zijn kleiner gezet.
- `.ui-page-header h1` is kleiner gezet.
- `.ui-section-header h2` gebruikt een kleinere token.
- dashboard focus/work cards hebben minder padding, minder gap en lagere min-height.

Deze laag is belangrijk voor het gevoel dat de hele portal rustiger en professioneler
is geworden.

### 4. Knoppen, badges en stat cards

Bestand: `src/styles/layers/06-ui-components.css`

Dit is de belangrijkste laag voor de klacht "buttons zijn te groot".

- `.ui-button`: lagere min-height, minder horizontale padding, font-weight van `700`
  naar `650`.
- `.ui-button-sm`: van grotere knop naar ongeveer `34px` hoog op desktop.
- `.ui-button-md`: rond `38px`.
- `.ui-button-lg`: rond `42px`.
- icon-buttons ook compacter.
- `@media (pointer: coarse)` houdt touch targets groter op touch devices.
- stat cards zijn compacter gemaakt qua min-height, padding en typografie.

Zonder deze laag vallen de knoppen op de laptop weer fors uit.

### 5. Dossieracties, intake-openklap en calculators

Bestand: `src/styles/layers/04-features-field.css`

Toegevoegd/aangepast:

- `.dossier-action-card`
- `.customer-scope-list`
- `.customer-scope-disclosure`
- `.customer-scope-content`
- compactere metrics;
- compactere calculator tabs;
- compactere calculator body/input/result spacing;
- responsive form action rows.

Dit hoort bij de klantfeedback-flow: productgroepen openklappen, dan meten/calculators.

### 6. Klantdossier detail-layout

Bestand: `src/styles/layers/13-features-projects.css`

Dit is de laag die de screenshots met te grote/oranje knoppen en lege-state cards
netjeser maakt.

Belangrijkste selectors:

- `.customer-overview-grid`
- `.customer-support-grid`
- `.customer-detail-panel`
- `.customer-detail-action-bar`
- `.customer-detail-action-button`
- `.customer-danger-action`
- `.customer-projects-panel`
- `.dossier-attachments-panel`
- `.dossier-attachment-form`
- `.dossier-attachment-card`

Effect:

- actieknoppen in klantpanelen worden veel kleiner;
- "Archiveren" is geen zware rode knop meer, maar een rustige danger-ghost action;
- empty states in klantpanelen krijgen minder zware nested-card uitstraling;
- projecten/dossierstukken/contactmomenten staan strakker;
- brede klantdetail-layout klapt pas bij ongeveer `1180px` naar een kolom.

### 7. Offerte-layout

Bestand: `src/styles/layers/14-features-quotes.css`

Deze laag is noodzakelijk voor de offertepagina die eerder "absoluut niet goed" ging.

Belangrijkste selectors:

- `.quote-detail-workspace`
- `.quote-workbench`
- `.quote-summary-panel`
- `.quote-status-actions`
- `.quote-line-list`
- `.quote-line-card`
- `.quote-line-card-values`

Effect:

- offerte-detail is losgetrokken van het overzicht;
- builder gebruikt een rustige full-width werkruimte;
- summary/totals zijn compacter;
- offerteposten worden als cards weergegeven in plaats van een te krappe tabel;
- responsive gedrag rond `920px` is toegevoegd.

### 8. Quick action/FAB

Bestand: `src/styles/layers/07-overlays.css`

De zwevende quick action-knop en menu-items zijn compacter gemaakt:

- lagere min-height;
- kleinere icon-pill;
- kleinere afstand tot viewport-rand;
- subtielere shadows;
- kleinere labels.

## Styling-only bestandenset

Voor een eerste laptop-overname zonder functionele logica is dit de kernset:

```text
src/styles/layers/01-tokens.css
src/styles/layers/02-portal-layout.css
src/styles/layers/03-utilities.css
src/styles/layers/04-features-field.css
src/styles/layers/06-ui-components.css
src/styles/layers/07-overlays.css
src/styles/layers/13-features-projects.css
src/styles/layers/14-features-quotes.css
src/styles/layers/16-responsive.css
```

Maar: CSS-only is niet altijd genoeg. Sommige styling hangt aan classes die in
componenten zijn toegevoegd.

## Componenten die de styling activeren

Minimaal relevant voor klantdetail/dossier UI:

```text
src/components/customers/ContactListTable.tsx
src/components/customers/CustomerInfoPanel.tsx
src/components/customers/CustomerProjectsTable.tsx
src/components/customers/LoanedItemsList.tsx
src/components/customers/CustomerDetail.tsx
src/components/customers/CustomerIntakePanel.tsx
src/components/customers/CustomerDossierAttachmentsPanel.tsx
src/components/dossiers/DossierActions.tsx
src/components/dossiers/DossierWorkspace.tsx
```

Relevant voor klant aanmaken/project starten/meten:

```text
src/components/customers/CustomerForm.tsx
src/components/projects/ProjectForm.tsx
src/components/projects/MeasurementPanel.tsx
```

Relevant voor offerte-layout:

```text
src/components/quotes/QuoteBuilder.tsx
src/components/quotes/QuoteWorkspace.tsx
```

Waarom dit uitmaakt:

- `CustomerInfoPanel` gebruikt nu `customer-detail-panel`,
  `customer-detail-action-bar`, `customer-detail-action-button` en `customer-danger-action`.
- `ContactListTable` en `CustomerProjectsTable` gebruiken dezelfde compacte panel/actions.
- `QuoteBuilder` introduceert `quote-line-card`.
- `QuoteWorkspace` maakt een echte detailroute voor `/portal/offertes/:id`.
- `DossierActions` opent klant vastleggen direct in een modal in plaats van via de oude
  tussenstap.

## Functionele stukken die niet puur styling zijn

Deze wijzigingen zijn nuttig, maar raken gedrag en/of Convex:

- klant direct vastleggen vanuit dossiers;
- na opslaan naar klantdossier;
- project aanmaken vanuit klantdossier;
- productgroep-intake met PVC/ramen/plinten/tapijt/vinyl/behang/raambekleding/gordijnen;
- `?meet=` context naar het meetpaneel;
- dossierstukken/upload/legacy-bestanden;
- Convex schema/functies voor `dossierAttachments`.

Voor styling overnemen op een laptop die al functioneel verder is: deze niet automatisch
meenemen tenzij die flow daar ook ontbreekt.

## Aanpak voor laptop die functioneel verder is

Maak eerst een aparte backup/branch op de laptop:

```powershell
git status --short --branch
git switch -c codex/backup-voor-compact-ui
git switch <jouw-laptop-werkbranch>
git fetch origin
```

Maak daarna liever patches dan een blind cherry-pick.

Styling-only patch maken:

```powershell
git diff origin/main...origin/codex/dossier-customer-flow -- `
  src/styles/layers/01-tokens.css `
  src/styles/layers/02-portal-layout.css `
  src/styles/layers/03-utilities.css `
  src/styles/layers/04-features-field.css `
  src/styles/layers/06-ui-components.css `
  src/styles/layers/07-overlays.css `
  src/styles/layers/13-features-projects.css `
  src/styles/layers/14-features-quotes.css `
  src/styles/layers/16-responsive.css `
  > compact-ui-styling.patch
```

Toepassen op laptop:

```powershell
git apply --3way compact-ui-styling.patch
```

Als klantdetail/offerte nog visueel afwijkt, maak een tweede patch met componentclasses:

```powershell
git diff origin/main...origin/codex/dossier-customer-flow -- `
  src/components/customers/ContactListTable.tsx `
  src/components/customers/CustomerInfoPanel.tsx `
  src/components/customers/CustomerProjectsTable.tsx `
  src/components/customers/LoanedItemsList.tsx `
  src/components/quotes/QuoteBuilder.tsx `
  src/components/quotes/QuoteWorkspace.tsx `
  > compact-ui-components.patch

git apply --3way compact-ui-components.patch
```

Neem de volledige klant/dossier-flow pas mee als de laptop die flow nog mist:

```powershell
git diff origin/main...origin/codex/dossier-customer-flow -- `
  src/components/customers `
  src/components/dossiers `
  src/components/projects/MeasurementPanel.tsx `
  src/components/projects/ProjectForm.tsx `
  src/lib/portalTypes.ts `
  convex `
  > dossier-customer-flow.patch
```

## Controle na overname

Run lokaal:

```powershell
npm run check
npm test
```

Visueel controleren:

- `/portal`
- `/portal/dossiers`
- `/portal/klanten/<id>`
- `/portal/projecten/<id>?meet=flooring#project-measurement`
- `/portal/offertes`
- `/portal/offertes/<id>`

Specifiek letten op:

- knoppen in klantdetail niet te hoog/breed;
- "Toevoegen" in contactmomenten/dossierstukken rustig secundair, niet zwaar oranje;
- "Archiveren" rustig danger-ghost;
- empty states niet als dikke nested cards;
- offerte detailpagina full-width en niet in rommelige overzicht/detail-mix;
- mobiel/touch behoudt bruikbare touch targets.

## Productie/Convex waarschuwing

Voor alleen styling is geen Convex-deploy nodig.

Convex is pas relevant als je dossierstukken/upload of schemawijzigingen meeneemt. Dan
moet `convex/schema.ts`, `convex/dossiers/attachments.ts`, `convex/portal.ts`,
`convex/portalUtils.ts` en gegenereerde API consistent zijn met de frontend. Niet mengen
met productie-data zonder bewuste releasecheck.

Kort: voor de laptop eerst styling + class-activerende componenten overnemen. Pas daarna
functionele klant/dossier/Convex-stukken beoordelen.