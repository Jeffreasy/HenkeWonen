/**
 * Retentie-rapportage (AVG-bewaartermijnbeleid, audit 2026-07-03 punt 3).
 *
 * READ-ONLY: telt per omgeving hoeveel data een bewaargrens (standaard 7 jaar) al passeert,
 * zodat de eigenaar de omvang van een toekomstig opschoonbeleid kan inschatten. Er wordt
 * BEWUST niets verwijderd of gewijzigd — daadwerkelijk opschonen vraagt eerst een
 * beleidskeuze (welke termijn, wel/niet automatisch); zie docs/avg-bewaartermijnbeleid-voorstel.md.
 *
 * INTERN (internalQuery): niet aanroepbaar via de publieke portal-API. Alleen via het Convex
 * dashboard of `npx convex run beheer/retention:retentionReport '{"tenantSlug":"..."}'`.
 */
import { internalQuery } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

const JAAR_MS = 365 * 24 * 60 * 60 * 1000;

export type RetentionReport = {
  tenant: string;
  referentieDatum: number;
  bewaartermijnJaren: number;
  bewaargrensMs: number;
  facturen: {
    totaal: number;
    ouderDanGrens: number;
  };
  klanten: {
    totaal: number;
    geanonimiseerd: number;
    /** Geanonimiseerde stubs waarvan álle facturen de grens zijn gepasseerd → mogen volledig weg. */
    geanonimiseerdVolledigOpschoonbaar: number;
    /** Actieve/gearchiveerde klanten zónder facturen, langer dan de grens niet gewijzigd. */
    inactiefZonderFacturenOuderDanGrens: number;
  };
  projecten: {
    totaal: number;
    afgeslotenOuderDanGrens: number;
  };
};

/**
 * Rekent de retentie-telling uit voor één tenant. Losse helper (geen Convex-functie) zodat de
 * logica direct testbaar is; de `internalQuery` hieronder is een dunne wrapper.
 */
export async function computeRetentionReport(
  ctx: { db: any },
  tenant: Doc<"tenants">,
  opts: { referentieDatum: number; bewaartermijnJaren: number }
): Promise<RetentionReport> {
  const tenantId = tenant._id as Id<"tenants">;
  const bewaargrensMs = opts.referentieDatum - opts.bewaartermijnJaren * JAAR_MS;

  const [customers, invoices, projects] = await Promise.all([
    ctx.db
      .query("customers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect(),
    ctx.db
      .query("invoices")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect(),
    ctx.db
      .query("projects")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect()
  ]);

  // Nieuwste factuurdatum per klant + welke klanten überhaupt facturen hebben.
  const nieuwsteFactuurPerKlant = new Map<string, number>();
  for (const invoice of invoices as Doc<"invoices">[]) {
    const key = String(invoice.klantId);
    const huidige = nieuwsteFactuurPerKlant.get(key);
    if (huidige === undefined || invoice.factuurdatum > huidige) {
      nieuwsteFactuurPerKlant.set(key, invoice.factuurdatum);
    }
  }

  const facturenOuderDanGrens = (invoices as Doc<"invoices">[]).filter(
    (invoice) => invoice.factuurdatum < bewaargrensMs
  ).length;

  let geanonimiseerd = 0;
  let geanonimiseerdVolledigOpschoonbaar = 0;
  let inactiefZonderFacturenOuderDanGrens = 0;

  for (const customer of customers as Doc<"customers">[]) {
    const key = String(customer._id);
    const nieuwsteFactuur = nieuwsteFactuurPerKlant.get(key);
    const heeftFacturen = nieuwsteFactuur !== undefined;

    if (customer.geanonimiseerdOp !== undefined) {
      geanonimiseerd += 1;
      // Stub mag volledig weg zodra er geen facturen (meer) binnen de bewaarplicht zijn.
      if (!heeftFacturen || nieuwsteFactuur < bewaargrensMs) {
        geanonimiseerdVolledigOpschoonbaar += 1;
      }
      continue;
    }

    // Niet-geanonimiseerde, factuurloze klant die lang niet is aangeraakt: opschoonkandidaat.
    if (
      !heeftFacturen &&
      (customer.status === "archived" || customer.status === "inactive") &&
      customer.gewijzigdOp < bewaargrensMs
    ) {
      inactiefZonderFacturenOuderDanGrens += 1;
    }
  }

  const afgeslotenOuderDanGrens = (projects as Doc<"projects">[]).filter((project) => {
    if (project.status !== "closed" && project.status !== "cancelled") {
      return false;
    }
    const afgerondOp = project.afgeslotenOp ?? project.gewijzigdOp;
    return afgerondOp < bewaargrensMs;
  }).length;

  return {
    tenant: tenant.slug,
    referentieDatum: opts.referentieDatum,
    bewaartermijnJaren: opts.bewaartermijnJaren,
    bewaargrensMs,
    facturen: {
      totaal: invoices.length,
      ouderDanGrens: facturenOuderDanGrens
    },
    klanten: {
      totaal: customers.length,
      geanonimiseerd,
      geanonimiseerdVolledigOpschoonbaar,
      inactiefZonderFacturenOuderDanGrens
    },
    projecten: {
      totaal: projects.length,
      afgeslotenOuderDanGrens
    }
  };
}

export const retentionReport = internalQuery({
  args: {
    tenantSlug: v.string(),
    /** Bewaargrens in jaren; standaard 7 (fiscale bewaarplicht). */
    bewaartermijnJaren: v.optional(v.number()),
    /** Referentiemoment (Unix-ms); standaard nu. Expliciet meegeven maakt de uitkomst reproduceerbaar. */
    nowMs: v.optional(v.number())
  },
  handler: async (ctx, args): Promise<RetentionReport> => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      throw new ConvexError(`Tenant "${args.tenantSlug}" niet gevonden.`);
    }

    return await computeRetentionReport(ctx, tenant, {
      referentieDatum: args.nowMs ?? Date.now(),
      bewaartermijnJaren: args.bewaartermijnJaren ?? 7
    });
  }
});
