# Duplicate-EAN — expliciete productie-acceptatie (2026-06-13)

Datum: 13 juni 2026
Status: **GEACCEPTEERD voor productie** als bekend datakwaliteitspunt
Vastgelegd door: Jeffrey (ontwikkelaar/beheerder), namens het Henke Wonen portal-project
Scope: live productie-catalogus `prod:accomplished-kangaroo-354` (tenant `henke-wonen`)

> Dit document is de **expliciete release-acceptatie** die het parkeerbesluit
> (`duplicate-ean-parkeerbesluit-2026-06-01.md`) vereist voor productie. Het parkeerbesluit stelde:
> *"Voor productie is dit alleen acceptabel als bekende waarschuwing met expliciete release-acceptatie.
> Zonder die acceptatie blijft het een productiepoort."* De richtprijs-feature is op 2026-06-13 live gegaan;
> hiermee is die poort bewust en onderbouwd gepasseerd.

---

## Besluit

De duplicate-EAN-signalen in de productie-catalogus worden **geaccepteerd als bekend, gedocumenteerd
datakwaliteitspunt**. Ze worden **niet** opgelost verklaard, **niet** automatisch samengevoegd en
**niet** verborgen. Er vindt geen datawijziging plaats op basis van dit besluit.

## Onderbouwing (geverifieerd in de live code, 2026-06-13)

Het kernrisico van duplicate-EAN — verkeerde productselectie of -koppeling — is **niet van toepassing**,
omdat EAN nergens in een klantflow als identiteit fungeert:

- De indexen `by_ean` / `by_supplier_ean` worden **uitsluitend** bevraagd in `convex/catalog/review.ts`
  (de admin-tooling voor de duplicate-EAN-review zelf). **Geen** klantflow gebruikt ze.
- De richtprijs-picker zoekt op naam + categorie en toont naam/kleur/leverancier
  (`src/components/catalog/CatalogProductPicker.tsx`, `convex/catalog/pickerSearch.ts`); EAN komt alleen
  mee als attribuut, niet als selector.
- Prijskeuze en offerte-import werken op `productId`, nooit op EAN.
- Er bestaat **geen** barcode-/scanflow (de belangrijkste her-open-trigger uit het parkeerbesluit).
- De bulk is benigne: collectie-/artikelnummer-hergebruik binnen leveranciersbestanden (Texdecor:
  Casadeco/Caselio/Casamance).

## Actuele productie-stand (read-only export 2026-06-13)

| Metriek | Waarde |
|---|---:|
| Duplicate-EAN groepen | **1.871** |
| Producten in groepen | **4.393** |
| — intra-leverancier (echte dedup-kandidaten) | 1.805 |
| — cross-leverancier (waarschijnlijk legitiem) | 66 |
| Geregistreerde `catalogDataIssues` op prod | **0** (tabel leeg) |

> **Caveat (bewust geaccepteerd):** omdat `catalogDataIssues` op prod leeg is, zijn de waarschuwingen
> momenteel **niet in de portal** auditbaar (op dev wel). Het auditspoor leeft daarom in de
> release-readiness-documentatie + de triage-CSV (zie onder). Optioneel kan de eigenaar de issues alsnog
> in-portal zichtbaar maken via `syncDuplicateEanIssues` (aparte eigenaarsmutatie) — niet vereist voor deze
> acceptatie.

## Guardrails (herbevestigd)

Conform parkeerbesluit + vrijgavegids §3:
1. EAN mag **niet** als unieke productkey worden gebruikt.
2. Duplicate-EAN mag **geen** automatische merge/delete triggeren.
3. Offerte-, zoek- en catalogusflows tonen/gebruiken productnaam, artikelnummer, collectie, leverancier en
   importkey.
4. Dit staat als bekend datakwaliteitspunt in de release-/vrijgavedocumentatie (vrijgavegids §3, update
   2026-06-13).
5. De volledige prod-triage blijft bewaard (zie auditspoor).

## Her-open-triggers

Pak dit dossier opnieuw op zodra één van deze ontstaat:
1. Er komt een barcode-/scanflow waarbij EAN leidend wordt.
2. Een leverancier levert gecorrigeerde bestanden.
3. Gebruikers melden verwarring of verkeerde productselectie door dezelfde EAN.
4. Er wordt productdeduplicatie, automatische merge of voorraadkoppeling gebouwd.

## Auditspoor

- Prod-analyse: `docs/release-readiness/data-issues/prod-cleanup-analysis-2026-06-13.md` (§B2)
- Verse prod-triage-CSV: `C:\Users\jeffrey\HenkeWonen-backups\eans-duplicate-triage-20260613.csv`
  (1.871 groepen, kolommen incl. `crossSupplier`-vlag)
- Volledige read-only backup: `C:\Users\jeffrey\HenkeWonen-backups\prod-backup-20260613-185149.zip`
- Voorganger: `docs/release-readiness/data-issues/duplicate-ean-parkeerbesluit-2026-06-01.md`

## Release-notes-regel (klantcommunicatie)

> *"Bekend datakwaliteitspunt: leveranciers hergebruiken soms hetzelfde EAN-nummer voor verschillende
> producten/varianten (1.871 groepen, vooral Texdecor-behang). De portal gebruikt EAN bewust niet als
> unieke sleutel en voegt nooit automatisch samen; productselectie verloopt via naam, artikelnummer,
> collectie en leverancier. Dit punt is voor de productie-release expliciet geaccepteerd en wordt bewaakt."*

Opgenomen in: `docs/klant/henke-wonen-portal-vrijgave-en-datakwaliteit-2026-06-10.md` §3 (update 2026-06-13).

## Optionele formele bekrachtiging

Deze acceptatie is operationeel vastgelegd door de beheerder. Wil de directie van Henke Wonen een formele
sign-off, voeg dan hieronder naam + datum toe — niet vereist om het besluit van kracht te laten zijn.

- Directie Henke Wonen: __________________________  Datum: __________
