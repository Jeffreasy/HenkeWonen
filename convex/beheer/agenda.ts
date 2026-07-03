import { internalMutation, mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutationActorValidator, readActorValidator, requireMutationRole, requireQueryRole } from "../authz";

export const DAG_MS = 24 * 60 * 60 * 1000;

// ── Inmeet-regels (Henke Wonen) ───────────────────────────────────────────────
// Inmeten kan alleen op di/wo/do, in het aankomstvenster 16:30–17:30. Per
// inmeetdag is er ruimte voor 2 "plekken": een klein klusje (1-2 ramen / 1 ruimte)
// telt als 1, een volledige woning als 2. Zo passen 2× klein óf 1× volledig.
const INMEET_DAGEN = [1, 2, 3]; // 0=maandag .. 6=zondag → di, wo, do
const INMEET_START_MINUUT = 16 * 60 + 30; // 16:30
const INMEET_EIND_MINUUT = 17 * 60 + 30; // 17:30
export const INMEET_CAPACITEIT = 2;

/** Weekdag (0=maandag .. 6=zondag), consistent met src/lib/agenda.weekdagVan. */
export function weekdagVanMs(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}

/** Maandag 00:00 (lokaal) van de week waarin `ms` valt — server-side spiegel van startVanWeek. */
export function startVanWeekMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - weekdagVanMs(d.getTime()));
  return d.getTime();
}

/** Capaciteit die een klus inneemt: volledige woning = 2, anders (incl. onbekend) = 1. */
export function omvangUnits(omvang?: string | null): number {
  return omvang === "volledig" ? 2 : 1;
}

/** Inmeten kan alleen op een inmeetdag (di/wo/do). */
export function isInmeetdag(datumMs: number): boolean {
  return INMEET_DAGEN.includes(weekdagVanMs(datumMs));
}

/**
 * Nette weergavenaam voor een gebruiker in de agenda/teamlijst: het ingestelde naam-veld,
 * anders een opgemaakte afleiding van het e-mail-lokaaldeel ("Wim@henkewonen.nl" → "Wim",
 * "jan.jansen@…" → "Jan Jansen"). Voorkomt dat ruwe e-mailadressen in de agenda staan.
 */
export function weergaveNaam(user: {
  agendaWeergaveNaam?: string | null;
  naam?: string | null;
  email: string;
}): string {
  if (user.agendaWeergaveNaam && user.agendaWeergaveNaam.trim()) return user.agendaWeergaveNaam.trim();
  if (user.naam && user.naam.trim()) return user.naam.trim();
  const local = (user.email ?? "").split("@")[0] ?? "";
  if (!local) return user.email ?? "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((deel) => deel.charAt(0).toUpperCase() + deel.slice(1))
    .join(" ");
}

/**
 * Bepaalt of een inmeting bij een monteur hoort. Leidend is de stabiele
 * gemetenDoorUserId; alleen als die ontbreekt (oude/legacy of vrije-tekst rijen)
 * vallen we terug op de naam. Zo breken hernoemen of dubbele namen niets.
 */
export function hoortBijMonteur(
  meting: Doc<"measurements">,
  monteurId: Id<"users">,
  naam: string
): boolean {
  if (meting.gemetenDoorUserId) {
    return meting.gemetenDoorUserId === monteurId;
  }
  return (meting.gemetenDoor ?? "") === naam;
}

/**
 * Zoekt een gebruiker op ÉÉNduidige naam-match ((naam ?? email) === naam) — dezelfde
 * regel als de backfill en de naam-fallback van hoortBijMonteur. Bij 0 of meerdere
 * matches: null (dan is er geen herleidbare monteur).
 */
export async function resolveMonteurByNaam(
  ctx: any,
  tenantId: Id<"tenants">,
  naam?: string | null
): Promise<Doc<"users"> | null> {
  if (!naam) return null;
  const users = await ctx.db
    .query("users")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .collect();
  const matches = users.filter((u: Doc<"users">) => (u.naam ?? u.email) === naam);
  return matches.length === 1 ? (matches[0] as Doc<"users">) : null;
}

/**
 * Resolvet de monteur van een inmeting voor de capaciteits-/afwezigheidscheck: primair
 * via gemetenDoorUserId, anders via een éénduidige naam-match. Zonder dit vangnet zou
 * een legacy rij (alleen een naam) wél meetellen in iemands agenda/capaciteit (via de
 * naam-fallback van hoortBijMonteur) maar bij het verzetten van de datum zónder
 * capaciteitscheck passeren — een dubbele boeking die de plan-modal juist weigert.
 */
export async function resolveMonteurVoorMeting(
  ctx: any,
  tenantId: Id<"tenants">,
  meting: Pick<Doc<"measurements">, "gemetenDoor" | "gemetenDoorUserId">
): Promise<Doc<"users"> | null> {
  if (meting.gemetenDoorUserId) {
    const monteur = await ctx.db.get(meting.gemetenDoorUserId);
    return monteur && monteur.tenantId === tenantId ? (monteur as Doc<"users">) : null;
  }
  return resolveMonteurByNaam(ctx, tenantId, meting.gemetenDoor);
}

/**
 * Bewaakt dat een expliciet toegewezen monteur ook echt boekbaar is: geen kijker, en —
 * zodra de toonInAgenda-whitelist in gebruik is — aangevinkt als monteur. Spiegelt de
 * client-side filtering van de plan-modal (kiesbareMonteurs), zodat een race met het
 * uitvinken van een monteur niet tot een boeking leidt die in geen enkele teamagenda
 * zichtbaar is.
 */
export async function assertMonteurBoekbaar(
  ctx: any,
  tenantId: Id<"tenants">,
  monteur: Doc<"users">
): Promise<void> {
  // Tenant-isolatie ook hier afdwingen: een per ongeluk doorgegeven gebruiker uit
  // een andere tenant mag nooit als boekbare monteur passeren.
  if (monteur.tenantId !== tenantId) {
    throw new ConvexError("Monteur niet gevonden.");
  }
  if (monteur.role === "viewer") {
    throw new ConvexError("Een kijker kan geen inmetingen uitvoeren. Kies een andere monteur.");
  }
  const nietViewers = (
    await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .collect()
  ).filter((u: Doc<"users">) => u.role !== "viewer");
  const aangevinkt = nietViewers.filter((u: Doc<"users">) => u.toonInAgenda === true);
  if (aangevinkt.length > 0 && monteur.toonInAgenda !== true) {
    throw new ConvexError(
      "Deze medewerker staat niet (meer) als monteur in de agenda. Vink de medewerker aan in de agenda-instellingen of kies een andere monteur."
    );
  }
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

/**
 * Berekent de inmeet-beschikbaarheid van één monteur op een dag: is het een inmeetdag,
 * blokkeert een afwezigheid het inmeetvenster (hele dag, óf een tijdvak dat 16:30-17:30
 * overlapt), en hoeveel dagcapaciteit is al gebruikt. Voedt zowel de plan-hint (query
 * inmeetBeschikbaarheid) als de plan-guard (startOrPlanMeasurement) zodat beide identiek
 * rekenen. `excludeProjectId` laat het bezoek van het dossier dat je nu plant buiten de telling.
 */
export async function berekenInmeetBeschikbaarheid(
  ctx: any,
  tenantId: Id<"tenants">,
  monteur: Doc<"users">,
  datumMs: number,
  excludeProjectId?: Id<"projects">
) {
  const naam = monteur.naam ?? monteur.email;
  // De inmeetdatum is rond het middaguur verankerd (fromDateInputValue), dus
  // [datum-12u, datum+12u) dekt precies de kalenderdag.
  const dagStart = datumMs - DAG_MS / 2;
  const dagEind = datumMs + DAG_MS / 2;

  const afwezigRows = await ctx.db
    .query("monteurAfwezigheid")
    .withIndex("by_monteur", (q: any) => q.eq("tenantId", tenantId).eq("userId", monteur._id))
    .collect();
  // Blokkeert het inmeetvenster (16:30-17:30) alleen bij hele-dag-afwezigheid óf een
  // tijdvak dat het venster overlapt — consistent met dagStatusVoorMonteur in de UI.
  const blokkerend = afwezigRows.find(
    (a: Doc<"monteurAfwezigheid">) =>
      a.vanafDatum < dagEind &&
      a.totDatum >= dagStart &&
      (a.heleDag ||
        (a.startMinuut != null &&
          a.eindMinuut != null &&
          a.startMinuut < INMEET_EIND_MINUUT &&
          a.eindMinuut > INMEET_START_MINUUT))
  );
  const afwezig = blokkerend
    ? { type: blokkerend.type, reden: blokkerend.reden ?? null }
    : null;

  const metingen = await ctx.db
    .query("measurements")
    .withIndex("by_measurement_date", (q: any) =>
      q.eq("tenantId", tenantId).gte("inmeetdatum", dagStart).lt("inmeetdatum", dagEind)
    )
    .collect();
  const eigen: Doc<"measurements">[] = metingen.filter(
    (m: Doc<"measurements">) =>
      hoortBijMonteur(m, monteur._id, naam) &&
      (!excludeProjectId || m.projectId !== excludeProjectId)
  );
  const gebruikteCapaciteit = eigen.reduce(
    (sum: number, m: Doc<"measurements">) => sum + omvangUnits(m.omvang),
    0
  );

  return {
    naam,
    weekdag: weekdagVanMs(datumMs),
    isInmeetdag: isInmeetdag(datumMs),
    dagStart,
    dagEind,
    afwezig,
    eigen,
    gebruikteCapaciteit,
    maxCapaciteit: INMEET_CAPACITEIT,
    vrijeCapaciteit: Math.max(0, INMEET_CAPACITEIT - gebruikteCapaciteit)
  };
}

/**
 * Server-side guard voor het boeken/wijzigen van een inmeetafspraak. Weigert (tenzij `force`):
 * een niet-inmeetdag, een afwezige monteur, of overschrijding van de dagcapaciteit. Wordt vanuit
 * ELK pad dat measurement.inmeetdatum muteert aangeroepen (startOrPlanMeasurement, updateMeasurement,
 * updateProject), zodat er één afgedwongen planningsregel-bron is en geen pad de regels kan omzeilen.
 */
export async function assertInmeetBoeking(
  ctx: any,
  tenantId: Id<"tenants">,
  opts: {
    datumMs?: number | null;
    monteur?: Doc<"users"> | null;
    omvang?: string | null;
    excludeProjectId?: Id<"projects">;
    force?: boolean;
  }
) {
  if (opts.force || opts.datumMs == null) return;
  if (!isInmeetdag(opts.datumMs)) {
    throw new ConvexError("Inmeten kan alleen op dinsdag, woensdag of donderdag.");
  }
  if (opts.monteur) {
    const besch = await berekenInmeetBeschikbaarheid(
      ctx,
      tenantId,
      opts.monteur,
      opts.datumMs,
      opts.excludeProjectId
    );
    if (besch.afwezig) {
      throw new ConvexError("De gekozen monteur is die dag afwezig. Kies een andere datum of monteur.");
    }
    const nodig = omvangUnits(opts.omvang);
    if (besch.gebruikteCapaciteit + nodig > besch.maxCapaciteit) {
      throw new ConvexError("De inmeetdag van deze monteur is vol. Kies een andere datum of monteur.");
    }
  }
}

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

// Stel de weergavenaam-override voor de agenda/teamlijst in (bv. "Winkel" voor Simone).
// Lege/witruimte-waarde wist de override → terug naar het naam-veld / e-mail-afleiding.
export const setAgendaWeergaveNaam = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    userId: v.id("users"),
    naam: v.string()
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
    const naam = args.naam.trim();
    await ctx.db.patch(args.userId, {
      agendaWeergaveNaam: naam ? naam : undefined,
      gewijzigdOp: Date.now()
    });
    return { userId: String(args.userId), agendaWeergaveNaam: naam || null };
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

    // Teambrede kantoorweergave (geen specifieke monteur, niet alleen-eigen) toont ook de
    // niet-toegewezen inmetingen; daarvoor is de volledige niet-viewer-set nodig (S1).
    const toonNietToegewezen = !args.userId && !args.alleenEigen;
    let alleNietViewers: Doc<"users">[] = [];

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
      alleNietViewers = (
        await ctx.db
          .query("users")
          .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
          .collect()
      ).filter((u: Doc<"users">) => u.role !== "viewer"); // kijkers doen geen inmetingen
      // Whitelist zodra er minstens één gebruiker expliciet op `toonInAgenda: true` staat;
      // anders (nog niet geconfigureerd) alle niet-viewers, zodat de agenda nooit leeg is.
      const aangevinkt = alleNietViewers.filter((u: Doc<"users">) => u.toonInAgenda === true);
      monteurs = aangevinkt.length > 0 ? aangevinkt : alleNietViewers;
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
        omvang: meting.omvang ?? null,
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
        // `naam` (e-mail-fallback) blijft voor de match; voor de weergave een nette naam.
        monteur: { id: String(monteur._id), naam: weergaveNaam(monteur), role: monteur.role },
        werktijden,
        afwezigheden,
        bezoeken
      });
    }

    // S1: inmetingen met een datum binnen de week maar zonder herleidbare monteur staan in
    // geen enkele monteur-agenda en tellen niet mee in de capaciteit. Toon ze apart (alleen in
    // de teambrede kantoorweergave) zodat ze niet stil verdwijnen.
    const nietToegewezen = [];
    if (toonNietToegewezen) {
      for (const m of metingen) {
        const herleidbaar = alleNietViewers.some((u: Doc<"users">) =>
          hoortBijMonteur(m, u._id, u.naam ?? u.email)
        );
        if (!herleidbaar) nietToegewezen.push(await bezoekDetail(m));
      }
    }

    return { weekStart, weekEnd, monteurs: result, nietToegewezen };
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
    const besch = await berekenInmeetBeschikbaarheid(
      ctx,
      tenant._id,
      monteur,
      args.datum,
      args.excludeProjectId
    );

    const bezoeken = [];
    for (const m of besch.eigen) {
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
      monteur: { id: String(monteur._id), naam: weergaveNaam(monteur) },
      weekdag: besch.weekdag,
      isInmeetdag: besch.isInmeetdag,
      venster: { startMinuut: INMEET_START_MINUUT, eindMinuut: INMEET_EIND_MINUUT },
      maxCapaciteit: besch.maxCapaciteit,
      gebruikteCapaciteit: besch.gebruikteCapaciteit,
      vrijeCapaciteit: besch.vrijeCapaciteit,
      afwezig: besch.afwezig,
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
