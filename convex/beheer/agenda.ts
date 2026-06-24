import { internalMutation, mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutationActorValidator, readActorValidator, requireMutationRole, requireQueryRole } from "../authz";

const DAG_MS = 24 * 60 * 60 * 1000;

// ── Inmeet-regels (Henke Wonen) ───────────────────────────────────────────────
// Inmeten kan alleen op di/wo/do, in het aankomstvenster 16:30–17:30. Per
// inmeetdag is er ruimte voor 2 "plekken": een klein klusje (1-2 ramen / 1 ruimte)
// telt als 1, een volledige woning als 2. Zo passen 2× klein óf 1× volledig.
const INMEET_DAGEN = [1, 2, 3]; // 0=maandag .. 6=zondag → di, wo, do
const INMEET_START_MINUUT = 16 * 60 + 30; // 16:30
const INMEET_EIND_MINUUT = 17 * 60 + 30; // 17:30
const INMEET_CAPACITEIT = 2;

/** Weekdag (0=maandag .. 6=zondag), consistent met src/lib/agenda.weekdagVan. */
function weekdagVanMs(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}

/** Capaciteit die een klus inneemt: volledige woning = 2, anders (incl. onbekend) = 1. */
function omvangUnits(omvang?: string | null): number {
  return omvang === "volledig" ? 2 : 1;
}

/**
 * Bepaalt of een inmeting bij een monteur hoort. Leidend is de stabiele
 * gemetenDoorUserId; alleen als die ontbreekt (oude/legacy of vrije-tekst rijen)
 * vallen we terug op de naam. Zo breken hernoemen of dubbele namen niets.
 */
function hoortBijMonteur(meting: Doc<"measurements">, monteurId: Id<"users">, naam: string): boolean {
  if (meting.gemetenDoorUserId) {
    return meting.gemetenDoorUserId === monteurId;
  }
  return (meting.gemetenDoor ?? "") === naam;
}

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

// ── Agenda-leden ─────────────────────────────────────────────────────────────
// Bepaalt of een gebruiker als monteur in de week-agenda verschijnt. Editor/admin
// kan dit per gebruiker aan/uit zetten (bv. dev-/admin-accounts verbergen).
export const setAgendaZichtbaarheid = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    userId: v.id("users"),
    toonInAgenda: v.boolean()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const user = await ctx.db.get(args.userId);
    if (!user || user.tenantId !== tenant._id) {
      throw new ConvexError("Gebruiker niet gevonden.");
    }
    await ctx.db.patch(args.userId, {
      toonInAgenda: args.toonInAgenda,
      gewijzigdOp: Date.now()
    });
    return { userId: String(args.userId), toonInAgenda: args.toonInAgenda };
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
    userId: v.optional(v.id("users")),
    /** Buitendienst: toon alleen de eigen week (de monteur die de query doet). */
    alleenEigen: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const weekStart = args.weekStart;
    const weekEnd = weekStart + 7 * DAG_MS;

    let monteurs: Doc<"users">[];
    if (args.userId) {
      monteurs = [await requireMonteur(ctx, tenant._id, args.userId)];
    } else if (args.alleenEigen) {
      // Scope op de ingelogde gebruiker zelf (via externalUserId, niet de UI-string).
      const eigen = (
        await ctx.db
          .query("users")
          .withIndex("by_external_user", (q: any) => q.eq("externalUserId", externalUserId))
          .collect()
      ).find((u: Doc<"users">) => u.tenantId === tenant._id);
      monteurs = eigen ? [eigen] : [];
    } else {
      const nietViewers = (
        await ctx.db
          .query("users")
          .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
          .collect()
      ).filter((u: Doc<"users">) => u.role !== "viewer"); // kijkers doen geen inmetingen
      // Whitelist zodra er minstens één gebruiker expliciet op `toonInAgenda: true` staat;
      // anders (nog niet geconfigureerd) alle niet-viewers, zodat de agenda nooit leeg is.
      const aangevinkt = nietViewers.filter((u: Doc<"users">) => u.toonInAgenda === true);
      monteurs = aangevinkt.length > 0 ? aangevinkt : nietViewers;
    }

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
        gemetenDoorUserId: meting.gemetenDoorUserId ? String(meting.gemetenDoorUserId) : null,
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

      const eigenMetingen = metingen.filter((m: Doc<"measurements">) =>
        hoortBijMonteur(m, monteur._id, naam)
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

// ── Inmeet-beschikbaarheid (één monteur, één dag) ─────────────────────────────
// Hint bij het inplannen van een inmeetbezoek: is het een inmeetdag (di/wo/do),
// is de monteur die dag afwezig, en is er binnen het venster 16:30–17:30 nog
// ruimte (capaciteit 2; klein=1, volledig=2)? `excludeProjectId` laat het bezoek
// van het dossier dat je nu plant buiten de telling, zodat herplannen niet
// zichzelf meetelt.
export const inmeetBeschikbaarheid = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    userId: v.id("users"),
    datum: v.number(),
    excludeProjectId: v.optional(v.id("projects"))
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const monteur = await requireMonteur(ctx, tenant._id, args.userId);
    const naam = monteur.naam ?? monteur.email;

    const weekdag = weekdagVanMs(args.datum);
    const isInmeetdag = INMEET_DAGEN.includes(weekdag);

    // De inmeetdatum is rond het middaguur verankerd (zie fromDateInputValue),
    // dus [datum-12u, datum+12u) dekt precies de kalenderdag.
    const dagStart = args.datum - DAG_MS / 2;
    const dagEind = args.datum + DAG_MS / 2;

    const afwezigRows = await ctx.db
      .query("monteurAfwezigheid")
      .withIndex("by_monteur", (q: any) => q.eq("tenantId", tenant._id).eq("userId", args.userId))
      .collect();
    const afwezigRij = afwezigRows.find(
      (a: Doc<"monteurAfwezigheid">) => a.vanafDatum < dagEind && a.totDatum >= dagStart
    );
    const afwezig = afwezigRij
      ? { type: afwezigRij.type, reden: afwezigRij.reden ?? null }
      : null;

    const metingen = await ctx.db
      .query("measurements")
      .withIndex("by_measurement_date", (q: any) =>
        q.eq("tenantId", tenant._id).gte("inmeetdatum", dagStart).lt("inmeetdatum", dagEind)
      )
      .collect();

    const eigen = metingen.filter(
      (m: Doc<"measurements">) =>
        hoortBijMonteur(m, monteur._id, naam) &&
        (!args.excludeProjectId || m.projectId !== args.excludeProjectId)
    );

    let gebruikteCapaciteit = 0;
    const bezoeken = [];
    for (const m of eigen) {
      gebruikteCapaciteit += omvangUnits(m.omvang);
      const project = await ctx.db.get(m.projectId);
      const klant = await ctx.db.get(m.klantId);
      bezoeken.push({
        inmetingId: String(m._id),
        projectId: String(m.projectId),
        projectTitel:
          project && project.tenantId === tenant._id ? project.titel ?? "Project" : "Project",
        klantNaam:
          klant && klant.tenantId === tenant._id ? klant.weergaveNaam ?? "Klant" : "Klant",
        omvang: m.omvang ?? null
      });
    }

    return {
      monteur: { id: String(monteur._id), naam },
      weekdag,
      isInmeetdag,
      venster: { startMinuut: INMEET_START_MINUUT, eindMinuut: INMEET_EIND_MINUUT },
      maxCapaciteit: INMEET_CAPACITEIT,
      gebruikteCapaciteit,
      vrijeCapaciteit: Math.max(0, INMEET_CAPACITEIT - gebruikteCapaciteit),
      afwezig,
      bezoeken
    };
  }
});

// ── Migratie: koppel bestaande inmetingen op userId ───────────────────────────
// Eenmalige backfill: zet gemetenDoorUserId op basis van de gemetenDoor-naam,
// per tenant. Alleen bij een ÉÉNduidige naam-match; bij 0 of meerdere matches
// blijft de rij ongemoeid (de naam-fallback in hoortBijMonteur dekt die nog).
// Intern (geen publieke API). Draai met: npx convex run beheer/agenda:backfillGemetenDoorUserId
// Aanname: het aantal measurements past binnen één Convex-transactie (inmetingen zijn
// laagvolume — ~1 per project). Bij forse groei: omzetten naar een chunked variant met
// cursor (zie backfillMeasurementRoomLinksChunk). De naam-fallback in hoortBijMonteur houdt
// het systeem correct werken, ook als deze backfill (nog) niet of slechts deels is gedraaid.
export const backfillGemetenDoorUserId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const metingen = await ctx.db.query("measurements").collect();
    const usersPerTenant = new Map<string, Doc<"users">[]>();
    let bijgewerkt = 0;
    let ambigu = 0;
    const now = Date.now();

    for (const meting of metingen) {
      if (meting.gemetenDoorUserId || !meting.gemetenDoor) {
        continue;
      }
      const tenantKey = String(meting.tenantId);
      if (!usersPerTenant.has(tenantKey)) {
        usersPerTenant.set(
          tenantKey,
          await ctx.db
            .query("users")
            .withIndex("by_tenant", (q: any) => q.eq("tenantId", meting.tenantId))
            .collect()
        );
      }
      const matches = (usersPerTenant.get(tenantKey) ?? []).filter(
        (u: Doc<"users">) => (u.naam ?? u.email) === meting.gemetenDoor
      );
      if (matches.length === 1) {
        await ctx.db.patch(meting._id, { gemetenDoorUserId: matches[0]._id, gewijzigdOp: now });
        bijgewerkt += 1;
      } else if (matches.length > 1) {
        ambigu += 1; // dubbele naam — laat staan, naam-fallback blijft werken
      }
    }

    return { totaal: metingen.length, bijgewerkt, ambigu };
  }
});
