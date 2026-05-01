import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

async function requireMeasurement(ctx: any, tenantId: any, measurementId: any) {
  const measurement = await ctx.db.get(measurementId);

  if (!measurement || measurement.tenantId !== tenantId) {
    throw new Error("Measurement not found");
  }

  return measurement;
}

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
    projectId: v.id("projects")
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
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
    projectId: v.id("projects")
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
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
    projectId: v.id("projects"),
    customerId: v.id("customers"),
    measurementDate: v.optional(v.number()),
    measuredBy: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
    }

    const customer = await ctx.db.get(args.customerId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new Error("Customer not found");
    }

    if (project.customerId !== args.customerId) {
      throw new Error("Customer does not belong to project");
    }

    const now = Date.now();

    return await ctx.db.insert("measurements", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      customerId: args.customerId,
      status: "draft",
      measurementDate: args.measurementDate,
      measuredBy: args.measuredBy,
      notes: args.notes,
      createdByExternalUserId: args.createdByExternalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateMeasurement = mutation({
  args: {
    tenantId: v.id("tenants"),
    measurementId: v.id("measurements"),
    status: v.optional(measurementStatus),
    measurementDate: v.optional(v.number()),
    measuredBy: v.optional(v.string()),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMeasurement(ctx, args.tenantId, args.measurementId);

    const patch: Record<string, unknown> = {
      updatedAt: Date.now()
    };

    if (args.status !== undefined) {
      patch.status = args.status;
    }

    if (args.measurementDate !== undefined) {
      patch.measurementDate = args.measurementDate;
    }

    if (args.measuredBy !== undefined) {
      patch.measuredBy = args.measuredBy;
    }

    if (args.notes !== undefined) {
      patch.notes = args.notes;
    }

    await ctx.db.patch(args.measurementId, patch);

    return args.measurementId;
  }
});

export const addMeasurementRoom = mutation({
  args: {
    tenantId: v.id("tenants"),
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
    const measurement = await requireMeasurement(ctx, args.tenantId, args.measurementId);

    if (args.projectRoomId) {
      const projectRoom = await ctx.db.get(args.projectRoomId);

      if (
        !projectRoom ||
        projectRoom.tenantId !== args.tenantId ||
        projectRoom.projectId !== measurement.projectId
      ) {
        throw new Error("Project room not found");
      }
    }

    const rooms = await ctx.db
      .query("measurementRooms")
      .withIndex("by_measurement", (q) =>
        q.eq("tenantId", args.tenantId).eq("measurementId", args.measurementId)
      )
      .collect();
    const now = Date.now();

    return await ctx.db.insert("measurementRooms", {
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
  }
});

export const addMeasurementLine = mutation({
  args: {
    tenantId: v.id("tenants"),
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
    quoteLineType
  },
  handler: async (ctx, args) => {
    await requireMeasurement(ctx, args.tenantId, args.measurementId);

    if (args.roomId) {
      const room = await ctx.db.get(args.roomId);

      if (
        !room ||
        room.tenantId !== args.tenantId ||
        room.measurementId !== args.measurementId
      ) {
        throw new Error("Measurement room not found");
      }
    }

    const now = Date.now();

    return await ctx.db.insert("measurementLines", {
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
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateMeasurementLineStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    lineId: v.id("measurementLines"),
    quotePreparationStatus
  },
  handler: async (ctx, args) => {
    const line = await ctx.db.get(args.lineId);

    if (!line || line.tenantId !== args.tenantId) {
      throw new Error("Measurement line not found");
    }

    await ctx.db.patch(args.lineId, {
      quotePreparationStatus: args.quotePreparationStatus,
      updatedAt: Date.now()
    });

    return args.lineId;
  }
});

export const markMeasurementLineConverted = mutation({
  args: {
    tenantId: v.id("tenants"),
    lineId: v.id("measurementLines"),
    quoteId: v.id("quotes"),
    quoteLineId: v.id("quoteLines")
  },
  handler: async (ctx, args) => {
    const line = await ctx.db.get(args.lineId);

    if (!line || line.tenantId !== args.tenantId) {
      throw new Error("Measurement line not found");
    }

    if (line.quotePreparationStatus !== "ready_for_quote") {
      throw new Error("Measurement line is not ready for quote");
    }

    const measurement = await ctx.db.get(line.measurementId);

    if (!measurement || measurement.tenantId !== args.tenantId) {
      throw new Error("Measurement not found");
    }

    const quote = await ctx.db.get(args.quoteId);

    if (!quote || quote.tenantId !== args.tenantId || quote.projectId !== measurement.projectId) {
      throw new Error("Quote not found for measurement project");
    }

    const quoteLine = await ctx.db.get(args.quoteLineId);

    if (
      !quoteLine ||
      quoteLine.tenantId !== args.tenantId ||
      quoteLine.quoteId !== args.quoteId
    ) {
      throw new Error("Quote line not found");
    }

    await ctx.db.patch(args.lineId, {
      quotePreparationStatus: "converted",
      convertedQuoteId: args.quoteId,
      convertedQuoteLineId: args.quoteLineId,
      updatedAt: Date.now()
    });

    return args.lineId;
  }
});

export const listWasteProfiles = query({
  args: {
    tenantId: v.id("tenants"),
    productGroup: v.optional(productGroup)
  },
  handler: async (ctx, args) => {
    return await getActiveWasteProfiles(ctx, args.tenantId, args.productGroup);
  }
});

export const seedDefaultWasteProfiles = mutation({
  args: {
    tenantId: v.id("tenants")
  },
  handler: async (ctx, args) => {
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
