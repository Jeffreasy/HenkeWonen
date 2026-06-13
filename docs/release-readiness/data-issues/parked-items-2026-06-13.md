# Bewust geparkeerde data-/ops-punten (2026-06-13)

> Lage-prioriteit punten die bewust **niet** worden opgeruimd, met de reden. Voorkomt dat ze later als
> "vergeten" worden gelezen. Een AI mag prod niet muteren — eventuele opschoning is een eigenaarsactie.

## 1. `productImportRows` staging-bloat
- **Stand:** dev ~232k rijen / ~687 MB, prod ~38.788 rijen (24 batches).
- **Wat het is:** staging-/provenance-rijen van import-runs (`raw`, `normalized`, `importedProductId`,
  `importedPriceIds`, `rowHash`) — koppelen bronregel → product/prijs.
- **Waarom geparkeerd:** verwijderen verliest de import-traceerbaarheid (welke bronregel welk product/prijs
  opleverde). Niet functioneel schadelijk; alleen opslag.
- **Aanbeveling (optioneel, eigenaar):** opschoonbaar **per oude, geslaagde batch** (bewaar de recentste),
  niet als blinde wis-alles. Geen bestaand tool; bouwen on-demand. **Niet urgent.**

## 2. Verweesde tabel `dossierAttachments`
- **Stand:** 0 rijen op prod; staat **niet** in `convex/schema.ts` (legacy/verweesd).
- **Waarom geparkeerd:** leeg → geen dataverlies-risico; harmloos. Convex laat een lege niet-schema-tabel staan.
- **Aanbeveling (optioneel):** in het Convex-dashboard de lege tabel verwijderen, of laten staan. **Geen impact.**

## 3. Duplicate-EAN backlog
- **Stand:** prod 1.871 groepen / 4.393 producten (1.805 intra-leverancier, 66 cross). 
- **Status:** **geaccepteerd** als bekend datakwaliteitspunt voor productie — zie
  `duplicate-ean-prod-acceptatie-2026-06-13.md` (+ `duplicate-ean-parkeerbesluit-2026-06-01.md`). EAN is geen
  unieke productkey; geen auto-merge/-delete. **Geen actie**, tenzij een her-open-trigger optreedt.

## 4. 13 cascade-wezen op prod
- **Stand:** 2 projectRooms, 3 projectTasks, 7 projectWorkflowEvents, 1 quoteLine (resten van verwijderde
  test-projecten/quotes). IDs in `prod-cleanup-analysis-2026-06-13.md` §B1.
- **Status:** **niet** geparkeerd maar wel laag-urgent (onzichtbaar voor gebruikers). Opruimen via het nieuwe
  `deleteDocumentsByIdChunk`-tool (zie `tools/cleanup_orphan_records.mjs`) — eigenaarsactie op prod.
