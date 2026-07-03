import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRole,
  requireMutationRoleForTenantId,
  requireQueryRoleForTenantId
} from "../authz";
import { pilotHiddenReason } from "../catalog/pilot";
import { isUnitCompatible } from "../catalog/pricingRules";
import {
  assertInmeetBoeking,
  resolveMonteurByNaam,
  resolveMonteurVoorMeting
} from "../beheer/agenda";
import { addProjectEvent, assertValidRoomDimensions, hasProjectEvent } from "../portalUtils";
import {
  calculatorForLine,
  deriveLineForRoom,
  paramsFromInvoer,
  type RoomDimensions
} from "../../src/lib/quotes/roomLineDerivation";
import type { Doc, Id } from "../_generated/dataModel";

/** Genormaliseerde ruimtenaam voor dedup (trim + lowercase). */
function normalizeRoomName(naam: string): string {
  return naam.trim().toLowerCase();
}

/**
 * Auto-promotie van een inmeet-ruimte naar een dossier-ruimte.
 *
 * Bij het toevoegen van een measurementRoom zonder expliciete dossier-koppeling zoeken we de
 * dossier-ruimte (projectRoom) met dezelfde genormaliseerde naam binnen het project; bestaat die
 * niet, dan maken we 'm aan (maten van m → cm). Zo hoeft de gebruiker een ruimte niet twee keer
 * in te voeren, blijft de dossierlijst in sync met de inmeting, en behoudt de offerte de ruimte
 * (quoteLines verwijzen immers hard naar projectRooms). Retourneert de projectRoom-id.
 */
export async function findOrCreateProjectRoom(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  fields: {
    naam: string;
    verdieping?: string;
    breedteM?: number;
    lengteM?: number;
    hoogteM?: number;
    oppervlakteM2?: number;
    omtrekM?: number;
    notities?: string;
  }
): Promise<Id<"projectRooms">> {
  const projectRooms = await ctx.db
    .query("projectRooms")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();

  const target = normalizeRoomName(fields.naam);
  const existing = projectRooms.find((room: any) => normalizeRoomName(room.naam) === target);

  if (existing) {
    return existing._id as Id<"projectRooms">;
  }

  const now = Date.now();
  const toCm = (meters?: number) =>
    typeof meters === "number" ? Math.round(meters * 100) : undefined;

  const roomId = await ctx.db.insert("projectRooms", {
    tenantId,
    projectId,
    naam: fields.naam,
    verdieping: fields.verdieping,
    breedteCm: toCm(fields.breedteM),
    lengteCm: toCm(fields.lengteM),
    hoogteCm: toCm(fields.hoogteM),
    oppervlakteM2: fields.oppervlakteM2,
    omtrekMeter: fields.omtrekM,
    notities: fields.notities,
    sortOrder: projectRooms.length + 1,
    aangemaaktOp: now,
    gewijzigdOp: now
  });
  await ctx.db.patch(projectId, { gewijzigdOp: now });

  return roomId as Id<"projectRooms">;
}

/**
 * Houdt de dossier-ruimte (projectRoom) in sync met de inmeet-ruimte: één ruimte-identiteit.
 * Identiteit (naam) wordt altijd doorgeschreven; verdieping en de gemeten maten alleen als ze
 * gedefinieerd zijn (nooit per ongeluk wissen). Maten gaan m → cm. Eénrichting: inmeting → dossier
 * (de inmeter meet ter plekke; het dossier weerspiegelt de laatste meting). De andere richting
 * (dossier-identiteit → inmeting) loopt via updateProjectRoom.
 */
export async function syncProjectRoomFromMeasurement(
  ctx: any,
  tenantId: Id<"tenants">,
  projectRuimteId: Id<"projectRooms"> | undefined,
  fields: {
    naam: string;
    verdieping?: string;
    breedteM?: number;
    lengteM?: number;
    hoogteM?: number;
    oppervlakteM2?: number;
    omtrekM?: number;
  }
): Promise<void> {
  if (!projectRuimteId) return;

  const projectRoom = await ctx.db.get(projectRuimteId);
  if (!projectRoom || projectRoom.tenantId !== tenantId) return;

  const toCm = (meters?: number) =>
    typeof meters === "number" ? Math.round(meters * 100) : undefined;

  const patch: Record<string, unknown> = { naam: fields.naam, gewijzigdOp: Date.now() };
  if (fields.verdieping !== undefined) patch.verdieping = fields.verdieping;
  if (typeof fields.breedteM === "number") patch.breedteCm = toCm(fields.breedteM);
  if (typeof fields.lengteM === "number") patch.lengteCm = toCm(fields.lengteM);
  if (typeof fields.hoogteM === "number") patch.hoogteCm = toCm(fields.hoogteM);
  if (typeof fields.oppervlakteM2 === "number") patch.oppervlakteM2 = fields.oppervlakteM2;
  if (typeof fields.omtrekM === "number") patch.omtrekMeter = fields.omtrekM;

  await ctx.db.patch(projectRuimteId, patch);
}

/**
 * Herrekent de niet-handmatige, nog niet geconverteerde meetregels van een ruimte met de
 * actuele ruimtematen — de belofte van `handmatigAangepast` (schema): automatische regels
 * bewegen mee bij een maatcorrectie. Zonder dit stroomden verouderde hoeveelheden de
 * offerte in (klant krijgt te weinig/te veel besteld). Regels die niet automatisch
 * herleidbaar zijn (maatwerk/gordijnen/trap) of waarvan de maten onvolledig raken,
 * blijven ongemoeid. Retourneert het aantal herrekende regels voor terugkoppeling.
 */
async function recalculateLinesForRoom(
  ctx: any,
  tenantId: Id<"tenants">,
  room: Doc<"measurementRooms">
): Promise<number> {
  const lines = await ctx.db
    .query("measurementLines")
    .withIndex("by_room", (q: any) => q.eq("tenantId", tenantId).eq("ruimteId", room._id))
    .collect();
  const dims: RoomDimensions = {
    breedteM: room.breedteM,
    lengteM: room.lengteM,
    hoogteM: room.hoogteM,
    oppervlakteM2: room.oppervlakteM2,
    omtrekM: room.omtrekM
  };

  let recalculated = 0;
  const now = Date.now();
  for (const line of lines as Doc<"measurementLines">[]) {
    if (line.handmatigAangepast || line.quotePreparationStatus === "converted") {
      continue;
    }
    const calculator = calculatorForLine(line);
    if (!calculator) {
      continue;
    }
    const derived = deriveLineForRoom(
      calculator,
      dims,
      paramsFromInvoer((line.invoer ?? {}) as Record<string, unknown>)
    );
    if (derived.validationError) {
      continue; // maten (nu) onvolledig voor deze berekening: regel laten staan
    }
    if (derived.aantal === line.aantal && derived.eenheid === line.eenheid) {
      continue;
    }
    await ctx.db.patch(line._id, {
      invoer: derived.invoer,
      resultaat: derived.resultaat,
      snijverliesPct: derived.snijverliesPct,
      aantal: derived.aantal,
      eenheid: derived.eenheid,
      gewijzigdOp: now
    });
    recalculated += 1;
  }

  return recalculated;
}

const measurementStatus = v.union(
  v.literal("draft"),
  v.literal("measured"),
  v.literal("reviewed"),
  v.literal("converted_to_quote")
);

const productGroup = v.union(
  v.literal("flooring"),
  v.literal("plinths"),
  v.literal("wallpaper"),
  v.literal("wall_panels"),
  v.literal("curtains"),
  v.literal("rails"),
  v.literal("stairs"),
  v.literal("other")
);

const calculationType = v.union(
  v.literal("area"),
  v.literal("perimeter"),
  v.literal("rolls"),
  v.literal("panels"),
  v.literal("stairs"),
  v.literal("matrix"),
  v.literal("manual")
);

const quoteLineType = v.union(
  v.literal("product"),
  v.literal("service"),
  v.literal("labor"),
  v.literal("material"),
  v.literal("discount"),
  v.literal("text"),
  v.literal("manual")
);

const quotePreparationStatus = v.union(
  v.literal("draft"),
  v.literal("ready_for_quote"),
  v.literal("converted")
);

function hasArg<T extends object>(args: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(args, key);
}

async function requireMeasurement(ctx: any, tenantId: any, measurementId: any) {
  const measurement = await ctx.db.get(measurementId);

  if (!measurement || measurement.tenantId !== tenantId) {
    throw new ConvexError("Inmeting niet gevonden.");
  }

  return measurement;
}

async function touchMeasurement(ctx: any, measurementId: any, updatedAt = Date.now()) {
  await ctx.db.patch(measurementId, { gewijzigdOp: updatedAt });
}

// Bewaakt de numerieke meetregel-invoer: aantal en snijverlies-% stromen door naar de
// offerte- en factuurtotalen, dus NaN/Infinity of negatieve/absurde waarden mogen niet
// stilletjes worden opgeslagen. snijverliesPct is een percentage (seed gebruikt 7/5/10).
function validateMeasurementQuantities(aantal: number, snijverliesPct?: number) {
  if (!Number.isFinite(aantal) || aantal < 0) {
    throw new ConvexError("Aantal moet een eindig, niet-negatief getal zijn.");
  }
  if (
    snijverliesPct !== undefined &&
    (!Number.isFinite(snijverliesPct) || snijverliesPct < 0 || snijverliesPct > 100)
  ) {
    throw new ConvexError("Snijverlies-% moet een getal tussen 0 en 100 zijn.");
  }
}

/**
 * Valideert een tijdens het inmeten gekozen product: moet bij de tenant horen
 * en mag niet pilot-verborgen zijn (zelfde guard als validateQuoteLineProduct).
 */
async function requireSelectableProduct(ctx: any, tenantId: any, productId: any) {
  const product = await ctx.db.get(productId);

  if (!product || product.tenantId !== tenantId) {
    throw new ConvexError("Product niet gevonden.");
  }

  const category = product.categorieId ? await ctx.db.get(product.categorieId) : null;

  if (pilotHiddenReason(product, category?.naam)) {
    throw new ConvexError("Dit product is in de pilot niet beschikbaar.");
  }

  if (product.status !== "active") {
    throw new ConvexError("Dit product is niet (meer) actief en kan niet worden gekozen.");
  }

  return product;
}

/** Optionele richtprijs-snapshotvelden op een meetregel. */
const indicativeSnapshotArgs = {
  productId: v.optional(v.id("products")),
  productNaam: v.optional(v.string()),
  indicatieveEenheidsprijsExBtw: v.optional(v.number()),
  indicatiefBtwTarief: v.optional(v.number()),
  indicatievePrijsEenheid: v.optional(v.string()),
  indicatievePrijsSoort: v.optional(v.string()),
  indicatiefVastgelegdOp: v.optional(v.number())
};

async function getActiveWasteProfiles(ctx: any, tenantId: any, productGroupArg?: string) {
  if (productGroupArg) {
    return await ctx.db
      .query("wasteProfiles")
      .withIndex("by_product_group", (q: any) =>
        q.eq("tenantId", tenantId).eq("productGroep", productGroupArg)
      )
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect();
  }

  return await ctx.db
    .query("wasteProfiles")
    .withIndex("by_status", (q: any) => q.eq("tenantId", tenantId).eq("status", "active"))
    .collect();
}

export const getForProject = query({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new ConvexError("Project niet gevonden.");
    }

    const measurement = await ctx.db
      .query("measurements")
      .withIndex("by_project", (q) =>
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .order("desc")
      .first();
    const wasteProfiles = await getActiveWasteProfiles(ctx, args.tenantId);

    if (!measurement) {
      return {
        measurement: null,
        rooms: [],
        lines: [],
        wasteProfiles
      };
    }

    const rooms = await ctx.db
      .query("measurementRooms")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", args.tenantId).eq("inmetingId", measurement._id)
      )
      .collect();
    const lines = await ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", args.tenantId).eq("inmetingId", measurement._id)
      )
      .collect();

    return {
      measurement,
      rooms: rooms.sort((left, right) => left.sortOrder - right.sortOrder),
      lines: lines.sort((left, right) => left.aangemaaktOp - right.aangemaaktOp),
      wasteProfiles
    };
  }
});

export const listReadyForQuoteByProject = query({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new ConvexError("Project niet gevonden.");
    }

    const measurements = await ctx.db
      .query("measurements")
      .withIndex("by_project", (q) =>
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .order("desc")
      .collect();
    const latestMeasurement = measurements[0] ?? null;
    const readyLines = [];
    // Aantal regels dat nog in concept staat: de import-picker toont alleen
    // ready_for_quote-regels, dus zonder deze telling ziet de winkel niet dat de
    // inmeting nog niet-klaargezette regels bevat en gaat een onvolledige offerte
    // de deur uit zonder enige waarschuwing.
    let draftLineCount = 0;

    for (const measurement of measurements) {
      const [rooms, lines] = await Promise.all([
        ctx.db
          .query("measurementRooms")
          .withIndex("by_measurement", (q: any) =>
            q.eq("tenantId", args.tenantId).eq("inmetingId", measurement._id)
          )
          .collect(),
        ctx.db
          .query("measurementLines")
          .withIndex("by_measurement", (q: any) =>
            q.eq("tenantId", args.tenantId).eq("inmetingId", measurement._id)
          )
          .collect()
      ]);
      const roomsById = new Map(rooms.map((room: any) => [String(room._id), room]));

      for (const line of lines) {
        if (line.quotePreparationStatus === "draft") {
          draftLineCount += 1;
        }
        if (line.quotePreparationStatus !== "ready_for_quote") {
          continue;
        }

        const room = line.ruimteId ? roomsById.get(String(line.ruimteId)) : null;

        readyLines.push({
          line,
          measurement,
          room
        });
      }
    }

    return {
      measurement: latestMeasurement,
      readyLines: readyLines.sort((left, right) => left.line.aangemaaktOp - right.line.aangemaaktOp),
      draftLineCount
    };
  }
});

export const createForProject = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    projectId: v.id("projects"),
    klantId: v.id("customers"),
    inmeetdatum: v.optional(v.number()),
    gemetenDoor: v.optional(v.string()),
    notities: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { externalUserId } = await requireMutationRoleForTenantId(
      ctx,
      args.tenantId,
      args.actor,
      ["user", "editor", "admin"]
    );
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new ConvexError("Project niet gevonden.");
    }

    const customer = await ctx.db.get(args.klantId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new ConvexError("Klant niet gevonden.");
    }

    if (project.klantId !== args.klantId) {
      throw new ConvexError("Deze klant hoort niet bij dit project.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("measurements")
      .withIndex("by_project", (q) =>
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .order("desc")
      .first();

    // Plan-guard óók op dit pad: de invariant is dat ELK pad dat measurement.inmeetdatum
    // muteert de inmeet-regels toetst (zie assertInmeetBoeking) — dit pad omzeilde ze.
    const datumGewijzigd = hasArg(args, "inmeetdatum") && existing?.inmeetdatum !== args.inmeetdatum;
    if (datumGewijzigd && args.inmeetdatum !== undefined) {
      const monteur = existing
        ? await resolveMonteurVoorMeting(ctx, args.tenantId, existing)
        : await resolveMonteurByNaam(ctx, args.tenantId, args.gemetenDoor);
      await assertInmeetBoeking(ctx, args.tenantId, {
        datumMs: args.inmeetdatum,
        monteur,
        omvang: existing?.omvang,
        excludeProjectId: args.projectId
      });
    }

    let measurementId: Id<"measurements">;
    if (existing) {
      const patch: Record<string, unknown> = {};

      if (datumGewijzigd) {
        patch.inmeetdatum = args.inmeetdatum;
      }

      if (args.gemetenDoor && !existing.gemetenDoor) {
        patch.gemetenDoor = args.gemetenDoor;
      }

      if (hasArg(args, "notities") && args.notities && !existing.notities) {
        patch.notities = args.notities;
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, {
          ...patch,
          gewijzigdOp: now
        });
      }

      measurementId = existing._id;
    } else {
      measurementId = await ctx.db.insert("measurements", {
        tenantId: args.tenantId,
        projectId: args.projectId,
        klantId: args.klantId,
        status: "draft",
        inmeetdatum: args.inmeetdatum,
        gemetenDoor: args.gemetenDoor,
        notities: args.notities,
        createdByExternalUserId: externalUserId,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    // Zelfde nawerk als startOrPlanMeasurement, zodat "Inmeting starten" via dit pad niet
    // stil blijft: dossier-datum in sync, statusovergang vanuit de aanloopfase en een
    // workflow-event — anders bleef de winkel "Nieuwe aanvraag opvolgen" zien terwijl de
    // monteur al aan het meten was.
    const projectPatch: Partial<Doc<"projects">> = { gewijzigdOp: now };
    if (datumGewijzigd) {
      projectPatch.inmeetdatum = args.inmeetdatum;
    }
    if (project.status === "lead") {
      projectPatch.status = "measurement_planned";
    }
    await ctx.db.patch(project._id, projectPatch);

    const alreadyHasMeasurementEvent = await hasProjectEvent(
      ctx,
      args.tenantId,
      args.projectId,
      "measurement_planned"
    );
    if (!alreadyHasMeasurementEvent) {
      await addProjectEvent(
        ctx,
        args.tenantId,
        args.projectId,
        "measurement_planned",
        args.inmeetdatum ? "Inmeting gepland" : "Inmeting gestart",
        externalUserId
      );
    }

    return measurementId;
  }
});

export const updateMeasurement = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    inmetingId: v.id("measurements"),
    status: v.optional(measurementStatus),
    // `null` = het inmeetbezoek expliciet afzeggen (datum wissen). `undefined`
    // overleeft JSON niet (de Convex-client laat het veld weg), dus zonder
    // null-sentinel bestond er geen enkel pad om een afspraak af te zeggen.
    inmeetdatum: v.optional(v.union(v.number(), v.null())),
    gemetenDoor: v.optional(v.string()),
    notities: v.optional(v.string()),
    // Bewust de inmeet-regels overrulen bij het zetten van de inmeetdatum.
    force: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const measurement = await requireMeasurement(ctx, args.tenantId, args.inmetingId);

    const nieuweDatum = args.inmeetdatum ?? undefined; // null → wissen
    const datumGewijzigd = hasArg(args, "inmeetdatum") && measurement.inmeetdatum !== nieuweDatum;

    // Plan-guard ook hier: dit form (office/field 'Inmeting samenvatting') zet de inmeetdatum direct
    // en synct die naar het dossier. Alleen toetsen bij een DAADWERKELIJKE datumwijziging: een
    // ongewijzigde (legacy) datum mag het opslaan van status/notities niet blokkeren — er bestaat
    // geen UI-pad dat force meestuurt, dus zo'n dossier zat anders muurvast. Resolve de monteur
    // (userId, anders éénduidige naam) voor de capaciteits-/afwezigheidscheck, zodat ook rijen
    // zonder userId niet buiten de capaciteit om verzet kunnen worden.
    if (datumGewijzigd && nieuweDatum !== undefined) {
      const monteur = await resolveMonteurVoorMeting(ctx, args.tenantId, measurement);
      await assertInmeetBoeking(ctx, args.tenantId, {
        datumMs: nieuweDatum,
        monteur,
        omvang: measurement.omvang,
        excludeProjectId: measurement.projectId as Id<"projects">,
        force: args.force
      });
    }

    const patch: Record<string, unknown> = {
      gewijzigdOp: Date.now()
    };

    if (args.status !== undefined && args.status !== measurement.status) {
      // 'Verwerkt naar offerte' wordt automatisch beheerd (gezet bij de offerte-import,
      // teruggedraaid als de regels weer vrijkomen). Handmatig die status in- of
      // uitstappen gaf tegenstrijdige signalen tussen het winkel-paneel en de
      // urgentiekleur op de buitendienst-kaart.
      if (args.status === "converted_to_quote" || measurement.status === "converted_to_quote") {
        throw new ConvexError(
          "De status 'Verwerkt naar offerte' wordt automatisch beheerd bij het verwerken naar (of terugtrekken uit) een offerte en kan niet handmatig worden gezet."
        );
      }
      patch.status = args.status;
    }

    if (datumGewijzigd) {
      patch.inmeetdatum = nieuweDatum;
    }

    // Naam en userId blijven synchroon (zelfde semantiek als startOrPlanMeasurement):
    // leeg = beide wissen, éénduidig teamlid = beide zetten, vrije tekst = naam zetten +
    // oude userId wissen. Anders blijft de agenda/capaciteit (userId-primair) op de oude
    // monteur hangen terwijl de kaart de nieuwe naam toont.
    if (hasArg(args, "gemetenDoor")) {
      const naam = args.gemetenDoor?.trim() ? args.gemetenDoor.trim() : undefined;
      if (naam !== measurement.gemetenDoor) {
        patch.gemetenDoor = naam;
        const matchendeMonteur = await resolveMonteurByNaam(ctx, args.tenantId, naam);
        patch.gemetenDoorUserId = matchendeMonteur?._id;
      }
    }

    if (hasArg(args, "notities")) {
      patch.notities = args.notities;
    }

    await ctx.db.patch(args.inmetingId, patch);

    // Houd de inmeetdatum op het dossier in sync met de inmeting, zodat winkel en
    // buitendienst dezelfde planningsdatum zien (M5: bidirectionele sync).
    if (datumGewijzigd) {
      const project = await ctx.db.get(measurement.projectId as Id<"projects">);
      if (project && project.tenantId === args.tenantId && project.inmeetdatum !== nieuweDatum) {
        await ctx.db.patch(project._id, {
          inmeetdatum: nieuweDatum,
          gewijzigdOp: Date.now()
        });
      }
    }

    return args.inmetingId;
  }
});

export const addMeasurementRoom = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    inmetingId: v.id("measurements"),
    projectRuimteId: v.optional(v.id("projectRooms")),
    naam: v.string(),
    verdieping: v.optional(v.string()),
    breedteM: v.optional(v.number()),
    lengteM: v.optional(v.number()),
    hoogteM: v.optional(v.number()),
    oppervlakteM2: v.optional(v.number()),
    omtrekM: v.optional(v.number()),
    notities: v.optional(v.string()),
    sortOrder: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    assertValidRoomDimensions({
      breedteM: args.breedteM,
      lengteM: args.lengteM,
      hoogteM: args.hoogteM,
      oppervlakteM2: args.oppervlakteM2,
      omtrekM: args.omtrekM
    });
    const measurement = await requireMeasurement(ctx, args.tenantId, args.inmetingId);

    let projectRuimteId = args.projectRuimteId;

    if (projectRuimteId) {
      const projectRoom = await ctx.db.get(projectRuimteId);

      if (
        !projectRoom ||
        projectRoom.tenantId !== args.tenantId ||
        projectRoom.projectId !== measurement.projectId
      ) {
        throw new ConvexError("Ruimte niet gevonden.");
      }
    } else {
      // Auto-promotie: koppel/maak de dossier-ruimte zodat dezelfde ruimte niet twee keer
      // ingevoerd hoeft te worden en de offerte de ruimte behoudt.
      projectRuimteId = await findOrCreateProjectRoom(ctx, args.tenantId, measurement.projectId, {
        naam: args.naam,
        verdieping: args.verdieping,
        breedteM: args.breedteM,
        lengteM: args.lengteM,
        hoogteM: args.hoogteM,
        oppervlakteM2: args.oppervlakteM2,
        omtrekM: args.omtrekM,
        notities: args.notities
      });
    }

    const rooms = await ctx.db
      .query("measurementRooms")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", args.tenantId).eq("inmetingId", args.inmetingId)
      )
      .collect();
    const now = Date.now();

    // Idempotent op naam, maar als UPSERT: wie op locatie dezelfde ruimtenaam mét maten
    // invoert (bv. de winkel had "Woonkamer" alvast zonder maten voorbereid) verwacht dat
    // die maten landen — voorheen werden ze stil weggegooid en meldde de UI even later
    // "Deze ruimtes missen nog maten". Alleen meegegeven velden worden toegepast; een
    // pure dubbelklik (identieke invoer) blijft een no-op.
    const duplicateRoom = rooms.find(
      (room) => room.naam.trim().toLowerCase() === args.naam.trim().toLowerCase()
    );
    if (duplicateRoom) {
      const dupPatch: Record<string, unknown> = {};
      if (args.verdieping !== undefined && args.verdieping !== duplicateRoom.verdieping) {
        dupPatch.verdieping = args.verdieping;
      }
      if (args.breedteM !== undefined && args.breedteM !== duplicateRoom.breedteM) {
        dupPatch.breedteM = args.breedteM;
      }
      if (args.lengteM !== undefined && args.lengteM !== duplicateRoom.lengteM) {
        dupPatch.lengteM = args.lengteM;
      }
      if (args.hoogteM !== undefined && args.hoogteM !== duplicateRoom.hoogteM) {
        dupPatch.hoogteM = args.hoogteM;
      }
      if (args.oppervlakteM2 !== undefined && args.oppervlakteM2 !== duplicateRoom.oppervlakteM2) {
        dupPatch.oppervlakteM2 = args.oppervlakteM2;
      }
      if (args.omtrekM !== undefined && args.omtrekM !== duplicateRoom.omtrekM) {
        dupPatch.omtrekM = args.omtrekM;
      }
      if (args.notities !== undefined && args.notities !== duplicateRoom.notities) {
        dupPatch.notities = args.notities;
      }

      if (Object.keys(dupPatch).length > 0) {
        await ctx.db.patch(duplicateRoom._id, { ...dupPatch, gewijzigdOp: now });
        const updatedDuplicate = await ctx.db.get(duplicateRoom._id);
        if (updatedDuplicate) {
          await syncProjectRoomFromMeasurement(ctx, args.tenantId, updatedDuplicate.projectRuimteId, {
            naam: updatedDuplicate.naam,
            verdieping: updatedDuplicate.verdieping,
            breedteM: updatedDuplicate.breedteM,
            lengteM: updatedDuplicate.lengteM,
            hoogteM: updatedDuplicate.hoogteM,
            oppervlakteM2: updatedDuplicate.oppervlakteM2,
            omtrekM: updatedDuplicate.omtrekM
          });
          await recalculateLinesForRoom(ctx, args.tenantId, updatedDuplicate);
        }
      }

      await touchMeasurement(ctx, args.inmetingId, now);
      return duplicateRoom._id;
    }

    const roomId = await ctx.db.insert("measurementRooms", {
      tenantId: args.tenantId,
      inmetingId: args.inmetingId,
      projectRuimteId,
      naam: args.naam,
      verdieping: args.verdieping,
      breedteM: args.breedteM,
      lengteM: args.lengteM,
      hoogteM: args.hoogteM,
      oppervlakteM2: args.oppervlakteM2,
      omtrekM: args.omtrekM,
      notities: args.notities,
      sortOrder: args.sortOrder ?? rooms.length + 1,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await touchMeasurement(ctx, args.inmetingId, now);
    // Houd de dossier-ruimte in sync (identiteit + gemeten maten).
    await syncProjectRoomFromMeasurement(ctx, args.tenantId, projectRuimteId, {
      naam: args.naam,
      verdieping: args.verdieping,
      breedteM: args.breedteM,
      lengteM: args.lengteM,
      hoogteM: args.hoogteM,
      oppervlakteM2: args.oppervlakteM2,
      omtrekM: args.omtrekM
    });

    return roomId;
  }
});

/**
 * Eenmalige migratie (ruimte-model A): koppel bestaande inmeet-ruimtes zonder dossier-koppeling
 * aan een dossier-ruimte (find-or-create op naam), zodat measurementRooms.projectRuimteId daarna
 * verplicht kan worden. Gated (admin + letterlijke confirm), dryRun-default, idempotent, chunked.
 *
 * Aansturing: node tools/backfill_room_links.mjs
 */
export const backfillMeasurementRoomLinksChunk = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    confirm: v.literal("BACKFILL_ROOM_LINKS"),
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, ["admin"]);
    const batchSize = Math.min(Math.max(args.batchSize ?? 200, 50), 500);
    const dryRun = args.dryRun ?? true;

    // Tenant-gescoped pagineren via de index (prefix op tenantId) i.p.v. een
    // volledige-tabel-scan die rijen van alle tenants buffert. Een backfill-run
    // moet met deze querievorm starten; cursors van een eerdere (ongeïndexeerde)
    // run zijn niet herbruikbaar.
    const paginated = await ctx.db
      .query("measurementRooms")
      .withIndex("by_measurement", (q) => q.eq("tenantId", tenant._id))
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let scanned = 0;
    let alreadyLinked = 0;
    let matched = 0;
    let linked = 0;
    let skippedNoMeasurement = 0;

    for (const room of paginated.page) {
      scanned += 1;

      if (room.projectRuimteId) {
        alreadyLinked += 1;
        continue;
      }

      const measurement = await ctx.db.get(room.inmetingId);
      if (!measurement) {
        skippedNoMeasurement += 1;
        continue;
      }

      matched += 1;

      if (!dryRun) {
        const projectRuimteId = await findOrCreateProjectRoom(
          ctx,
          tenant._id,
          measurement.projectId,
          {
            naam: room.naam,
            verdieping: room.verdieping,
            breedteM: room.breedteM,
            lengteM: room.lengteM,
            hoogteM: room.hoogteM,
            oppervlakteM2: room.oppervlakteM2,
            omtrekM: room.omtrekM
          }
        );
        await ctx.db.patch(room._id, { projectRuimteId, gewijzigdOp: Date.now() });
        linked += 1;
      }
    }

    return {
      dryRun,
      scanned,
      alreadyLinked,
      matched,
      linked: dryRun ? 0 : linked,
      skippedNoMeasurement,
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor
    };
  }
});

export const updateMeasurementRoom = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    ruimteId: v.id("measurementRooms"),
    naam: v.string(),
    verdieping: v.optional(v.string()),
    breedteM: v.optional(v.number()),
    lengteM: v.optional(v.number()),
    hoogteM: v.optional(v.number()),
    oppervlakteM2: v.optional(v.number()),
    omtrekM: v.optional(v.number()),
    notities: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    assertValidRoomDimensions({
      breedteM: args.breedteM,
      lengteM: args.lengteM,
      hoogteM: args.hoogteM,
      oppervlakteM2: args.oppervlakteM2,
      omtrekM: args.omtrekM
    });
    const room = await ctx.db.get(args.ruimteId);

    if (!room || room.tenantId !== args.tenantId) {
      throw new ConvexError("Meetruimte niet gevonden.");
    }

    const measurement = await requireMeasurement(ctx, args.tenantId, room.inmetingId);

    const patch: Record<string, unknown> = {
      naam: args.naam,
      gewijzigdOp: Date.now()
    };

    if (hasArg(args, "verdieping")) patch.verdieping = args.verdieping;
    if (hasArg(args, "breedteM")) patch.breedteM = args.breedteM;
    if (hasArg(args, "lengteM")) patch.lengteM = args.lengteM;
    if (hasArg(args, "hoogteM")) patch.hoogteM = args.hoogteM;
    if (hasArg(args, "oppervlakteM2")) patch.oppervlakteM2 = args.oppervlakteM2;
    if (hasArg(args, "omtrekM")) patch.omtrekM = args.omtrekM;
    if (hasArg(args, "notities")) patch.notities = args.notities;

    await ctx.db.patch(args.ruimteId, patch);
    await touchMeasurement(ctx, measurement._id);

    // Houd de gekoppelde dossier-ruimte in sync met de nieuwe meetwaarden en herreken de
    // automatische meetregels van deze ruimte, zodat een maatcorrectie niet met verouderde
    // hoeveelheden in de offerte belandt.
    const updated = await ctx.db.get(args.ruimteId);
    let herekendeRegels = 0;
    if (updated) {
      await syncProjectRoomFromMeasurement(ctx, args.tenantId, updated.projectRuimteId, {
        naam: updated.naam,
        verdieping: updated.verdieping,
        breedteM: updated.breedteM,
        lengteM: updated.lengteM,
        hoogteM: updated.hoogteM,
        oppervlakteM2: updated.oppervlakteM2,
        omtrekM: updated.omtrekM
      });
      herekendeRegels = await recalculateLinesForRoom(ctx, args.tenantId, updated);
    }

    return { ruimteId: args.ruimteId, herekendeRegels };
  }
});

export const deleteMeasurementRoom = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    ruimteId: v.id("measurementRooms")
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const room = await ctx.db.get(args.ruimteId);

    if (!room || room.tenantId !== args.tenantId) {
      throw new ConvexError("Meetruimte niet gevonden.");
    }

    const line = await ctx.db
      .query("measurementLines")
      .withIndex("by_room", (q: any) => q.eq("tenantId", args.tenantId).eq("ruimteId", room._id))
      .first();

    if (line) {
      throw new ConvexError(
        "Deze meetruimte bevat meetregels en kan niet veilig worden verwijderd."
      );
    }

    await ctx.db.delete(room._id);
    await touchMeasurement(ctx, room.inmetingId);

    return room._id;
  }
});

export const addMeasurementLine = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    inmetingId: v.id("measurements"),
    ruimteId: v.optional(v.id("measurementRooms")),
    productGroep: productGroup,
    berekeningType: calculationType,
    invoer: v.any(),
    resultaat: v.any(),
    snijverliesPct: v.optional(v.number()),
    aantal: v.number(),
    eenheid: v.string(),
    notities: v.optional(v.string()),
    offerteRegelType: quoteLineType,
    ...indicativeSnapshotArgs
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    await requireMeasurement(ctx, args.tenantId, args.inmetingId);
    validateMeasurementQuantities(args.aantal, args.snijverliesPct);

    if (args.ruimteId) {
      const room = await ctx.db.get(args.ruimteId);

      if (!room || room.tenantId !== args.tenantId || room.inmetingId !== args.inmetingId) {
        throw new ConvexError("Meetruimte niet gevonden.");
      }
    }

    if (args.productId) {
      await requireSelectableProduct(ctx, args.tenantId, args.productId);
    }

    const now = Date.now();

    // Richtprijs-snapshot bewaren bij een gekozen product óf bij een productloze richtprijs
    // (raambekleding-matrix: geen catalogusproduct, maar wél een indicatieve prijs).
    const keepSnapshot =
      Boolean(args.productId) || args.indicatieveEenheidsprijsExBtw !== undefined;

    const lineId = await ctx.db.insert("measurementLines", {
      tenantId: args.tenantId,
      inmetingId: args.inmetingId,
      ruimteId: args.ruimteId,
      productGroep: args.productGroep,
      berekeningType: args.berekeningType,
      invoer: args.invoer,
      resultaat: args.resultaat,
      snijverliesPct: args.snijverliesPct,
      aantal: args.aantal,
      eenheid: args.eenheid,
      notities: args.notities,
      offerteRegelType: args.offerteRegelType,
      quotePreparationStatus: "draft",
      productId: args.productId,
      productNaam: keepSnapshot ? args.productNaam : undefined,
      indicatieveEenheidsprijsExBtw: keepSnapshot ? args.indicatieveEenheidsprijsExBtw : undefined,
      indicatiefBtwTarief: keepSnapshot ? args.indicatiefBtwTarief : undefined,
      indicatievePrijsEenheid: keepSnapshot ? args.indicatievePrijsEenheid : undefined,
      indicatievePrijsSoort: keepSnapshot ? args.indicatievePrijsSoort : undefined,
      indicatiefVastgelegdOp: keepSnapshot ? (args.indicatiefVastgelegdOp ?? now) : undefined,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await touchMeasurement(ctx, args.inmetingId, now);

    return lineId;
  }
});

/**
 * Voegt meerdere meetregels in één keer toe (Fase C — workflow product → ruimtes → maten).
 * Eén gekozen product/dienst wordt op N ruimtes toegepast: de client berekent per ruimte de
 * regel met de gedeelde afleidings-engine (src/lib/quotes/roomLineDerivation.ts) en stuurt de
 * kant-en-klare regels mee. De server valideert elke regel net als addMeasurementLine
 * (hoeveelheid, ruimte hoort bij deze inmeting, product is selecteerbaar) en bewaart de
 * richtprijs-snapshot. Ruimte- en productcontroles worden gecachet omdat dezelfde ruimte/product
 * vaak in meerdere regels terugkomt.
 */
const MAX_BULK_LINES = 200;

export const addMeasurementLinesBulk = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    inmetingId: v.id("measurements"),
    regels: v.array(
      v.object({
        ruimteId: v.optional(v.id("measurementRooms")),
        productGroep: productGroup,
        berekeningType: calculationType,
        invoer: v.any(),
        resultaat: v.any(),
        snijverliesPct: v.optional(v.number()),
        aantal: v.number(),
        eenheid: v.string(),
        notities: v.optional(v.string()),
        offerteRegelType: quoteLineType,
        ...indicativeSnapshotArgs
      })
    )
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    await requireMeasurement(ctx, args.tenantId, args.inmetingId);

    if (args.regels.length === 0) {
      return { lineIds: [], count: 0 };
    }

    if (args.regels.length > MAX_BULK_LINES) {
      throw new ConvexError(`Maximaal ${MAX_BULK_LINES} regels per keer.`);
    }

    const checkedRooms = new Set<string>();
    const checkedProducts = new Set<string>();
    const now = Date.now();
    const lineIds: Array<Id<"measurementLines">> = [];

    for (const regel of args.regels) {
      validateMeasurementQuantities(regel.aantal, regel.snijverliesPct);

      if (regel.ruimteId && !checkedRooms.has(regel.ruimteId)) {
        const room = await ctx.db.get(regel.ruimteId);

        if (!room || room.tenantId !== args.tenantId || room.inmetingId !== args.inmetingId) {
          throw new ConvexError("Meetruimte niet gevonden.");
        }

        checkedRooms.add(regel.ruimteId);
      }

      if (regel.productId && !checkedProducts.has(regel.productId)) {
        await requireSelectableProduct(ctx, args.tenantId, regel.productId);
        checkedProducts.add(regel.productId);
      }

      const keepSnapshot =
        Boolean(regel.productId) || regel.indicatieveEenheidsprijsExBtw !== undefined;

      const lineId = await ctx.db.insert("measurementLines", {
        tenantId: args.tenantId,
        inmetingId: args.inmetingId,
        ruimteId: regel.ruimteId,
        productGroep: regel.productGroep,
        berekeningType: regel.berekeningType,
        invoer: regel.invoer,
        resultaat: regel.resultaat,
        snijverliesPct: regel.snijverliesPct,
        aantal: regel.aantal,
        eenheid: regel.eenheid,
        notities: regel.notities,
        offerteRegelType: regel.offerteRegelType,
        quotePreparationStatus: "draft",
        productId: regel.productId,
        productNaam: keepSnapshot ? regel.productNaam : undefined,
        indicatieveEenheidsprijsExBtw: keepSnapshot
          ? regel.indicatieveEenheidsprijsExBtw
          : undefined,
        indicatiefBtwTarief: keepSnapshot ? regel.indicatiefBtwTarief : undefined,
        indicatievePrijsEenheid: keepSnapshot ? regel.indicatievePrijsEenheid : undefined,
        indicatievePrijsSoort: keepSnapshot ? regel.indicatievePrijsSoort : undefined,
        indicatiefVastgelegdOp: keepSnapshot ? (regel.indicatiefVastgelegdOp ?? now) : undefined,
        aangemaaktOp: now,
        gewijzigdOp: now
      });

      lineIds.push(lineId);
    }

    await touchMeasurement(ctx, args.inmetingId, now);

    return { lineIds, count: lineIds.length };
  }
});

export const updateMeasurementLineStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    lineId: v.id("measurementLines"),
    quotePreparationStatus
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const line = await ctx.db.get(args.lineId);

    if (!line || line.tenantId !== args.tenantId) {
      throw new ConvexError("Inmeetregel niet gevonden.");
    }

    if (args.quotePreparationStatus === "converted") {
      throw new ConvexError(
        "Gebruik de verwerkingsactie om een meetregel aan een offerte te koppelen."
      );
    }

    const now = Date.now();

    await ctx.db.patch(args.lineId, {
      quotePreparationStatus: args.quotePreparationStatus,
      gewijzigdOp: now
    });
    await touchMeasurement(ctx, line.inmetingId, now);

    return args.lineId;
  }
});

export const updateMeasurementLine = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    lineId: v.id("measurementLines"),
    ruimteId: v.optional(v.id("measurementRooms")),
    productGroep: productGroup,
    berekeningType: calculationType,
    invoer: v.any(),
    resultaat: v.any(),
    snijverliesPct: v.optional(v.number()),
    aantal: v.number(),
    eenheid: v.string(),
    notities: v.optional(v.string()),
    offerteRegelType: quoteLineType,
    quotePreparationStatus: v.optional(quotePreparationStatus),
    handmatigAangepast: v.optional(v.boolean()),
    ...indicativeSnapshotArgs,
    /** Expliciet de productkeuze + snapshot wissen (undefined overleeft JSON niet). */
    clearProduct: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const line = await ctx.db.get(args.lineId);

    if (!line || line.tenantId !== args.tenantId) {
      throw new ConvexError("Inmeetregel niet gevonden.");
    }

    if (line.quotePreparationStatus === "converted") {
      throw new ConvexError("Verwerkte meetregels kunnen niet direct worden aangepast.");
    }
    validateMeasurementQuantities(args.aantal, args.snijverliesPct);

    if (args.ruimteId) {
      const room = await ctx.db.get(args.ruimteId);

      if (!room || room.tenantId !== args.tenantId || room.inmetingId !== line.inmetingId) {
        throw new ConvexError("Meetruimte niet gevonden.");
      }
    }

    if (args.productId && args.productId !== line.productId) {
      await requireSelectableProduct(ctx, args.tenantId, args.productId);
    }

    // Productkeuze: alleen overschrijven als de aanroeper het veld meestuurt of
    // expliciet wist via clearProduct (undefined overleeft JSON-serialisatie niet).
    const touchesProduct = hasArg(args, "productId") || args.clearProduct === true;
    const nextProductId =
      args.clearProduct === true ? undefined : touchesProduct ? args.productId : line.productId;

    // Productloze richtprijzen (raambekleding-matrix = "matrix"; dienst/legkost = "service_rule")
    // mogen opnieuw worden meegestuurd (her-prijzen bij gewijzigde maten) zónder product.
    const isProductlessSnapshotType = (type?: string) =>
      type === "matrix" || type === "service_rule";
    const sendsProductlessSnapshot =
      isProductlessSnapshotType(args.indicatievePrijsSoort) &&
      args.indicatieveEenheidsprijsExBtw !== undefined;
    const usesArgsSnapshot = touchesProduct || sendsProductlessSnapshot;
    const snapshotSource = usesArgsSnapshot ? args : line;
    const isProductlessSnapshot =
      isProductlessSnapshotType(snapshotSource.indicatievePrijsSoort) &&
      snapshotSource.indicatieveEenheidsprijsExBtw !== undefined;

    // Behoud een prijssnapshot wanneer er een product is én de prijseenheid bij de (mogelijk
    // gewijzigde) meeteenheid past, OF wanneer het een productloze richtprijs is. Anders
    // vervalt de prijs zodat geen m²-prijs × meters de offerte in stroomt. clearProduct wist altijd.
    const keepPriceSnapshot = Boolean(
      args.clearProduct !== true &&
      ((nextProductId &&
        snapshotSource.indicatieveEenheidsprijsExBtw !== undefined &&
        (touchesProduct ||
          isUnitCompatible(args.eenheid, snapshotSource.indicatievePrijsEenheid))) ||
        (!nextProductId && isProductlessSnapshot))
    );
    const keepProductName =
      args.clearProduct !== true && (Boolean(nextProductId) || isProductlessSnapshot);

    await ctx.db.patch(line._id, {
      ruimteId: args.ruimteId,
      productGroep: args.productGroep,
      berekeningType: args.berekeningType,
      invoer: args.invoer,
      resultaat: args.resultaat,
      snijverliesPct: args.snijverliesPct,
      aantal: args.aantal,
      eenheid: args.eenheid,
      notities: args.notities,
      offerteRegelType: args.offerteRegelType,
      quotePreparationStatus: args.quotePreparationStatus ?? line.quotePreparationStatus,
      handmatigAangepast: args.handmatigAangepast ?? line.handmatigAangepast,
      productId: nextProductId,
      productNaam: keepProductName ? snapshotSource.productNaam : undefined,
      indicatieveEenheidsprijsExBtw: keepPriceSnapshot
        ? snapshotSource.indicatieveEenheidsprijsExBtw
        : undefined,
      indicatiefBtwTarief: keepPriceSnapshot ? snapshotSource.indicatiefBtwTarief : undefined,
      indicatievePrijsEenheid: keepPriceSnapshot
        ? snapshotSource.indicatievePrijsEenheid
        : undefined,
      indicatievePrijsSoort: keepPriceSnapshot ? snapshotSource.indicatievePrijsSoort : undefined,
      indicatiefVastgelegdOp: keepPriceSnapshot
        ? usesArgsSnapshot
          ? (args.indicatiefVastgelegdOp ?? Date.now())
          : line.indicatiefVastgelegdOp
        : undefined,
      gewijzigdOp: Date.now()
    });
    await touchMeasurement(ctx, line.inmetingId);

    return line._id;
  }
});

export const deleteMeasurementLine = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    lineId: v.id("measurementLines")
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const line = await ctx.db.get(args.lineId);

    if (!line || line.tenantId !== args.tenantId) {
      throw new ConvexError("Inmeetregel niet gevonden.");
    }

    if (
      line.quotePreparationStatus === "converted" ||
      line.geconverteerdeOfferteId ||
      line.geconverteerdeOfferteregelId
    ) {
      throw new ConvexError("Verwerkte meetregels kunnen niet direct worden verwijderd.");
    }

    await ctx.db.delete(line._id);
    await touchMeasurement(ctx, line.inmetingId);

    return line._id;
  }
});

// markMeasurementLineConverted is verwijderd: legacy twee-staps-conversie, volledig
// vervangen door importMeasurementLinesToQuote (offertes/core.ts) dat de quoteLine
// aanmaakt én de measurementLine atomisch op 'converted' zet. De oude mutation was
// publiek en kon een meetregel aan een willekeurige quoteLine koppelen (mislink).

export const listWasteProfiles = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator,
    productGroep: v.optional(productGroup)
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    return await getActiveWasteProfiles(ctx, args.tenantId, args.productGroep);
  }
});

export const seedDefaultWasteProfiles = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const defaults = [
      {
        productGroup: "flooring",
        name: "PVC rechte plank",
        defaultWastePercent: 3,
        description: "Indicatief snijverlies voor PVC in rechte plank."
      },
      {
        productGroup: "flooring",
        name: "PVC visgraat",
        defaultWastePercent: 5,
        description: "Indicatief snijverlies voor PVC visgraat."
      },
      {
        productGroup: "flooring",
        name: "Tapijt standaard",
        defaultWastePercent: 10,
        description: "Indicatief snijverlies voor tapijt; rolbreedte blijft bepalend."
      },
      {
        productGroup: "flooring",
        name: "Vinyl standaard",
        defaultWastePercent: 10,
        description: "Indicatief snijverlies voor vinyl."
      },
      {
        productGroup: "wallpaper",
        name: "Behang standaard",
        defaultWastePercent: 10,
        description: "Indicatief snijverlies voor behang; patroonrapport apart controleren."
      },
      {
        productGroup: "wall_panels",
        name: "Wandpanelen standaard",
        defaultWastePercent: 8,
        description: "Indicatief snijverlies voor wandpanelen."
      },
      {
        productGroup: "plinths",
        name: "Plinten standaard",
        defaultWastePercent: 5,
        description: "Indicatief snijverlies voor plinten."
      },
      {
        productGroup: "other",
        name: "Handmatig",
        defaultWastePercent: 0,
        description: "Handmatig snijverlies door gebruiker invullen."
      }
    ] as const;
    const now = Date.now();
    const results = {
      inserted: 0,
      updated: 0,
      unchanged: 0
    };

    for (const profile of defaults) {
      const existing = await ctx.db
        .query("wasteProfiles")
        .withIndex("by_product_group", (q) =>
          q.eq("tenantId", args.tenantId).eq("productGroep", profile.productGroup)
        )
        .filter((q) => q.eq(q.field("naam"), profile.name))
        .first();

      if (!existing) {
        await ctx.db.insert("wasteProfiles", {
          tenantId: args.tenantId,
          productGroep: profile.productGroup,
          naam: profile.name,
          standaardSnijverliesPct: profile.defaultWastePercent,
          omschrijving: profile.description,
          status: "active",
          aangemaaktOp: now,
          gewijzigdOp: now
        });
        results.inserted += 1;
        continue;
      }

      const needsUpdate =
        existing.standaardSnijverliesPct !== profile.defaultWastePercent ||
        existing.omschrijving !== profile.description ||
        existing.status !== "active";

      if (needsUpdate) {
        await ctx.db.patch(existing._id, {
          standaardSnijverliesPct: profile.defaultWastePercent,
          omschrijving: profile.description,
          status: "active",
          gewijzigdOp: now
        });
        results.updated += 1;
      } else {
        results.unchanged += 1;
      }
    }

    return results;
  }
});
