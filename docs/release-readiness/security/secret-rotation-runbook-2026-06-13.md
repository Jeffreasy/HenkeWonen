# Secret-rotatie runbook — Henke Wonen (2026-06-13)

> **Aanleiding:** tijdens een werksessie zijn secrets in de chat geplakt
> (`AUTHZ_TOKEN_SECRET`, `LAVENTECARE_JWT_SECRET`, een Vercel-token). Daarnaast stond
> `AUTHZ_TOKEN_SECRET` hardcoded in `.github/workflows/ci.yml` (nu vervangen door een GitHub-secret-referentie
> met veilige CI-fallback). Rotatie maakt de gelekte waarden waardeloos.
>
> **Belangrijk:** rotatie verwijdert de waarden **niet** uit git-historie of chatlogs (de blootstelling is al
> gebeurd) — het maakt ze ongeldig. Dat is de juiste mitigatie. Een AI kan deze rotatie niet uitvoeren
> (prod-env schrijven + deploy = eigenaarsactie, §6.1 van de overdracht). Hieronder staan de exacte stappen.

---

## Overzicht: waar leeft elk secret?

| Secret | Wie tekent | Wie verifieert | Locaties | Rotatie-impact |
|---|---|---|---|---|
| `AUTHZ_TOKEN_SECRET` | Astro SSR (`src/lib/auth/authzToken.ts`) + tools (`tools/authz_actor.mjs`) | Convex backend (`convex/authz.ts`) | Convex-env (dev+prod), Vercel-env, `.env.local`, `.env.prod.local`, GitHub-secret | Móet matchen tussen Vercel ⇄ Convex; korte mismatch-window |
| `LAVENTECARE_JWT_SECRET` | **LaventeCare (extern)** | Astro (`src/lib/auth/laventeCareAuthProvider.ts`) | Vercel-env, `.env.*`, evt. Convex-env | **Gedeeld met LaventeCare → niet eenzijdig roteren** |
| Vercel-token (OIDC of access) | Vercel | Vercel | `.vercel/.env.*` (OIDC, kortlevend) of account-tokens | OIDC = vrijwel zeker al verlopen; access-token = direct revoken |

---

## 1. `AUTHZ_TOKEN_SECRET` (HMAC voor Convex actor-tokens)

Astro **tekent** actor-tokens, Convex **verifieert** ze met hetzelfde secret. Daarom moeten de waarde op
Vercel (Astro-runtime) en in de Convex-deployment-env identiek zijn. De gelekte waarde was gelijk aan de
**dev**-secret, dus roteer dev **én** prod.

### 1a. Nieuw secret genereren (64-hex, zelfde formaat als het oude)
```bash
# een van beide:
openssl rand -hex 32
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 1b. Productie roteren (volgorde = verifier eerst, dan signer)
Convex (de verifier) moet het nieuwe secret kennen vóórdat Astro ermee gaat tekenen. Doe dit in een
rustig moment; de mismatch-window is alleen de redeploy-tijd (~40s). Actieve sessies krijgen hooguit één
keer een opnieuw-tekenen / login.

```bash
# 1. Convex prod-env zetten
npx convex env set AUTHZ_TOKEN_SECRET <NIEUW> --prod

# 2. Vercel prod-env zetten (CLI of dashboard)
vercel env rm AUTHZ_TOKEN_SECRET production
vercel env add AUTHZ_TOKEN_SECRET production      # plak <NIEUW> wanneer gevraagd
#   Dashboard-alternatief: Project → Settings → Environment Variables → Production

# 3. Frontend opnieuw deployen zodat Vercel de nieuwe env oppakt (env-wijziging vereist redeploy)
vercel --prod                                     # of: git push origin main (bij gekoppelde repo)
```

### 1c. Dev roteren (gelekte waarde = dev-secret)
```bash
npx convex env set AUTHZ_TOKEN_SECRET <NIEUW-DEV>     # zonder --prod = dev
# + Vercel "Development"/"Preview" env indien gebruikt
```

### 1d. Lokale env-bestanden bijwerken (anders falen de tools)
- `.env.local` → `AUTHZ_TOKEN_SECRET=<NIEUW-DEV>`
- `.env.prod.local` → `AUTHZ_TOKEN_SECRET=<NIEUW-PROD>` (zie §6.2 overdracht; gebruik `Set-Content` met
  array-regels, niet `Add-Content`, anders raakt de volgende regel vervuild).

### 1e. (Optioneel) GitHub-secret
`ci.yml` gebruikt nu `${{ secrets.AUTHZ_TOKEN_SECRET || 'ci-test-secret-not-used-outside-ci' }}`. CI is
self-consistent (tekent+verifieert met dezelfde waarde tegen een nep-deployment), dus dit is **niet
verplicht**. Wil je toch een echte: Repo → Settings → Secrets and variables → Actions → New repository
secret `AUTHZ_TOKEN_SECRET`. Hoeft géén productie-waarde te zijn.

### 1f. Verifiëren
- Log in op `https://henke-wonen.vercel.app`, open een projectpagina, voer een kleine mutatie uit
  (bv. een veld opslaan). Slaagt = actor-token verifieert correct met het nieuwe secret.
- Bij "Server Error": check `npx convex logs --prod` (Convex verbergt op prod de echte foutmelding, §6.4).

---

## 2. `LAVENTECARE_JWT_SECRET` — **coördineren, niet eenzijdig roteren**

LaventeCare (externe IdP) **tekent** de JWT's; de portal **verifieert** ze met dit secret. Eenzijdig
roteren breekt direct alle logins.

1. Neem contact op met LaventeCare om de gedeelde sleutel te roteren (gelijktijdig aan beide kanten).
2. Zet de nieuwe waarde op Vercel-env (Production/Preview/Development) + `.env.*` (+ Convex-env indien daar
   gebruikt) en redeploy.
3. Test **end-to-end SSO-login** vanaf LaventeCare → portal vóór en na, in een rustig moment.

> Als LaventeCare niet snel kan: behandel dit als bekend-risico en plan de gecoördineerde rotatie.

---

## 3. Vercel-token

Bepaal eerst wélk token gelekt is:
- **OIDC-token** (`VERCEL_OIDC_TOKEN`, staat in `.vercel/.env.development.local`): kortlevend (~12u TTL),
  wordt automatisch ververst door de Vercel-CLI. De geplakte waarde is vrijwel zeker **al verlopen** →
  laag risico, geen actie behalve bewustzijn.
- **Access-token** (persoonlijk/team, formaat `vercel_…`): **direct revoken** op
  `https://vercel.com/account/tokens` (of team-instellingen) en zo nodig een nieuwe uitgeven voor CLI/CI.

---

## Checklist (eigenaar)

- [ ] `AUTHZ_TOKEN_SECRET` prod geroteerd (Convex-env → Vercel-env → redeploy) + geverifieerd (1b, 1f)
- [ ] `AUTHZ_TOKEN_SECRET` dev geroteerd (1c) + `.env.local`/`.env.prod.local` bijgewerkt (1d)
- [ ] `LAVENTECARE_JWT_SECRET` rotatie met LaventeCare gecoördineerd + SSO getest (2)
- [ ] Vercel-token gecontroleerd: OIDC (verlopen, ok) of access-token gerevoked (3)
- [ ] (optioneel) GitHub-secret `AUTHZ_TOKEN_SECRET` gezet (1e)
- [ ] `ci.yml`-fix gecommit/gepusht (al voorbereid in deze sessie)
