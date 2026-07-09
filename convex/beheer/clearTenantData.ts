/**
 * clearTenantData — Admin-only mutatie om testdata te verwijderen.
 *
 * Bewaart:
 *   tenants, users, categories, suppliers, brands, productCollections,
 *   products, productPrices, importProfiles, wasteProfiles,
 *   serviceCostRules, quoteTemplates, priceLists,
 *   productImportBatches, productImportRows, catalogDataIssues
 *
 * Verwijdert (in dependency-volgorde, kind voor ouder):
 *   measurementLines → measurementRooms → measurements
 *   quoteLines → quotes → invoices → supplierOrders
 *   projectTasks → projectWorkflowEvents
 *   projectRooms → projects → customerContacts → customers
 *
 * Vereist: ALLOW_CONVEX_TOOLING=true in de Convex environment variables
 * Vereist: confirmPhrase = "JA_VERWIJDER_TESTDATA"
 *
 * INTERN (internalMutation): NIET aanroepbaar via de publieke client-API. Alleen via het Convex
 * dashboard of `npx convex run` (deploy-key-auth). ALLOW_CONVEX_TOOLING + confirmPhrase zijn extra sloten.
 */
import { internalMutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { requireConvexToolingEnabled } from "../authz";

/**
 * Verwijdert alle records in een tabel die horen bij de opgegeven tenantId.
 * Gebruikt het opgegeven index-pad om efficiënt te paginen.
 * Geeft het aantal verwijderde records terug.
 */
async function deleteAllForTenant(
  ctx: any,
  tableName: string,
  tenantId: any,
  indexName = "by_tenant"
): Promise<number> {
  let deleted = 0;

  // Verwijder in batches van 100 om mutation-timeout te vermijden
  while (true) {
    const batch = await ctx.db
      .query(tableName)
      .withIndex(indexName, (q: any) => q.eq("tenantId", tenantId))
      .take(100);

    if (batch.length === 0) break;

    for (const doc of batch) {
      await ctx.db.delete(doc._id);
      deleted += 1;
    }
  }

  return deleted;
}

export const clearTenantData = internalMutation({
  args: {
    tenantSlug: v.string(),
    /**
     * Veiligheidsconfirmatie: moet exact "JA_VERWIJDER_TESTDATA" zijn.
     * Voorkomt accidenteel aanroepen.
     */
    confirmPhrase: v.string()
  },
  handler: async (ctx, args) => {
    // 1. Tooling-gate: vereist expliciete opt-in via env var ALLOW_CONVEX_TOOLING=true
    requireConvexToolingEnabled("clearTenantData");

    // 2. Bevestigingszin valideren
    if (args.confirmPhrase !== "JA_VERWIJDER_TESTDATA") {
      throw new ConvexError(
        "Veiligheidsbevestiging klopt niet. Stuur confirmPhrase: \"JA_VERWIJDER_TESTDATA\"."
      );
    }

    // 3. Tenant opzoeken via slug
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      throw new ConvexError(`Tenant "${args.tenantSlug}" niet gevonden.`);
    }

    const tenantId = tenant._id;
    const counts: Record<string, number> = {};

    // ── Stap 1: measurementLines ──────────────────────────────────────────────
    counts.measurementLines = await deleteAllForTenant(
      ctx, "measurementLines", tenantId, "by_measurement"
    );

    // ── Stap 2: measurementRooms ──────────────────────────────────────────────
    counts.measurementRooms = await deleteAllForTenant(
      ctx, "measurementRooms", tenantId, "by_measurement"
    );

    // ── Stap 3: measurements ──────────────────────────────────────────────────
    counts.measurements = await deleteAllForTenant(
      ctx, "measurements", tenantId, "by_status"
    );

    // ── Stap 4: quoteLines ────────────────────────────────────────────────────
    counts.quoteLines = await deleteAllForTenant(
      ctx, "quoteLines", tenantId, "by_quote"
    );

    // ── Stap 5: quotes ────────────────────────────────────────────────────────
    counts.quotes = await deleteAllForTenant(ctx, "quotes", tenantId, "by_tenant");

    // ── Stap 6: invoices ──────────────────────────────────────────────────────
    counts.invoices = await deleteAllForTenant(ctx, "invoices", tenantId, "by_tenant");

    // ── Stap 7: supplierOrders ────────────────────────────────────────────────
    counts.supplierOrders = await deleteAllForTenant(
      ctx, "supplierOrders", tenantId, "by_status"
    );

    // ── Stap 8: projectTasks ──────────────────────────────────────────────────
    counts.projectTasks = await deleteAllForTenant(
      ctx, "projectTasks", tenantId, "by_status"
    );

    // ── Stap 9: projectWorkflowEvents ─────────────────────────────────────────
    counts.projectWorkflowEvents = await deleteAllForTenant(
      ctx, "projectWorkflowEvents", tenantId, "by_project"
    );

    // (timelineEvents is als spooktabel verwijderd — audit 2026-07-09.)

    // ── Stap 11: projectRooms ─────────────────────────────────────────────────
    counts.projectRooms = await deleteAllForTenant(
      ctx, "projectRooms", tenantId, "by_project"
    );

    // ── Stap 12: projects ─────────────────────────────────────────────────────
    counts.projects = await deleteAllForTenant(ctx, "projects", tenantId, "by_tenant");

    // ── Stap 13: customerContacts ─────────────────────────────────────────────
    counts.customerContacts = await deleteAllForTenant(
      ctx, "customerContacts", tenantId, "by_customer"
    );

    // ── Stap 14: customers ────────────────────────────────────────────────────
    counts.customers = await deleteAllForTenant(ctx, "customers", tenantId, "by_tenant");

    const totalDeleted = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return {
      success: true,
      tenant: tenant.slug,
      totalDeleted,
      counts
    };
  }
});
