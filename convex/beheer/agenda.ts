import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutationActorValidator, readActorValidator, requireMutationRole, requireQueryRole } from "../authz";

const DAG_MS = 24 * 60 * 60 * 1000;

const afwezigheidType = v.union(
  v.literal("verlof"),
  v.literal("ziek"),
  v.literal("blokkade"),
  v.literal("overig")
);

const werktijdInput = v.object({
  weekdag: v.number(),
  startMinuut: v.number(),
  eindMinuut: v.number()
});

/** Valideert een tijdvak in minuten sinds middernacht. */
function assertTijdvak(startMinuut: number, eindMinuut: number, context: string) {
  if (!Number.isFinite(startMinuut) || !Number.isFinite(eindMinuut)) {
    throw new ConvexError(`${context}: tijden moeten geldige getallen zijn.`);
  }
  if (startMinuut < 0 || eindMinuut > 24 * 60) {
    throw new ConvexError(`${context}: tijden moeten tussen 00:00 en 24:00 liggen.`);
  }
  if (startMinuut >= eindMinuut) {
    throw new ConvexError(`${context}: starttijd moet vóór de eindtijd liggen.`);
  }
}

/** Haalt een monteur (user) op en verifieert dat die bij de tenant hoort. */
async function requireMonteur(ctx: any, tenantId: Id<"tenants">, userId: Id<"users">) {
  const monteur = await ctx.db.get(userId);
  if (!monteur || monteur.tenantId !== tenantId) {
    throw new ConvexError("Monteur niet gevonden.");
  }
  return monteur as Doc<"users">;
}

// ── Werktijden ───────────────────────────────────────────────────────────────

export const getMonteurWerktijden = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    userId: v.id("users")
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    await requireMonteur(ctx, tenant._id, args.userId);

    const werktijden = await ctx.db
      .query("monteurWerktijden")
      .withIndex("by_monteur", (q: any) => q.eq("tenantId", tenant._id).eq("userId", args.userId))
      .collect();

    return werktijden
      .map((rij: Doc<"monteurWerktijden">) => ({
        id: String(rij._id),
        weekdag: rij.weekdag,
        startMinuut: rij.startMinuut,
        eindMinuut: rij.eindMinuut
      }))
      .sort(
        (a: { weekdag: number; startMinuut: number }, b: { weekdag: number; startMinuut: number }) =>
          a.weekdag - b.weekdag || a.startMinuut - b.startMinuut
      );
  }
});

/** Vervangt de volledige weekrooster-set van één monteur (idempotent). */
export const setMonteurWerktijden = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    userId: v.id("users"),
    werktijden: v.array(werktijdInput)
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    await requireMonteur(ctx, tenant._id, args.userId);

    for (const wt of args.werktijden) {
      if (!Number.isInteger(wt.weekdag) || wt.weekdag < 0 || wt.weekdag > 6) {
        throw new ConvexError("Weekdag moet tussen 0 (maandag) en 6 (zondag) liggen.");
      }
      assertTijdvak(wt.startMinuut, wt.eindMinuut, `Werktijd (dag ${wt.weekdag})`);
    }

    const now = Date.now();
    const bestaand = await ctx.db
      .query("monteurWerktijden")
      .withIndex("by_monteur", (q: any) => q.eq("tenantId", tenant._id).eq("userId", args.userId))
      .collect();

    for (const rij of bestaand) {
      await ctx.db.delete(rij._id);
    }

    for (const wt of args.werktijden) {
      await ctx.db.insert("monteurWerktijden", {
        tenantId: tenant._id,
        userId: args.userId,
        weekdag: wt.weekdag,
        startMinuut: wt.startMinuut,
        eindMinuut: wt.eindMinuut,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    return { userId: String(args.userId), aantal: args.werktijden.length };
  }
});

// ── Afwezigheid ──────────────────────────────────────────────────────────────

export const listAfwezigheid = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    userId: v.optional(v.id("users")),
    vanaf: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    let rows: Doc<"monteurAfwezigheid">[];
    if (args.userId) {
      await requireMonteur(ctx, tenant._id, args.userId);
      rows = await ctx.db
        .query("monteurAfwezigheid")
        .withIndex("by_monteur", (q: any) => q.eq("tenantId", tenant._id).eq("userId", args.userId))
        .collect();
    } else {
      rows = await ctx.db
        .query("monteurAfwezigheid")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect();
    }

    const vanaf = args.vanaf ?? 0;
    return rows
      .filter((r: Doc<"monteurAfwezigheid">) => r.totDatum >= vanaf)
      .map((r: Doc<"monteurAfwezigheid">) => ({
        id: String(r._id),
        userId: String(r.userId),
        type: r.type,
        vanafDatum: r.vanafDatum,
        totDatum: r.totDatum,
        heleDag: r.heleDag,
        startMinuut: r.startMinuut,
        eindMinuut: r.eindMinuut,
        reden: r.reden
      }))
      .sort((a: { vanafDatum: number }, b: { vanafDatum: number }) => a.vanafDatum - b.vanafDatum);
  }
});

export const addAfwezigheid = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    userId: v.id("users"),
    type: afwezigheidType,
    vanafDatum: v.number(),
    totDatum: v.number(),
    heleDag: v.boolean(),
    startMinuut: v.optional(v.number()),
    eindMinuut: v.optional(v.number()),
    reden: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    await requireMonteur(ctx, tenant._id, args.userId);

    if (!Number.isFinite(args.vanafDatum) || !Number.isFinite(args.totDatum)) {
      throw new ConvexError("Afwezigheid: ongeldige datums.");
    }
    if (args.totDatum < args.vanafDatum) {
      throw new ConvexError("Afwezigheid: einddatum mag niet vóór de startdatum liggen.");
    }
    if (!args.heleDag) {
      if (args.startMinuut === undefined || args.eindMinuut === undefined) {
        throw new ConvexError("Afwezigheid: een tijdvak vereist een start- en eindtijd.");
      }
      assertTijdvak(args.startMinuut, args.eindMinuut, "Afwezigheid");
    }

    const now = Date.now();
    return await ctx.db.insert("monteurAfwezigheid", {
      tenantId: tenant._id,
      userId: args.userId,
      type: args.type,
      vanafDatum: args.vanafDatum,
      totDatum: args.totDatum,
      heleDag: args.heleDag,
      startMinuut: args.heleDag ? undefined : args.startMinuut,
      eindMinuut: args.heleDag ? undefined : args.eindMinuut,
      reden: args.reden,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const removeAfwezigheid = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    afwezigheidId: v.id("monteurAfwezigheid")
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const rij = await ctx.db.get(args.afwezigheidId);
    if (!rij || rij.tenantId !== tenant._id) {
      throw new ConvexError("Afwezigheid niet gevonden.");
    }
    await ctx.db.delete(args.afwezigheidId);
    return { id: String(args.afwezigheidId) };
  }
});

// ── Agenda (week) ────────────────────────────────────────────────────────────
// Levert per monteur de werktijden, afwezigheden én geboekte inmeetbezoeken in
// een week van 7 dagen vanaf `weekStart`. "Bereikbaar" wordt in de UI afgeleid
// uit werktijden − afwezigheid − geboekte bezoeken.
export const agendaWeek = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    weekStart: v.number(),
    userId: v.optional(v.id("users"))
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const weekStart = args.weekStart;
    const weekEnd = weekStart + 7 * DAG_MS;

    const monteurs = args.userId
      ? [await requireMonteur(ctx, tenant._id, args.userId)]
      : await ctx.db
          .query("users")
          .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
          .collect();

    // Geboekte inmeetbezoeken in de week (tenant-gescopet via de datum-index),
    // daarna per monteur gematcht op naam (gemetenDoor is de monteurnaam).
    const metingen = await ctx.db
      .query("measurements")
      .withIndex("by_measurement_date", (q: any) =>
        q.eq("tenantId", tenant._id).gte("inmeetdatum", weekStart).lt("inmeetdatum", weekEnd)
      )
      .collect();

    const projectCache = new Map<string, Doc<"projects"> | null>();
    const klantCache = new Map<string, Doc<"customers"> | null>();
    async function bezoekDetail(meting: Doc<"measurements">) {
      const pid = String(meting.projectId);
      if (!projectCache.has(pid)) {
        const p = await ctx.db.get(meting.projectId);
        projectCache.set(pid, p && p.tenantId === tenant._id ? p : null);
      }
      const kid = String(meting.klantId);
      if (!klantCache.has(kid)) {
        const k = await ctx.db.get(meting.klantId);
        klantCache.set(kid, k && k.tenantId === tenant._id ? k : null);
      }
      const project = projectCache.get(pid) ?? null;
      const klant = klantCache.get(kid) ?? null;
      return {
        inmetingId: String(meting._id),
        projectId: String(meting.projectId),
        projectTitel: project?.titel ?? "Project",
        klantNaam: klant?.weergaveNaam ?? "Klant",
        inmeetdatum: meting.inmeetdatum ?? null,
        gemetenDoor: meting.gemetenDoor ?? null,
        status: meting.status
      };
    }

    const result = [];
    for (const monteur of monteurs) {
      const naam = monteur.naam ?? monteur.email;

      const werktijden = (
        await ctx.db
          .query("monteurWerktijden")
          .withIndex("by_monteur", (q: any) =>
            q.eq("tenantId", tenant._id).eq("userId", monteur._id)
          )
          .collect()
      )
        .map((wt: Doc<"monteurWerktijden">) => ({
          weekdag: wt.weekdag,
          startMinuut: wt.startMinuut,
          eindMinuut: wt.eindMinuut
        }))
        .sort((a, b) => a.weekdag - b.weekdag || a.startMinuut - b.startMinuut);

      const afwezigheden = (
        await ctx.db
          .query("monteurAfwezigheid")
          .withIndex("by_monteur", (q: any) =>
            q.eq("tenantId", tenant._id).eq("userId", monteur._id)
          )
          .collect()
      )
        .filter((a: Doc<"monteurAfwezigheid">) => a.totDatum >= weekStart && a.vanafDatum < weekEnd)
        .map((a: Doc<"monteurAfwezigheid">) => ({
          id: String(a._id),
          type: a.type,
          vanafDatum: a.vanafDatum,
          totDatum: a.totDatum,
          heleDag: a.heleDag,
          startMinuut: a.startMinuut,
          eindMinuut: a.eindMinuut,
          reden: a.reden
        }));

      const eigenMetingen = metingen.filter(
        (m: Doc<"measurements">) => (m.gemetenDoor ?? "") === naam
      );
      const bezoeken = [];
      for (const m of eigenMetingen) {
        bezoeken.push(await bezoekDetail(m));
      }

      result.push({
        monteur: { id: String(monteur._id), naam, role: monteur.role },
        werktijden,
        afwezigheden,
        bezoeken
      });
    }

    return { weekStart, weekEnd, monteurs: result };
  }
});
