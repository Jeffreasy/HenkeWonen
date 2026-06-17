<!--
  PR-titel in Conventional Commits-stijl: type(scope): onderwerp
  bijv. fix(facturen): voorkom dubbele factuur per offerte
  CodeRabbit reviewt automatisch. Stuur de bot met: @coderabbitai help
-->

## Wat & waarom

<!-- Korte beschrijving van de wijziging en de aanleiding. Link het issue: Closes #... -->

## Type wijziging

- [ ] `fix` — bugfix
- [ ] `feat` — nieuwe functionaliteit
- [ ] `refactor` — geen functionele wijziging
- [ ] `docs` — alleen documentatie
- [ ] `chore` / `ci` — tooling, build, pipeline
- [ ] `test` — alleen tests

## Domein-impact (vink aan wat van toepassing is)

- [ ] **Tenant-isolatie** — elke nieuwe/gewijzigde Convex-functie scoped op `tenantId` via index, met authz-guard als eerste statement.
- [ ] **Financieel** — bedragen/BTW via `money.ts` / `calculateLineTotals`; totalen server-side herberekend; afronding via `roundMoney`.
- [ ] **Winkel/Buitendienst** — `workspaceMode` ('general'/'field')-grenzen gerespecteerd (facturen geblokkeerd in 'field').
- [ ] **Destructief / productie** — `--apply`/`--production`-guards, confirm-literal, admin-rol en tenant-scope intact; `seed/demo` raakt nooit prod.
- [ ] **Secrets / PII** — geen credentials, tokens of klant-PII in de diff; niets gevoeligs nieuw client-side.
- [ ] **Schema** — nieuwe tabellen hebben `tenantId` + by_tenant-index; migratie meegeleverd indien breaking.
- [ ] **i18n / UX** — gebruikersgerichte teksten in het Nederlands via `src/lib/i18n/*`.
- [ ] Geen van bovenstaande van toepassing.

## Tests

<!-- Welke tests draaiden? `npm run check && npm run lint && npm run test` -->

- [ ] `npm run check` (TypeScript + Astro)
- [ ] `npm run lint`
- [ ] `npm run test` (portal + convex)
- [ ] Nieuwe rekenregels / endpoints hebben dekkende unit-tests.

## Documentatie

- [ ] Relevante module-README / `docs/` meegewijzigd (of n.v.t.).

## Screenshots / opmerkingen

<!-- Optioneel: UI-screenshots (Winkel en/of Buitendienst), of context voor de reviewer. -->
