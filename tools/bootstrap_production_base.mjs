import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCatalogToolEnv,
  PRODUCTION_CONVEX_DEPLOYMENT,
  requireCatalogToolTarget,
  targetSummary
} from "./catalog_tooling_env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: process.argv.slice(2) });

requireCatalogToolTarget(toolEnv, {
  operation: "production basisconfig bootstrap",
  mutates: true,
  productionConfirmFlag: "--confirm-production-bootstrap"
});

if (toolEnv.target !== "production") {
  throw new Error("Deze bootstrap is alleen bedoeld voor production.");
}

function run(command) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, {
      cwd: root,
      shell: true,
      env: {
        ...process.env,
        CONVEX_DEPLOYMENT: PRODUCTION_CONVEX_DEPLOYMENT,
        FORCE_COLOR: "0",
        NO_COLOR: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(output);
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

function parseJsonFromOutput(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Kon JSON-output niet lezen: ${output}`);
  }

  return JSON.parse(output.slice(start, end + 1));
}

async function queryCounts() {
  const output = await run(
    "npx convex run --deployment accomplished-kangaroo-354 --inline-query \"return { tenants: (await ctx.db.query('tenants').collect()).length, users: (await ctx.db.query('users').collect()).length, customers: (await ctx.db.query('customers').collect()).length, projects: (await ctx.db.query('projects').collect()).length, quotes: (await ctx.db.query('quotes').collect()).length, suppliers: (await ctx.db.query('suppliers').collect()).length, categories: (await ctx.db.query('categories').collect()).length, importProfiles: (await ctx.db.query('importProfiles').collect()).length, products: (await ctx.db.query('products').collect()).length, productPrices: (await ctx.db.query('productPrices').collect()).length, productImportBatches: (await ctx.db.query('productImportBatches').collect()).length, productImportRows: (await ctx.db.query('productImportRows').collect()).length }\""
  );

  return parseJsonFromOutput(output);
}

function assertNoBusinessOrCatalogData(counts) {
  const protectedTables = [
    "customers",
    "projects",
    "quotes",
    "products",
    "productPrices",
    "productImportBatches",
    "productImportRows"
  ];
  const nonEmpty = protectedTables.filter((table) => (counts[table] ?? 0) > 0);

  if (nonEmpty.length > 0) {
    throw new Error(
      `Bootstrap gestopt: production bevat al business/catalogusdata in ${nonEmpty.join(", ")}.`
    );
  }
}

console.log(JSON.stringify({ ...targetSummary(toolEnv), action: "bootstrap base config" }, null, 2));

const before = await queryCounts();
assertNoBusinessOrCatalogData(before);
console.log(JSON.stringify({ before }, null, 2));

let toolingEnabled = false;

try {
  await run("npx convex env set ALLOW_CONVEX_TOOLING true --deployment accomplished-kangaroo-354");
  toolingEnabled = true;
  await run("npx convex run seed:run --deployment accomplished-kangaroo-354");
} finally {
  if (toolingEnabled) {
    await run("npx convex env remove ALLOW_CONVEX_TOOLING --deployment accomplished-kangaroo-354");
  }
}

const after = await queryCounts();
assertNoBusinessOrCatalogData(after);
console.log(JSON.stringify({ done: true, before, after }, null, 2));
