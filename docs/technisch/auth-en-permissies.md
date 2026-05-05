# Auth en permissies

Fase 4 scheidt lokale dev-auth van klant- en productie-auth.

## Auth modes

- `AUTH_MODE=laventecare` is de beoogde productie-instelling.
- `AUTH_MODE=dev` of `PUBLIC_AUTH_MODE=dev` werkt alleen in development, tenzij `ALLOW_DEV_AUTH=true` expliciet is gezet.
- `DEV_AUTH_ROLE`, `DEV_AUTH_USER_ID`, `DEV_AUTH_EMAIL`, `DEV_AUTH_NAME` en `DEV_AUTH_TENANT_ID` zijn alleen bedoeld voor lokale demo's.

## LaventeCare AuthSystem

De LaventeCare provider ondersteunt twee productieroutes:

- `LAVENTECARE_AUTH_ME_URL`: server-side `/auth/me` endpoint. De portal stuurt de bestaande cookies mee en verwacht een JSON payload met gebruiker, tenant en rol.
- `LAVENTECARE_JWT_SECRET`: HS256 JWT-validatie uit `LAVENTECARE_SESSION_COOKIE` of een Bearer token.

Optionele instellingen:

- `LAVENTECARE_SESSION_COOKIE`, standaard `laventecare_session`.
- `LAVENTECARE_TENANT_SLUG`, standaard `henke-wonen`.
- `LAVENTECARE_LOGIN_URL` voor de login-knop.

## Convex-mutaties

Mutaties krijgen een server-gesigneerde actor mee. Convex valideert:

- de actor-token;
- de tenant;
- de gebruiker in de Convex `users` tabel;
- de rol die bij de mutatie hoort.

Gebruik `AUTHZ_TOKEN_SECRET` in Astro en Convex met dezelfde waarde. Zonder deze secret worden alleen lokale `dev.*` tokens geaccepteerd, bedoeld voor development.
