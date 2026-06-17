# CodeRabbit — bedien-handleiding (Henke Wonen)

> Automatische AI-code-review op elke pull request, afgestemd op de architectuur
> van dit portaal. Configuratie staat in [`.coderabbit.yaml`](../../.coderabbit.yaml)
> (root). Dit document beschrijft hóe we CodeRabbit hier inzetten, het rollout-plan
> en de commando's.

## 1. Wat CodeRabbit hier doet

CodeRabbit reviewt automatisch elke PR naar `main`/`master` in het Nederlands en
is ingericht op onze vier risicogebieden:

| Gebied | Wat de bot bewaakt |
| --- | --- |
| **Multi-tenant security** | Authz-guard als eerste statement, `tenantId`-scoping via index, geen secret-/PII-lek (`convex/**`, `authz.ts`, `src/lib/auth`, API-routes, middleware). |
| **Financieel** | Server-side herberekening van totalen, BTW/afronding via de centrale helpers, Winkel/Buitendienst-grenzen (`facturen`, `offertes`, `money.ts`, calculators). |
| **Catalogus & destructieve tooling** | Confirm-literals, admin-rol, dry-run-defaults en productie-guards bij `tools/**`, `clearTenantData`, `seed`, migraties. |
| **Frontend & conventies** | React-hooks-regels, rol-gating in de UI, Nederlandse i18n, geen geheimen client-side. |

De volledige pad-instructies staan in `reviews.path_instructions` in de config en
spiegelen [`.github/CODEOWNERS`](../../.github/CODEOWNERS).

## 2. De bestanden

| Bestand | Functie |
| --- | --- |
| `.coderabbit.yaml` | Hoofdconfig — review-gedrag, pad-instructies, pre-merge checks, tools, kennisbank. Bevat een `$schema`-regel voor editor-validatie. |
| `.github/CODEOWNERS` | Wie een PR moet goedkeuren; nodig om de merge-gate hard te maken. |
| `.github/pull_request_template.md` | Gestructureerd PR-sjabloon met domein-impact-checklist. |

## 3. De merge-gate

CodeRabbit's gate werkt in lagen:

1. **`request_changes_workflow: true`** — de bot zet de PR op *"changes requested"*
   tot zijn opmerkingen zijn opgelost en geen `pre_merge_checks` in `mode: error`
   falen.
2. **Echt blokkeren** doet GitHub, niet CodeRabbit. Zet daarvoor een
   *branch protection rule* op `main`:
   - **Settings → Branches → Add rule** op `main`.
   - ✅ *Require a pull request before merging* → *Require review from Code Owners*.
   - Voeg **@coderabbitai** toe als reviewer (of als code-owner) zodat zijn
     *"changes requested"* de merge tegenhoudt tot hij approve geeft.
   - Houd de bestaande CI-checks (`Astro & Vitest CI`) verplicht via
     *Require status checks to pass*.

> **Let op:** CodeRabbit publiceert geen eigen named status-check die je 1-op-1
> verplicht kunt stellen. De gate ontstaat via de code-owner-review hierboven.

`override_requested_reviewers_only: true` beperkt het overslaan van gefaalde
checks tot de aangewezen reviewers.

## 4. Rollout-plan (frictiearm naar enterprise)

De config staat nu op een grondig maar werkbaar niveau. Aanbevolen volgorde:

1. **Week 1 — observeren.** Laat auto-review draaien, lees de opmerkingen, stel
   `path_instructions` bij waar de bot ruis geeft. `pre_merge_checks` staan
   grotendeels op `warning` (zichtbaar, niet-blokkerend).
2. **Week 2 — gate aanzetten.** Activeer branch protection (§3). De `error`-checks
   (titel, tenant-isolatie, secrets/PII, destructieve guards) worden dan
   blokkerend.
3. **Doorlopend — leren.** Bevestig of corrigeer de bot in PR-comments; met
   `knowledge_base.learnings.scope: local` onthoudt hij teamvoorkeuren binnen
   deze repo.

Een check strenger/zachter maken = de `mode` in `reviews.pre_merge_checks`
omzetten tussen `off` → `warning` → `error`.

## 5. Commando's (in een PR-comment)

| Commando | Effect |
| --- | --- |
| `@coderabbitai review` | Incrementele review sinds de laatste. |
| `@coderabbitai full review` | Volledige herbeoordeling, negeert eerdere comments. |
| `@coderabbitai summary` | Ververst de PR-samenvatting. |
| `@coderabbitai resolve` | Markeert alle bot-comments als opgelost. |
| `@coderabbitai approve` | Approve (alleen geldig bij `request_changes_workflow: true`). |
| `@coderabbitai pause` / `resume` | Auto-reviews tijdelijk uit/aan. |
| `@coderabbitai configuration` | Toont de actieve config. |
| `@coderabbitai generate sequence diagram` | Genereert een sequence-diagram. |
| `@coderabbitai ignore` | In de PR-beschrijving: sla auto-review over voor déze PR. |
| `@coderabbitai help` | Alle commando's. |

## 6. Ingeschakelde tools

Native static-analysis draait mee op elke PR (alleen bij matchende bestanden):

- **Secrets:** `gitleaks` (hele changeset), `dotenvLint` (.env-kwaliteit).
- **JS/TS/Astro/Convex:** `eslint`, `oxc` (Oxlint), `semgrep`, `ast-grep`.
- **Python (`tools/`):** `ruff`.
- **CI/workflows:** `actionlint`, `zizmor` (Actions-security), `yamllint`.
- **Dependencies:** `osvScanner` (bekende npm-kwetsbaarheden).
- **Docs:** `markdownlint`.

Bewust **uit:** `biome` (geen config), `languagetool` (prose-grammar-nags op
Nederlandse docs = ruis). PII-detectie (`presidio`) staat default uit; overweeg
inschakelen als extra AVG-vangnet, maar test eerst op ruis met de demo-seed-data.

Eigen Convex/Astro-lintregels kun je later toevoegen via
`reviews.tools.ast-grep.rule_dirs` (placeholder staat in de config).

## 7. Tunen

- **Te veel ruis?** Zet `reviews.profile` op `chill`, of verfijn de betreffende
  `path_instructions`.
- **Nieuw gevoelig pad?** Voeg een `path_instructions`-entry én een CODEOWNERS-regel
  toe (houd ze gespiegeld).
- **Bestand niet reviewen?** Voeg een `!`-glob toe aan `reviews.path_filters`.
- **Config valideren:** dankzij de `$schema`-regel bovenin valideert je editor
  (VS Code + YAML-extensie) de keys live.

---

_Configuratie aangelegd op basis van een volledige codebase-analyse en het
officiële CodeRabbit-schema (`schema.v2.json`). Zie ook
[`convex/README.md`](../../convex/README.md) en
[`src/lib/auth/README.md`](../../src/lib/auth/README.md)._
