import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { requireConvexToolingEnabled } from "../authz";
import { calculatorRulesSeed } from "./calculatorRulesSeed";

const HENKE_TENANT_SLUG = "henke-wonen";

/**
 * Seed de calculator-regels (marge-delers + placeholder-bedrijfsregels) uit HenkeWonenDATA.
 * Idempotent: dedupe-sleutel is (tenantId, productToolSleutel, regelSoort, bronCel, notitie) —
 * herrunbaar. Gated achter ALLOW_CONVEX_TOOLING, net als de overige seed-/beheermutaties.
 */
export const seedCalculatorRules = internalMutation({
  args: { tenantSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireConvexToolingEnabled("calculatorRules.seed");
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
    for (const r of calculatorRulesSeed) {
      const candidates = await ctx.db
        .query("calculatorRules")
        .withIndex("by_tool_rule", (q) =>
          q
            .eq("tenantId", tenantId)
            .eq("productToolSleutel", r.productToolSleutel)
            .eq("regelSoort", r.regelSoort)
        )
        .collect();
      const existing = candidates.find(
        (c) => (c.bronCel ?? null) === r.bronCel && (c.notitie ?? null) === r.notitie
      );

      const fields = {
        productToolSleutel: r.productToolSleutel,
        regelSoort: r.regelSoort,
        waarde: r.waarde ?? undefined,
        bronCel: r.bronCel ?? undefined,
        notitie: r.notitie ?? undefined,
        vereistKlantInput: r.vereistKlantInput,
        status: "active" as const
      };

      if (existing) {
        await ctx.db.patch(existing._id, { ...fields, gewijzigdOp: now });
        updated++;
      } else {
        await ctx.db.insert("calculatorRules", {
          tenantId,
          ...fields,
          aangemaaktOp: now,
          gewijzigdOp: now
        });
        inserted++;
      }
    }

    return { tenantId, inserted, updated, total: calculatorRulesSeed.length };
  }
});

/** Interne ophaal-helper voor de calculator-engine (Fase 1.2/1.3 prijsafleiding). */
export const listForTenant = internalQuery({
  args: { tenantId: v.id("tenants"), productToolSleutel: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const tool = args.productToolSleutel;
    if (tool) {
      return await ctx.db
        .query("calculatorRules")
        .withIndex("by_tool", (q) => q.eq("tenantId", args.tenantId).eq("productToolSleutel", tool))
        .collect();
    }
    return await ctx.db
      .query("calculatorRules")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  }
});
