import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const previewPath = resolve(root, "docs/catalog-import-preview.json");
const envPath = resolve(root, ".env.local");
const args = new Set(process.argv.slice(2));

if (!args.has("--legacy-direct-confirm")) {
  throw new Error(
    "Legacy direct catalog import is disabled. Use npm run catalog:import or npm run catalog:import:dev so every import creates productImportBatches and productImportRows."
  );
}

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

function chunk(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

loadEnv(envPath);

const convexUrl = process.env.PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("PUBLIC_CONVEX_URL is missing. Check .env.local.");
}

const payload = JSON.parse(readFileSync(previewPath, "utf8"));
const rows = payload.rows ?? [];
const tenantSlug = payload.tenantSlug ?? "henke-wonen";
const client = new ConvexHttpClient(convexUrl);
const chunks = chunk(rows, 75);
const totals = {
  receivedRows: 0,
  skippedRows: 0,
  insertedProducts: 0,
  updatedProducts: 0,
  insertedPrices: 0,
  updatedPrices: 0,
};

console.log(
  JSON.stringify(
    {
      tenantSlug,
      convexUrl,
      rows: rows.length,
      chunks: chunks.length,
    },
    null,
    2
  )
);

for (let index = 0; index < chunks.length; index += 1) {
  const result = await client.mutation(api.catalogImport.importRows, {
    tenantSlug,
    rows: chunks[index],
  });

  for (const key of Object.keys(totals)) {
    totals[key] += result[key] ?? 0;
  }

  if ((index + 1) % 10 === 0 || index === chunks.length - 1) {
    console.log(
      JSON.stringify(
        {
          chunk: index + 1,
          chunks: chunks.length,
          totals,
        },
        null,
        2
      )
    );
  }
}

console.log(JSON.stringify({ done: true, totals }, null, 2));
