/**
 * Onderhoudsmutatie voor offerte-totalen.
 *
 * Herstelt offertes waarvan de OPGESLAGEN totalen (subtotaalExBtw / btwTotaal /
 * totaalInclBtw) niet kloppen met de som van hun regels. Dit repareert de schade
 * van de bug waarbij recalculateQuote niet-bestaande regelvelden las
 * (line.lineTotalExVat i.p.v. line.regelTotaalExBtw) → opgeslagen offertetotalen
 * werden NaN en lekten naar facturen. De regel-totalen zelf zijn altijd correct
 * geweest; alleen het quote-niveau aggregaat dreef weg / werd NaN.
 *
 * Chunked (cursor-gebaseerd), admin-actor + letterlijke bevestiging, dryRun-default
 * (telt alleen). Aansturing: tools/repair_quote_totals.mjs
 */
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRole } from "../authz";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const recalculateQuoteTotalsChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    confirm: v.literal("REPAIR_QUOTE_TOTALS"),
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const batchSize = Math.min(Math.max(args.batchSize ?? 100, 25), 200);
    const dryRun = args.dryRun ?? true;

    const paginated = await ctx.db
      .query("quotes")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let mismatched = 0;
    let patched = 0;
    let nanCount = 0;
    const samples: Array<Record<string, unknown>> = [];

    for (const quote of paginated.page) {
      const lines = await ctx.db
        .query("quoteLines")
        .withIndex("by_quote", (q: any) =>
          q.eq("tenantId", tenant._id).eq("quoteId", quote._id)
        )
        .collect();

      const subtotal = roundMoney(
        lines.reduce((sum: number, line: any) => sum + line.regelTotaalExBtw, 0)
      );
      const vat = roundMoney(
        lines.reduce((sum: number, line: any) => sum + line.regelBtwTotaal, 0)
      );
      const total = roundMoney(subtotal + vat);

      // NaN komt afhankelijk van de Convex-versie als NaN of null terug; beide
      // worden door !Number.isFinite gevangen. Daarnaast: gedreven aggregaten.
      const storedNonFinite =
        !Number.isFinite(quote.subtotaalExBtw) ||
        !Number.isFinite(quote.btwTotaal) ||
        !Number.isFinite(quote.totaalInclBtw);
      const storedDrifted =
        Math.abs((quote.subtotaalExBtw ?? 0) - subtotal) > 0.01 ||
        Math.abs((quote.btwTotaal ?? 0) - vat) > 0.01 ||
        Math.abs((quote.totaalInclBtw ?? 0) - total) > 0.01;

      if (!storedNonFinite && !storedDrifted) {
        continue;
      }

      mismatched += 1;
      if (storedNonFinite) {
        nanCount += 1;
      }
      if (samples.length < 25) {
        samples.push({
          offertenummer: quote.offertenummer,
          status: quote.status,
          regels: lines.length,
          storedNonFinite,
          stored: {
            subtotaalExBtw: Number.isFinite(quote.subtotaalExBtw) ? quote.subtotaalExBtw : "NaN/null",
            btwTotaal: Number.isFinite(quote.btwTotaal) ? quote.btwTotaal : "NaN/null",
            totaalInclBtw: Number.isFinite(quote.totaalInclBtw) ? quote.totaalInclBtw : "NaN/null"
          },
          correct: { subtotaalExBtw: subtotal, btwTotaal: vat, totaalInclBtw: total }
        });
      }

      if (!dryRun) {
        await ctx.db.patch(quote._id, {
          subtotaalExBtw: subtotal,
          btwTotaal: vat,
          totaalInclBtw: total,
          gewijzigdOp: Date.now()
        });
        patched += 1;
      }
    }

    return {
      dryRun,
      scanned: paginated.page.length,
      mismatched,
      nanCount,
      patched,
      samples,
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});
