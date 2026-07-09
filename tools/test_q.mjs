import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

import { loadCatalogToolEnv } from "./catalog_tooling_env.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolEnv = loadCatalogToolEnv({ root, argv: [] });
const client = new ConvexHttpClient(toolEnv.convexUrl);
client.query(api.catalog.core.listProductsForPortal, { 
    tenantSlug: "henkewonen", 
    limit: 5,
    actor: { type: "user", tenantId: "jd783r3sw3rww5v0g7sks4zhmd8a7tt5", role: "admin", _id: "jh79bch7mtt37494wgbqysntqd8a7n3j" } 
}).then(res => console.log(JSON.stringify(res.items.map(p => ({ id: p.id, naam: p.naam, verkoopEenheid: p.verkoopEenheid, eenheid: p.eenheid })), null, 2))).catch(console.error);
