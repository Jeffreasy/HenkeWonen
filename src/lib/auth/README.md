# Auth — `src/lib/auth/`

Authenticatie- en permissielaag van het Henke Wonen portal.

## Bestanden

| Bestand | Functie |
| --- | --- |
| `session.ts` | Kern: `AppSession`, `AppRole`, `AppWorkspaceMode` en alle permission helpers |
| `index.ts` | Exporteert de actieve auth-provider op basis van `AUTH_MODE` |
| `mode.ts` | Leest `AUTH_MODE` env-var en bepaalt welke provider actief is |
| `laventeCareAuthProvider.ts` | Productie-auth via LaventeCare AuthSystem |
| `laventeCareConfig.ts` | Env-variabelen voor de LaventeCare-koppeling |
| `laventeCareCookies.ts` | Cookie-rewrite logica (LaventeCare → Henke-domein) |
| `laventeCareSession.ts` | Session-parsing uit LaventeCare tokens/cookies |
| `devAuthProvider.ts` | Lokale dev-auth (NOOIT in productie actief zonder `ALLOW_DEV_AUTH=true`) |
| `authzToken.ts` | Mint korte-levensduur HMAC-SHA256-tokens voor Convex: `actor`-tokens (mutatie-autorisatie) en `sync`-tokens (sessiesync) |
| `sessionSync.ts` | Synchroniseert sessiegegevens naar Convex na elke authenticatie |

## Auth-modes

```
AUTH_MODE=laventecare   ← productie (default)
AUTH_MODE=dev           ← alleen lokaal development
```

Dev-auth is geblokkeerd in productie tenzij `ALLOW_DEV_AUTH=true` expliciet is gezet. Zet die vlag nooit in productie.

## Rolhiërarchie

```
viewer < user < editor < admin
```

| Rol | Toegang |
| --- | --- |
| `viewer` | Lezen — geen schrijfrechten |
| `user` | Dossiers, projecten, offertes aanmaken en bewerken |
| `editor` | + Catalogus en prijzen bewerken, financiële data inzien |
| `admin` | + Beheer, import, leveranciers, instellingen |

## LaventeCare proxy-architectuur

De portal zit als proxy tussen de browser en LaventeCare AuthSystem:

```
Browser → /api/auth/* (Henke domein) → LaventeCare AuthSystem
```

- `/api/auth/login` stuurt door naar LaventeCare
- `/api/auth/me`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/token` blijven first-party
- Cookies worden herschreven naar het Henke-domein — de browser ziet nooit cross-site auth-details
- `refresh_token` behoudt het `Path`-attribuut van LaventeCare (blind herschrijven naar `Path=/` veroorzaakt shadow cookies)
- Middleware probeert server-side refresh wanneer een portaalroute geen sessie kan lezen maar er wel een `refresh_token` beschikbaar is

## Benodigde env-variabelen

```env
AUTH_MODE=laventecare
LAVENTECARE_API_URL=https://laventecareauthsystems.onrender.com/api/v1
LAVENTECARE_TENANT_ID=<uuid>
HENKE_TENANT_SLUG=henke-wonen
AUTHZ_TOKEN_SECRET=<gedeeld-secret-met-convex>
```

## Convex-mutatiebeveiliging

Elke Convex-mutatie krijgt een server-gesigneerd actor-token (`authzToken` in `AppSession`).
Convex valideert:
1. De actor-token (via `AUTHZ_TOKEN_SECRET`)
2. De tenant-ID
3. De gebruiker in de `users`-tabel
4. De rol die bij de mutatie hoort

Zie [`convex/authz.ts`](../../convex/authz.ts) voor de validatielogica.

> [!CAUTION]
> Gebruik `ALLOW_DEV_AUTHZ_TOKENS=true` nooit in Convex-productie.
