/**
 * Onderhoudsmutaties voor de prijsdata (fase 0 van het richtprijs-plan,
 * docs/technisch/plan-richtprijs-inmeting-2026-06-13.md).
 *
 * 1. repairPriceVatModesChunk — zet vatMode van bestaande prijsregels om volgens
 *    een expliciete regel (standaard: unknown/inclusive → exclusive, conform het
 *    klantbesluit "alle leverancierslijsten zijn exclusief btw").
 * 2. deletePseudoPriceRowsChunk — verwijdert pseudo-prijsregels die uit de
 *    Texdecor-import zijn meegekomen ("Code prix" prijscodes en
 *    "Qté multiple d'achat" bestelveelvouden) — dit zijn geen prijzen.
 *
 * Beide zijn chunked (cursor-gebaseerd) om binnen de Convex-leeslimieten te
 * blijven, vereisen een admin-actor plus letterlijke bevestiging, en hebben een
 * dryRun-modus die alleen telt. updatedAt wordt bij reparatie bewust NIET
 * aangepast: dat veld weerspiegelt het importmoment en wordt gebruikt als
 * tie-break bij prijskeuze.
 *
 * Aansturing: tools/repair_price_data.mjs
 */
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRole } from "../authz";

const vatModeValue = v.union(
  v.literal("exclusive"),
  v.literal("inclusive"),
  v.literal("unknown")
);

function normalizedText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

/** Pseudo-prijskolommen uit de Texdecor-bestanden (geen echte prijzen). */
function isPseudoPriceColumn(sourceColumnName?: string) {
  const name = normalizedText(sourceColumnName);

  if (!name) {
    return false;
  }

  return (
    name.startsWith("code prix") ||
    name.includes("qté multiple d'achat") ||
    name.includes("qte multiple d'achat") ||
    name.startsWith("unité de vente") ||
    name.startsWith("unite de vente")
  );
}

export const repairPriceVatModesChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    confirm: v.literal("REPAIR_PRICE_VAT_MODES"),
    rule: v.object({
      fromModes: v.array(vatModeValue),
      toMode: v.union(v.literal("exclusive"), v.literal("inclusive")),
      priceTypes: v.optional(v.array(v.string())),
      sourceColumnNames: v.optional(v.array(v.string())),
      sourceFileNames: v.optional(v.array(v.string()))
    }),
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const batchSize = Math.min(Math.max(args.batchSize ?? 1000, 100), 2000);
    const dryRun = args.dryRun ?? true;
    const fromModes = new Set(args.rule.fromModes);
    const priceTypes = args.rule.priceTypes?.length ? new Set(args.rule.priceTypes) : null;
    const sourceColumnNames = args.rule.sourceColumnNames?.length
      ? new Set(args.rule.sourceColumnNames.map(normalizedText))
      : null;
    const sourceFileNames = args.rule.sourceFileNames?.length
      ? new Set(args.rule.sourceFileNames.map(normalizedText))
      : null;

    if (fromModes.has(args.rule.toMode)) {
      throw new Error("fromModes mag de doelmodus niet bevatten.");
    }

    const paginated = await ctx.db
      .query("productPrices")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let matched = 0;
    const breakdown: Record<string, number> = {};

    for (const price of paginated.page) {
      const mode = price.vatMode ?? "unknown";

      if (!fromModes.has(mode)) {
        continue;
      }

      if (priceTypes && !priceTypes.has(price.priceType)) {
        continue;
      }

      if (sourceColumnNames && !sourceColumnNames.has(normalizedText(price.sourceColumnName))) {
        continue;
      }

      if (sourceFileNames && !sourceFileNames.has(normalizedText(price.sourceFileName))) {
        continue;
      }

      matched += 1;
      const key = `${price.priceType}|${mode}|${price.sourceColumnName ?? "?"}`;
      breakdown[key] = (breakdown[key] ?? 0) + 1;

      if (!dryRun) {
        // Bewust geen updatedAt-patch: dat veld blijft het importmoment.
        await ctx.db.patch(price._id, { vatMode: args.rule.toMode });
      }
    }

    return {
      dryRun,
      scanned: paginated.page.length,
      matched,
      patched: dryRun ? 0 : matched,
      // Array i.p.v. record: kolomnamen kunnen tekens bevatten (bv. "€") die
      // Convex niet als veldnaam accepteert.
      breakdown: Object.entries(breakdown).map(([key, count]) => ({ key, count })),
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});

export const deletePseudoPriceRowsChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    confirm: v.literal("DELETE_PSEUDO_PRICE_ROWS"),
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const batchSize = Math.min(Math.max(args.batchSize ?? 1000, 100), 2000);
    const dryRun = args.dryRun ?? true;

    const paginated = await ctx.db
      .query("productPrices")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let matched = 0;
    const breakdown: Record<string, number> = {};

    for (const price of paginated.page) {
      if (!isPseudoPriceColumn(price.sourceColumnName)) {
        continue;
      }

      matched += 1;
      const key = price.sourceColumnName ?? "?";
      breakdown[key] = (breakdown[key] ?? 0) + 1;

      if (!dryRun) {
        await ctx.db.delete(price._id);
      }
    }

    return {
      dryRun,
      scanned: paginated.page.length,
      matched,
      deleted: dryRun ? 0 : matched,
      breakdown: Object.entries(breakdown).map(([key, count]) => ({ key, count })),
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});
