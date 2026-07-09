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
  calculateLineTotals,
  existingInvoiceForQuote,
  restoreMeasurementLinesForQuote,
  assertQuoteAcceptable,
  cancelOtherOpenQuotesAndRestore,
  assertQuoteStatusTransition,
  assertNoOtherAcceptedQuote,
  cancelOpenSupplierOrders,
  applyProjectStatusForNewQuote
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

// De legacy-mutaties "create" en "addLine" zijn verwijderd (audit 2026-07-09):
// nergens door de UI gebruikt en met zwakkere validatie dan createQuote/addQuoteLine
// (geen tenant-check op productId/projectRuimteId/werktariefRegelId). De portal-
// varianten in portal.ts zijn de enige ondersteunde route.

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
    throw new ConvexError("Offerte niet gevonden.");
  }

  const lines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", tenantId).eq("quoteId", quoteId))
    .collect();

  const subtotalExVat = roundMoney(
    lines.reduce((sum: number, line: any) => sum + line.regelTotaalExBtw, 0)
  );
  const vatTotal = roundMoney(
    lines.reduce((sum: number, line: any) => sum + line.regelBtwTotaal, 0)
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
    throw new ConvexError("Product niet gevonden.");
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

/**
 * Verwijdert de `requiresManualPriceReview`-vlag uit regel-metadata. Een bewuste
 * updateQuoteLine geldt als de vereiste prijsreview, zodat de regel daarna door de
 * status-gate mag. De rest van de metadata (bv. isIndicative) blijft staan.
 */
function clearedPriceReviewMetadata(metadata: unknown): unknown {
  if (!metadata || typeof metadata !== "object") {
    return metadata;
  }
  if (!("requiresManualPriceReview" in (metadata as Record<string, unknown>))) {
    return metadata;
  }
  const { requiresManualPriceReview: _drop, ...rest } = metadata as Record<string, unknown>;
  return rest;
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
      throw new ConvexError("Offerteregel niet gevonden.");
    }

    const quote = await ctx.db.get(line.quoteId);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Offerte niet gevonden.");
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
        (ml: any) => ml.geconverteerdeOfferteregelId === line._id
      );

      if (linkedLine) {
        await ctx.db.patch(linkedLine._id, {
          quotePreparationStatus: "ready_for_quote",
          geconverteerdeOfferteId: undefined,
          geconverteerdeOfferteregelId: undefined,
          gewijzigdOp: Date.now()
        });
        // De inmeting is pas niet langer 'verwerkt naar offerte' als er ook geen
        // ándere geconverteerde regels meer op staan — anders zou één verwijderde
        // offertepost de status onterecht terugzetten (spiegel van de automatische
        // doorzet in importMeasurementLinesToQuote).
        const nogGeconverteerd = mLines.some(
          (ml: any) => ml._id !== linkedLine._id && ml.quotePreparationStatus === "converted"
        );
        await ctx.db.patch(measurement._id, {
          ...(measurement.status === "converted_to_quote" && !nogGeconverteerd
            ? { status: "reviewed" as const }
            : {}),
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
      throw new ConvexError("Offerteregel niet gevonden.");
    }

    const quote = await ctx.db.get(line.quoteId);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Offerte niet gevonden.");
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
        throw new ConvexError("Ruimte niet gevonden.");
      }
    }

    // Valideer het product alleen wanneer het daadwerkelijk WIJZIGT. Een ongewijzigd
    // product mag een latere deactivatie/pilot-verberging niet blokkeren — anders kan
    // een monteur de prijs of het aantal van een bestaande regel niet meer corrigeren.
    const productUnchanged =
      args.regelType === "product" &&
      !!args.productId &&
      !!line.productId &&
      args.productId === String(line.productId);
    const productId =
      args.regelType !== "product"
        ? undefined
        : productUnchanged
          ? line.productId
          : await validateQuoteLineProduct(ctx, tenant._id, args.productId);

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
      // Een bewuste regel-bewerking telt als prijsreview: wis de review-vlag.
      metadata: clearedPriceReviewMetadata(args.metadata),
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
      throw new ConvexError("Offerte niet gevonden.");
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
      throw new ConvexError("Offerte niet gevonden.");
    }

    const project = await ctx.db.get(quote.projectId);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
    }

    // Idempotent: dezelfde status opnieuw zetten is een no-op (voorkomt dubbele
    // workflow-events en een herhaalde sibling-cancel bij een dubbelklik).
    if (args.status === quote.status) {
      return quote._id;
    }

    // Een al-gefactureerde offerte is bevroren op 'akkoord': hij mag niet uit akkoord worden
    // gehaald (terug naar concept, of op afgewezen/geannuleerd/verlopen) — anders wijkt de
    // offerte stil af van de reeds aangemaakte factuur (die de offerteregels live toont). Maak
    // zo nodig een creditfactuur via de factuur-flow. Bewust vóór de overgangsguard: deze
    // melding is specifieker dan de generieke "alleen annuleren"-melding.
    if (args.status !== "accepted") {
      const reedsGefactureerd = await existingInvoiceForQuote(ctx, tenant._id, quote._id);
      if (reedsGefactureerd) {
        throw new ConvexError(
          "Deze offerte is al gefactureerd en kan niet meer worden gewijzigd. Maak zo nodig een creditfactuur via de factuur-flow."
        );
      }
    }

    // Bewaak de toegestane overgang: een terminale offerte mag niet herleven naar
    // verstuurd/akkoord (zou dezelfde inmeting dubbel factureerbaar maken), en een
    // geaccepteerde offerte gaat alleen nog naar 'geannuleerd'.
    assertQuoteStatusTransition(quote.status, args.status);

    // Eén leidende geaccepteerde offerte per dossier.
    if (args.status === "accepted") {
      await assertNoOtherAcceptedQuote(ctx, tenant._id, project._id, quote._id);
    }

    // Prijs-/richtprijs-/leeg-gate vóór 'verstuurd'/'akkoord' — gedeeld met het winkel-
    // dossierpad (processProjectAction) zodat beide accept-paden dezelfde controle dragen.
    if (args.status === "sent" || args.status === "accepted") {
      await assertQuoteAcceptable(ctx, tenant._id, quote._id);
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

    // Annuleer de overige open offertes van dit project en bevrijd hun inmeetregels (gedeeld
    // met het winkel-accept-pad zodat er nooit twee 'levende' offertes op één dossier blijven).
    if (args.status === "accepted") {
      await cancelOtherOpenQuotesAndRestore(ctx, tenant._id, project._id, quote._id, now);
    }

    const statusMap: Partial<Record<Doc<"quotes">["status"], Doc<"projects">["status"]>> = {
      draft: "quote_draft",
      sent: "quote_sent",
      accepted: "quote_accepted",
      rejected: "quote_rejected",
      // Geen aparte 'quote_expired' projectstatus; een verlopen offerte gedraagt zich als
      // afgewezen (offerte-fase geëindigd zonder akkoord).
      expired: "quote_rejected",
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

    // Terminale offerte-staat (afgewezen/geannuleerd/verlopen): sluit de opvolgtaak,
    // bevrijd de inmeetregels (anders blijven ze permanent 'converted' en verdwijnen ze
    // uit de import-picker) en annuleer de nog-open leveranciersbestellingen van déze
    // offerte (een eerder geaccepteerde offerte kan al bestellingen hebben; ontvangen
    // bestellingen blijven staan). De telling gaat mee in het workflow-event, zodat het
    // annuleren van bestellingen nooit onzichtbaar gebeurt.
    if (args.status === "cancelled" || args.status === "rejected" || args.status === "expired") {
      await closeOpenProjectTasks(ctx, tenant._id, project._id, "quote_follow_up", "dismissed", quote._id);
      await restoreMeasurementLinesForQuote(ctx, tenant._id, project._id, quote._id);
      const cancelledOrderCount = await cancelOpenSupplierOrders(
        ctx,
        tenant._id,
        project._id,
        now,
        quote._id
      );
      const orderNote =
        cancelledOrderCount > 0
          ? `${cancelledOrderCount} openstaande leveranciersbestelling(en) geannuleerd.`
          : undefined;

      // Elke terminale overgang laat een spoor na in de dossier-tijdlijn: wie hierna het
      // dossier opent (winkel óf buitendienst) moet kunnen zien dat en wanneer de offerte
      // is gestopt — een afwijzing was voorheen onzichtbaar (dood einde).
      if (args.status === "cancelled") {
        await addProjectEvent(
          ctx,
          tenant._id,
          project._id,
          "closed",
          "Offerte geannuleerd",
          externalUserId,
          orderNote
        );
      } else {
        await addProjectEvent(
          ctx,
          tenant._id,
          project._id,
          "quote_rejected",
          args.status === "rejected" ? "Offerte afgewezen" : "Offerte verlopen",
          externalUserId,
          orderNote
        );
      }
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
      return { customers: [], projects: [], quotes: [], templates: [], klantAfspraken: [] };
    }

    const [customerDoc, projectDoc, templates, klantContacten] = await Promise.all([
      ctx.db.get(quoteDoc.klantId),
      ctx.db.get(quoteDoc.projectId),
      ctx.db
        .query("quoteTemplates")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("customerContacts")
        .withIndex("by_customer", (q: any) =>
          q.eq("tenantId", tenant._id).eq("klantId", quoteDoc.klantId)
        )
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
        .map((template: Doc<"quoteTemplates">) => toQuoteTemplate(tenant.slug, template)),
      // Afspraken die de klant mag zien ("zichtbaar voor klant"): verschijnen als
      // Afspraken-blok op de klantversie van de offerte. Oudste eerst (leesvolgorde).
      klantAfspraken: (klantContacten as Doc<"customerContacts">[])
        .filter((contact) => contact.zichtbaarVoorKlant)
        .sort((a, b) => a.aangemaaktOp - b.aangemaaktOp)
        .map((contact) => ({
          titel: contact.titel,
          omschrijving: contact.omschrijving
        }))
    };
  }
});

export const createQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    projectId: v.string(),
    titel: v.string(),
    // Optioneel gekozen offertesjabloon; zonder keuze valt hij terug op het
    // sjabloon van type "default" (het vorige, vaste gedrag).
    templateId: v.optional(v.string()),
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
      throw new ConvexError("Project niet gevonden.");
    }

    let template;
    if (args.templateId) {
      const chosen = await ctx.db.get(args.templateId as Id<"quoteTemplates">);
      if (!chosen || chosen.tenantId !== tenant._id || chosen.status !== "active") {
        throw new ConvexError("Offertesjabloon niet gevonden.");
      }
      template = chosen;
    } else {
      template = await ctx.db
        .query("quoteTemplates")
        .withIndex("by_type", (q: any) => q.eq("tenantId", tenant._id).eq("type", "default"))
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .first();
    }
    const now = Date.now();

    // Guard + statuszet vóór de insert: geen nieuwe offerte op een geannuleerd/gesloten
    // dossier, en geen statusregressie van een dossier dat al voorbij de offerte-fase is
    // (meerwerk-offerte op een lopend dossier laat de projectstatus staan).
    await applyProjectStatusForNewQuote(ctx, project, now);

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
      throw new ConvexError("Offerte niet gevonden.");
    }

    if (quote.status !== "draft") {
      throw new ConvexError("Alleen conceptoffertes kunnen inhoudelijk worden aangepast.");
    }

    const patch: Partial<Doc<"quotes">> = { gewijzigdOp: Date.now() };

    if (args.titel !== undefined) patch.titel = args.titel;
    const hasArg = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
    if (hasArg(args, "geldigTot")) patch.geldigTot = args.geldigTot;
    if (hasArg(args, "inleidingTekst")) patch.inleidingTekst = args.inleidingTekst;
    if (hasArg(args, "afsluitTekst")) patch.afsluitTekst = args.afsluitTekst;

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
      throw new ConvexError("Offerte niet gevonden.");
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
        throw new ConvexError("Ruimte niet gevonden.");
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
      throw new ConvexError("Offerte niet gevonden.");
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
        throw new ConvexError("Inmeetregel niet gevonden.");
      }

      if (line.quotePreparationStatus !== "ready_for_quote") {
        throw new ConvexError("Deze inmeetregel is nog niet klaar voor een offerte. Zet de regel eerst op 'klaar voor offerte'.");
      }

      const measurement = await ctx.db.get(line.inmetingId);

      if (
        !measurement ||
        measurement.tenantId !== tenant._id ||
        measurement.projectId !== quote.projectId
      ) {
        throw new ConvexError("Inmeting niet gevonden bij het project van deze offerte.");
      }

      const room = line.ruimteId ? await ctx.db.get(line.ruimteId) : null;

      if (
        room &&
        (room.tenantId !== tenant._id || room.inmetingId !== measurement._id)
      ) {
        throw new ConvexError("Meetruimte niet gevonden.");
      }

      if (room?.projectRuimteId) {
        const projectRoom = await ctx.db.get(room.projectRuimteId);

        if (
          !projectRoom ||
          projectRoom.tenantId !== tenant._id ||
          projectRoom.projectId !== quote.projectId
        ) {
          throw new ConvexError("Ruimte niet gevonden.");
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

      // Productloze maar vertrouwde richtprijzen mogen wél overgenomen worden:
      // raambekleding-matrix ("matrix") en eigen diensten/legkosten ("service_rule")
      // hebben géén catalogusproduct maar hun prijs komt uit eigen beheer (zelfde
      // regel als de staleness-guard in projecten/measurements.ts). Een verwijderd/
      // inactief catalogusproduct (productId stond er ooit, maar valideert niet
      // meer) blijft bewust leeg-geprijsd binnenkomen.
      const isTrustedProductlessLine =
        line.indicatievePrijsSoort === "matrix" || line.indicatievePrijsSoort === "service_rule";
      const hasIndicativePrice =
        (prefilledProductId !== undefined || isTrustedProductlessLine) &&
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
          productName: prefilledProductId || isTrustedProductlessLine ? line.productNaam : undefined,
          indicativePriceType: hasIndicativePrice ? line.indicatievePrijsSoort : undefined,
          indicativePriceUnit: hasIndicativePrice ? line.indicatievePrijsEenheid : undefined,
          // Matrix- (raambekleding) en dienstregels hebben bewust geen catalogusproduct nodig.
          requiresManualProductReview: !prefilledProductId && !isTrustedProductlessLine,
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
      // De import ís de verwerking naar offerte: zet de inmeting door naar
      // 'converted_to_quote' zodat de buitendienst-kaart niet rood 'achterstallig'
      // blijft staan en niemand het handmatige status-dropdownnetje hoeft te onthouden.
      const measurement = await ctx.db.get(measurementId);
      await ctx.db.patch(measurementId, {
        ...(measurement && measurement.status !== "converted_to_quote"
          ? { status: "converted_to_quote" as const }
          : {}),
        gewijzigdOp: now
      });
    }

    await recalculateQuote(ctx, tenant._id, quote._id);

    return insertedLineIds;
  }
});
