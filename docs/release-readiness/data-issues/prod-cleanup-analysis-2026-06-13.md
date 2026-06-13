# Productie opruim-analyse — Henke Wonen (2026-06-13)

> **Bron:** read-only snapshot-export van `prod:accomplished-kangaroo-354`
> (`prod-backup-20260613-185149.zip`, 35 MB, gedownload 2026-06-13 18:52). Alle cijfers hieronder zijn
> streamend over de JSONL berekend; er is **niets gemuteerd** op productie.
> **Context:** deze analyse hoort bij de go-live-verificatie van de richtprijs-feature. Zie
> `docs/technisch/sessie-overdracht-2026-06-13.md` §8 (openstaande punten).

---

## A. §7 data-verificatie — BEVESTIGD (exact gelijk aan doelstand)

| Metriek | Resultaat | Doel (§7) |
|---|---|---|
| productPrices totaal | **73.688** | 73.688 ✅ |
| vatMode-verdeling | **73.657 exclusive + 31 inclusive + 0 unknown** | idem ✅ |
| products totaal | **24.983** | 24.983 ✅ |
| packageContentM2 ≥ 100 | **0** | 0 ✅ |
| productnamen met bestandsnaam-lek | **0** | 0 ✅ |
| Texdecor in categorie "Overig" | **0** (sterker: 0 producten in "Overig" totaal) | 0 ✅ |

De data-reparaties van de vorige sessie houden stand op productie. Geen actie nodig.

---

## B. Opruim-targets (§8) — bevindingen + eigenaarsacties

> ⚠️ Een AI mag productie niet muteren (§6.1 van de overdracht). Alle *deletes* hieronder zijn
> **eigenaarsacties**. De identificatie is gedaan; de IDs/commando's staan klaar.

### B1. Cascade-wezen — **exact 13** (resten van verwijderde test-projecten/quotes)

Op productie staan nog maar **1 echt project + 1 echte quote** (+ 31 klanten). De 13 wezen verwijzen
naar inmiddels verwijderde ouders:

| Tabel | Aantal | Document-IDs |
|---|---:|---|
| `projectRooms` | 2 | `m577fkfsp3c2bppkrmrsbz606588dn69`, `m57914wby4jcspx11e4pcx1bsh88cdcm` |
| `projectTasks` | 3 | `ns70tjtf30pj8dk64744zap9v988c0r7`, `ns74qyzs2wts2dtzt0yjt6rhr588dass`, `ns7a3hr3zw4rvjpeffvmmd30g588cetz` |
| `projectWorkflowEvents` | 7 | `m9720rj4kwh0zaczpejq141kws88c5dr`, `m973gdh3rk2nkk1vvd95efknes88dvf6`, `m9748xkss5xxv5kf4rd719g4w188cp9f`, `m974zfn54v6rvx2mvarn9hje5588cq0n`, `m97afvnp742yc8nw8g38wrstf188c06y`, `m97akxxxrjw0q0cgta0asysjfd88crbp`, `m97ft6nj4gqhz20gny8j8tgmz188cwwr` |
| `quoteLines` | 1 | `mh77mas12gtr0dsf82wpd06md588dp8t` |

**Aanbevolen eigenaarsactie (laagste risico voor 13 records):** verwijder ze in het Convex-dashboard
→ Data → betreffende tabel → zoek op `_id` → Delete. Dashboard:
`https://dashboard.convex.dev/d/accomplished-kangaroo-354/data`.

**Alternatief (herhaalbaar/scriptbaar):** er is nog geen delete-tool. Op verzoek bouw ik een veilige
chunked maintenance-mutatie `deleteDocumentsByIdChunk(ids, confirm, dryRun)` in
`convex/catalog/maintenance.ts` + driver (zelfde patroon als de bestaande repair-tools:
admin-rol + letterlijke `confirm` + dryRun-default). Vereist daarna een prod-deploy + run door de eigenaar.

### B2. Duplicate-EAN — **geparkeerd besluit; productie-acceptatie is een open governance-punt**

Prod-actuele stand (gegroepeerd per EAN binnen de tenant):

| Metriek | Prod 2026-06-13 | Dev 2026-06-01 (parkeerbesluit) |
|---|---:|---:|
| Duplicate-EAN groepen | **1.871** | 1.821 |
| Producten in groepen | **4.393** | 4.278 |
| — waarvan intra-leverancier (echte dedup-kandidaten) | **1.805** | — |
| — waarvan cross-leverancier (waarschijnlijk legitiem) | **66** | — |

Dit is **niet** zomaar opruimwerk: `duplicate-ean-parkeerbesluit-2026-06-01.md` bepaalt expliciet
**geen auto-merge / geen auto-delete**, EAN is **niet** de unieke productkey, en de bulk zit in
Texdecor-collectie/artikelnummer-hergebruik (Casadeco/Caselio/Casamance) — wat exact strookt met de
1.805 intra-leverancier groepen hierboven.

> **⚠️ Governance-gate:** het parkeerbesluit stelt dat dit voor productie alleen acceptabel is als
> **bekend datakwaliteitspunt mét expliciete release-acceptatie** ("zonder die acceptatie blijft het een
> productiepoort"). De richtprijs-feature staat nu live op prod. **Actie eigenaar:** leg de release-acceptatie
> vast (release notes / besluitregel) dat EAN-duplicaten een geaccepteerd, bekend punt zijn. De feature
> respecteert de guardrails al (toont naam/artikelnummer/collectie/leverancier; gebruikt EAN niet als key).

**Verse prod-triage-export (read-only):** `C:\Users\jeffrey\HenkeWonen-backups\eans-duplicate-triage-20260613.csv`
— kolommen: `ean, productCount, crossSupplier, productId, articleNumber, supplier, brand, name`, gesorteerd op
groepsgrootte. Bruikbaar voor handmatige triage zónder de data opnieuw te exporteren.

### B3. `productImportRows` staging-bloat — **38.788 rijen / 24 batches** (optioneel)

Komt overeen met de verwachte ~39k. **Caveat:** deze rijen bevatten import-provenance
(`importedProductId`, `importedPriceIds`, `rowHash`) — verwijderen verliest de traceerbaarheid van welke
bronregel welk product/prijs opleverde. Alleen opruimen als opslag een echt probleem is; overweeg per-batch
te bewaren wat recent/relevant is. Geen bestaand tool; op verzoek bouw ik een chunked delete per `batchId`.
**Niet urgent.**

### B4. `productCollections` — **niets te doen (correctie op §8)**

§8 noemde "ongebruikte productCollections met onzin-namen". Op prod zijn **alle 1.017 collecties in
gebruik** (0 ongebruikt; elke collectie wordt door ≥1 product gerefereerd via `collectionId`). De namen
zijn cosmetisch rommelig, maar verwijderen zou productreferenties breken. **Geen opruimactie.**

### B5. `dossierAttachments` — **lege wees-tabel** (laag, harmloos)

0 rijen, en de tabel staat niet in `convex/schema.ts`. Geen data om te verliezen. Eventueel op te ruimen
door de lege tabel in het Convex-dashboard te verwijderen. **Harmloos; mag blijven staan.**

### B6. Overige lege tabellen (informatief, géén actie)

`measurements`, `measurementRooms`, `measurementLines`, `timelineEvents`, `invoices`, `customerContacts`,
`catalogDataIssues` zijn allemaal **0 rijen** op prod — legitiem (feature nog niet door pilot gebruikt
resp. nog niet gevuld). Let op: `catalogDataIssues` is leeg, dus duplicate-EAN-signalen staan op prod
(anders dan op dev) **niet** geparkeerd in die tabel — zie B2 voor de governance-route.

---

## C. Samenvatting eigenaarsacties

| # | Actie | Urgentie | Wie |
|---|---|---|---|
| 1 | 13 cascade-wezen verwijderen (IDs in B1) via dashboard | laag | eigenaar |
| 2 | Release-acceptatie EAN-duplicaten vastleggen (B2 governance-gate) | **besluit** | eigenaar |
| 3 | (optioneel) `productImportRows` opschonen — let op provenance | laag | eigenaar |
| 4 | `dossierAttachments` lege tabel droppen | zeer laag | eigenaar / negeren |
| — | `productCollections` | n.v.t. | niets te doen |

Op verzoek lever ik de delete-tooling (B1/B3) als veilige, dry-run-bare maintenance-mutatie + driver.
