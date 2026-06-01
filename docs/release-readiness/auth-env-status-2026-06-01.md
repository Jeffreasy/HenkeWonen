# Auth/env status 2026-06-01

## Samenvatting

De productie-auth configuratie is inhoudelijk goed gezet: Vercel Production wijst naar Convex production, `AUTHZ_TOKEN_SECRET` is aanwezig in beide systemen en de waarden matchen. `ALLOW_DEV_AUTH`, `ALLOW_DEV_AUTHZ_TOKENS` en `ALLOW_CONVEX_TOOLING` staan niet aan in productie.

Er is wel een concreet preview-risico: Vercel Preview wijst naar Convex development, maar de opgehaalde previewwaarden voor `AUTHZ_TOKEN_SECRET`, `LAVENTECARE_API_URL` en `LAVENTECARE_TENANT_ID` zijn leeg. Preview-deployments zijn daardoor niet geschikt als acceptatieomgeving voor LaventeCare-login of beveiligde Convex-mutaties totdat deze waarden opnieuw gezet en gecontroleerd zijn.

Secrets zijn alleen op aanwezigheid en onderlinge match gecontroleerd. Waarden zijn niet vastgelegd in documentatie of command-output. Tijdelijke Vercel pull-bestanden zijn na controle verwijderd.

## Besluit

- Productie-env: groen voor auth/env-consistentie.
- Development/local: groen voor huidige ontwikkelbaseline.
- Preview-env: niet groen; eerst herstellen voordat preview als release-acceptatieomgeving wordt gebruikt.
- Echte LaventeCare-login met gebruikersnaam/wachtwoord is nog niet uitgevoerd, omdat er geen testaccount of credentialset in scope is meegegeven.

## Omgevingsstatus

| Omgeving | Convex target | Auth mode | Authz status | Dev flags | Status |
| --- | --- | --- | --- | --- | --- |
| Lokaal `.env.local` | `dev:kindly-greyhound-592` | `laventecare` | aanwezig; matcht Convex dev en Vercel Development | niet gezet | Goed |
| Convex dev | `dev` | n.v.t. | `AUTHZ_TOKEN_SECRET` aanwezig | `ALLOW_DEV_AUTHZ_TOKENS` en `ALLOW_CONVEX_TOOLING` niet gezet | Goed |
| Vercel Development | `dev:kindly-greyhound-592` | `laventecare` | aanwezig; matcht Convex dev en lokaal | `ALLOW_DEV_AUTH` en `ALLOW_DEV_AUTHZ_TOKENS` niet gezet | Goed |
| Vercel Preview | `dev:kindly-greyhound-592` | `laventecare` | leeg/niet vergelijkbaar | `ALLOW_DEV_AUTH` en `ALLOW_DEV_AUTHZ_TOKENS` niet gezet | Herstellen |
| Convex prod | `prod` | n.v.t. | `AUTHZ_TOKEN_SECRET` aanwezig | `ALLOW_DEV_AUTHZ_TOKENS` en `ALLOW_CONVEX_TOOLING` niet gezet | Goed |
| Vercel Production | `prod:accomplished-kangaroo-354` | `laventecare` | aanwezig; matcht Convex prod | `ALLOW_DEV_AUTH` en `ALLOW_DEV_AUTHZ_TOKENS` niet gezet | Goed |

## Verplichte variabelen

### Astro/Vercel local, development en preview

Deze waarden zijn nodig voor een werkende LaventeCare-portal tegen Convex development:

- `CONVEX_DEPLOYMENT=dev:kindly-greyhound-592`
- `PUBLIC_CONVEX_URL=https://kindly-greyhound-592.eu-west-1.convex.cloud`
- `PUBLIC_CONVEX_HTTP_ACTIONS_URL=https://kindly-greyhound-592.eu-west-1.convex.site`
- `CONVEX_SITE_URL=https://kindly-greyhound-592.eu-west-1.convex.site`
- `AUTH_MODE=laventecare`
- `PUBLIC_AUTH_MODE=laventecare`
- `LAVENTECARE_API_URL`
- `LAVENTECARE_TENANT_ID`
- `HENKE_TENANT_SLUG=henke-wonen`
- `AUTH_TENANT_NAME=Henke Wonen`
- `AUTHZ_TOKEN_SECRET`, identiek aan de Convex development secret

`ALLOW_DEV_AUTH` hoort niet standaard gezet te zijn. Alleen tijdelijke lokale smoke-tests mogen dit expliciet overriden. `ALLOW_DEV_AUTHZ_TOKENS` hoort niet gezet te zijn zolang `AUTHZ_TOKEN_SECRET` aanwezig is.

### Astro/Vercel production

Deze waarden zijn nodig voor productie:

- `CONVEX_DEPLOYMENT=prod:accomplished-kangaroo-354`
- `PUBLIC_CONVEX_URL=https://accomplished-kangaroo-354.eu-west-1.convex.cloud`
- `PUBLIC_CONVEX_HTTP_ACTIONS_URL=https://accomplished-kangaroo-354.eu-west-1.convex.site`
- `CONVEX_SITE_URL=https://accomplished-kangaroo-354.eu-west-1.convex.site`
- `AUTH_MODE=laventecare`
- `PUBLIC_AUTH_MODE=laventecare`
- `LAVENTECARE_API_URL`
- `LAVENTECARE_TENANT_ID`
- `HENKE_TENANT_SLUG=henke-wonen`
- `AUTH_TENANT_NAME=Henke Wonen`
- `AUTHZ_TOKEN_SECRET`, identiek aan de Convex production secret

Productie mag geen `ALLOW_DEV_AUTH=true` en geen `ALLOW_DEV_AUTHZ_TOKENS=true` hebben.

### Convex development en production

Convex heeft minimaal nodig:

- `AUTHZ_TOKEN_SECRET`

Alleen voor bewuste lokale noodsituaties zonder secret mag development tijdelijk `ALLOW_DEV_AUTHZ_TOKENS=true` krijgen. De huidige stand gebruikt dat niet. `ALLOW_CONVEX_TOOLING=true` hoort alleen tijdelijk tijdens expliciete beheeracties gezet te worden en staat nu niet aan.

## Smoke-tests

Uitgevoerd met project-lokale Node 24 runtime.

| Smoke | Resultaat | Dekking |
| --- | --- | --- |
| LaventeCare loginpagina | Geslaagd | `/login` geeft HTTP 200, toont LaventeCare-koppeling en loginformulier |
| Ongeauthenticeerde portalredirect | Geslaagd | `/portal` zonder sessie redirect naar `/login` |
| Dev-auth portalroutes | Geslaagd | 20/20 routes HTTP 200, inclusief `/portal`, `/portal/buitendienst`, `/portal/catalogus`, `/portal/beheer`, imports en offerteteksten |

Niet uitgevoerd:

- Echte LaventeCare-login met gebruikersaccount.
- MFA-pad.
- Deployed preview-smoke, omdat Vercel Preview-env leeg is voor auth-kritieke waarden.

## Acties

1. Herstel Vercel Preview voordat preview als acceptatieomgeving wordt gebruikt:
   - zet `AUTHZ_TOKEN_SECRET` non-empty en gelijk aan Convex dev;
   - zet `LAVENTECARE_API_URL`;
   - zet `LAVENTECARE_TENANT_ID`;
   - trek preview-env opnieuw lokaal naar een tijdelijk bestand en controleer aanwezigheid/match.
2. Voer daarna een echte LaventeCare-login smoke uit met een testaccount:
   - login;
   - portal dashboard;
   - buitendienst;
   - admin/catalogus;
   - logout.
3. Houd productieguardrails vast:
   - geen dev-auth flags in Vercel Production;
   - geen `ALLOW_DEV_AUTHZ_TOKENS` in Convex production;
   - geen permanente `ALLOW_CONVEX_TOOLING` in Convex production.
