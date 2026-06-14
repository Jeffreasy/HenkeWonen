import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRoleForTenantId,
  requireQueryRoleForTenantId
} from "../authz";
import { pilotHiddenReason } from "../catalog/pilot";
import { isUnitCompatible } from "../catalog/pricingRules";

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
    throw new ConvexError("Measurement not found");
  }

  return measurement;
}

async function touchMeasurement(ctx: any, measurementId: any, updatedAt = Date.now()) {
  await ctx.db.patch(measurementId, { gewijzigdOp: updatedAt });
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

  const category = product.categoryId ? await ctx.db.get(product.categoryId) : null;

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
      throw new ConvexError("Project not found");
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
      throw new ConvexError("Project not found");
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
      readyLines: readyLines.sort((left, right) => left.line.aangemaaktOp - right.line.aangemaaktOp)
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
      throw new ConvexError("Project not found");
    }

    const customer = await ctx.db.get(args.klantId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new ConvexError("Customer not found");
    }

    if (project.klantId !== args.klantId) {
      throw new ConvexError("Customer does not belong to project");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("measurements")
      .withIndex("by_project", (q) =>
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .order("desc")
      .first();

    if (existing) {
      const patch: Record<string, unknown> = {};

      if (hasArg(args, "inmeetdatum") && existing.inmeetdatum !== args.inmeetdatum) {
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

      return existing._id;
    }

    return await ctx.db.insert("measurements", {
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
});

export const updateMeasurement = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    inmetingId: v.id("measurements"),
    status: v.optional(measurementStatus),
    inmeetdatum: v.optional(v.number()),
    gemetenDoor: v.optional(v.string()),
    notities: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    await requireMeasurement(ctx, args.tenantId, args.inmetingId);

    const patch: Record<string, unknown> = {
      gewijzigdOp: Date.now()
    };

    if (args.status !== undefined) {
      patch.status = args.status;
    }

    if (hasArg(args, "inmeetdatum")) {
      patch.inmeetdatum = args.inmeetdatum;
    }

    if (hasArg(args, "gemetenDoor")) {
      patch.gemetenDoor = args.gemetenDoor;
    }

    if (hasArg(args, "notities")) {
      patch.notities = args.notities;
    }

    await ctx.db.patch(args.inmetingId, patch);

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
    const measurement = await requireMeasurement(ctx, args.tenantId, args.inmetingId);

    if (args.projectRuimteId) {
      const projectRoom = await ctx.db.get(args.projectRuimteId);

      if (
        !projectRoom ||
        projectRoom.tenantId !== args.tenantId ||
        projectRoom.projectId !== measurement.projectId
      ) {
        throw new ConvexError("Project room not found");
      }
    }

    const rooms = await ctx.db
      .query("measurementRooms")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", args.tenantId).eq("inmetingId", args.inmetingId)
      )
      .collect();
    const now = Date.now();

    const roomId = await ctx.db.insert("measurementRooms", {
      tenantId: args.tenantId,
      inmetingId: args.inmetingId,
      projectRuimteId: args.projectRuimteId,
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

    return roomId;
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
    const room = await ctx.db.get(args.ruimteId);

    if (!room || room.tenantId !== args.tenantId) {
      throw new ConvexError("Measurement room not found");
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

    return args.ruimteId;
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
      throw new ConvexError("Measurement room not found");
    }

    const line = await ctx.db
      .query("measurementLines")
      .withIndex("by_room", (q: any) => q.eq("tenantId", args.tenantId).eq("ruimteId", room._id))
      .first();

    if (line) {
      throw new ConvexError("Deze meetruimte bevat meetregels en kan niet veilig worden verwijderd.");
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

    if (args.ruimteId) {
      const room = await ctx.db.get(args.ruimteId);

      if (
        !room ||
        room.tenantId !== args.tenantId ||
        room.inmetingId !== args.inmetingId
      ) {
        throw new ConvexError("Measurement room not found");
      }
    }

    if (args.productId) {
      await requireSelectableProduct(ctx, args.tenantId, args.productId);
    }

    const now = Date.now();

    // Richtprijs-snapshot bewaren bij een gekozen product óf bij een productloze richtprijs
    // (raambekleding-matrix: geen catalogusproduct, maar wél een indicatieve prijs).
    const keepSnapshot = Boolean(args.productId) || args.indicatieveEenheidsprijsExBtw !== undefined;

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
      indicatiefVastgelegdOp: keepSnapshot ? args.indicatiefVastgelegdOp ?? now : undefined,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await touchMeasurement(ctx, args.inmetingId, now);

    return lineId;
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
      throw new ConvexError("Measurement line not found");
    }

    if (args.quotePreparationStatus === "converted") {
      throw new ConvexError("Gebruik de verwerkingsactie om een meetregel aan een offerte te koppelen.");
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
      throw new ConvexError("Measurement line not found");
    }

    if (line.quotePreparationStatus === "converted") {
      throw new ConvexError("Verwerkte meetregels kunnen niet direct worden aangepast.");
    }

    if (args.ruimteId) {
      const room = await ctx.db.get(args.ruimteId);

      if (!room || room.tenantId !== args.tenantId || room.inmetingId !== line.inmetingId) {
        throw new ConvexError("Measurement room not found");
      }
    }

    if (args.productId && args.productId !== line.productId) {
      await requireSelectableProduct(ctx, args.tenantId, args.productId);
    }

    // Productkeuze: alleen overschrijven als de aanroeper het veld meestuurt of
    // expliciet wist via clearProduct (undefined overleeft JSON-serialisatie niet).
    const touchesProduct = hasArg(args, "productId") || args.clearProduct === true;
    const nextProductId = args.clearProduct === true ? undefined : touchesProduct ? args.productId : line.productId;

    // Een productloze matrix-richtprijs (raambekleding) wordt herkend aan indicativePriceType "matrix".
    // De aanroeper mag zo'n snapshot opnieuw meesturen (her-prijzen bij gewijzigde maten) zónder product.
    const sendsMatrixSnapshot =
      args.indicatievePrijsSoort === "matrix" && args.indicatieveEenheidsprijsExBtw !== undefined;
    const usesArgsSnapshot = touchesProduct || sendsMatrixSnapshot;
    const snapshotSource = usesArgsSnapshot ? args : line;
    const isMatrixSnapshot =
      snapshotSource.indicatievePrijsSoort === "matrix" &&
      snapshotSource.indicatieveEenheidsprijsExBtw !== undefined;

    // Behoud een prijssnapshot wanneer er een product is én de prijseenheid bij de (mogelijk
    // gewijzigde) meeteenheid past, OF wanneer het een productloze matrix-richtprijs is. Anders
    // vervalt de prijs zodat geen m²-prijs × meters de offerte in stroomt. clearProduct wist altijd.
    const keepPriceSnapshot = Boolean(
      args.clearProduct !== true &&
        ((nextProductId &&
          snapshotSource.indicatieveEenheidsprijsExBtw !== undefined &&
          (touchesProduct || isUnitCompatible(args.eenheid, snapshotSource.indicatievePrijsEenheid))) ||
          (!nextProductId && isMatrixSnapshot))
    );
    const keepProductName = args.clearProduct !== true && (Boolean(nextProductId) || isMatrixSnapshot);

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
      productId: nextProductId,
      productNaam: keepProductName ? snapshotSource.productNaam : undefined,
      indicatieveEenheidsprijsExBtw: keepPriceSnapshot ? snapshotSource.indicatieveEenheidsprijsExBtw : undefined,
      indicatiefBtwTarief: keepPriceSnapshot ? snapshotSource.indicatiefBtwTarief : undefined,
      indicatievePrijsEenheid: keepPriceSnapshot ? snapshotSource.indicatievePrijsEenheid : undefined,
      indicatievePrijsSoort: keepPriceSnapshot ? snapshotSource.indicatievePrijsSoort : undefined,
      indicatiefVastgelegdOp: keepPriceSnapshot
        ? usesArgsSnapshot
          ? args.indicatiefVastgelegdOp ?? Date.now()
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
      throw new ConvexError("Measurement line not found");
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

export const markMeasurementLineConverted = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    lineId: v.id("measurementLines"),
    quoteId: v.id("quotes"),
    quoteLineId: v.id("quoteLines")
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const line = await ctx.db.get(args.lineId);

    if (!line || line.tenantId !== args.tenantId) {
      throw new ConvexError("Measurement line not found");
    }

    if (line.quotePreparationStatus !== "ready_for_quote") {
      throw new ConvexError("Measurement line is not ready for quote");
    }

    const measurement = await ctx.db.get(line.inmetingId);

    if (!measurement || measurement.tenantId !== args.tenantId) {
      throw new ConvexError("Measurement not found");
    }

    const quote = await ctx.db.get(args.quoteId);

    if (!quote || quote.tenantId !== args.tenantId || quote.projectId !== measurement.projectId) {
      throw new ConvexError("Quote not found for measurement project");
    }

    const quoteLine = await ctx.db.get(args.quoteLineId);

    if (
      !quoteLine ||
      quoteLine.tenantId !== args.tenantId ||
      quoteLine.quoteId !== args.quoteId
    ) {
      throw new ConvexError("Quote line not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.lineId, {
      quotePreparationStatus: "converted",
      geconverteerdeOfferteId: args.quoteId,
      geconverteerdeOfferteregelId: args.quoteLineId,
      gewijzigdOp: now
    });
    await touchMeasurement(ctx, line.inmetingId, now);

    return args.lineId;
  }
});

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
        defaultWastePercent: 7,
        description: "Indicatief snijverlies voor PVC in rechte plank."
      },
      {
        productGroup: "flooring",
        name: "PVC visgraat",
        defaultWastePercent: 12,
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
