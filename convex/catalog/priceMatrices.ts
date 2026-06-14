import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { requireConvexToolingEnabled } from "../authz";
import { priceMatricesSeed } from "./priceMatricesSeed";

const HENKE_TENANT_SLUG = "henke-wonen";

/**
 * Seed de breedte×hoogte-prijsmatrices voor raambekleding (geconsolideerd uit HenkeWonenDATA).
 * Idempotent: dedupe-sleutel is (tenantId, productToolSleutel, prijsgroep, bronBlad) — herrunbaar.
 * Gated achter ALLOW_CONVEX_TOOLING, net als de overige seed-/beheermutaties.
 */
export const seedPriceMatrices = internalMutation({
  args: { tenantSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireConvexToolingEnabled("priceMatrices.seed");
    const now = Date.now();
    const slug = args.tenantSlug ?? HENKE_TENANT_SLUG;

    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!tenant) {
      throw new Error(`Tenant '${slug}' niet gevonden — draai eerst de basis-seed (seed.run).`);
    }
    const tenantId = tenant._id;

    let inserted = 0;
    let updated = 0;
    for (const m of priceMatricesSeed) {
      const candidates = await ctx.db
        .query("priceMatrices")
        .withIndex("by_tool_group", (q) =>
          q
            .eq("tenantId", tenantId)
            .eq("productToolSleutel", m.productToolSleutel)
            .eq("prijsgroep", m.prijsgroep)
        )
        .collect();
      const existing = candidates.find((c) => (c.bronBlad ?? null) === m.bronBlad);

      const fields = {
        productToolSleutel: m.productToolSleutel,
        prijsgroep: m.prijsgroep,
        bronBestand: m.bronBestand ?? undefined,
        bronBlad: m.bronBlad ?? undefined,
        breedteAs: m.breedteAs,
        hoogteAs: m.hoogteAs,
        prijzen: m.prijzen,
        btwModus: m.btwModus
      };

      if (existing) {
        await ctx.db.patch(existing._id, { ...fields, gewijzigdOp: now });
        updated++;
      } else {
        await ctx.db.insert("priceMatrices", {
          tenantId,
          ...fields,
          aangemaaktOp: now,
          gewijzigdOp: now
        });
        inserted++;
      }
    }

    return { tenantId, inserted, updated, total: priceMatricesSeed.length };
  }
});

/** Interne ophaal-helper voor de matrix-lookup (Fase 1.2 prijskeuze + verificatie). */
export const listForTenant = internalQuery({
  args: { tenantId: v.id("tenants"), productToolSleutel: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const tool = args.productToolSleutel;
    if (tool) {
      return await ctx.db
        .query("priceMatrices")
        .withIndex("by_tool", (q) => q.eq("tenantId", args.tenantId).eq("productToolSleutel", tool))
        .collect();
    }
    return await ctx.db
      .query("priceMatrices")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});
