/**
 * deleteProjects — Admin-only opschoning van losse test-/duplicaatdossiers.
 *
 * Verwijdert per opgegeven project de volledige boom: meetregels → meetruimtes →
 * inmetingen, offerteregels → offertes, bestelregels → bestellingen, taken,
 * workflow-events en projectruimtes; dossierbijlagen en contactmomenten worden
 * LOSGEKOPPELD (die horen bij de klant, niet bij het project). De klant zelf
 * blijft altijd staan.
 *
 * Guard: een project met een factuur wordt overgeslagen (facturen blijven
 * wettelijk bewaard; gebruik daarvoor de AVG-route deleteCustomer of laat het
 * dossier op geannuleerd staan).
 *
 * INTERN (internalMutation): alleen via het Convex-dashboard of `npx convex run`
 * (deploy-key-auth). ALLOW_CONVEX_TOOLING + confirmPhrase zijn extra sloten.
 */
import { internalMutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requireConvexToolingEnabled } from "../authz";

async function deleteByIndex(
  ctx: any,
  table: string,
  indexName: string,
  key: { tenantId: Id<"tenants">; field: string; value: any }
): Promise<number> {
  let deleted = 0;
  while (true) {
    const batch = await ctx.db
      .query(table)
      .withIndex(indexName, (q: any) => q.eq("tenantId", key.tenantId).eq(key.field, key.value))
      .take(100);
    if (batch.length === 0) break;
    for (const doc of batch) {
      await ctx.db.delete(doc._id);
      deleted += 1;
    }
  }
  return deleted;
}

export const deleteProjects = internalMutation({
  args: {
    tenantSlug: v.string(),
    projectIds: v.array(v.string()),
    confirmPhrase: v.string()
  },
  handler: async (ctx, args) => {
    requireConvexToolingEnabled("deleteProjects");

    if (args.confirmPhrase !== "JA_VERWIJDER_PROJECTEN") {
      throw new ConvexError(
        'Veiligheidsbevestiging klopt niet. Stuur confirmPhrase: "JA_VERWIJDER_PROJECTEN".'
      );
    }

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.tenantSlug))
      .first();
    if (!tenant) {
      throw new ConvexError(`Tenant "${args.tenantSlug}" niet gevonden.`);
    }

    const results: Array<{ projectId: string; titel?: string; status: string; counts?: Record<string, number> }> = [];

    for (const rawId of args.projectIds) {
      const project = await ctx.db.get(rawId as Id<"projects">);
      if (!project || project.tenantId !== tenant._id) {
        results.push({ projectId: rawId, status: "niet gevonden — overgeslagen" });
        continue;
      }

      // Facturen blijven wettelijk bewaard: zo'n dossier verwijderen we niet.
      const invoice = await ctx.db
        .query("invoices")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .first();
      if (invoice) {
        results.push({
          projectId: rawId,
          titel: project.titel,
          status: "heeft factuur — overgeslagen"
        });
        continue;
      }

      const counts: Record<string, number> = {};

      // Inmetingen (kind vóór ouder).
      counts.measurementLines = 0;
      counts.measurementRooms = 0;
      counts.measurements = 0;
      while (true) {
        const measurement = await ctx.db
          .query("measurements")
          .withIndex("by_project", (q: any) =>
            q.eq("tenantId", tenant._id).eq("projectId", project._id)
          )
          .first();
        if (!measurement) break;
        counts.measurementLines += await deleteByIndex(ctx, "measurementLines", "by_measurement", {
          tenantId: tenant._id,
          field: "measurementId",
          value: measurement._id
        });
        counts.measurementRooms += await deleteByIndex(ctx, "measurementRooms", "by_measurement", {
          tenantId: tenant._id,
          field: "measurementId",
          value: measurement._id
        });
        await ctx.db.delete(measurement._id);
        counts.measurements += 1;
      }

      // Offertes (regels eerst).
      counts.quoteLines = 0;
      counts.quotes = 0;
      while (true) {
        const quote = await ctx.db
          .query("quotes")
          .withIndex("by_project", (q: any) =>
            q.eq("tenantId", tenant._id).eq("projectId", project._id)
          )
          .first();
        if (!quote) break;
        counts.quoteLines += await deleteByIndex(ctx, "quoteLines", "by_quote", {
          tenantId: tenant._id,
          field: "quoteId",
          value: quote._id
        });
        await ctx.db.delete(quote._id);
        counts.quotes += 1;
      }

      // Bestellingen (regels eerst).
      counts.supplierOrderLines = 0;
      counts.supplierOrders = 0;
      while (true) {
        const order = await ctx.db
          .query("supplierOrders")
          .withIndex("by_project", (q: any) =>
            q.eq("tenantId", tenant._id).eq("projectId", project._id)
          )
          .first();
        if (!order) break;
        counts.supplierOrderLines += await deleteByIndex(ctx, "supplierOrderLines", "by_order", {
          tenantId: tenant._id,
          field: "bestellingId",
          value: order._id
        });
        await ctx.db.delete(order._id);
        counts.supplierOrders += 1;
      }

      counts.projectTasks = await deleteByIndex(ctx, "projectTasks", "by_project", {
        tenantId: tenant._id,
        field: "projectId",
        value: project._id
      });
      counts.projectWorkflowEvents = await deleteByIndex(ctx, "projectWorkflowEvents", "by_project", {
        tenantId: tenant._id,
        field: "projectId",
        value: project._id
      });
      counts.projectRooms = await deleteByIndex(ctx, "projectRooms", "by_project", {
        tenantId: tenant._id,
        field: "projectId",
        value: project._id
      });

      // Bijlagen en contactmomenten horen bij de klant: loskoppelen, niet wissen.
      counts.unlinkedAttachments = 0;
      const attachments = await ctx.db
        .query("dossierAttachments")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect();
      for (const attachment of attachments) {
        await ctx.db.patch(attachment._id, { projectId: undefined });
        counts.unlinkedAttachments += 1;
      }
      counts.unlinkedContacts = 0;
      const contacts = await ctx.db
        .query("customerContacts")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect();
      for (const contact of contacts) {
        await ctx.db.patch(contact._id, { projectId: undefined });
        counts.unlinkedContacts += 1;
      }

      await ctx.db.delete(project._id);
      results.push({ projectId: rawId, titel: project.titel, status: "verwijderd", counts });
    }

    return { tenant: tenant.slug, results };
  }
});
