# Technische documentatie

Actuele technische samenvattingen. Domeinspecifieke documentatie staat **naast de code** in de bronmappen.

## Co-located documentatie (naast de code)

| Document | Locatie |
| --- | --- |
| Auth & permissies | [`src/lib/auth/README.md`](../../src/lib/auth/README.md) |
| CSS architectuur (layers) | [`src/styles/README.md`](../../src/styles/README.md) |
| Catalogus & importstraat | [`convex/catalog/README.md`](../../convex/catalog/README.md) |
| Inmeetmodule & projecten | [`convex/projecten/README.md`](../../convex/projecten/README.md) |
| Convex backend overzicht | [`convex/README.md`](../../convex/README.md) |
| Import-tools | [`tools/README.md`](../../tools/README.md) |
| Convex datamodel | [`convex/schema.ts`](../../convex/schema.ts) (module-header bovenin) |
| AppSession & rollen | [`src/lib/auth/session.ts`](../../src/lib/auth/session.ts) (volledig JSDoc) |

## Projectniveau samenvattingen

| Document | Gebruik |
| --- | --- |
| [Projectstabilisatie 2026-06-01](./project-stabilisatie-2026-06-01.md) | Actuele baseline, Node 24 workflow en catalogusreleasepunten |
| [Vooronderzoek rapport](./vooronderzoek-rapport.md) | Technisch vooronderzoek en architectuurkeuzes |
| [Codebase Audit Rapport 2026-06-10](./codebase-audit-rapport-2026-06-10.md) | Grondige codebase-audit en verificatie van alle modules voor de pilot-start |
| [UI/UX compact styling-overdracht 2026-06-11](./ui-ux-compact-styling-overdracht-2026-06-11.md) | Vastlegging van de compacte typografie/knoppen/cards-styling om gericht over te nemen |
| [Plan richtprijs bij inmeting 2026-06-13](./plan-richtprijs-inmeting-2026-06-13.md) | Geïmplementeerd plan: product kiezen → direct indicatieve richtprijs zien |
| [Sessie-overdracht 2026-06-13](./sessie-overdracht-2026-06-13.md) | Nieuwe sessie/ontwikkelaar op snelheid brengen na de richtprijs- en prod-data-werkzaamheden |
| [Volgende stappen — aanbeveling 2026-06-13](./volgende-stappen-aanbeveling-2026-06-13.md) | Geprioriteerde vervolgstappen uit het multi-agent onderzoek over 5 dimensies |

## Runbooks & operationeel

| Document | Gebruik |
| --- | --- |
| [Ruimte-model A — runbook](./ruimte-model-runbook.md) | Één ruimte-identiteit: auto-promotie, identiteit-sync/backfill en de verplichte `measurementRooms.projectRuimteId`-FK |
| [Productie-update runbook 2026-06-15](./prod-update-runbook-2026-06-15.md) | NL-schema + catalogus naar productie brengen (eigenaar voert de prod-muterende stappen zelf uit) |

## Tooling & conventies

| Document | Gebruik |
| --- | --- |
| [CodeRabbit — bedien-handleiding](./coderabbit.md) | Hoe CodeRabbit op elke PR reviewt; config in [`.coderabbit.yaml`](../../.coderabbit.yaml) |
| [NL-rename glossary & uitvoeringsplan](./nl-rename-glossary.md) | Glossary, beslissingen en plan voor de Nederlandse veldnaam-migratie; canonieke map in [`tools/nl-rename-map.mjs`](../../tools/nl-rename-map.mjs) |

## Historisch (archief)

Faseverslagen, workflow-inventarisaties en projectoverdrachten staan in [`docs/archief/`](../archief/README.md).
