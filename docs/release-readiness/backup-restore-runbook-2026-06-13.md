# Backup- & restore-runbook — Henke Wonen (2026-06-13)

> **Waarom:** productieherstel hing tot nu af van één handmatige export-zip op de laptop van de eigenaar,
> terwijl prod-mutaties handmatig (zonder audit-spoor) gebeuren. Een **ongeteste** backup is geen backup.
> Dit runbook legt de strategie vast en beschrijft de restore-procedure; de proef-restore is een eigenaarsactie.

## Huidige stand
- **Laatste handmatige export:** `C:\Users\jeffrey\HenkeWonen-backups\prod-backup-20260613-185149.zip` (35 MB,
  read-only snapshot van `prod:accomplished-kangaroo-354`, 2026-06-13). Duurzaam (buiten `%TEMP%` en buiten de repo).
- **Geen** geautomatiseerde/periodieke backup ingeregeld; geen geteste restore.

## Backup-strategie (3 lagen)
1. **Convex snapshot-export (handmatig, periodiek).** Read-only, veilig, AI-uitvoerbaar:
   ```bash
   npx convex export --prod --path "C:/Users/jeffrey/HenkeWonen-backups/prod-backup-<YYYYMMDD-HHMMSS>.zip"
   ```
   Bewaar buiten de repo (PII!) en buiten `%TEMP%`. Aanbevolen ritme: wekelijks + vóór elke prod-data-reparatie.
2. **Convex platform-snapshots.** Controleer in het Convex-dashboard → **Settings → Backups/Snapshot Export**
   of automatische snapshots + retentie actief zijn voor het prod-deployment (afhankelijk van het plan).
   Documenteer de retentie hier zodra geverifieerd.
3. **Off-site kopie.** Zet de wekelijkse zip op een tweede, niet-laptop-locatie (cloud-drive/NAS) — één laptop is een single point of failure.

## Restore-procedure (⚠️ destructief — eigenaarsactie)
`npx convex import` met `--replace` overschrijft data. **Nooit blind op prod.**

1. **Altijd eerst een verse export maken** (zie laag 1) vóór een restore.
2. **Test de restore op DEV** (niet prod) met een prod-backup:
   ```bash
   # DEV-deployment, vervangt dev-data:
   npx convex import --replace --path "<pad-naar-prod-backup>.zip"
   ```
   Verifieer daarna kerntellingen (producten/prijzen/klanten) en een login.
3. **Prod-restore** alleen bij een echte calamiteit, na expliciete dubbelcheck van het doel-deployment:
   ```bash
   npx convex import --prod --replace --path "<backup>.zip"
   ```

## Openstaande eigenaarsacties
- [ ] Convex-dashboard: auto-snapshot-retentie verifiëren + hier documenteren.
- [ ] Eén **proef-restore naar dev** uitvoeren met de bestaande prod-backup en het resultaat verifiëren.
- [ ] Wekelijkse export + off-site kopie inregelen (evt. via `/schedule` of een kalenderherinnering).

## Gerelateerd
- Read-only prod-inspectie/mechanica: `docs/technisch/sessie-overdracht-2026-06-13.md` §10.4.
