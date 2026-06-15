# Ruimte-model A — runbook (één ruimte-identiteit)

## Probleem (diagnose 2026-06-15)

Dezelfde fysieke ruimte ("Woonkamer") leefde in drie ontkoppelde tabellen
(`projectRooms` in cm, `measurementRooms` in m, en als losse string op de
offerte), met een optionele koppeling die in de praktijk vrijwel altijd leeg
bleef. Gevolg: ruimte op meerdere plekken opnieuw invoeren/kiezen, en de ruimte
verdween op de offerte. Zie de flow-kaart in de sessie van 2026-06-15.

## Oplossing (drie lagen)

1. **Auto-promotie** (commit `474b428`): `addMeasurementRoom` koppelt elke
   inmeet-ruimte aan een dossier-ruimte (find-or-create op genormaliseerde naam,
   maten m→cm). Geen dubbel invoeren meer; de offerte behoudt de ruimte.
2. **A1 — identiteit-sync + backfill** (commit `d78371d`, expand):
   `syncProjectRoomFromMeasurement` (inmeting → dossier) en de propagatie in
   `updateProjectRoom` (dossier → inmeting) houden naam/verdieping gelijk;
   gemeten maten stromen inmeting → dossier. `backfillMeasurementRoomLinksChunk`
   koppelt bestaande losse inmeet-ruimtes.
3. **A2 — verplichte FK** (commit `f2745aa`, contract):
   `measurementRooms.projectRuimteId` is niet langer optioneel → orphans zijn
   structureel onmogelijk.

## Sync-semantiek (bewuste keuzes)

- **Identiteit (naam/verdieping):** tweerichting. Bewerk je de ruimte in het
  dossier óf in de inmeting, beide blijven gelijk.
- **Maten:** éénrichting inmeting → dossier. De inmeter meet ter plekke; het
  dossier weerspiegelt de laatste meting. Een dossier-maatwijziging overschrijft
  de gemeten maat NIET. Niet-gemeten maten wissen de dossier-maat nooit.
- **Notities:** per laag (bezoek-notitie vs dossier-notitie), niet gesynct.

## Dev — uitgevoerd & gevalideerd (2026-06-15)

Backup: `C:\Users\jeffrey\HenkeBackups\dev-pre-room-model-A-20260615.zip`.
Deploy A1-code → `node tools/backfill_room_links.mjs --apply` (7 ruimtes
gekoppeld, 0 resterend) → schema verplichte FK → `npx convex dev --once` groen
(validatie bevestigt dat alle 8 measurementRooms gekoppeld zijn). vitest 202.

## PROD — EIGENAARSACTIE (expand-then-contract, AI muteert prod niet)

De volgorde is dwingend: de verplichte-FK-deploy (A2) faalt zolang er één
inmeet-ruimte zonder koppeling bestaat. Dus eerst A1 + backfill, dán A2.

```
# 0. Backup (buiten repo/temp; bevat PII)
npx convex export --prod --path <pad>\prod-pre-room-model-A-<datum>.zip

# 1. Deploy t/m commit d78371d (A1 — backfill-mutatie + sync, FK nog optioneel)
git checkout d78371d        # of merge de branch t/m A1 naar je prod-branch
npx convex deploy           # (of de prod-deploy die je normaal gebruikt)

# 2. Backfill draaien (dry-run, dan apply)
node tools/backfill_room_links.mjs --env-file .env.production --production --target=production
node tools/backfill_room_links.mjs --apply --env-file .env.production --production \
  --target=production --confirm-production-room-backfill     # vereist AUTHZ_TOKEN_SECRET
#   → controleer dat een herhaalde dry-run "0 inmeet-ruimte(s) zonder koppeling" geeft

# 3. Deploy commit f2745aa (A2 — verplichte FK). De deploy-validatie bevestigt
#    dat alle measurementRooms gekoppeld zijn; faalt als stap 2 onvolledig was.
git checkout f2745aa
npx convex deploy
```

Rollback: `npx convex import --prod --replace <backup>.zip` (destructief).

## Vervolg (optioneel)

- Echte single-source: `naam`/`verdieping` fysiek van `measurementRooms`
  verwijderen en altijd via de dossier-ruimte tonen (nu een gesynchroniseerde
  denormalisatie — kan niet meer divergeren, maar de kolommen bestaan nog).
- UI: de "Ruimte uit dossier"-dropdown kan nu een eenvoudige ruimtekeuze worden
  die door inmeet- en offerteschermen heen meereist (richting C uit de analyse).
