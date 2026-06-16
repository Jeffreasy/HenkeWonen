import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRoleForTenantId,
  requireMutationRole,
  requireQueryRole,
  requireQueryRoleForTenantId
} from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import { pilotHiddenReason } from "../catalog/pilot";
import {
  toQuote,
  toCustomer,
  toQuoteTemplate,
  quoteLineType,
  toProject,
  importedMeasurementLineTitle,
  importedMeasurementLineDescription,
  calculateLineTotals
} from "../portalUtils";

const quoteStatus = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("expired"),
  v.literal("cancelled")
);

const lineType = v.union(
  v.literal("product"),
  v.literal("service"),
  v.literal("labor"),
  v.literal("material"),
  v.literal("discount"),
  v.literal("text"),
  v.literal("manual")
);

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}



export const list = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    return await ctx.db
      .query("quotes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  }
});

export const get = query({
  args: {
    tenantId: v.id("tenants"),
    quoteId: v.id("quotes"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId);

    if (!quote || quote.tenantId !== args.tenantId) {
      return null;
    }

    const lines = await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q) =>
        q.eq("tenantId", args.tenantId).eq("quoteId", args.quoteId)
      )
      .collect();

    return {
      quote,
      lines: lines.sort((a, b) => a.sortOrder - b.sortOrder)
    };
  }
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    projectId: v.id("projects"),
    klantId: v.id("customers"),
    titel: v.string(),
    inleidingTekst: v.optional(v.string()),
    afsluitTekst: v.optional(v.string()),
    voorwaarden: v.optional(v.array(v.string())),
    betalingsvoorwaarden: v.optional(v.array(v.string())),
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
    const customer = await ctx.db.get(args.klantId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new ConvexError("Project not found");
    }

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new ConvexError("Customer not found");
    }

    const now = Date.now();
    const quoteNumber = `OFF-${new Date(now).getFullYear()}-${now}`;

    const quoteId = await ctx.db.insert("quotes", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      klantId: args.klantId,
      offertenummer: quoteNumber,
      titel: args.titel,
      status: "draft",
      inleidingTekst: args.inleidingTekst,
      afsluitTekst: args.afsluitTekst,
      voorwaarden: args.voorwaarden,
      betalingsvoorwaarden: args.betalingsvoorwaarden,
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    await ctx.db.patch(args.projectId, {
      status: "quote_draft",
      gewijzigdOp: now
    });

    return quoteId;
  }
});

export const addLine = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    quoteId: v.id("quotes"),
    projectRuimteId: v.optional(v.id("projectRooms")),
    productId: v.optional(v.id("products")),
    werktariefRegelId: v.optional(v.id("serviceCostRules")),
    regelType: lineType,
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    aantal: v.number(),
    eenheid: v.string(),
    eenheidsprijsExBtw: v.number(),
    btwTarief: v.number(),
    kortingExBtw: v.optional(v.number()),
    sortOrder: v.number(),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId);

    if (!quote || quote.tenantId !== args.tenantId) {
      throw new ConvexError("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const totals = calculateLineTotals(
      args.regelType,
      args.aantal,
      args.eenheidsprijsExBtw,
      args.btwTarief,
      args.kortingExBtw
    );
    const now = Date.now();

    const lineId = await ctx.db.insert("quoteLines", {
      tenantId: args.tenantId,
      quoteId: args.quoteId,
      projectRuimteId: args.projectRuimteId,
      productId: args.productId,
      werktariefRegelId: args.werktariefRegelId,
      regelType: args.regelType,
      titel: args.titel,
      omschrijving: args.omschrijving,
      aantal: args.aantal,
      eenheid: args.eenheid,
      eenheidsprijsExBtw: args.eenheidsprijsExBtw,
      btwTarief: args.btwTarief,
      kortingExBtw: args.kortingExBtw,
      regelTotaalExBtw: totals.lineTotalExVat,
      regelBtwTotaal: totals.lineVatTotal,
      regelTotaalInclBtw: totals.lineTotalIncVat,
      sortOrder: args.sortOrder,
      metadata: args.metadata,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    await recalculateQuote(ctx, args.tenantId, args.quoteId);

    return lineId;
  }
});

export const recalculate = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    quoteId: v.id("quotes")
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    await recalculateQuote(ctx, args.tenantId, args.quoteId);
    return args.quoteId;
  }
});

async function recalculateQuote(ctx: any, tenantId: any, quoteId: any) {
  const quote = await ctx.db.get(quoteId);

  if (!quote || quote.tenantId !== tenantId) {
    throw new ConvexError("Quote not found");
  }

  const lines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", tenantId).eq("quoteId", quoteId))
    .collect();

  const subtotalExVat = roundMoney(
    lines.reduce((sum: number, line: any) => sum + line.lineTotalExVat, 0)
  );
  const vatTotal = roundMoney(
    lines.reduce((sum: number, line: any) => sum + line.lineVatTotal, 0)
  );
  const totalIncVat = roundMoney(subtotalExVat + vatTotal);

  await ctx.db.patch(quoteId, {
    subtotaalExBtw: subtotalExVat,
    btwTotaal: vatTotal,
    totaalInclBtw: totalIncVat,
    gewijzigdOp: Date.now()
  });
}


function addCalendarDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

async function validateQuoteLineProduct(
  ctx: any,
  tenantId: Id<"tenants">,
  productId?: string
) {
  if (!productId) {
    return undefined;
  }

  const product = await ctx.db.get(productId as Id<"products">);

  if (!product || product.tenantId !== tenantId) {
    throw new ConvexError("Product not found");
  }

  const category = product.categorieId ? await ctx.db.get(product.categorieId) : null;
  const hiddenReason = pilotHiddenReason(product, category?.naam);

  if (hiddenReason) {
    throw new ConvexError(hiddenReason);
  }

  if (product.status !== "active") {
    throw new ConvexError("Dit product is niet (meer) actief en kan niet worden gekozen.");
  }

  return product._id;
}

async function addProjectEvent(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  type: Doc<"projectWorkflowEvents">["type"],
  title: string,
  externalUserId?: string,
  description?: string
) {
  await ctx.db.insert("projectWorkflowEvents", {
    tenantId,
    projectId,
    type,
    titel: title,
    omschrijving: description,
    zichtbaarVoorKlant: false,
    createdByExternalUserId: externalUserId,
    aangemaaktOp: Date.now()
  });
}

async function upsertProjectTask(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  type: Doc<"projectTasks">["type"],
  title: string,
  dueAt: number,
  externalUserId?: string,
  quoteId?: Id<"quotes">
) {
  const existing = (
    await ctx.db
      .query("projectTasks")
      .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
      .collect()
  ).find(
    (task: Doc<"projectTasks">) =>
      task.status === "open" &&
      task.type === type &&
      String(task.quoteId ?? "") === String(quoteId ?? "")
  );
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      titel: title,
      vervaltOp: dueAt,
      gewijzigdOp: now
    });
    return existing._id;
  }

  return await ctx.db.insert("projectTasks", {
    tenantId,
    projectId,
    quoteId,
    type,
    titel: title,
    vervaltOp: dueAt,
    status: "open",
    createdByExternalUserId: externalUserId,
    aangemaaktOp: now,
    gewijzigdOp: now
  });
}

async function closeOpenProjectTasks(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  type: Doc<"projectTasks">["type"],
  status: "done" | "dismissed",
  quoteId?: Id<"quotes">
) {
  const tasks = await ctx.db
    .query("projectTasks")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();
  const now = Date.now();

  await Promise.all(
    tasks
      .filter(
        (task: Doc<"projectTasks">) =>
          task.status === "open" &&
          task.type === type &&
          (quoteId === undefined || String(task.quoteId ?? "") === String(quoteId))
      )
      .map((task: Doc<"projectTasks">) =>
        ctx.db.patch(task._id, {
          status,
          voltooidOp: status === "done" ? now : task.voltooidOp,
          afgewezenOp: status === "dismissed" ? now : task.afgewezenOp,
          gewijzigdOp: now
        })
      )
  );
}

export const deleteQuoteLine = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    lineId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const line = await ctx.db.get(args.lineId as Id<"quoteLines">);

    if (!line || line.tenantId !== tenant._id) {
      throw new ConvexError("Quote line not found");
    }

    const quote = await ctx.db.get(line.quoteId);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    // Herstel eventueel gekoppelde meetregel (measurementLine)
    const measurements = await ctx.db
      .query("measurements")
      .withIndex("by_project", (q: any) =>
        q.eq("tenantId", tenant._id).eq("projectId", quote.projectId)
      )
      .collect();

    for (const measurement of measurements) {
      const mLines = await ctx.db
        .query("measurementLines")
        .withIndex("by_measurement", (q: any) =>
          q.eq("tenantId", tenant._id).eq("inmetingId", measurement._id)
        )
        .collect();

      const linkedLine = mLines.find(
        (ml: any) => ml.convertedQuoteLineId === line._id
      );

      if (linkedLine) {
        await ctx.db.patch(linkedLine._id, {
          quotePreparationStatus: "ready_for_quote",
          geconverteerdeOfferteId: undefined,
          geconverteerdeOfferteregelId: undefined,
          gewijzigdOp: Date.now()
        });
        await ctx.db.patch(measurement._id, {
          gewijzigdOp: Date.now()
        });
      }
    }

    await ctx.db.delete(line._id);
    await recalculateQuote(ctx, tenant._id, line.quoteId);

    return line._id;
  }
});

export const updateQuoteLine = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    lineId: v.string(),
    projectRuimteId: v.optional(v.string()),
    productId: v.optional(v.string()),
    regelType: lineType,
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    aantal: v.number(),
    eenheid: v.string(),
    eenheidsprijsExBtw: v.number(),
    btwTarief: v.number(),
    kortingExBtw: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const line = await ctx.db.get(args.lineId as Id<"quoteLines">);

    if (!line || line.tenantId !== tenant._id) {
      throw new ConvexError("Quote line not found");
    }

    const quote = await ctx.db.get(line.quoteId);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const projectRoomId = args.projectRuimteId
      ? (args.projectRuimteId as Id<"projectRooms">)
      : undefined;

    if (projectRoomId) {
      const projectRoom = await ctx.db.get(projectRoomId);

      if (
        !projectRoom ||
        projectRoom.tenantId !== tenant._id ||
        projectRoom.projectId !== quote.projectId
      ) {
        throw new ConvexError("Project room not found");
      }
    }

    const productId = args.regelType === "product"
      ? await validateQuoteLineProduct(ctx, tenant._id, args.productId)
      : undefined;

    const totals = calculateLineTotals(
      args.regelType,
      args.aantal,
      args.eenheidsprijsExBtw,
      args.btwTarief,
      args.kortingExBtw
    );

    await ctx.db.patch(line._id, {
      projectRuimteId: projectRoomId,
      productId,
      regelType: args.regelType,
      titel: args.titel,
      omschrijving: args.omschrijving,
      aantal: args.aantal,
      eenheid: args.eenheid,
      eenheidsprijsExBtw: args.eenheidsprijsExBtw,
      btwTarief: args.btwTarief,
      kortingExBtw: args.kortingExBtw,
      regelTotaalExBtw: totals.lineTotalExVat,
      regelBtwTotaal: totals.lineVatTotal,
      regelTotaalInclBtw: totals.lineTotalIncVat,
      sortOrder: args.sortOrder ?? line.sortOrder,
      metadata: args.metadata,
      gewijzigdOp: Date.now()
    });
    await recalculateQuote(ctx, tenant._id, line.quoteId);

    return line._id;
  }
});

export const updateQuoteTerms = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    voorwaarden: v.array(v.string()),
    betalingsvoorwaarden: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    await ctx.db.patch(quote._id, {
      voorwaarden: args.voorwaarden,
      betalingsvoorwaarden: args.betalingsvoorwaarden ?? [],
      gewijzigdOp: Date.now()
    });

    return quote._id;
  }
});

export const updateQuoteStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    status: quoteStatus
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Quote not found");
    }

    const project = await ctx.db.get(quote.projectId);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project not found");
    }

    const now = Date.now();
    const quotePatch: Partial<Doc<"quotes">> = {
      status: args.status,
      verzondenOp: args.status === "sent" ? quote.verzondenOp ?? now : quote.verzondenOp,
      geldigTot:
        args.status === "sent" ? quote.geldigTot ?? addCalendarDays(now, 30) : quote.geldigTot,
      geaccepteerdOp: args.status === "accepted" ? now : quote.geaccepteerdOp,
      afgewezenOp: args.status === "rejected" ? now : quote.afgewezenOp,
      gewijzigdOp: now
    };

    await ctx.db.patch(quote._id, quotePatch);

    // Cancel other open quotes for the same project if this one is accepted
    if (args.status === "accepted") {
      const otherQuotes = await ctx.db
        .query("quotes")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect();

      for (const other of otherQuotes) {
        if (
          other._id !== quote._id &&
          (other.status === "draft" || other.status === "sent")
        ) {
          await ctx.db.patch(other._id, {
            status: "cancelled",
            gewijzigdOp: now
          });
        }
      }
    }

    const statusMap: Partial<Record<Doc<"quotes">["status"], Doc<"projects">["status"]>> = {
      draft: "quote_draft",
      sent: "quote_sent",
      accepted: "quote_accepted",
      rejected: "quote_rejected",
      cancelled: "cancelled"
    };
    const nextProjectStatus = statusMap[args.status];

    if (nextProjectStatus) {
      await ctx.db.patch(project._id, {
        status: nextProjectStatus,
        geaccepteerdOp: args.status === "accepted" ? now : project.geaccepteerdOp,
        gewijzigdOp: now
      });
    }

    if (args.status === "sent") {
      await addProjectEvent(ctx, tenant._id, project._id, "quote_sent", "Offerte verzonden", externalUserId);
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "quote_follow_up",
        "Offerte opvolgen",
        addCalendarDays(now, 18),
        externalUserId,
        quote._id
      );
    }

    if (args.status === "accepted") {
      await addProjectEvent(ctx, tenant._id, project._id, "quote_accepted", "Offerte akkoord", externalUserId);
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "quote_follow_up", "done", quote._id);
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "confirmation_payment",
        "Bevestigingsmail / betaling binnen 5 dagen",
        addCalendarDays(now, 5),
        externalUserId,
        quote._id
      );
      await upsertProjectTask(
        ctx,
        tenant._id,
        project._id,
        "execution_call",
        "Bellen / afspraak maken voor uitvoering",
        addCalendarDays(now, 5),
        externalUserId,
        quote._id
      );
    }

    if (args.status === "cancelled") {
      await addProjectEvent(ctx, tenant._id, project._id, "closed", "Offerte geannuleerd", externalUserId);
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "quote_follow_up", "dismissed", quote._id);
    }

    if (args.status === "rejected") {
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "quote_follow_up", "dismissed", quote._id);
    }

    return quote._id;
  }
});

export const listQuotesWorkspace = query({
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
    const [customers, projects, quotes, templates] = await Promise.all([
      ctx.db
        .query("customers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
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
        .collect(),
      ctx.db
        .query("quoteTemplates")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect()
    ]);

    return {
      customers: customers.map((customer: Doc<"customers">) => toCustomer(tenant.slug, customer)),
      projects: await Promise.all(
        projects.map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
      ),
      quotes: await Promise.all(
        quotes.map((quote: Doc<"quotes">) => toQuote(ctx, tenant.slug, quote))
      ),
      templates: templates
        .filter((template: Doc<"quoteTemplates">) => template.status === "active")
        .map((template: Doc<"quoteTemplates">) => toQuoteTemplate(tenant.slug, template))
    };
  }
});

// Detailpagina (/portal/offertes/[id]): zelfde vorm als listQuotesWorkspace,
// maar geschaald naar één offerte zodat niet de hele catalogus aan offertes
// wordt geladen om er één te tonen.
export const quoteDetailWorkspace = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    quoteId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    const quoteDoc = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quoteDoc || quoteDoc.tenantId !== tenant._id) {
      return { customers: [], projects: [], quotes: [], templates: [] };
    }

    const [customerDoc, projectDoc, templates] = await Promise.all([
      ctx.db.get(quoteDoc.klantId),
      ctx.db.get(quoteDoc.projectId),
      ctx.db
        .query("quoteTemplates")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect()
    ]);

    return {
      customers:
        customerDoc && customerDoc.tenantId === tenant._id
          ? [toCustomer(tenant.slug, customerDoc)]
          : [],
      projects:
        projectDoc && projectDoc.tenantId === tenant._id
          ? [await toProject(ctx, tenant.slug, projectDoc)]
          : [],
      quotes: [await toQuote(ctx, tenant.slug, quoteDoc)],
      templates: templates
        .filter((template: Doc<"quoteTemplates">) => template.status === "active")
        .map((template: Doc<"quoteTemplates">) => toQuoteTemplate(tenant.slug, template))
    };
  }
});

export const createQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    titel: v.string(),
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

    const template = await ctx.db
      .query("quoteTemplates")
      .withIndex("by_type", (q: any) => q.eq("tenantId", tenant._id).eq("type", "default"))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .first();
    const now = Date.now();
    const quoteId = await ctx.db.insert("quotes", {
      tenantId: tenant._id,
      projectId: project._id,
      klantId: project.klantId,
      offertenummer: `OFF-${new Date(now).getFullYear()}-${now}`,
      titel: args.titel,
      status: "draft",
      inleidingTekst: template?.inleidingTekst,
      afsluitTekst: template?.afsluitTekst,
      voorwaarden: template?.standaardVoorwaarden ?? [],
      betalingsvoorwaarden: template?.betalingsvoorwaarden ?? [],
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    await ctx.db.patch(project._id, {
      status: "quote_draft",
      gewijzigdOp: now
    });
    await ctx.db.insert("projectWorkflowEvents", {
      tenantId: tenant._id,
      projectId: project._id,
      type: "quote_created",
      titel: "Offerte aangemaakt",
      zichtbaarVoorKlant: false,
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now
    });

    return quoteId;
  }
});

export const updateQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    titel: v.optional(v.string()),
    geldigTot: v.optional(v.number()),
    inleidingTekst: v.optional(v.string()),
    afsluitTekst: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const patch: Partial<Doc<"quotes">> = { gewijzigdOp: Date.now() };

    if (args.titel !== undefined) patch.titel = args.titel;
    const hasArg = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
    if (hasArg(args, "validUntil")) patch.geldigTot = args.geldigTot;
    if (hasArg(args, "introText")) patch.inleidingTekst = args.inleidingTekst;
    if (hasArg(args, "closingText")) patch.afsluitTekst = args.afsluitTekst;

    await ctx.db.patch(quote._id, patch);

    return quote._id;
  }
});

export const addQuoteLine = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    projectRuimteId: v.optional(v.string()),
    productId: v.optional(v.string()),
    regelType: quoteLineType,
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    aantal: v.number(),
    eenheid: v.string(),
    eenheidsprijsExBtw: v.number(),
    btwTarief: v.number(),
    kortingExBtw: v.optional(v.number()),
    sortOrder: v.number(),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const projectRoomId = args.projectRuimteId
      ? (args.projectRuimteId as Id<"projectRooms">)
      : undefined;

    if (projectRoomId) {
      const projectRoom = await ctx.db.get(projectRoomId);

      if (
        !projectRoom ||
        projectRoom.tenantId !== tenant._id ||
        projectRoom.projectId !== quote.projectId
      ) {
        throw new ConvexError("Project room not found");
      }
    }

    const productId = args.regelType === "product"
      ? await validateQuoteLineProduct(ctx, tenant._id, args.productId)
      : undefined;

    const totals = calculateLineTotals(
      args.regelType,
      args.aantal,
      args.eenheidsprijsExBtw,
      args.btwTarief,
      args.kortingExBtw
    );
    const now = Date.now();
    const lineId = await ctx.db.insert("quoteLines", {
      tenantId: tenant._id,
      quoteId: quote._id,
      projectRuimteId: projectRoomId,
      productId,
      regelType: args.regelType,
      titel: args.titel,
      omschrijving: args.omschrijving,
      aantal: args.aantal,
      eenheid: args.eenheid,
      eenheidsprijsExBtw: args.eenheidsprijsExBtw,
      btwTarief: args.btwTarief,
      kortingExBtw: args.kortingExBtw,
      regelTotaalExBtw: totals.lineTotalExVat,
      regelBtwTotaal: totals.lineVatTotal,
      regelTotaalInclBtw: totals.lineTotalIncVat,
      sortOrder: args.sortOrder,
      metadata: args.metadata,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    await recalculateQuote(ctx, tenant._id, quote._id);

    return lineId;
  }
});

export const importMeasurementLinesToQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    lineIds: v.array(v.id("measurementLines")),
    startSortOrder: v.number()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Quote not found");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    if (args.lineIds.length === 0) {
      return [];
    }

    if (new Set(args.lineIds.map((lineId) => String(lineId))).size !== args.lineIds.length) {
      throw new ConvexError("Meetregels mogen maar een keer worden geimporteerd.");
    }

    const now = Date.now();
    const insertedLineIds: Id<"quoteLines">[] = [];
    const touchedMeasurementIds = new Set<Id<"measurements">>();
    const existingQuoteLines = await ctx.db
      .query("quoteLines")
      .withIndex("by_quote", (q: any) => q.eq("tenantId", tenant._id).eq("quoteId", quote._id))
      .collect();
    const requestedSortOrder = Number.isFinite(args.startSortOrder)
      ? Math.max(1, Math.round(args.startSortOrder))
      : 1;
    const nextSortOrder =
      existingQuoteLines.reduce(
        (highest: number, line: Doc<"quoteLines">) => Math.max(highest, line.sortOrder),
        0
      ) + 1;
    const startSortOrder = Math.max(requestedSortOrder, nextSortOrder);

    for (const [index, lineId] of args.lineIds.entries()) {
      const line = await ctx.db.get(lineId);

      if (!line || line.tenantId !== tenant._id) {
        throw new ConvexError("Measurement line not found");
      }

      if (line.quotePreparationStatus !== "ready_for_quote") {
        throw new ConvexError("Measurement line is not ready for quote");
      }

      const measurement = await ctx.db.get(line.inmetingId);

      if (
        !measurement ||
        measurement.tenantId !== tenant._id ||
        measurement.projectId !== quote.projectId
      ) {
        throw new ConvexError("Measurement not found for quote project");
      }

      const room = line.ruimteId ? await ctx.db.get(line.ruimteId) : null;

      if (
        room &&
        (room.tenantId !== tenant._id || room.inmetingId !== measurement._id)
      ) {
        throw new ConvexError("Measurement room not found");
      }

      if (room?.projectRuimteId) {
        const projectRoom = await ctx.db.get(room.projectRuimteId);

        if (
          !projectRoom ||
          projectRoom.tenantId !== tenant._id ||
          projectRoom.projectId !== quote.projectId
        ) {
          throw new ConvexError("Project room not found");
        }
      }

      // Richtprijs-snapshot van de meetregel als voorinvulling gebruiken.
      // Prijsreview blijft altijd verplicht; de offerte is en blijft de
      // plek waar de prijs definitief wordt gecontroleerd.
      // Een inmiddels verwijderd of pilot-verborgen product mag de batch niet
      // blokkeren: die regel komt dan zonder product/prijs binnen (zoals voorheen).
      let prefilledProductId: Id<"products"> | undefined;

      if (line.productId) {
        try {
          prefilledProductId = await validateQuoteLineProduct(ctx, tenant._id, String(line.productId));
        } catch {
          prefilledProductId = undefined;
        }
      }

      // Een raambekleding-matrix-regel heeft géén catalogusproduct maar wél een richtprijs;
      // die mag wél overgenomen worden. Een verwijderd/inactief catalogusproduct (productId stond
      // er ooit, maar valideert niet meer) blijft bewust leeg-geprijsd binnenkomen.
      const isMatrixLine = line.indicatievePrijsSoort === "matrix";
      const hasIndicativePrice =
        (prefilledProductId !== undefined || isMatrixLine) &&
        line.indicatieveEenheidsprijsExBtw !== undefined &&
        line.indicatiefBtwTarief !== undefined;
      const unitPriceExVat = hasIndicativePrice ? line.indicatieveEenheidsprijsExBtw! : 0;
      const vatRate = hasIndicativePrice ? line.indicatiefBtwTarief! : 0;
      const totals = calculateLineTotals(line.offerteRegelType, line.aantal, unitPriceExVat, vatRate);
      const quoteLineId = await ctx.db.insert("quoteLines", {
        tenantId: tenant._id,
        quoteId: quote._id,
        projectRuimteId: room?.projectRuimteId,
        regelType: line.offerteRegelType,
        titel: importedMeasurementLineTitle(line, room),
        omschrijving: importedMeasurementLineDescription(line, hasIndicativePrice),
        aantal: line.aantal,
        eenheid: line.eenheid,
        eenheidsprijsExBtw: unitPriceExVat,
        btwTarief: vatRate,
        productId: prefilledProductId,
        regelTotaalExBtw: totals.lineTotalExVat,
        regelBtwTotaal: totals.lineVatTotal,
        regelTotaalInclBtw: totals.lineTotalIncVat,
        sortOrder: startSortOrder + index,
        metadata: {
          source: "measurement",
          measurementId: measurement._id,
          measurementLineId: line._id,
          measurementRoomId: room?._id,
          productGroup: line.productGroep,
          calculationType: line.berekeningType,
          wastePercent: line.snijverliesPct,
          isIndicative: true,
          productId: prefilledProductId ? line.productId : undefined,
          productName: prefilledProductId || isMatrixLine ? line.productNaam : undefined,
          indicativePriceType: hasIndicativePrice ? line.indicatievePrijsSoort : undefined,
          indicativePriceUnit: hasIndicativePrice ? line.indicatievePrijsEenheid : undefined,
          // Matrix-regels (raambekleding) hebben bewust geen catalogusproduct nodig.
          requiresManualProductReview: !prefilledProductId && !isMatrixLine,
          requiresManualPriceReview: true,
          requiresManualVatReview: !hasIndicativePrice
        },
        aangemaaktOp: now,
        gewijzigdOp: now
      });

      await ctx.db.patch(line._id, {
        quotePreparationStatus: "converted",
        geconverteerdeOfferteId: quote._id,
        geconverteerdeOfferteregelId: quoteLineId,
        gewijzigdOp: now
      });

      insertedLineIds.push(quoteLineId);
      touchedMeasurementIds.add(measurement._id);
    }

    for (const measurementId of touchedMeasurementIds) {
      await ctx.db.patch(measurementId, { gewijzigdOp: now });
    }

    await recalculateQuote(ctx, tenant._id, quote._id);

    return insertedLineIds;
  }
});
