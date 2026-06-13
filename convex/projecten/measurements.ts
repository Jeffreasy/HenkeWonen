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
  await ctx.db.patch(measurementId, { updatedAt });
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

  if (pilotHiddenReason(product, category?.name)) {
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
  productName: v.optional(v.string()),
  indicativeUnitPriceExVat: v.optional(v.number()),
  indicativeVatRate: v.optional(v.number()),
  indicativePriceUnit: v.optional(v.string()),
  indicativePriceType: v.optional(v.string()),
  indicativeCapturedAt: v.optional(v.number())
};

async function getActiveWasteProfiles(ctx: any, tenantId: any, productGroupArg?: string) {
  if (productGroupArg) {
    return await ctx.db
      .query("wasteProfiles")
      .withIndex("by_product_group", (q: any) =>
        q.eq("tenantId", tenantId).eq("productGroup", productGroupArg)
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
        q.eq("tenantId", args.tenantId).eq("measurementId", measurement._id)
      )
      .collect();
    const lines = await ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", args.tenantId).eq("measurementId", measurement._id)
      )
      .collect();

    return {
      measurement,
      rooms: rooms.sort((left, right) => left.sortOrder - right.sortOrder),
      lines: lines.sort((left, right) => left.createdAt - right.createdAt),
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
            q.eq("tenantId", args.tenantId).eq("measurementId", measurement._id)
          )
          .collect(),
        ctx.db
          .query("measurementLines")
          .withIndex("by_measurement", (q: any) =>
            q.eq("tenantId", args.tenantId).eq("measurementId", measurement._id)
          )
          .collect()
      ]);
      const roomsById = new Map(rooms.map((room: any) => [String(room._id), room]));

      for (const line of lines) {
        if (line.quotePreparationStatus !== "ready_for_quote") {
          continue;
        }

        const room = line.roomId ? roomsById.get(String(line.roomId)) : null;

        readyLines.push({
          line,
          measurement,
          room
        });
      }
    }

    return {
      measurement: latestMeasurement,
      readyLines: readyLines.sort((left, right) => left.line.createdAt - right.line.createdAt)
    };
  }
});

export const createForProject = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    projectId: v.id("projects"),
    customerId: v.id("customers"),
    measurementDate: v.optional(v.number()),
    measuredBy: v.optional(v.string()),
    notes: v.optional(v.string()),
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

    const customer = await ctx.db.get(args.customerId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new ConvexError("Customer not found");
    }

    if (project.customerId !== args.customerId) {
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

      if (hasArg(args, "measurementDate") && existing.measurementDate !== args.measurementDate) {
        patch.measurementDate = args.measurementDate;
      }

      if (args.measuredBy && !existing.measuredBy) {
        patch.measuredBy = args.measuredBy;
      }

      if (hasArg(args, "notes") && args.notes && !existing.notes) {
        patch.notes = args.notes;
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, {
          ...patch,
          updatedAt: now
        });
      }

      return existing._id;
    }

    return await ctx.db.insert("measurements", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      customerId: args.customerId,
      status: "draft",
      measurementDate: args.measurementDate,
      measuredBy: args.measuredBy,
      notes: args.notes,
      createdByExternalUserId: externalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateMeasurement = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    measurementId: v.id("measurements"),
    status: v.optional(measurementStatus),
    measurementDate: v.optional(v.number()),
    measuredBy: v.optional(v.string()),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    await requireMeasurement(ctx, args.tenantId, args.measurementId);

    const patch: Record<string, unknown> = {
      updatedAt: Date.now()
    };

    if (args.status !== undefined) {
      patch.status = args.status;
    }

    if (hasArg(args, "measurementDate")) {
      patch.measurementDate = args.measurementDate;
    }

    if (hasArg(args, "measuredBy")) {
      patch.measuredBy = args.measuredBy;
    }

    if (hasArg(args, "notes")) {
      patch.notes = args.notes;
    }

    await ctx.db.patch(args.measurementId, patch);

    return args.measurementId;
  }
});

export const addMeasurementRoom = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    measurementId: v.id("measurements"),
    projectRoomId: v.optional(v.id("projectRooms")),
    name: v.string(),
    floor: v.optional(v.string()),
    widthM: v.optional(v.number()),
    lengthM: v.optional(v.number()),
    heightM: v.optional(v.number()),
    areaM2: v.optional(v.number()),
    perimeterM: v.optional(v.number()),
    notes: v.optional(v.string()),
    sortOrder: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const measurement = await requireMeasurement(ctx, args.tenantId, args.measurementId);

    if (args.projectRoomId) {
      const projectRoom = await ctx.db.get(args.projectRoomId);

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
        q.eq("tenantId", args.tenantId).eq("measurementId", args.measurementId)
      )
      .collect();
    const now = Date.now();

    const roomId = await ctx.db.insert("measurementRooms", {
      tenantId: args.tenantId,
      measurementId: args.measurementId,
      projectRoomId: args.projectRoomId,
      name: args.name,
      floor: args.floor,
      widthM: args.widthM,
      lengthM: args.lengthM,
      heightM: args.heightM,
      areaM2: args.areaM2,
      perimeterM: args.perimeterM,
      notes: args.notes,
      sortOrder: args.sortOrder ?? rooms.length + 1,
      createdAt: now,
      updatedAt: now
    });
    await touchMeasurement(ctx, args.measurementId, now);

    return roomId;
  }
});

export const updateMeasurementRoom = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    roomId: v.id("measurementRooms"),
    name: v.string(),
    floor: v.optional(v.string()),
    widthM: v.optional(v.number()),
    lengthM: v.optional(v.number()),
    heightM: v.optional(v.number()),
    areaM2: v.optional(v.number()),
    perimeterM: v.optional(v.number()),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const room = await ctx.db.get(args.roomId);

    if (!room || room.tenantId !== args.tenantId) {
      throw new ConvexError("Measurement room not found");
    }

    const measurement = await requireMeasurement(ctx, args.tenantId, room.measurementId);

    const patch: Record<string, unknown> = {
      name: args.name,
      updatedAt: Date.now()
    };

    if (hasArg(args, "floor")) patch.floor = args.floor;
    if (hasArg(args, "widthM")) patch.widthM = args.widthM;
    if (hasArg(args, "lengthM")) patch.lengthM = args.lengthM;
    if (hasArg(args, "heightM")) patch.heightM = args.heightM;
    if (hasArg(args, "areaM2")) patch.areaM2 = args.areaM2;
    if (hasArg(args, "perimeterM")) patch.perimeterM = args.perimeterM;
    if (hasArg(args, "notes")) patch.notes = args.notes;

    await ctx.db.patch(args.roomId, patch);
    await touchMeasurement(ctx, measurement._id);

    return args.roomId;
  }
});

export const deleteMeasurementRoom = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    roomId: v.id("measurementRooms")
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const room = await ctx.db.get(args.roomId);

    if (!room || room.tenantId !== args.tenantId) {
      throw new ConvexError("Measurement room not found");
    }

    const line = await ctx.db
      .query("measurementLines")
      .withIndex("by_room", (q: any) => q.eq("tenantId", args.tenantId).eq("roomId", room._id))
      .first();

    if (line) {
      throw new ConvexError("Deze meetruimte bevat meetregels en kan niet veilig worden verwijderd.");
    }

    await ctx.db.delete(room._id);
    await touchMeasurement(ctx, room.measurementId);

    return room._id;
  }
});

export const addMeasurementLine = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    measurementId: v.id("measurements"),
    roomId: v.optional(v.id("measurementRooms")),
    productGroup,
    calculationType,
    input: v.any(),
    result: v.any(),
    wastePercent: v.optional(v.number()),
    quantity: v.number(),
    unit: v.string(),
    notes: v.optional(v.string()),
    quoteLineType,
    ...indicativeSnapshotArgs
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    await requireMeasurement(ctx, args.tenantId, args.measurementId);

    if (args.roomId) {
      const room = await ctx.db.get(args.roomId);

      if (
        !room ||
        room.tenantId !== args.tenantId ||
        room.measurementId !== args.measurementId
      ) {
        throw new ConvexError("Measurement room not found");
      }
    }

    if (args.productId) {
      await requireSelectableProduct(ctx, args.tenantId, args.productId);
    }

    const now = Date.now();

    const lineId = await ctx.db.insert("measurementLines", {
      tenantId: args.tenantId,
      measurementId: args.measurementId,
      roomId: args.roomId,
      productGroup: args.productGroup,
      calculationType: args.calculationType,
      input: args.input,
      result: args.result,
      wastePercent: args.wastePercent,
      quantity: args.quantity,
      unit: args.unit,
      notes: args.notes,
      quoteLineType: args.quoteLineType,
      quotePreparationStatus: "draft",
      productId: args.productId,
      productName: args.productId ? args.productName : undefined,
      indicativeUnitPriceExVat: args.productId ? args.indicativeUnitPriceExVat : undefined,
      indicativeVatRate: args.productId ? args.indicativeVatRate : undefined,
      indicativePriceUnit: args.productId ? args.indicativePriceUnit : undefined,
      indicativePriceType: args.productId ? args.indicativePriceType : undefined,
      indicativeCapturedAt: args.productId ? args.indicativeCapturedAt ?? now : undefined,
      createdAt: now,
      updatedAt: now
    });
    await touchMeasurement(ctx, args.measurementId, now);

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
      updatedAt: now
    });
    await touchMeasurement(ctx, line.measurementId, now);

    return args.lineId;
  }
});

export const updateMeasurementLine = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    lineId: v.id("measurementLines"),
    roomId: v.optional(v.id("measurementRooms")),
    productGroup,
    calculationType,
    input: v.any(),
    result: v.any(),
    wastePercent: v.optional(v.number()),
    quantity: v.number(),
    unit: v.string(),
    notes: v.optional(v.string()),
    quoteLineType,
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

    if (args.roomId) {
      const room = await ctx.db.get(args.roomId);

      if (!room || room.tenantId !== args.tenantId || room.measurementId !== line.measurementId) {
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
    const snapshotSource = touchesProduct ? args : line;

    // Een behouden prijssnapshot is alleen geldig zolang de prijseenheid bij de
    // (mogelijk gewijzigde) meeteenheid past; anders vervalt de prijs (het
    // product blijft gekozen) zodat geen m²-prijs × meters de offerte in stroomt.
    const keepPriceSnapshot = Boolean(
      nextProductId &&
        snapshotSource.indicativeUnitPriceExVat !== undefined &&
        (touchesProduct || isUnitCompatible(args.unit, snapshotSource.indicativePriceUnit))
    );

    await ctx.db.patch(line._id, {
      roomId: args.roomId,
      productGroup: args.productGroup,
      calculationType: args.calculationType,
      input: args.input,
      result: args.result,
      wastePercent: args.wastePercent,
      quantity: args.quantity,
      unit: args.unit,
      notes: args.notes,
      quoteLineType: args.quoteLineType,
      quotePreparationStatus: args.quotePreparationStatus ?? line.quotePreparationStatus,
      productId: nextProductId,
      productName: nextProductId ? snapshotSource.productName : undefined,
      indicativeUnitPriceExVat: keepPriceSnapshot ? snapshotSource.indicativeUnitPriceExVat : undefined,
      indicativeVatRate: keepPriceSnapshot ? snapshotSource.indicativeVatRate : undefined,
      indicativePriceUnit: keepPriceSnapshot ? snapshotSource.indicativePriceUnit : undefined,
      indicativePriceType: keepPriceSnapshot ? snapshotSource.indicativePriceType : undefined,
      indicativeCapturedAt: keepPriceSnapshot
        ? touchesProduct
          ? args.indicativeCapturedAt ?? Date.now()
          : line.indicativeCapturedAt
        : undefined,
      updatedAt: Date.now()
    });
    await touchMeasurement(ctx, line.measurementId);

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
      line.convertedQuoteId ||
      line.convertedQuoteLineId
    ) {
      throw new ConvexError("Verwerkte meetregels kunnen niet direct worden verwijderd.");
    }

    await ctx.db.delete(line._id);
    await touchMeasurement(ctx, line.measurementId);

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

    const measurement = await ctx.db.get(line.measurementId);

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
      convertedQuoteId: args.quoteId,
      convertedQuoteLineId: args.quoteLineId,
      updatedAt: now
    });
    await touchMeasurement(ctx, line.measurementId, now);

    return args.lineId;
  }
});

export const listWasteProfiles = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator,
    productGroup: v.optional(productGroup)
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    return await getActiveWasteProfiles(ctx, args.tenantId, args.productGroup);
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
          q.eq("tenantId", args.tenantId).eq("productGroup", profile.productGroup)
        )
        .filter((q) => q.eq(q.field("name"), profile.name))
        .first();

      if (!existing) {
        await ctx.db.insert("wasteProfiles", {
          tenantId: args.tenantId,
          productGroup: profile.productGroup,
          name: profile.name,
          defaultWastePercent: profile.defaultWastePercent,
          description: profile.description,
          status: "active",
          createdAt: now,
          updatedAt: now
        });
        results.inserted += 1;
        continue;
      }

      const needsUpdate =
        existing.defaultWastePercent !== profile.defaultWastePercent ||
        existing.description !== profile.description ||
        existing.status !== "active";

      if (needsUpdate) {
        await ctx.db.patch(existing._id, {
          defaultWastePercent: profile.defaultWastePercent,
          description: profile.description,
          status: "active",
          updatedAt: now
        });
        results.updated += 1;
      } else {
        results.unchanged += 1;
      }
    }

    return results;
  }
});
