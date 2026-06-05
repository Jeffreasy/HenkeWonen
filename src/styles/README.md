# CSS Architectuur — `src/styles/`

Gelaagde CSS-architectuur voor het Henke Wonen portal. Alle stijlen zijn georganiseerd in genummerde layers die via `global.css` worden geïmporteerd.

## Import-volgorde (`global.css`)

```
00-keyframes.css       Animatie-definities
00-tokens.css          Design tokens (kleuren, spacing, typografie)
01-portal-layout.css   Portal shell, sidebar, header
03-utilities.css       Herbruikbare utility-klassen
04-ui-components.css   Generieke UI-componenten
05-overlays.css        Modals, drawers, toasts
06-legacy-ui.css       Verouderde stijlen (afbouwen)
06-shared.css          Gedeelde klassen zonder domeindependency
07-features-imports.css Feature-specifieke CSS (imports)
07-vat-workbench.css   BTW-workbench specifieke stijlen
```

> [!IMPORTANT]
> Nummering is intentioneel — voeg een nieuwe layer altijd in op het juiste nummer.
> Wijzig nooit de volgorde van bestaande layers zonder de hele cascade te controleren.

## Design tokens (`00-tokens.css`)

Alle kleuren, spacing en typografie staan als CSS custom properties op `:root`:

```css
/* Primaire kleur */
--color-primary: ...
--color-primary-hover: ...

/* Spacing */
--space-xs: ...
--space-sm: ...
--space-md: ...

/* Typografie */
--font-body: ...
--font-mono: ...
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
| Generieke UI | `src/components/ui/` (eigen CSS-in-TSX of module) |
| Portal layout | `src/styles/layers/01-portal-layout.css` |
| Feature-stijlen | `src/styles/layers/07-features-*.css` |
