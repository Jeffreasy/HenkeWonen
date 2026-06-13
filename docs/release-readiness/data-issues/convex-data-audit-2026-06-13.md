# Geconsolideerd Auditrapport — Convex dev-data Henke Wonen

Datum: 2026-06-13 · Tenant: `md7f9ecc27at3eqn5wvbshgrnx85sen9` (1 tenant, status active) · Bron: 5 domein-audits met adversariële verificatie van high/critical-bevindingen.

---

## 1. Eindoordeel

De data is **goed maar niet "absoluut goed"**. De vier recente reparaties zijn aantoonbaar volledig doorgevoerd en de kern-integriteit is uitzonderlijk schoon: 0 enum-schendingen, 0 tenant-afwijkingen, 0 orphaned product-/categorie-/supplier-FK's in de catalogus, 100% prijsdekking en rekenkundig sluitende quote-denormalisatie tot op de cent. Wat een onvoorwaardelijk "absoluut goed" in de weg staat is een kleine maar harde restlijst: 31 BTW-inclusieve adviesprijzen die door de reparatie als exclusief zijn gemarkeerd **zonder bedragomrekening** (echte prijsfout), 988 productnamen met gelekte bronbestandsnaam, en een handvol dangling FK's / status-machine-tegenstrijdigheden in de business-data. Geen daarvan is systemisch, maar de 31 prijzen en de 988 namen zijn klant-/offerte-zichtbaar en moeten gecorrigeerd worden voordat het predicaat "absoluut goed" terecht is.

---

## 2. Verificatie van de 4 recente reparaties

| # | Reparatie | Oordeel | Cijfers |
|---|-----------|---------|---------|
| 1 | **BTW = exclusive** | **VOLLEDIG** (met 1 randgeval, zie Critical) | `vatMode` 100% "exclusive": 74.225/74.225, 0 "unknown", 0 "inclusive". Bevestigd in alle 5 domeinen, per `priceType` én per `sourceColumnName` geen afwijker. `vatRate` 100% = 21. |
| 2 | **Pseudo-prijzen weg** | **VOLLEDIG** | 0 rijen met `sourceColumnName` beginnend met "Code prix" of bevattend "Qté multiple d'achat" / "Unité de vente". Case-insensitive geverifieerd over alle 53 distinct kolomnamen. |
| 3 | **Texdecor → Behang** | **VOLLEDIG** | Alle 7.134 wallpaper-producten in "Behang" (productKind wallpaper, unit roll). Categorie "Overig" = 0 producten. 0 Casadeco/Caselio/Casamance nog in "Overig". Panelen/gordijnstoffen blijven terecht buiten Behang. |
| 4 | **packageContentM2 < 100** | **VOLLEDIG** | 0 producten met `packageContentM2` >= 100. |

**Kanttekening bij reparatie 1:** volledig qua flag-zetting, maar de blinde flip naar "exclusive" heeft 31 expliciet BTW-inclusieve adviesprijzen niet omgerekend — zie Critical-1. De reparatie is dus *technisch volledig uitgevoerd* maar *inhoudelijk te grofmazig* geweest.

---

## 3. Bevindingen geprioriteerd (bevestigd/plausibel)

### CRITICAL

**C-1 · 31 BTW-inclusieve adviesprijzen nu als exclusief zonder omrekening** (n=31, 31 distinct producten) — *geverifieerd BEVESTIGD*
Bronkolom "Adviesverkoopprijs incl. BTW. per verpakking" is expliciet inclusief BTW, maar staat na de reparatie op `vatMode` "exclusive" terwijl `amount === ruwe sourceValue` (geen omrekening). Gevolg: deze adviesprijzen worden ~21% te hoog naar klant gepresenteerd. Dit is het enige echte prijs-integriteitsprobleem in 74.225 rijen, maar het is klantzichtbaar.
*Ik til dit van "high" (zoals de bron-audit het labelde) naar Critical: het is de enige bevinding die direct verkeerde geldbedragen richting klant oplevert.*
**Herstel:** voor deze 31 rijen `amount = sourceValue / 1,21` (afronden op cent) en `vatMode` op "exclusive" laten, OF `vatMode` terug naar "inclusive" zetten. Selecteer op `sourceColumnName = "Adviesverkoopprijs incl. BTW. per verpakking"`. Verifieer daarna dat geen andere inclusief-BTW-bronkolommen blind zijn geflipt.

### HIGH

**H-1 · 988 productnamen met gelekte bronbestandsnaam** (n=988) — *geverifieerd BEVESTIGD*
988 `products.name`-velden bevatten de string "henke-swifterbant-artikeloverzicht" (import-artefact). Klant-/offerte-zichtbaar.
**Herstel:** strip het bestandsnaam-fragment uit `name` via gerichte string-replace; valideer dat er geen lege namen overblijven en dat unieke namen behouden blijven.

**H-2 · 21 catalogDataIssues verwijzen naar 42 niet-bestaande producten** (n=21 issues → 42 dangling productrefs) — *geverifieerd BEVESTIGD*
Dangling FK's: de gerefereerde producten bestaan niet meer. (cross-cutting telt dit als onderdeel van 42 dangling refs.)
**Herstel:** deze 21 issues `resolve`/sluiten of opschonen; productrefs zijn niet meer reviewbaar.

**H-3 · 2 projecten vast in `quote_draft` ondanks accept/closed-events** (n=2) — *geverifieerd BEVESTIGD*
Projecten hebben `acceptedAt` gezet en quote_accepted/closed `projectWorkflowEvents`, maar `status` bleef "quote_draft". Status-machine-inconsistentie.
**Herstel:** status herafleiden uit de workflow-events (naar accepted/closed); root-cause in de statusovergang-trigger onderzoeken.

**H-4 · measurementLine 'converted' met dangling `convertedQuoteLineId`** (n=1) — *geverifieerd BEVESTIGD*
Verwijst naar een verwijderde quoteLine.
**Herstel:** `convertedQuoteLineId` legen + status terug van "converted", of de bijbehorende quoteLine herstellen.

**H-5 · quoteLine met orphaned `productId`** (n=1) — *geverifieerd BEVESTIGD*
Verwijst naar een niet-bestaand product.
**Herstel:** `productId` corrigeren naar bestaand product of de regel ontkoppelen/verwijderen; verifieer dat de quote-totalen daarna nog sluiten.

### MEDIUM

**M-1 · Duplicate-EAN-groepen niet geparkeerd als catalogDataIssue** (products: n=51 · cross-cutting: n=56) — *plausibel; telling licht inconsistent tussen audits*
Niet alle duplicate-EAN-clusters zijn als `catalogDataIssue` vastgelegd (51 resp. 56 ongetraceerd). Niet hetzelfde als de 1.816 reeds geparkeerde open issues.
**Herstel:** ontbrekende clusters alsnog parkeren als `duplicate_ean`-issue; de 5-cluster-verschil tussen beide audits uitzoeken (telmethode/peilmoment).

**M-2 · 1.816 open `duplicate_ean`-issues vereisen handmatige review** (n=1816 open; 1842 totaal, waarvan 21 resolved + 5 reviewed) — *plausibel*
Geen bug — backlog. Vraagt handmatige triage.
**Herstel:** review-workflow inplannen; overweeg bulk-regels voor evidente varianten (kleur/maat).

**M-3 · productImportRows staging-bloat 671–672 MB** (n=232.687) — *plausibel* (zie ook §4)
**Herstel:** geïmporteerde/genegeerde staging-rijen archiveren of opschonen na succesvolle batches.

**M-4/M-5 · 2 quotes met `acceptedAt` maar status "draft"** (n=2) — *plausibel; hangt samen met H-3*
Status/timestamp tegenstrijdig — vrijwel zeker dezelfde 2 cases als H-3, één laag dieper (quote i.p.v. project).
**Herstel:** samen met H-3 oplossen; quote-status herafleiden uit `acceptedAt`/events.

### LOW

- **L-1 · 2 producten zonder retail/advice_retail-prijs** (n=2) — krijgen geen richtprijs. Herstel: adviesprijs aanvullen of bewust markeren.
- **L-2 · dossierAttachments/catalogDataIssues dangling cluster** (n=42) — overlapt met H-2 (42 dangling refs). Herstel: zie H-2.
- **L-3 · 977 valide + 494 warning staging-rijen nooit geïmporteerd** (n=1471) — controleren of bewust genegeerd; anders herimporteren.
- **L-4 · 6 failed import-batches blijven staan** (n=6) — diagnostische foutmeldingen; archiveren na analyse.
- **L-5 · 5 ongebruikte productCollections met onzin-namen** (n=5, import-artefacten) — verwijderen (1029/1034 wél gebruikt).
- **L-6 · 4 inactieve importProfiles missen supplierId-koppeling** (n=4) terwijl de supplier bestaat — koppeling herstellen of profiel opruimen.
- **L-7 · 2 duplicate customers** (n=2, zelfde e-mail, near-duplicate naam) — dev-data; mergen of negeren.

### Verworpen / niet-bevestigde high/critical-bevindingen

Geen enkele high/critical-bevinding is bij adversariële verificatie *verworpen* — alle 6 de geverifieerde high/critical-claims (C-1, H-1 t/m H-5) zijn BEVESTIGD met exacte tellingen. Wel gedegradeerd qua status, niet verworpen: de "reparatie volledig"-claims zijn `info`, geen bug. Te noteren: de cross-cutting-audit labelde de twee dangling business-FK's (measurementLines/quoteLines) als **medium**, terwijl de business-data-audit ze als **high** classificeerde — ik volg de business-data-audit (H-4/H-5), want een dangling FK in offerte-/meetdata is zwaarder dan een telkwestie. Dit is een *prioriteitsverschil*, geen verwerping.

---

## 4. Datakwaliteit-observaties (geen bug, wel aandacht)

- **Staging-bloat:** `productImportRows` 671–672 MB / 232.687 rijen (188.200 imported, 43.016 ignored, 977 valid-niet-geïmporteerd, 494 warning). Verwijderbare opslag na geslaagde import; grootste storage-post van de deployment.
- **Geparkeerde duplicate-EAN-backlog:** 1.816 open `duplicate_ean`-issues (van 1.842 totaal). Bewust geparkeerd, vraagt handmatige review — geen integriteitsfout, wel openstaand werk. Naast deze backlog staan nog 51–56 *ongetraceerde* clusters (M-1).
- **Ongebruikte/zwakke referentiedata:** 5 ongebruikte productCollections met import-artefact-namen; 15 suppliers die door geen enkel product gerefereerd worden; 26 suppliers zonder optioneel `status`-veld; categories zonder hiërarchie (alle 25 `parentCategoryId` leeg — mogelijk bewust plat model).
- **Dev-artefacten:** 2 users delen e-mailadres (dev-accounts), 2 duplicate customers. Onschuldig in dev, opruimen vóór prod-promotie.
- **Lege tabellen (verwacht):** invoices, supplierOrders, timelineEvents, dossierAttachments = 0 — bevestigd leeg, conform dev-fase.

---

## 5. Niet geverifieerd / aanbevolen vervolgcontroles

1. **Overige inclusief-BTW-bronkolommen:** alleen de kolom "Adviesverkoopprijs incl. BTW. per verpakking" is op niet-omgerekende inclusief-BTW gecontroleerd (31 hits). Aanbevolen: scan alle 53 distinct `sourceColumnName`-waarden op "incl"/"inclusief"/"BTW"/"TTC" om te bevestigen dat C-1 het enige inclusief-BTW-cluster is.
2. **Telverschil duplicate-EAN (51 vs 56):** twee audits rapporteren een ander aantal ongetraceerde clusters. Eén canonieke telling produceren (zelfde definitie van "cluster" en "geparkeerd").
3. **Samenhang H-3 ↔ M-4/M-5:** bevestigen dat de 2 vastzittende projecten exact corresponderen met de 2 quotes met `acceptedAt`+draft (waarschijnlijk dezelfde cases, niet apart geteld).
4. **Volledige FK-sweep business-data:** alleen high/critical-FK's zijn adversarieel herverifieerd; een complete cross-tabel orphan-scan over measurements/quotes/projects is aanbevolen nu het datavolume nog klein is (7 projecten, 7 quotes).
5. **Impact-bevestiging C-1 in offertes:** controleren of een van de 31 te-hoge adviesprijzen al in een uitgebrachte quoteLine is beland (anders alleen catalogus-correctie nodig, geen offerte-rectificatie).
6. **Naamcorrectie H-1 reversibiliteit:** vóór de bulk-strip van "henke-swifterbant-artikeloverzicht" een dry-run draaien om te bevestigen dat geen 988 namen na strippen leeg of niet-uniek worden.

---

**Samengevat:** 1 Critical (31 verkeerd geprijsde adviesprijzen), 5 High (988 namen + 4 referentie-/status-defecten), 5 Medium en 7 Low. Geen verworpen high/critical. Na correctie van C-1 en H-1 is de data klant-veilig; de overige punten zijn opruimwerk en backlog.