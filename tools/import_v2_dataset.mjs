import fs from "node:fs/promises";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor } from "./authz_actor.mjs";
import { loadCatalogToolEnv, requireCatalogToolTarget } from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });

// De V2-import is een upsert op leverancier+sku: bestaande producten worden
// bijgewerkt (stabiele productId's, dus offertes/bestellingen blijven werken),
// nieuwe toegevoegd, en producten die van de prijslijst verdwenen worden
// GEARCHIVEERD. Op production blijft een expliciete bevestigingsvlag verplicht:
// de import vervangt wel alle prijzen van de aangeleverde leveranciers.
requireCatalogToolTarget(toolEnv, {
  operation: "V2 catalogus-import",
  mutates: true,
  requireAuthzSecret: true,
  productionConfirmFlag: "--confirm-production-v2-import"
});

const convexUrl = toolEnv.convexUrl;
const client = new ConvexHttpClient(convexUrl);
const tenantSlug = toolEnv.tenantSlug;
const actor = createToolMutationActor(tenantSlug);

const JSONL_DIR = "C:\\Users\\jeffrey\\Desktop\\HenkeWonenDATAV2\\DATACONVEX";
const CHUNK_SIZE = 100;

// Convex kan een mutatie afwijzen met OptimisticConcurrencyControlFailure
// wanneer een andere sessie tegelijk dezelfde documenten raakt (bv. de
// users-tabel via ensureUser). Dat is transient — met backoff opnieuw proberen.
async function mutationWithRetry(fn, args, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await client.mutation(fn, args);
    } catch (error) {
      lastError = error;
      const message = String(error?.message ?? error);
      if (!message.includes("OptimisticConcurrencyControlFailure")) throw error;
      const delay = 500 * attempt;
      console.warn(`- OCC-conflict, poging ${attempt}/${attempts} — opnieuw over ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

async function run() {
  console.log(`Starting V2 upsert-import for tenant: ${tenantSlug} at ${convexUrl}`);

  // Alles wat de import deze run aanraakt krijgt gewijzigdOp >= runStart; wat
  // van een aangeleverde leverancier daarna nog vóór runStart staat, is van de
  // prijslijst verdwenen en wordt in stap 4 gearchiveerd.
  const runStart = Date.now();

  // 1/2 (wissen van producten en EAN-beoordelingen) zijn vervallen: de import
  // upsert nu op leverancier+sku, dus productId's en beoordelingen blijven.
  console.log("\n3. Clearing old import batches, profiles and logs...");
  let deletedLogs = 0;
  let hasMoreLogs = true;
  while (hasMoreLogs) {
    const logsResult = await mutationWithRetry(api.catalog.v2_import.clearOldImportData, {
      tenantSlug,
      actor,
    });
    deletedLogs += logsResult.deleted;
    hasMoreLogs = logsResult.moreRows;
    if (logsResult.deleted > 0) {
      console.log(`- Deleted ${logsResult.deleted} old logs (Total so far: ${deletedLogs})...`);
    }
  }
  console.log(`- Deleted ${deletedLogs} old import batches and profiles.`);

  const supplierCounts = new Map();

  const files = await fs.readdir(JSONL_DIR);
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    
    console.log(`\nImporting ${file}...`);
    const filePath = path.join(JSONL_DIR, file);
    
    const fileContent = await fs.readFile(filePath, "utf-8");
    const lines = fileContent.split("\n").filter(l => l.trim() !== "");
    
    // Parse to ensure valid JSON and track counts
    const parsedRows = [];
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        parsedRows.push(row);
        
        const supName = row.supplier;
        if (!supplierCounts.has(supName)) {
          supplierCounts.set(supName, { productCount: 0, priceCount: 0 });
        }
        const stats = supplierCounts.get(supName);
        stats.productCount++;
        if (row.purchase_price_excl !== undefined && row.purchase_price_excl > 0) stats.priceCount++;
        if (row.purchase_price_excl_b !== undefined && row.purchase_price_excl_b > 0) stats.priceCount++;
        if (row.sales_price !== undefined && row.sales_price > 0) stats.priceCount++;
      } catch (e) {
        console.error(`Invalid JSON in ${file}:`, line);
      }
    }
    
    let fileInserted = 0;
    let fileUpdated = 0;
    for (let i = 0; i < parsedRows.length; i += CHUNK_SIZE) {
      const chunk = parsedRows.slice(i, i + CHUNK_SIZE);
      console.log(`- Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(parsedRows.length / CHUNK_SIZE)} (${chunk.length} items)...`);

      const result = await mutationWithRetry(api.catalog.v2_import.importChunk, {
        tenantSlug,
        actor,
        rows: chunk
      });
      fileInserted += result.inserted ?? 0;
      fileUpdated += result.updated ?? 0;
    }

    console.log(`Finished importing ${file} (${fileInserted} nieuw, ${fileUpdated} bijgewerkt).`);
  }

  // 3b. Archiveer producten van aangeleverde leveranciers die niet meer op de
  // prijslijst staan (deze run niet aangeraakt). Alleen leveranciers uit de
  // dataset: andere leveranciers blijven volledig ongemoeid.
  console.log("\n3b. Archiving vanished products per supplier...");
  let totalArchived = 0;
  for (const supplierName of supplierCounts.keys()) {
    let cursor = null;
    let archivedForSupplier = 0;
    for (let guard = 0; guard < 500; guard += 1) {
      const result = await mutationWithRetry(api.catalog.v2_import.archiveVanishedProducts, {
        tenantSlug,
        actor,
        supplierName,
        runStartMs: runStart,
        cursor
      });
      archivedForSupplier += result.archived ?? 0;
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    if (archivedForSupplier > 0) {
      console.log(`- ${supplierName}: ${archivedForSupplier} producten gearchiveerd (niet meer op de prijslijst)`);
    }
    totalArchived += archivedForSupplier;
  }
  console.log(`Archived ${totalArchived} vanished products.`);

  // 4. Update Supplier batches for accurate 'bijgewerkt' timestamps in portal
  console.log("\n4. Updating supplier latest import timestamps...");
  const countsArray = Array.from(supplierCounts.entries()).map(([supplier, counts]) => ({
    supplier,
    productCount: counts.productCount,
    priceCount: counts.priceCount
  }));
  
  const fixResult = await mutationWithRetry(api.catalog.v2_import.fixSupplierBatches, {
    tenantSlug,
    actor,
    counts: countsArray
  });
  console.log(`Fixed ${fixResult.fixed} suppliers so they show up correctly in the portal.`);
  
  // 5. Sync supplier prijslijst status based on actual imported products
  console.log("Syncing supplier prijslijstStatus based on actual products...");
  const syncResult = await mutationWithRetry(api.catalog.v2_import.syncSupplierStatuses, {
    tenantSlug,
    actor,
  });
  console.log(`Successfully synced status for ${syncResult.updated} suppliers!`);
  
  // 6. Optioneel: leveranciers zonder producten verwijderen. Standaard UIT,
  // want de leverancierslijst is óók opvolgadministratie (contactgegevens,
  // notities, "prijslijst aangevraagd") die een catalogusimport niet mag wissen.
  if (process.argv.includes("--clean-legacy-suppliers")) {
    console.log("Cleaning up legacy suppliers with 0 products (--clean-legacy-suppliers)...");
    const cleanResult = await mutationWithRetry(api.catalog.v2_import.cleanLegacySuppliers, {
      tenantSlug,
      actor,
    });
    console.log(`Deleted ${cleanResult.deletedCount} legacy suppliers.`);
  } else {
    console.log(
      "Leveranciers zonder producten blijven staan (opvolgadministratie). " +
      "Gebruik --clean-legacy-suppliers om ze bewust te verwijderen."
    );
  }
  
  console.log("\nAll V2 dataset files imported successfully!");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
