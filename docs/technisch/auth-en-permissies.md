# Auth en permissies

Fase 4 scheidt lokale dev-auth van klant- en productie-auth.

## Auth modes

- `AUTH_MODE=laventecare` is de beoogde productie-instelling.
- `AUTH_MODE=dev` of `PUBLIC_AUTH_MODE=dev` werkt alleen in development, tenzij `ALLOW_DEV_AUTH=true` expliciet is gezet.
- `DEV_AUTH_ROLE`, `DEV_AUTH_USER_ID`, `DEV_AUTH_EMAIL`, `DEV_AUTH_NAME` en `DEV_AUTH_TENANT_ID` zijn alleen bedoeld voor lokale demo's.

## LaventeCare AuthSystem

De LaventeCare provider gebruikt in productie bij voorkeur de lokale Henke auth-proxy:

- `/api/auth/login` stuurt loginpogingen door naar LaventeCare AuthSystem.
- `/api/auth/me`, `/api/auth/refresh`, `/api/auth/logout` en `/api/auth/token` blijven first-party onder het Henke domein.
- De proxy stuurt altijd `X-Tenant-ID` mee naar LaventeCare AuthSystem.
- Cookies uit LaventeCare worden herschreven naar het Henke domein, zodat de browser geen cross-site auth-details hoeft te kennen.

Benodigde instellingen:

- `AUTH_MODE=laventecare` is de beoogde productie-instelling.
- `LAVENTECARE_API_URL`, standaard `https://laventecareauthsystems.onrender.com/api/v1`.
- `LAVENTECARE_TENANT_ID`, de UUID van de tenant in LaventeCare AuthSystem.
- `HENKE_TENANT_SLUG`, standaard `henke-wonen`. Dit is de interne Convex/data-tenant en hoeft niet gelijk te zijn aan de LaventeCare tenant-slug.

Legacy/fallback productieroutes:

- `LAVENTECARE_AUTH_ME_URL`: server-side `/auth/me` endpoint. De portal stuurt de bestaande cookies mee en verwacht een JSON payload met gebruiker, tenant en rol.
- `LAVENTECARE_JWT_SECRET`: HS256 JWT-validatie uit `LAVENTECARE_SESSION_COOKIE` of een Bearer token.

Optionele instellingen:

- `LAVENTECARE_SESSION_COOKIE`, standaard `access_token`.
- `LAVENTECARE_LOGIN_URL` voor de login-knop.

## Convex-mutaties

Mutaties krijgen een server-gesigneerde actor mee. Convex valideert:

- de actor-token;
- de tenant;
- de gebruiker in de Convex `users` tabel;
- de rol die bij de mutatie hoort.

Gebruik `AUTHZ_TOKEN_SECRET` in Astro en Convex met dezelfde waarde. Zonder deze secret worden alleen lokale `dev.*` tokens geaccepteerd, bedoeld voor development.
