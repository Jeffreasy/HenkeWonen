// Zet de btw-modus van alle adviesprijzen van één leverancier om, zonder
// her-import. Standaard dry-run; pas --apply voert echt uit.
//
//   node tools/set_supplier_vat_mode.mjs --supplier="Masureel" --mode=inclusive
//   node tools/set_supplier_vat_mode.mjs --supplier="Masureel" --mode=inclusive --apply
//
// De keuze wordt ook op de leverancier vastgelegd (suppliers.verkoopBtwModus)
// en is leidend bij her-imports; vat_config.json is alleen nog de default voor
// leveranciers zonder expliciete instelling. Dit kan ook via het portaal:
// /portal/leveranciers → kolom "Btw verkoopprijzen".
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createToolMutationActor } from "./authz_actor.mjs";
import { loadCatalogToolEnv, requireCatalogToolTarget } from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const toolEnv = loadCatalogToolEnv({ root, argv });

requireCatalogToolTarget(toolEnv, {
  operation: "btw-modus wijziging",
  mutates: true,
  requireAuthzSecret: true,
  productionConfirmFlag: "--confirm-production-vat-apply"
});

const getArg = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
};

const supplierName = getArg("supplier");
const mode = getArg("mode");
const apply = argv.includes("--apply");

if (!supplierName || !["exclusive", "inclusive"].includes(mode ?? "")) {
  console.error('Gebruik: node tools/set_supplier_vat_mode.mjs --supplier="<naam>" --mode=exclusive|inclusive [--apply]');
  process.exit(1);
}

const client = new ConvexHttpClient(toolEnv.convexUrl);
const actor = createToolMutationActor(toolEnv.tenantSlug);

let cursor = null;
let totalPatched = 0;
let totalWould = 0;
let round = 0;

do {
  const result = await client.mutation(api.catalog.v2_import.setSupplierSalesVatMode, {
    tenantSlug: toolEnv.tenantSlug,
    actor,
    supplierName,
    mode,
    dryRun: !apply,
    cursor: cursor ?? undefined,
  });
  if (!result.supplierFound) {
    console.error(`Leverancier "${supplierName}" niet gevonden.`);
    process.exit(1);
  }
  totalPatched += result.patched;
  totalWould += result.wouldPatch ?? 0;
  cursor = result.continueCursor;
  round++;
  console.log(`- chunk ${round}: scanned=${result.scanned} ${apply ? `patched=${result.patched}` : `zou patchen=${result.wouldPatch}`}`);
} while (cursor);

console.log(apply
  ? `Klaar: ${totalPatched} adviesprijzen van "${supplierName}" op ${mode} gezet.`
  : `Dry-run: ${totalWould} adviesprijzen van "${supplierName}" zouden op ${mode} gezet worden. Draai opnieuw met --apply.`);
