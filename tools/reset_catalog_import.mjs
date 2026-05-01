import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const tenantSlug = process.argv[2] ?? "henke-wonen";

function loadEnv(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0 && !process.env[key]) {
        process.env[key] = rest.join("=");
      }
    }
  } catch {
    // Environment can also be provided by the shell.
  }
}

loadEnv(envPath);

const convexUrl = process.env.PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("PUBLIC_CONVEX_URL is missing. Check .env.local.");
}

const client = new ConvexHttpClient(convexUrl);

console.log(JSON.stringify({ tenantSlug, convexUrl, action: "catalog reset" }, null, 2));
console.log(
  JSON.stringify(
    {
      before: await client.query(api.catalogImport.getCatalogImportStats, { tenantSlug }),
    },
    null,
    2
  )
);

const totals = {};
let iterations = 0;

while (true) {
  iterations += 1;

  const result = await client.mutation(api.catalogImport.resetCatalogChunk, {
    tenantSlug,
    confirm: "RESET_IMPORTED_CATALOG",
    batchSize: 500,
  });

  if (result.done) {
    break;
  }

  totals[result.tableName] = (totals[result.tableName] ?? 0) + result.deleted;

  if (iterations % 10 === 0) {
    console.log(JSON.stringify({ iterations, totals }, null, 2));
  }
}

console.log(
  JSON.stringify(
    {
      done: true,
      iterations,
      deleted: totals,
      after: await client.query(api.catalogImport.getCatalogImportStats, { tenantSlug }),
    },
    null,
    2
  )
);
