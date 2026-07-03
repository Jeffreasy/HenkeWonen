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
import { computeProjectNextStep } from "./nextStep";
import {
  DAG_MS,
  assertInmeetBoeking,
  assertMonteurBoekbaar,
  resolveMonteurVoorMeting
} from "../beheer/agenda";
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
  restoreMeasurementLinesForQuote,
  assertQuoteAcceptable,
  cancelOtherOpenQuotesAndRestore,
  assertNoOtherAcceptedQuote,
  hasProjectEvent,
  nextInvoiceNumber,
  completeInvoiceWorkflow,
  addProjectEvent,
  upsertProjectTask,
  closeOpenProjectTasks,
  getRooms,
  sortProjectTasks,
  assertValidRoomDimensions,
  cancelOpenSupplierOrders
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
        .withIndex("by_status", (q) => q.eq("tenantId", args.tenantId).eq("status", args.status!))
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
      throw new ConvexError("Klant niet gevonden.");
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

export const updateStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    projectId: v.id("projects"),
    status: projectStatus
  },
  handler: async (ctx, args) => {
    // Vrije statuspatch zonder de invarianten van processProjectAction (offerte-/
    // factuur-gates, taken, events): uitsluitend een admin-vangnet voor datacorrecties.
    // Met rol 'user' kon elke medewerker een dossier zó op 'invoiced'/'paid' zetten
    // zonder offerte of factuur — het viel dan uit alle werklijsten zonder spoor.
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, ["admin"]);
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new ConvexError("Project niet gevonden.");
    }

    await ctx.db.patch(args.projectId, {
      status: args.status,
      geaccepteerdOp: args.status === "quote_accepted" ? Date.now() : project.geaccepteerdOp,
      inmeetGeplandOp: args.status === "measurement_planned" ? Date.now() : project.inmeetGeplandOp,
      uitvoerGeplandOp: args.status === "execution_planned" ? Date.now() : project.uitvoerGeplandOp,
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
    directeVerkoop: v.optional(v.boolean()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const customer = await ctx.db.get(args.klantId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new ConvexError("Klant niet gevonden.");
    }

    const now = Date.now();

    return await ctx.db.insert("projects", {
      tenantId: tenant._id,
      klantId: customer._id,
      titel: args.titel,
      omschrijving: args.omschrijving,
      directeVerkoop: args.directeVerkoop,
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
    // `null` = de afspraak expliciet afzeggen (datum wissen). `undefined` overleeft JSON
    // niet (de Convex-client laat het veld weg), dus zonder null-sentinel werd het
    // leegmaken van het datumveld in het dossier stil genegeerd en bestond er geen
    // enkel pad om alleen het inmeetbezoek af te zeggen.
    inmeetdatum: v.optional(v.union(v.number(), v.null())),
    uitvoerdatum: v.optional(v.union(v.number(), v.null())),
    interneNotities: v.optional(v.string()),
    klantNotities: v.optional(v.string()),
    // Bewust de inmeet-regels overrulen bij het zetten van de inmeetdatum vanuit het dossier.
    force: v.optional(v.boolean())
    // status staat hier BEWUST niet: statusovergangen lopen via processProjectAction
    // (met invarianten, timestamps en workflow-events); updateProjectStatus/updateStatus
    // zijn admin-vangnetten voor datacorrecties. Een vrije status-patch hier zou bv. een
    // sprong naar invoiced/paid/closed zonder factuur/offerte toestaan.
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
    }

    const nieuweInmeetdatum = args.inmeetdatum ?? undefined; // null → wissen
    const inmeetdatumGewijzigd =
      hasArg(args, "inmeetdatum") && project.inmeetdatum !== nieuweInmeetdatum;

    // De inmeetdatum vanuit het dossier synct naar de inmeting, dus dezelfde inmeet-regels gelden
    // (geen niet-inmeetdag / volle of afwezige toegewezen monteur). Alleen toetsen bij een echte
    // wijziging: een ongewijzigde (legacy) datum mag het opslaan van de overige velden niet
    // blokkeren. Resolve de monteur van de laatste inmeting (userId, anders éénduidige naam).
    if (inmeetdatumGewijzigd && nieuweInmeetdatum !== undefined) {
      const laatste = await latestMeasurementForProject(ctx, tenant._id, project._id);
      const monteur = laatste ? await resolveMonteurVoorMeting(ctx, tenant._id, laatste) : null;
      await assertInmeetBoeking(ctx, tenant._id, {
        datumMs: nieuweInmeetdatum,
        monteur,
        omvang: laatste?.omvang,
        excludeProjectId: project._id,
        force: args.force
      });
    }

    const patch: Partial<Doc<"projects">> = { gewijzigdOp: Date.now() };

    if (args.titel !== undefined) patch.titel = args.titel;
    if (hasArg(args, "omschrijving")) patch.omschrijving = args.omschrijving;
    if (hasArg(args, "gewensteUitvoerdatum")) {
      patch.gewensteUitvoerdatum = args.gewensteUitvoerdatum;
    }
    if (hasArg(args, "inmeetdatum")) patch.inmeetdatum = nieuweInmeetdatum;
    if (hasArg(args, "uitvoerdatum")) patch.uitvoerdatum = args.uitvoerdatum ?? undefined;
    if (hasArg(args, "interneNotities")) patch.interneNotities = args.interneNotities;
    if (hasArg(args, "klantNotities")) patch.klantNotities = args.klantNotities;

    await ctx.db.patch(project._id, patch);

    // Houd de inmeetdatum in sync met de laatste inmeting (zoals startOrPlanMeasurement),
    // zodat winkel en buitendienst dezelfde planningsdatum zien — ook bij afzeggen.
    if (hasArg(args, "inmeetdatum")) {
      const measurement = await latestMeasurementForProject(ctx, tenant._id, project._id);
      if (measurement && measurement.inmeetdatum !== nieuweInmeetdatum) {
        await ctx.db.patch(measurement._id, {
          inmeetdatum: nieuweInmeetdatum,
          gewijzigdOp: Date.now()
        });
      }
    }

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

    const [
      customer,
      workflowEvents,
      projectTasks,
      projectInvoices,
      latestQuote,
      latestMeasurement
    ] = await Promise.all([
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
      latestQuoteForProject(ctx, tenant._id, project._id),
      latestMeasurementForProject(ctx, tenant._id, project._id)
    ]);

    // Meest recente factuur (doorgaans is er maar één per project)
    const latestInvoice = projectInvoices
      .sort(
        (left: Doc<"invoices">, right: Doc<"invoices">) => right.aangemaaktOp - left.aangemaaktOp
      )
      .at(0);

    return {
      project: await toProject(ctx, tenant.slug, project),
      // Canonieke "volgende stap": server-side bepaald zodat dossier/dashboard/
      // buitendienst dezelfde vervolgactie tonen (één bron-van-waarheid).
      nextStep: computeProjectNextStep({
        status: project.status,
        projectId: String(project._id),
        latestQuoteId: latestQuote ? String(latestQuote._id) : null,
        invoiceId: latestInvoice ? String(latestInvoice._id) : null,
        directeVerkoop: project.directeVerkoop,
        measurementStatus: latestMeasurement?.status ?? null
      }),
      // Laatste inmeting: status + klusgrootte + toegewezen monteur — zodat de winkel
      // de overdracht (afgeronde inmeting) ziet en herplannen terugvalt op de
      // bestaande waarden i.p.v. stil te resetten.
      inmeetStatus: latestMeasurement?.status ?? null,
      inmeetOmvang: latestMeasurement?.omvang ?? null,
      inmeetMonteur: latestMeasurement?.gemetenDoor ?? null,
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
    assertValidRoomDimensions({
      oppervlakteM2: args.oppervlakteM2,
      omtrekMeter: args.omtrekMeter
    });
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
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
    assertValidRoomDimensions({
      oppervlakteM2: args.oppervlakteM2,
      omtrekMeter: args.omtrekMeter
    });
    const room = await ctx.db.get(args.ruimteId as Id<"projectRooms">);

    if (!room || room.tenantId !== tenant._id) {
      throw new ConvexError("Ruimte niet gevonden.");
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

    // Propageer de identiteit (naam/verdieping) naar gekoppelde inmeet-ruimtes — één ruimte-identiteit.
    // Maten propageren we bewust NIET: de gemeten maten op de inmeting zijn leidend.
    const linkedRooms = await ctx.db
      .query("measurementRooms")
      .withIndex("by_project_room", (q) =>
        q.eq("tenantId", tenant._id).eq("projectRuimteId", room._id)
      )
      .collect();
    for (const measurementRoom of linkedRooms) {
      await ctx.db.patch(measurementRoom._id, {
        naam: args.naam,
        verdieping: args.verdieping,
        gewijzigdOp: now
      });
    }

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
      throw new ConvexError("Ruimte niet gevonden.");
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
      throw new ConvexError(
        "Ruimte is al gebruikt in een inmeting of offerte en kan niet veilig worden verwijderd."
      );
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
    // Vrije statuspatch zonder invarianten: uitsluitend een admin-vangnet voor
    // datacorrecties. Reguliere statusovergangen lopen via processProjectAction
    // (offerte-/factuur-gates, taken sluiten, sibling-offertes, workflow-events).
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
    }

    const now = Date.now();

    await ctx.db.patch(project._id, {
      status: args.status,
      geaccepteerdOp: args.status === "quote_accepted" ? now : project.geaccepteerdOp,
      inmeetGeplandOp: args.status === "measurement_planned" ? now : project.inmeetGeplandOp,
      uitvoerGeplandOp: args.status === "execution_planned" ? now : project.uitvoerGeplandOp,
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
    gemetenDoor: v.optional(v.string()),
    gemetenDoorUserId: v.optional(v.id("users")),
    omvang: v.optional(v.union(v.literal("klein"), v.literal("volledig"))),
    // Bewust de inmeet-regels overrulen (niet-inmeetdag / afwezige monteur / volle dag).
    force: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    // Verifieer dat een meegegeven monteur tot deze tenant hoort (tenant-isolatie) én
    // boekbaar is (geen kijker; op de toonInAgenda-whitelist zodra die in gebruik is).
    // De whitelist-check zat alleen client-side in de plan-modal: een race met het
    // uitvinken van een monteur leverde anders een boeking op die in geen enkele
    // teamagenda zichtbaar is.
    let monteurDoc: Doc<"users"> | null = null;
    if (args.gemetenDoorUserId) {
      monteurDoc = await ctx.db.get(args.gemetenDoorUserId);
      if (!monteurDoc || monteurDoc.tenantId !== tenant._id) {
        throw new ConvexError("Monteur niet gevonden.");
      }
      await assertMonteurBoekbaar(ctx, tenant._id, monteurDoc);
    }
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
    }

    if (["closed", "cancelled", "paid"].includes(project.status)) {
      throw new ConvexError("Afgesloten dossiers kunnen niet opnieuw worden ingemeten.");
    }

    const customer = await ctx.db.get(project.klantId);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new ConvexError("Klant niet gevonden.");
    }

    const now = Date.now();
    const existingMeasurement = await latestMeasurementForProject(ctx, tenant._id, project._id);
    const measurementDate = hasArg(args, "inmeetdatum")
      ? args.inmeetdatum
      : (project.inmeetdatum ?? existingMeasurement?.inmeetdatum);

    // Plan-guard: dwing de inmeet-regels server-side af (tenzij bewust geforceerd), zodat de agenda
    // geen operationeel-onmogelijke staat krijgt. Alleen handhaven bij een DAADWERKELIJKE wijziging
    // van datum of monteur; een pure start-/statusactie of het ongewijzigd herbevestigen van een
    // (legacy) datum mag een bestaande boeking niet retroactief afkeuren. Dezelfde guard draait op
    // elk schrijfpad (zie assertInmeetBoeking).
    const datumGewijzigd =
      hasArg(args, "inmeetdatum") && existingMeasurement?.inmeetdatum !== measurementDate;
    const monteurGewijzigd =
      hasArg(args, "gemetenDoorUserId") &&
      existingMeasurement?.gemetenDoorUserId !== args.gemetenDoorUserId;
    await assertInmeetBoeking(ctx, tenant._id, {
      datumMs: datumGewijzigd || monteurGewijzigd ? measurementDate : null,
      monteur: monteurDoc,
      omvang: args.omvang ?? existingMeasurement?.omvang,
      excludeProjectId: project._id,
      force: args.force
    });

    let measurementId = existingMeasurement?._id;
    let measurementCreated = false;

    if (existingMeasurement) {
      const measurementPatch: Partial<Doc<"measurements">> = {};

      if (hasArg(args, "inmeetdatum") && existingMeasurement.inmeetdatum !== measurementDate) {
        measurementPatch.inmeetdatum = measurementDate;
      }

      // Monteur-toewijzing telt als "expliciet" zodra gemetenDoor wordt meegestuurd
      // (de plan-modal doet dat altijd, ook als lege string). Naam én userId blijven
      // dan synchroon: leeg = loskoppelen (beide wissen), teamlid = beide zetten,
      // vrije tekst = naam zetten + oude userId wissen. Zo blijft de capaciteit/agenda
      // (die userId-primair matcht) niet op een oude monteur hangen.
      if (hasArg(args, "gemetenDoor")) {
        const naam = args.gemetenDoor?.trim() ? args.gemetenDoor.trim() : undefined;
        if (naam !== existingMeasurement.gemetenDoor) {
          measurementPatch.gemetenDoor = naam;
        }
        if (args.gemetenDoorUserId !== existingMeasurement.gemetenDoorUserId) {
          measurementPatch.gemetenDoorUserId = args.gemetenDoorUserId;
        }
      }

      if (hasArg(args, "omvang") && args.omvang !== existingMeasurement.omvang) {
        measurementPatch.omvang = args.omvang;
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
        gemetenDoor: args.gemetenDoor?.trim() ? args.gemetenDoor.trim() : undefined,
        gemetenDoorUserId: args.gemetenDoorUserId,
        omvang: args.omvang,
        createdByExternalUserId: externalUserId,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    const projectPatch: Partial<Doc<"projects">> = {
      gewijzigdOp: now
    };

    // Statusovergang alleen vanuit de aanloopfase: een (na)meting plannen of een afspraak
    // verzetten op een dossier dat al in de offerte-/uitvoeringsfase zit, mag de workflow
    // niet stil terugzetten naar 'Inmeting gepland' (statusregressie zonder spoor).
    if (["lead", "measurement_planned"].includes(project.status)) {
      projectPatch.status = "measurement_planned";
    }

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
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
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
    invoiceDueAt: v.optional(v.number()),
    // Bij 'quote_accepted': de offerte die de gebruiker in de bevestigingsdialoog te
    // zien kreeg. Zonder expliciete id pakt de server "de nieuwste offerte" op het
    // mutatiemoment — een race met een collega (bv. buitendienst die intussen een
    // conceptofferte maakt) kon dan stil een ándere offerte op akkoord zetten.
    quoteId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
    }

    const now = Date.now();
    const customer = args.action === "invoice_created" ? await ctx.db.get(project.klantId) : null;
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

    let latestQuote: Doc<"quotes"> | null | undefined;
    if (args.action === "quote_accepted") {
      if (args.quoteId) {
        const expliciet = await ctx.db.get(args.quoteId as Id<"quotes">);
        if (!expliciet || expliciet.tenantId !== tenant._id || expliciet.projectId !== project._id) {
          throw new ConvexError("Offerte niet gevonden bij dit dossier.");
        }
        latestQuote = expliciet;
      } else {
        latestQuote = await latestQuoteForProject(ctx, tenant._id, project._id);
      }
    }
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

      // Dezelfde prijs-/richtprijs-/leeg-gate als updateQuoteStatus — zodat een offerte met
      // ongecontroleerde richtprijs of €0-regels ook via het winkel-dossierpad niet stil naar
      // akkoord (en daarmee factuur) kan glippen.
      await assertQuoteAcceptable(ctx, tenant._id, latestQuote._id);

      // Eén leidende geaccepteerde offerte per dossier (gedeeld met updateQuoteStatus).
      await assertNoOtherAcceptedQuote(ctx, tenant._id, project._id, latestQuote._id);
    }

    if (args.action === "invoice_created" && !latestAcceptedQuote) {
      throw new ConvexError("Maak of accepteer eerst een offerte voordat je een factuur aanmaakt.");
    }

    // "Export boekhouder" zet het dossier op 'invoiced'; dat mag alleen als er ook
    // echt een factuur bestaat — anders ontstaat een 'invoiced'-dossier zonder factuur
    // (en een dode "Betaling registreren"-banner zonder bestemming).
    if (args.action === "bookkeeper_export_sent") {
      const projectInvoices = await ctx.db
        .query("invoices")
        .withIndex("by_project", (q) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect();
      // Alleen een exporteerbare factuur telt: een 'draft' of 'cancelled' factuur mag
      // het dossier niet naar 'invoiced' tillen.
      const hasExportableInvoice = projectInvoices.some(
        (invoice) => invoice.status !== "draft" && invoice.status !== "cancelled"
      );
      if (!hasExportableInvoice) {
        throw new ConvexError(
          "Maak eerst een factuur aan voordat je het dossier naar de boekhouder exporteert."
        );
      }
    }

    await ctx.db.patch(project._id, {
      status: actionConfig.projectStatus,
      geaccepteerdOp:
        actionConfig.projectStatus === "quote_accepted" ? now : project.geaccepteerdOp,
      besteldOp: actionConfig.projectStatus === "ordering" ? now : project.besteldOp,
      gefactureerdOp: actionConfig.projectStatus === "invoiced" ? now : project.gefactureerdOp,
      afgeslotenOp:
        actionConfig.projectStatus === "closed" || actionConfig.projectStatus === "cancelled"
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

      // Annuleer de overige open offertes van dit dossier + bevrijd hun inmeetregels (gedeeld
      // met updateQuoteStatus) zodat er nooit twee 'levende' offertes blijven en geen siblings
      // permanent 'converted' staan.
      if (latestQuote) {
        await cancelOtherOpenQuotesAndRestore(ctx, tenant._id, project._id, latestQuote._id, now);
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
      const invoiceDueAt =
        existingInvoice?.vervaldatum ?? args.invoiceDueAt ?? addCalendarDays(now, invoiceTermDays);
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
        // Bevrijd de inmeetregels van de geannuleerde offerte (gedeeld met updateQuoteStatus)
        // zodat ze niet permanent 'converted' blijven en opnieuw geïmporteerd kunnen worden.
        await restoreMeasurementLinesForQuote(ctx, tenant._id, project._id, quote._id);
      }
      // Het hele dossier stopt: laat geen inkoop doorlopen en annuleer álle nog-open
      // leveranciersbestellingen van dit project. Ontvangen bestellingen blijven staan.
      await cancelOpenSupplierOrders(ctx, tenant._id, project._id, now);

      // Zeg ook het nog komende inmeetbezoek af: de agenda en de dagcapaciteit filteren
      // niet op projectstatus, dus zonder dit reed de monteur naar een geannuleerde klant
      // en bleef de plek bezet voor nieuwe boekingen. Een bezoek in het verleden blijft
      // staan (historie). De datum is rond het middaguur verankerd; > now - DAG_MS/2
      // dekt "vandaag of later".
      const measurement = await latestMeasurementForProject(ctx, tenant._id, project._id);
      if (measurement?.inmeetdatum && measurement.inmeetdatum > now - DAG_MS / 2) {
        await ctx.db.patch(measurement._id, { inmeetdatum: undefined, gewijzigdOp: now });
        if (project.inmeetdatum) {
          await ctx.db.patch(project._id, { inmeetdatum: undefined, gewijzigdOp: now });
        }
        await addProjectEvent(
          ctx,
          tenant._id,
          project._id,
          "measurement_planned",
          "Inmeetbezoek afgezegd",
          externalUserId,
          "Het geplande inmeetbezoek is afgezegd omdat het dossier is geannuleerd."
        );
      }
    }

    if (args.action === "closed" || args.action === "cancelled") {
      const finalTaskStatus = args.action === "closed" ? "done" : "dismissed";

      await Promise.all(
        (
          ["quote_follow_up", "confirmation_payment", "execution_call", "invoice_payment"] as const
        ).map((type) => closeOpenProjectTasks(ctx, tenant._id, project._id, type, finalTaskStatus))
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
      throw new ConvexError("Taak niet gevonden.");
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
