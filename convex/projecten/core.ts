import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRole, requireMutationRoleForTenantId } from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import {
  toProject,
  toCustomer,
  toWorkflowEvent,
  toProjectTask,
  toQuoteSummary,
  requireTenant,
  projectStatus,
  workflowEventType,
  projectTaskStatus,
  addCalendarDays,
  hasArg,
  normalizeProjectId,
  invoicePaymentTermDays,
  latestMeasurementForProject,
  latestQuoteForProject,
  hasProjectEvent,
  addProjectEvent,
  upsertProjectTask,
  closeOpenProjectTasks,
  getRooms,
  sortProjectTasks
} from "../portalUtils";


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
    actor: mutationActorValidator,
    customerId: v.id("customers"),
    title: v.string(),
    description: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { externalUserId } = await requireMutationRoleForTenantId(
      ctx,
      args.tenantId,
      args.actor,
      ["user", "editor", "admin"]
    );
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
      createdByExternalUserId: externalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const addRoom = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
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
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
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
    actor: mutationActorValidator,
    projectId: v.id("projects"),
    status: projectStatus
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
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

export const listProjects = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const [customers, projects] = await Promise.all([
      ctx.db
        .query("customers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect()
    ]);
    const customerById = new Map(
      customers.map((customer: Doc<"customers">) => [String(customer._id), customer.displayName])
    );

    return await Promise.all(
      projects.map(async (project: Doc<"projects">) => ({
        ...(await toProject(ctx, tenant.slug, project)),
        customerName: customerById.get(String(project.customerId)) ?? "-"
      }))
    );
  }
});

export const dossierWorkspace = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const [customers, projects, quotes] = await Promise.all([
      ctx.db
        .query("customers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect(),
      ctx.db
        .query("quotes")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect()
    ]);

    return {
      customers: customers.map((customer: Doc<"customers">) => toCustomer(tenant.slug, customer)),
      projects: await Promise.all(
        projects.map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
      ),
      quotes: quotes.map((quote: Doc<"quotes">) => toQuoteSummary(tenant.slug, quote))
    };
  }
});

export const createProject = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    customerId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const customer = await ctx.db.get(args.customerId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new Error("Customer not found");
    }

    const now = Date.now();

    return await ctx.db.insert("projects", {
      tenantId: tenant._id,
      customerId: customer._id,
      title: args.title,
      description: args.description,
      status: "lead",
      createdByExternalUserId: externalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateProject = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    preferredExecutionDate: v.optional(v.number()),
    measurementDate: v.optional(v.number()),
    executionDate: v.optional(v.number()),
    internalNotes: v.optional(v.string()),
    customerNotes: v.optional(v.string()),
    status: v.optional(projectStatus)
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    const patch: Partial<Doc<"projects">> = { updatedAt: Date.now() };

    if (args.title !== undefined) patch.title = args.title;
    if (hasArg(args, "description")) patch.description = args.description;
    if (hasArg(args, "preferredExecutionDate")) {
      patch.preferredExecutionDate = args.preferredExecutionDate;
    }
    if (hasArg(args, "measurementDate")) patch.measurementDate = args.measurementDate;
    if (hasArg(args, "executionDate")) patch.executionDate = args.executionDate;
    if (hasArg(args, "internalNotes")) patch.internalNotes = args.internalNotes;
    if (hasArg(args, "customerNotes")) patch.customerNotes = args.customerNotes;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(project._id, patch);

    return project._id;
  }
});

export const projectDetail = query({
  args: {
    tenantSlug: v.string(),
    projectId: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const projectId = normalizeProjectId(ctx, args.projectId);

    if (!projectId) {
      return null;
    }

    const project = await ctx.db.get(projectId);

    if (!project || project.tenantId !== tenant._id) {
      return null;
    }

    const [customer, workflowEvents, projectTasks] = await Promise.all([
      ctx.db.get(project.customerId),
      ctx.db
        .query("projectWorkflowEvents")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect(),
      ctx.db
        .query("projectTasks")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect()
    ]);

    return {
      project: await toProject(ctx, tenant.slug, project),
      customer: customer ? toCustomer(tenant.slug, customer) : null,
      workflowEvents: workflowEvents
        .sort(
          (left: Doc<"projectWorkflowEvents">, right: Doc<"projectWorkflowEvents">) =>
            right.createdAt - left.createdAt
        )
        .map((event: Doc<"projectWorkflowEvents">) => toWorkflowEvent(tenant.slug, event)),
      projectTasks: sortProjectTasks(projectTasks).map((task: Doc<"projectTasks">) =>
        toProjectTask(tenant.slug, task)
      )
    };
  }
});

export const addProjectRoom = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    name: v.string(),
    areaM2: v.optional(v.number()),
    perimeterMeter: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    const rooms = await getRooms(ctx, tenant._id, project._id);
    const now = Date.now();
    const roomId = await ctx.db.insert("projectRooms", {
      tenantId: tenant._id,
      projectId: project._id,
      name: args.name,
      areaM2: args.areaM2,
      perimeterMeter: args.perimeterMeter,
      sortOrder: rooms.length + 1,
      createdAt: now,
      updatedAt: now
    });

    await ctx.db.patch(project._id, { updatedAt: now });

    return roomId;
  }
});

export const updateProjectRoom = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    roomId: v.string(),
    name: v.string(),
    floor: v.optional(v.string()),
    areaM2: v.optional(v.number()),
    perimeterMeter: v.optional(v.number()),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const room = await ctx.db.get(args.roomId as Id<"projectRooms">);

    if (!room || room.tenantId !== tenant._id) {
      throw new Error("Project room not found");
    }

    const now = Date.now();
    await ctx.db.patch(room._id, {
      name: args.name,
      floor: args.floor,
      areaM2: args.areaM2,
      perimeterMeter: args.perimeterMeter,
      notes: args.notes,
      updatedAt: now
    });
    await ctx.db.patch(room.projectId, { updatedAt: now });

    return room._id;
  }
});

export const deleteProjectRoom = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    roomId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const room = await ctx.db.get(args.roomId as Id<"projectRooms">);

    if (!room || room.tenantId !== tenant._id) {
      throw new Error("Project room not found");
    }

    const [measurementRoom, quoteLine] = await Promise.all([
      ctx.db
        .query("measurementRooms")
        .withIndex("by_project_room", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectRoomId", room._id)
        )
        .first(),
      ctx.db
        .query("quoteLines")
        .withIndex("by_room", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectRoomId", room._id)
        )
        .first()
    ]);

    if (measurementRoom || quoteLine) {
      throw new Error("Ruimte is al gebruikt in een inmeting of offerte en kan niet veilig worden verwijderd.");
    }

    await ctx.db.delete(room._id);
    await ctx.db.patch(room.projectId, { updatedAt: Date.now() });

    return room._id;
  }
});

export const updateProjectStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    status: projectStatus,
    workflowType: v.optional(workflowEventType),
    workflowTitle: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    const now = Date.now();

    await ctx.db.patch(project._id, {
      status: args.status,
      acceptedAt: args.status === "quote_accepted" ? now : project.acceptedAt,
      measurementPlannedAt:
        args.status === "measurement_planned" ? now : project.measurementPlannedAt,
      executionPlannedAt:
        args.status === "execution_planned" ? now : project.executionPlannedAt,
      orderedAt: args.status === "ordering" ? now : project.orderedAt,
      invoicedAt: args.status === "invoiced" ? now : project.invoicedAt,
      paidAt: args.status === "paid" ? now : project.paidAt,
      closedAt: args.status === "closed" ? now : project.closedAt,
      updatedAt: now
    });

    if (args.workflowType && args.workflowTitle) {
      await ctx.db.insert("projectWorkflowEvents", {
        tenantId: tenant._id,
        projectId: project._id,
        type: args.workflowType,
        title: args.workflowTitle,
        visibleToCustomer: false,
        createdByExternalUserId: externalUserId,
        createdAt: now
      });
    }

    return project._id;
  }
});

export const startOrPlanMeasurement = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    measurementDate: v.optional(v.number()),
    measuredBy: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    if (["closed", "cancelled", "paid"].includes(project.status)) {
      throw new Error("Afgesloten dossiers kunnen niet opnieuw worden ingemeten.");
    }

    const customer = await ctx.db.get(project.customerId);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new Error("Customer not found");
    }

    const now = Date.now();
    const existingMeasurement = await latestMeasurementForProject(ctx, tenant._id, project._id);
    const measurementDate = hasArg(args, "measurementDate")
      ? args.measurementDate
      : project.measurementDate ?? existingMeasurement?.measurementDate;
    let measurementId = existingMeasurement?._id;
    let measurementCreated = false;

    if (existingMeasurement) {
      const measurementPatch: Partial<Doc<"measurements">> = {};

      if (hasArg(args, "measurementDate") && existingMeasurement.measurementDate !== measurementDate) {
        measurementPatch.measurementDate = measurementDate;
      }

      if (args.measuredBy && !existingMeasurement.measuredBy) {
        measurementPatch.measuredBy = args.measuredBy;
      }

      if (Object.keys(measurementPatch).length > 0) {
        await ctx.db.patch(existingMeasurement._id, {
          ...measurementPatch,
          updatedAt: now
        });
      }
    } else {
      measurementCreated = true;
      measurementId = await ctx.db.insert("measurements", {
        tenantId: tenant._id,
        projectId: project._id,
        customerId: project.customerId,
        status: "draft",
        measurementDate,
        measuredBy: args.measuredBy,
        createdByExternalUserId: externalUserId,
        createdAt: now,
        updatedAt: now
      });
    }

    const projectPatch: Partial<Doc<"projects">> = {
      status: "measurement_planned",
      updatedAt: now
    };

    if (hasArg(args, "measurementDate")) {
      projectPatch.measurementDate = measurementDate;
    } else if (!project.measurementDate) {
      projectPatch.measurementPlannedAt = undefined;
    }

    await ctx.db.patch(project._id, projectPatch);

    const alreadyHasMeasurementEvent = await hasProjectEvent(
      ctx,
      tenant._id,
      project._id,
      "measurement_planned"
    );

    if (!alreadyHasMeasurementEvent) {
      await addProjectEvent(
        ctx,
        tenant._id,
        project._id,
        "measurement_planned",
        measurementDate ? "Inmeting gepland" : "Inmeting gestart",
        externalUserId
      );
    }

    return {
      projectId: project._id,
      measurementId,
      measurementCreated
    };
  }
});

export const createWorkflowEvent = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    type: workflowEventType,
    title: v.string(),
    description: v.optional(v.string()),
    visibleToCustomer: v.boolean(),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    return await ctx.db.insert("projectWorkflowEvents", {
      tenantId: tenant._id,
      projectId: project._id,
      type: args.type,
      title: args.title,
      description: args.description,
      visibleToCustomer: args.visibleToCustomer,
      createdByExternalUserId: externalUserId,
      createdAt: Date.now()
    });
  }
});

export const processProjectAction = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    action: v.union(
      v.literal("quote_accepted"),
      v.literal("supplier_order_created"),
      v.literal("invoice_created"),
      v.literal("bookkeeper_export_sent"),
      v.literal("closed"),
      v.literal("cancelled")
    ),
    invoiceDueAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
    }

    const now = Date.now();
    const customer =
      args.action === "invoice_created" ? await ctx.db.get(project.customerId) : null;
    const invoiceTermDays = invoicePaymentTermDays(
      customer && customer.tenantId === tenant._id ? customer : null
    );
    const actionConfig = {
      quote_accepted: {
        projectStatus: "quote_accepted" as const,
        eventType: "quote_accepted" as const,
        eventTitle: "Offerte akkoord"
      },
      supplier_order_created: {
        projectStatus: "ordering" as const,
        eventType: "supplier_order_created" as const,
        eventTitle: "Bestelling aangemaakt"
      },
      invoice_created: {
        projectStatus: "invoiced" as const,
        eventType: "invoice_created" as const,
        eventTitle: "Factuur aangemaakt"
      },
      bookkeeper_export_sent: {
        projectStatus: "invoiced" as const,
        eventType: "bookkeeper_export_sent" as const,
        eventTitle: "Naar boekhouder verwerkt"
      },
      closed: {
        projectStatus: "closed" as const,
        eventType: "closed" as const,
        eventTitle: "Dossier gesloten"
      },
      cancelled: {
        projectStatus: "cancelled" as const,
        eventType: "closed" as const,
        eventTitle: "Dossier geannuleerd"
      }
    }[args.action];

    await ctx.db.patch(project._id, {
      status: actionConfig.projectStatus,
      acceptedAt:
        actionConfig.projectStatus === "quote_accepted" ? now : project.acceptedAt,
      orderedAt: actionConfig.projectStatus === "ordering" ? now : project.orderedAt,
      invoicedAt: actionConfig.projectStatus === "invoiced" ? now : project.invoicedAt,
      closedAt:
        actionConfig.projectStatus === "closed" ||
        actionConfig.projectStatus === "cancelled"
          ? now
          : project.closedAt,
      updatedAt: now
    });

    if (args.action === "quote_accepted") {
      const quote = await latestQuoteForProject(ctx, tenant._id, project._id);
      if (quote && quote.status !== "accepted") {
        await ctx.db.patch(quote._id, {
          status: "accepted",
          acceptedAt: now,
          updatedAt: now
        });
      }

      await closeOpenProjectTasks(
        ctx,
        tenant._id,
        project._id,
        "quote_follow_up",
        "done",
        quote?._id
      );
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "confirmation_payment",
        "Bevestigingsmail / betaling binnen 5 dagen",
        addCalendarDays(now, 5),
        externalUserId,
        quote?._id
      );
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "execution_call",
        "Bellen / afspraak maken voor uitvoering",
        addCalendarDays(now, 5),
        externalUserId,
        quote?._id
      );
    }

    if (args.action === "supplier_order_created") {
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "execution_call", "done");
    }

    if (args.action === "invoice_created") {
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "confirmation_payment", "done");
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "invoice_payment",
        "Factuurbetaling opvolgen",
        args.invoiceDueAt ?? addCalendarDays(now, invoiceTermDays),
        externalUserId
      );
    }

    if (args.action === "cancelled") {
      const quote = await latestQuoteForProject(ctx, tenant._id, project._id);
      if (quote && ["draft", "sent"].includes(quote.status)) {
        await ctx.db.patch(quote._id, {
          status: "cancelled",
          updatedAt: now
        });
      }
    }

    if (args.action === "closed" || args.action === "cancelled") {
      const finalTaskStatus = args.action === "closed" ? "done" : "dismissed";

      await Promise.all(
        (["quote_follow_up", "confirmation_payment", "execution_call", "invoice_payment"] as const)
          .map((type) =>
            closeOpenProjectTasks(ctx, tenant._id, project._id, type, finalTaskStatus)
          )
      );
    }

    await addProjectEvent(
      ctx,
      tenant._id,
      project._id,
      actionConfig.eventType,
      actionConfig.eventTitle,
      externalUserId
    );

    return project._id;
  }
});

export const updateProjectTaskStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    taskId: v.string(),
    status: projectTaskStatus
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const task = await ctx.db.get(args.taskId as Id<"projectTasks">);

    if (!task || task.tenantId !== tenant._id) {
      throw new Error("Project task not found");
    }

    const now = Date.now();

    await ctx.db.patch(task._id, {
      status: args.status,
      completedAt: args.status === "done" ? now : undefined,
      dismissedAt: args.status === "dismissed" ? now : undefined,
      updatedAt: now
    });

    return task._id;
  }
});
