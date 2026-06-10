# Projectstabilisatie Henke Wonen portal

Datum: 1 juni 2026  
Branch: `codex/stabilize-current-baseline`  
Doel: huidige projectstaat veilig vastleggen voordat er nieuwe featureontwikkeling start.

## Baseline

De huidige codebase is een Astro + React portal met Convex backend en Vercel server output. De worktree bevatte bij start van deze stabilisatieronde een brede set bestaande wijzigingen in frontend, Convex, tooling, documentatie en catalogusimport.

Deze ronde heeft geen featurewijzigingen toegevoegd. De wijzigingen zijn vastgelegd als huidige baseline, zodat vervolgwerk vanaf een expliciete branch en commit kan starten.

## Runtime

Het project verwacht Node 24:

- `package.json`: `engines.node = 24.x`
- `.npmrc`: `engine-strict=true`
- lokale helper: `tools/use-node24.ps1`

Geverifieerde runtime:

- Node `v24.16.0`
- npm `11.13.0`

Gebruik voor lokale checks op Windows:

```powershell
.\tools\use-node24.ps1 npm run check
.\tools\use-node24.ps1 npm run build
```

## Uitgevoerde controles

Alle controles zijn uitgevoerd met de project-lokale Node 24 runtime.

| Controle | Resultaat |
| --- | --- |
| `npm run check` | Geslaagd, Astro/TypeScript-checks zonder errors |
| `npm run build` | Geslaagd, Vercel server output gebouwd |
| `npm test` | Geslaagd, volledige Vitest-suite inclusief calculators, offertedocumenten, workflow-guardrails, route smoke en a11y smoke |
| `npm audit --omit=dev` | 0 vulnerabilities |

Browser smoke:

- `http://127.0.0.1:4325/login`: loginpagina laadt.
- `http://127.0.0.1:4325/portal?full=1`: winkelportal laadt zonder browser console errors.
- `http://127.0.0.1:4325/portal/buitendienst/vandaag`: buitendienst laadt zonder browser console errors en zonder beheer/catalogustermen in de field view.

## Catalogusstatus

Convex development status via `npm run catalog:status`:

- target: `development`
- deployment: `dev:kindly-greyhound-592`
- production import status: `READY`
- btw-mappings: 55 totaal, 55 opgelost, 0 open
- duplicate EAN issues: 4 open
- laatste import-run: 10.291 productregels, 13.015 prijsregels, 10.291 unknown-vat rows

Lokale cataloguspreview in `docs/catalog-import-summary.json`:

- productregels: 27.880
- preview/auditregels: 40.604
- prijsregels: 88.291
- prijsregels met onbekende btw-modus: 16.203
- bronbestanden totaal: 32
- bronbestanden met productregels: 26

Gerichte parser-smokes:

- ZTAHL no-write preview: 2 bronbestanden, 826 productregels, 826 prijsregels, 0 unknown-vat prijsregels.
- FlexColours no-write preview: 8 bronbestanden, 129 producten, 129 prijsregels.

Let op: een volledige `catalog:preview:check` over de complete DATA-map haalde 5 minuten niet. Gebruik daarom voor ontwikkeling eerst gerichte `--source` runs, of geef de volledige preview bewust ruimere tijd.

## Releasebeslissingen

Voor productie of grote featurebouw eerst expliciet beslissen:

1. Is de Convex development catalogus leidend, of moet de lokale 32-bestanden-preview opnieuw volledig worden geimporteerd?
2. Wat is de gewenste status van de 4 open duplicate-EAN issues?
3. Moet `catalog:preview:check` worden opgesplitst of versneld voordat het als standaard releasecheck geldt?
4. Zijn `AUTHZ_TOKEN_SECRET` en LaventeCare tenantconfiguratie in Vercel en Convex gelijk gezet?
5. Mag `ALLOW_DEV_AUTHZ_TOKENS` nergens in productie aan staan?

## Vervolgroute

Aanbevolen volgorde vanaf deze baseline:

1. Kies per nieuwe taak een kleine functionele scope.
2. Start altijd met Node 24 via `tools/use-node24.ps1`.
3. Draai bij frontend/backend wijzigingen minimaal `check`, relevante domeintest en daarna `build`.
4. Raak catalogusimport alleen met expliciete target/env-keuze.
5. Houd productie-auth en catalogus-readiness als aparte releasepoort.
