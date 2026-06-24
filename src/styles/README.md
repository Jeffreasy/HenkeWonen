# CSS Architectuur — `src/styles/`

Gelaagde CSS-architectuur voor het Henke Wonen portal. Alle stijlen zijn georganiseerd in genummerde layers die via `global.css` worden geïmporteerd.

## Import-volgorde (`global.css`)

```
01-tokens.css            Design tokens (kleuren, spacing, typografie)
02-portal-layout.css     Portal shell, sidebar, header
03-utilities.css         Herbruikbare utility-klassen
04-features-field.css    Buitendienst pages en calc-tabs
05-legacy-ui.css         Verouderde stijlen (afbouwen)
06-ui-components.css     Generieke UI-componenten
07-overlays.css          Modals, skeletons, toasts
08-shared.css            Gedeelde klassen zonder domeindependency
09-features-vat.css      BTW-workbench specifieke stijlen
10-features-catalog.css  Catalogus-workbench
11-features-imports.css  Import batch-workbench
12-timeline.css          Timeline en workflow rail
13-features-projects.css Projecten en dossiers
14-features-quotes.css   Offertes en calculators
15-features-agenda.css   Agenda en monteur-beschikbaarheid
16-keyframes.css         Animatie-definities
17-responsive.css        Responsive breakpoints
18-print.css             Printstijlen
```

> [!IMPORTANT]
> Nummering is intentioneel — voeg een nieuwe layer altijd in op het juiste nummer.
> Wijzig nooit de volgorde van bestaande layers zonder de hele cascade te controleren.

## Design tokens (`01-tokens.css`)

Alle kleuren, spacing en typografie staan als CSS custom properties op `:root`:

```css
/* Accentkleur (primaire knop) */
--color-accent: ...
--color-accent-strong: ...
--color-accent-hover: ...

/* Spacing (genummerde schaal) */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
/* … t/m --space-10 */

/* Typografie */
--font-sans: ...
--text-sm: ...
--text-md: ...
```

Gebruik altijd tokens — nooit hardcoded kleuren of spacing in component-stijlen.

## Guardrails

- Geen business logic in CSS-layers (geen prijs-, btw- of offerteberekeningen)
- Statussen tonen altijd **tekst**, niet alleen kleur (toegankelijkheid)
- Nederlandse UI-copy is de standaard
- Geen redesigns zonder modulegerichte onderbouwing
- Geen inline styles voor lay-out — altijd via utility-klassen of component-stijlen

## Component-stijlen

Domeinspecifieke stijlen horen **niet** in `src/styles/` — die staan bij het domeincomponent:

| Domein | Locatie |
| --- | --- |
| Generieke UI | `src/components/ui/` (consumeert het `ui-*`-systeem uit `06-ui-components.css`) |
| Portal layout | `src/styles/layers/02-portal-layout.css` |
| Feature-stijlen | `src/styles/layers/04-features-field.css`, `09-features-vat.css`, `10-features-catalog.css`, `11-features-imports.css`, `13-features-projects.css`, `14-features-quotes.css` |
