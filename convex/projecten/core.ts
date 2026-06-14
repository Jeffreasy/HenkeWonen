import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRole,
  requireMutationRoleForTenantId,
  requireQueryRole,
  requireQueryRoleForTenantId
} from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import {
  toProject,
  toCustomer,
  toWorkflowEvent,
  toProjectTask,
  toQuoteSummary,
  projectStatus,
  workflowEventType,
  projectTaskStatus,
  addCalendarDays,
  hasArg,
  normalizeProjectId,
  invoicePaymentTermDays,
  latestMeasurementForProject,
  latestQuoteForProject,
  latestAcceptedQuoteForProject,
  existingInvoiceForQuote,
  hasProjectEvent,
  nextInvoiceNumber,
  completeInvoiceWorkflow,
  addProjectEvent,
  upsertProjectTask,
  closeOpenProjectTasks,
  getRooms,
  sortProjectTasks
} from "../portalUtils";

export const list = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator,
    status: v.optional(projectStatus)
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

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
    klantId: v.id("customers"),
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { externalUserId } = await requireMutationRoleForTenantId(
      ctx,
      args.tenantId,
      args.actor,
      ["user", "editor", "admin"]
    );
    const customer = await ctx.db.get(args.klantId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new ConvexError("Customer not found");
    }

    const now = Date.now();

    return await ctx.db.insert("projects", {
      tenantId: args.tenantId,
      klantId: args.klantId,
      titel: args.titel,
      omschrijving: args.omschrijving,
      status: "lead",
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const addRoom = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    projectId: v.id("projects"),
    naam: v.string(),
    verdieping: v.optional(v.string()),
    breedteCm: v.optional(v.number()),
    lengteCm: v.optional(v.number()),
    hoogteCm: v.optional(v.number()),
    oppervlakteM2: v.optional(v.number()),
    omtrekMeter: v.optional(v.number()),
    notities: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new ConvexError("Project not found");
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
      naam: args.naam,
      verdieping: args.verdieping,
      breedteCm: args.breedteCm,
      lengteCm: args.lengteCm,
      hoogteCm: args.hoogteCm,
      oppervlakteM2: args.oppervlakteM2,
      omtrekMeter: args.omtrekMeter,
      notities: args.notities,
      sortOrder: rooms.length + 1,
      aangemaaktOp: now,
      gewijzigdOp: now
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
      throw new ConvexError("Project not found");
    }

    await ctx.db.patch(args.projectId, {
      status: args.status,
      geaccepteerdOp: args.status === "quote_accepted" ? Date.now() : project.geaccepteerdOp,
      inmeetGeplandOp:
        args.status === "measurement_planned" ? Date.now() : project.inmeetGeplandOp,
      uitvoerGeplandOp:
        args.status === "execution_planned" ? Date.now() : project.uitvoerGeplandOp,
      besteldOp: args.status === "ordering" ? Date.now() : project.besteldOp,
      gefactureerdOp: args.status === "invoiced" ? Date.now() : project.gefactureerdOp,
      betaaldOp: args.status === "paid" ? Date.now() : project.betaaldOp,
      afgeslotenOp: args.status === "closed" ? Date.now() : project.afgeslotenOp,
      gewijzigdOp: Date.now()
    });

    return args.projectId;
  }
});

export const listProjects = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
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
      customers.map((customer: Doc<"customers">) => [String(customer._id), customer.weergaveNaam])
    );

    return await Promise.all(
      projects.map(async (project: Doc<"projects">) => ({
        ...(await toProject(ctx, tenant.slug, project)),
        customerName: customerById.get(String(project.klantId)) ?? "-"
      }))
    );
  }
});

export const dossierWorkspace = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
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
    klantId: v.string(),
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const customer = await ctx.db.get(args.klantId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new ConvexError("Customer not found");
    }

    const now = Date.now();

    return await ctx.db.insert("projects", {
      tenantId: tenant._id,
      klantId: customer._id,
      titel: args.titel,
      omschrijving: args.omschrijving,
      status: "lead",
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const updateProject = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    titel: v.optional(v.string()),
    omschrijving: v.optional(v.string()),
    gewensteUitvoerdatum: v.optional(v.number()),
    inmeetdatum: v.optional(v.number()),
    uitvoerdatum: v.optional(v.number()),
    interneNotities: v.optional(v.string()),
    klantNotities: v.optional(v.string()),
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
      throw new ConvexError("Project not found");
    }

    const patch: Partial<Doc<"projects">> = { gewijzigdOp: Date.now() };

    if (args.titel !== undefined) patch.titel = args.titel;
    if (hasArg(args, "omschrijving")) patch.omschrijving = args.omschrijving;
    if (hasArg(args, "gewensteUitvoerdatum")) {
      patch.gewensteUitvoerdatum = args.gewensteUitvoerdatum;
    }
    if (hasArg(args, "inmeetdatum")) patch.inmeetdatum = args.inmeetdatum;
    if (hasArg(args, "uitvoerdatum")) patch.uitvoerdatum = args.uitvoerdatum;
    if (hasArg(args, "interneNotities")) patch.interneNotities = args.interneNotities;
    if (hasArg(args, "klantNotities")) patch.klantNotities = args.klantNotities;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(project._id, patch);

    return project._id;
  }
});

export const projectDetail = query({
  args: {
    tenantSlug: v.string(),
    projectId: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    const projectId = normalizeProjectId(ctx, args.projectId);

    if (!projectId) {
      return null;
    }

    const project = await ctx.db.get(projectId);

    if (!project || project.tenantId !== tenant._id) {
      return null;
    }

    const [customer, workflowEvents, projectTasks, projectInvoices, latestQuote] = await Promise.all([
      ctx.db.get(project.klantId),
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
        .collect(),
      ctx.db
        .query("invoices")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect(),
      latestQuoteForProject(ctx, tenant._id, project._id)
    ]);

    // Meest recente factuur (doorgaans is er maar één per project)
    const latestInvoice = projectInvoices
      .sort((left: Doc<"invoices">, right: Doc<"invoices">) => right.aangemaaktOp - left.aangemaaktOp)
      .at(0);

    return {
      project: await toProject(ctx, tenant.slug, project),
      customer: customer ? toCustomer(tenant.slug, customer) : null,
      latestQuote: latestQuote ? toQuoteSummary(tenant.slug, latestQuote) : null,
      workflowEvents: workflowEvents
        .sort(
          (left: Doc<"projectWorkflowEvents">, right: Doc<"projectWorkflowEvents">) =>
            right.aangemaaktOp - left.aangemaaktOp
        )
        .map((event: Doc<"projectWorkflowEvents">) => toWorkflowEvent(tenant.slug, event)),
      projectTasks: sortProjectTasks(projectTasks).map((task: Doc<"projectTasks">) =>
        toProjectTask(tenant.slug, task)
      ),
      invoice: latestInvoice
        ? {
            id: String(latestInvoice._id),
            invoiceNumber: latestInvoice.factuurnummer,
            status: latestInvoice.status,
            totalIncVat: latestInvoice.totaalInclBtw,
            dueDate: latestInvoice.vervaldatum,
            paidAmount: latestInvoice.betaaldBedrag
          }
        : null
    };
  }
});

export const addProjectRoom = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    naam: v.string(),
    oppervlakteM2: v.optional(v.number()),
    omtrekMeter: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project not found");
    }

    const rooms = await getRooms(ctx, tenant._id, project._id);
    const now = Date.now();
    const roomId = await ctx.db.insert("projectRooms", {
      tenantId: tenant._id,
      projectId: project._id,
      naam: args.naam,
      oppervlakteM2: args.oppervlakteM2,
      omtrekMeter: args.omtrekMeter,
      sortOrder: rooms.length + 1,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    await ctx.db.patch(project._id, { gewijzigdOp: now });

    return roomId;
  }
});

export const updateProjectRoom = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    ruimteId: v.string(),
    naam: v.string(),
    verdieping: v.optional(v.string()),
    oppervlakteM2: v.optional(v.number()),
    omtrekMeter: v.optional(v.number()),
    notities: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const room = await ctx.db.get(args.ruimteId as Id<"projectRooms">);

    if (!room || room.tenantId !== tenant._id) {
      throw new ConvexError("Project room not found");
    }

    const now = Date.now();
    await ctx.db.patch(room._id, {
      naam: args.naam,
      verdieping: args.verdieping,
      oppervlakteM2: args.oppervlakteM2,
      omtrekMeter: args.omtrekMeter,
      notities: args.notities,
      gewijzigdOp: now
    });
    await ctx.db.patch(room.projectId, { gewijzigdOp: now });

    return room._id;
  }
});

export const deleteProjectRoom = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    ruimteId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const room = await ctx.db.get(args.ruimteId as Id<"projectRooms">);

    if (!room || room.tenantId !== tenant._id) {
      throw new ConvexError("Project room not found");
    }

    const [measurementRoom, quoteLine] = await Promise.all([
      ctx.db
        .query("measurementRooms")
        .withIndex("by_project_room", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectRuimteId", room._id)
        )
        .first(),
      ctx.db
        .query("quoteLines")
        .withIndex("by_room", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectRuimteId", room._id)
        )
        .first()
    ]);

    if (measurementRoom || quoteLine) {
      throw new ConvexError("Ruimte is al gebruikt in een inmeting of offerte en kan niet veilig worden verwijderd.");
    }

    await ctx.db.delete(room._id);
    await ctx.db.patch(room.projectId, { gewijzigdOp: Date.now() });

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
      throw new ConvexError("Project not found");
    }

    const now = Date.now();

    await ctx.db.patch(project._id, {
      status: args.status,
      geaccepteerdOp: args.status === "quote_accepted" ? now : project.geaccepteerdOp,
      inmeetGeplandOp:
        args.status === "measurement_planned" ? now : project.inmeetGeplandOp,
      uitvoerGeplandOp:
        args.status === "execution_planned" ? now : project.uitvoerGeplandOp,
      besteldOp: args.status === "ordering" ? now : project.besteldOp,
      gefactureerdOp: args.status === "invoiced" ? now : project.gefactureerdOp,
      betaaldOp: args.status === "paid" ? now : project.betaaldOp,
      afgeslotenOp: args.status === "closed" ? now : project.afgeslotenOp,
      gewijzigdOp: now
    });

    if (args.workflowType && args.workflowTitle) {
      await ctx.db.insert("projectWorkflowEvents", {
        tenantId: tenant._id,
        projectId: project._id,
        type: args.workflowType,
        titel: args.workflowTitle,
        zichtbaarVoorKlant: false,
        createdByExternalUserId: externalUserId,
        aangemaaktOp: now
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
    inmeetdatum: v.optional(v.number()),
    gemetenDoor: v.optional(v.string())
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
      throw new ConvexError("Project not found");
    }

    if (["closed", "cancelled", "paid"].includes(project.status)) {
      throw new ConvexError("Afgesloten dossiers kunnen niet opnieuw worden ingemeten.");
    }

    const customer = await ctx.db.get(project.klantId);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new ConvexError("Customer not found");
    }

    const now = Date.now();
    const existingMeasurement = await latestMeasurementForProject(ctx, tenant._id, project._id);
    const measurementDate = hasArg(args, "inmeetdatum")
      ? args.inmeetdatum
      : project.inmeetdatum ?? existingMeasurement?.inmeetdatum;
    let measurementId = existingMeasurement?._id;
    let measurementCreated = false;

    if (existingMeasurement) {
      const measurementPatch: Partial<Doc<"measurements">> = {};

      if (hasArg(args, "inmeetdatum") && existingMeasurement.inmeetdatum !== measurementDate) {
        measurementPatch.inmeetdatum = measurementDate;
      }

      if (args.gemetenDoor && !existingMeasurement.gemetenDoor) {
        measurementPatch.gemetenDoor = args.gemetenDoor;
      }

      if (Object.keys(measurementPatch).length > 0) {
        await ctx.db.patch(existingMeasurement._id, {
          ...measurementPatch,
          gewijzigdOp: now
        });
      }
    } else {
      measurementCreated = true;
      measurementId = await ctx.db.insert("measurements", {
        tenantId: tenant._id,
        projectId: project._id,
        klantId: project.klantId,
        status: "draft",
        inmeetdatum: measurementDate,
        gemetenDoor: args.gemetenDoor,
        createdByExternalUserId: externalUserId,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    const projectPatch: Partial<Doc<"projects">> = {
      status: "measurement_planned",
      gewijzigdOp: now
    };

    if (hasArg(args, "inmeetdatum")) {
      projectPatch.inmeetdatum = measurementDate;
    } else if (!project.inmeetdatum) {
      projectPatch.inmeetGeplandOp = undefined;
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
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    zichtbaarVoorKlant: v.boolean(),
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
      throw new ConvexError("Project not found");
    }

    return await ctx.db.insert("projectWorkflowEvents", {
      tenantId: tenant._id,
      projectId: project._id,
      type: args.type,
      titel: args.titel,
      omschrijving: args.omschrijving,
      zichtbaarVoorKlant: args.zichtbaarVoorKlant,
      createdByExternalUserId: externalUserId,
      aangemaaktOp: Date.now()
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
      throw new ConvexError("Project not found");
    }

    const now = Date.now();
    const customer =
      args.action === "invoice_created" ? await ctx.db.get(project.klantId) : null;
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

    const latestQuote =
      args.action === "quote_accepted"
        ? await latestQuoteForProject(ctx, tenant._id, project._id)
        : undefined;
    const latestAcceptedQuote =
      args.action === "invoice_created"
        ? await latestAcceptedQuoteForProject(ctx, tenant._id, project._id)
        : undefined;
    const existingInvoice =
      args.action === "invoice_created" && latestAcceptedQuote
        ? await existingInvoiceForQuote(ctx, tenant._id, latestAcceptedQuote._id)
        : undefined;

    if (args.action === "quote_accepted") {
      if (!latestQuote) {
        throw new ConvexError("Maak eerst een offerte aan voordat je akkoord verwerkt.");
      }

      if (["cancelled", "rejected", "expired"].includes(latestQuote.status)) {
        throw new ConvexError("Er is geen actieve offerte om akkoord te verwerken.");
      }
    }

    if (args.action === "invoice_created" && !latestAcceptedQuote) {
      throw new ConvexError("Maak of accepteer eerst een offerte voordat je een factuur aanmaakt.");
    }

    await ctx.db.patch(project._id, {
      status: actionConfig.projectStatus,
      geaccepteerdOp:
        actionConfig.projectStatus === "quote_accepted" ? now : project.geaccepteerdOp,
      besteldOp: actionConfig.projectStatus === "ordering" ? now : project.besteldOp,
      gefactureerdOp: actionConfig.projectStatus === "invoiced" ? now : project.gefactureerdOp,
      afgeslotenOp:
        actionConfig.projectStatus === "closed" ||
        actionConfig.projectStatus === "cancelled"
          ? now
          : project.afgeslotenOp,
      gewijzigdOp: now
    });

    if (args.action === "quote_accepted") {
      if (latestQuote && latestQuote.status !== "accepted") {
        await ctx.db.patch(latestQuote._id, {
          status: "accepted",
          geaccepteerdOp: now,
          gewijzigdOp: now
        });
      }

      await closeOpenProjectTasks(
        ctx,
        tenant._id,
        project._id,
        "quote_follow_up",
        "done",
        latestQuote?._id
      );
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "confirmation_payment",
        "Bevestigingsmail / betaling binnen 5 dagen",
        addCalendarDays(now, 5),
        externalUserId,
        latestQuote?._id
      );
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "execution_call",
        "Bellen / afspraak maken voor uitvoering",
        addCalendarDays(now, 5),
        externalUserId,
        latestQuote?._id
      );
    }

    if (args.action === "supplier_order_created") {
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "execution_call", "done");
    }

    if (args.action === "invoice_created") {
      const invoiceDueAt = existingInvoice?.vervaldatum ?? args.invoiceDueAt ?? addCalendarDays(now, invoiceTermDays);
      await completeInvoiceWorkflow(ctx, tenant._id, project, invoiceDueAt, externalUserId);

      if (!existingInvoice) {
        const invoiceNumber = await nextInvoiceNumber(ctx, tenant._id);
        await ctx.db.insert("invoices", {
          tenantId: tenant._id,
          projectId: project._id,
          klantId: project.klantId,
          quoteId: latestAcceptedQuote?._id,
          factuurnummer: invoiceNumber,
          status: "sent",
          factuurdatum: now,
          vervaldatum: invoiceDueAt,
          subtotaalExBtw: latestAcceptedQuote?.subtotaalExBtw ?? 0,
          btwTotaal: latestAcceptedQuote?.btwTotaal ?? 0,
          totaalInclBtw: latestAcceptedQuote?.totaalInclBtw ?? 0,
          betaaldBedrag: 0,
          aangemaaktOp: now,
          gewijzigdOp: now
        });
      }
    }

    if (args.action === "cancelled") {
      const quote = await latestQuoteForProject(ctx, tenant._id, project._id);
      if (quote && ["draft", "sent"].includes(quote.status)) {
        await ctx.db.patch(quote._id, {
          status: "cancelled",
          gewijzigdOp: now
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

    if (args.action !== "invoice_created") {
      await addProjectEvent(
        ctx,
        tenant._id,
        project._id,
        actionConfig.eventType,
        actionConfig.eventTitle,
        externalUserId
      );
    }

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
      throw new ConvexError("Project task not found");
    }

    const now = Date.now();

    await ctx.db.patch(task._id, {
      status: args.status,
      voltooidOp: args.status === "done" ? now : undefined,
      afgewezenOp: args.status === "dismissed" ? now : undefined,
      gewijzigdOp: now
    });

    return task._id;
  }
});
