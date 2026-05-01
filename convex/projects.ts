import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const projectStatus = v.union(
  v.literal("lead"),
  v.literal("quote_draft"),
  v.literal("quote_sent"),
  v.literal("quote_accepted"),
  v.literal("quote_rejected"),
  v.literal("measurement_planned"),
  v.literal("execution_planned"),
  v.literal("ordering"),
  v.literal("in_progress"),
  v.literal("invoiced"),
  v.literal("paid"),
  v.literal("closed"),
  v.literal("cancelled")
);

export const list = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(projectStatus)
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("projects")
        .withIndex("by_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("projects")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  }
});

export const get = query({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects")
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      return null;
    }

    const rooms = await ctx.db
      .query("projectRooms")
      .withIndex("by_project", (q) =>
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .collect();

    return {
      project,
      rooms: rooms.sort((a, b) => a.sortOrder - b.sortOrder)
    };
  }
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    customerId: v.id("customers"),
    title: v.string(),
    description: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new Error("Customer not found");
    }

    const now = Date.now();

    return await ctx.db.insert("projects", {
      tenantId: args.tenantId,
      customerId: args.customerId,
      title: args.title,
      description: args.description,
      status: "lead",
      createdByExternalUserId: args.createdByExternalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const addRoom = mutation({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    name: v.string(),
    floor: v.optional(v.string()),
    widthCm: v.optional(v.number()),
    lengthCm: v.optional(v.number()),
    heightCm: v.optional(v.number()),
    areaM2: v.optional(v.number()),
    perimeterMeter: v.optional(v.number()),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
    }

    const rooms = await ctx.db
      .query("projectRooms")
      .withIndex("by_project", (q) =>
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .collect();
    const now = Date.now();

    return await ctx.db.insert("projectRooms", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      name: args.name,
      floor: args.floor,
      widthCm: args.widthCm,
      lengthCm: args.lengthCm,
      heightCm: args.heightCm,
      areaM2: args.areaM2,
      perimeterMeter: args.perimeterMeter,
      notes: args.notes,
      sortOrder: rooms.length + 1,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    status: projectStatus
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
    }

    await ctx.db.patch(args.projectId, {
      status: args.status,
      acceptedAt: args.status === "quote_accepted" ? Date.now() : project.acceptedAt,
      measurementPlannedAt:
        args.status === "measurement_planned" ? Date.now() : project.measurementPlannedAt,
      executionPlannedAt:
        args.status === "execution_planned" ? Date.now() : project.executionPlannedAt,
      orderedAt: args.status === "ordering" ? Date.now() : project.orderedAt,
      invoicedAt: args.status === "invoiced" ? Date.now() : project.invoicedAt,
      paidAt: args.status === "paid" ? Date.now() : project.paidAt,
      closedAt: args.status === "closed" ? Date.now() : project.closedAt,
      updatedAt: Date.now()
    });

    return args.projectId;
  }
});
