/**
 * run-clear-data.ts — Uitvoeringsscript voor clearTenantData
 *
 * Gebruik (vanuit project-root):
 *   npx convex run portal:clearTenantData '{"tenantSlug":"henke","actor":{"externalUserId":"<jouw-user-id>","authzToken":"<token>"},"confirmPhrase":"JA_VERWIJDER_TESTDATA"}'
 *
 * OF via dit script:
 *   npx tsx scripts/run-clear-data.ts
 *
 * Vereisten:
 *   1. ALLOW_CONVEX_TOOLING=true moet ingesteld zijn in Convex dashboard (Environment Variables)
 *   2. Je moet admin-rol hebben
 *   3. Je hebt een geldig authzToken nodig (kopieer uit browser DevTools → Network → een portal-request)
 *
 * ─── HOE EEN AUTHZ TOKEN KRIJGEN ───────────────────────────────────────────────
 *   1. Open het portal in de browser
 *   2. Open DevTools → Network
 *   3. Zoek een POST naar convex.cloud met "mutation"
 *   4. In de request body zie je { "actor": { "authzToken": "..." } }
 *   5. Kopieer dat token — het is 8 uur geldig
 * ────────────────────────────────────────────────────────────────────────────────
 *
 * VERWACHT RESULTAAT (JSON):
 * {
 *   "success": true,
 *   "tenant": "henke",
 *   "totalDeleted": 247,
 *   "counts": {
 *     "measurementLines": 12,
 *     "measurementRooms": 8,
 *     "measurements": 3,
 *     "quoteLines": 45,
 *     "quotes": 9,
 *     "invoices": 4,
 *     "supplierOrders": 2,
 *     "projectTasks": 18,
 *     "projectWorkflowEvents": 31,
 *     "timelineEvents": 22,
 *     "projectRooms": 14,
 *     "projects": 7,
 *     "customerContacts": 23,
 *     "customers": 49
 *   }
 * }
 */

// Dit bestand is documentatie — de daadwerkelijke aanroep gaat via het Convex dashboard of CLI.
// Zie de instructies in de comments hierboven.

export {};
