# Backend — `convex/`

Convex serverless backend voor het Henke Wonen portal. Zie [`schema.ts`](schema.ts) voor het volledige datamodel (inclusief tabeloverzicht bovenin het bestand).

## Mapstructuur

| Map / Bestand | Functie |
| --- | --- |
| `schema.ts` | Volledig datamodel — 32 tabellen met indexen |
| `authz.ts` | Query- en mutatiebeveiliging: actor-token validatie, rol-checks |
| `portal.ts` | Gecombineerde portalqueries (dashboard, dossiers) |
| `portalUtils.ts` | Gedeelde utiliteiten voor Convex functies |
| `beheer/` | Tenant-, gebruiker-, categorie- en leveranciersbeheer |
| `catalog/` | Catalogusimport-pipeline — zie [`catalog/README.md`](catalog/README.md) |
| `offertes/` | Offertes, offerteregels en offertetemplates |
| `projecten/` | Projecten, inmeting en buitendienst — zie [`projecten/README.md`](projecten/README.md) |
| `facturen/` | Facturen per project |
| `seed/` | Basisconfiguratie (`core.ts`) en demo-data (`demo.ts`) |
| `_generated/` | Auto-gegenereerd door Convex CLI — nooit handmatig aanpassen |

## Multi-tenant architectuur

Elke query en mutatie filtert altijd op `tenantId`. Er is geen cross-tenant data-toegang mogelijk.

```
tenants → users, customers, categories, suppliers, products, ...
```

## Query- en mutatiebeveiliging

Alle tenantgebonden publieke queries en alle schrijfoperaties gaan via `convex/authz.ts`:
1. Actor-token valideren (gedeelde `AUTHZ_TOKEN_SECRET` met Astro)
2. Tenant-ID verifiëren
3. Gebruiker opzoeken in `users`-tabel
4. Rol controleren op vereist permissieniveau

Zie [`src/lib/auth/README.md`](../src/lib/auth/README.md) voor de Astro-kant.

## Convex-deployments

| Omgeving | Deployment |
| --- | --- |
| Development | Lokale Convex dev server |
| Production | `prod:accomplished-kangaroo-354` |

> [!CAUTION]
> `seed/demo.ts` (demo-klanten, projecten, offertes) hoort **nooit** in productie te draaien.
> Productie gebruikt alleen `seed/core.ts`.
