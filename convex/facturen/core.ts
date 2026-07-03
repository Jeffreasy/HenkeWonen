import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRole,
  requireMutationRoleForTenantId,
  requireQueryRole
} from "../authz";
import type { Doc } from "../_generated/dataModel";
import type { PortalInvoice } from "../../src/lib/portalTypes";
import {
  completeInvoiceWorkflow,
  existingInvoiceForQuote,
  nextInvoiceNumber,
  requireTenant,
  roundMoney
} from "../portalUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toInvoice(tenantSlug: string, invoice: Doc<"invoices">): PortalInvoice {
  return {
    id: String(invoice._id),
    tenantId: tenantSlug,
    projectId: String(invoice.projectId),
    klantId: String(invoice.klantId),
    quoteId: invoice.quoteId ? String(invoice.quoteId) : undefined,
    factuurnummer: invoice.factuurnummer,
    status: invoice.status,
    factuurdatum: invoice.factuurdatum,
    vervaldatum: invoice.vervaldatum,
    subtotaalExBtw: invoice.subtotaalExBtw,
    btwTotaal: invoice.btwTotaal,
    totaalInclBtw: invoice.totaalInclBtw,
    betaaldBedrag: invoice.betaaldBedrag,
    betaaldOp: invoice.betaaldOp,
    herinneringVerzondenOp: invoice.herinneringVerzondenOp,
    aangemaaktOp: invoice.aangemaaktOp,
    gewijzigdOp: invoice.gewijzigdOp
  };
}

function ensureNotFieldMode(workspaceMode: string) {
  // Buitendienst-werkplek (field) krijgt geen toegang tot facturen. Audit: field-mode werd
  // niet server-side afgedwongen → financiële data was via de API bereikbaar voor buitendienst.
  if (workspaceMode === "field") {
    throw new ConvexError("Facturen zijn niet beschikbaar in de buitendienst-werkplek.");
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const listInvoices = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    // Geen "viewer": een kijker hoort geen financiële data te zien (spiegel van
    // canViewFinancials, dat voorheen dode code was terwijl de query alles teruggaf).
    const { tenant, workspaceMode } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    ensureNotFieldMode(workspaceMode);

    const invoiceStatuses = ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"] as const;

    const [invoicesByStatus, customers, projects] = await Promise.all([
      Promise.all(
        invoiceStatuses.map((status) =>
          ctx.db
            .query("invoices")
            .withIndex("by_status", (q: any) => q.eq("tenantId", tenant._id).eq("status", status))
            .collect()
        )
      ),
      ctx.db
        .query("customers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect()
    ]);

    const invoices: Doc<"invoices">[] = invoicesByStatus
      .flat()
      .sort((left, right) => right.aangemaaktOp - left.aangemaaktOp);

    const customerById = new Map(
      customers.map((c: Doc<"customers">) => [String(c._id), c.weergaveNaam])
    );
    const projectById = new Map(
      projects.map((p: Doc<"projects">) => [String(p._id), p.titel])
    );

    return invoices.map((invoice: Doc<"invoices">) => ({
      ...toInvoice(tenant.slug, invoice),
      customerName: customerById.get(String(invoice.klantId)) ?? "-",
      projectTitle: projectById.get(String(invoice.projectId)) ?? "-"
    }));
  }
});

export const invoiceDetail = query({
  args: {
    tenantSlug: v.string(),
    invoiceId: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    // Geen "viewer": zie listInvoices.
    const { tenant, workspaceMode } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    ensureNotFieldMode(workspaceMode);
    const invoiceId = ctx.db.normalizeId("invoices", args.invoiceId);

    if (!invoiceId) {
      return null;
    }

    const invoice = await ctx.db.get(invoiceId);

    if (!invoice || invoice.tenantId !== tenant._id) {
      return null;
    }

    const [customer, project, quote] = await Promise.all([
      ctx.db.get(invoice.klantId),
      ctx.db.get(invoice.projectId),
      invoice.quoteId ? ctx.db.get(invoice.quoteId) : Promise.resolve(null)
    ]);

    // Factuurspecificatie: facturen zijn header-only; de regels komen van de gekoppelde offerte.
    const quoteLineDocs =
      quote && quote.tenantId === tenant._id
        ? await ctx.db
            .query("quoteLines")
            .withIndex("by_quote", (q) => q.eq("tenantId", tenant._id).eq("quoteId", quote._id))
            .collect()
        : [];

    return {
      invoice: toInvoice(tenant.slug, invoice),
      customer: customer && customer.tenantId === tenant._id
        ? {
            id: String(customer._id),
            weergaveNaam: customer.weergaveNaam,
            email: customer.email,
            telefoon: customer.telefoon,
            type: customer.type,
            straat: customer.straat,
            huisnummer: customer.huisnummer,
            postcode: customer.postcode,
            plaats: customer.plaats,
            land: customer.land
          }
        : null,
      project: project && project.tenantId === tenant._id
        ? {
            id: String(project._id),
            titel: project.titel,
            status: project.status
          }
        : null,
      quote: quote && quote.tenantId === tenant._id
        ? {
            id: String(quote._id),
            offertenummer: quote.offertenummer,
            titel: quote.titel,
            status: quote.status
          }
        : null,
      quoteLines: quoteLineDocs
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((line) => ({
          id: String(line._id),
          regelType: line.regelType,
          titel: line.titel,
          aantal: line.aantal,
          eenheid: line.eenheid,
          eenheidsprijsExBtw: line.eenheidsprijsExBtw,
          btwTarief: line.btwTarief,
          kortingExBtw: line.kortingExBtw,
          regelTotaalExBtw: line.regelTotaalExBtw,
          regelBtwTotaal: line.regelBtwTotaal,
          regelTotaalInclBtw: line.regelTotaalInclBtw,
          sortOrder: line.sortOrder
        }))
    };
  }
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const createInvoice = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    projectId: v.id("projects"),
    klantId: v.id("customers"),
    quoteId: v.optional(v.id("quotes")),
    vervaldatum: v.number(),
    subtotaalExBtw: v.number(),
    btwTotaal: v.number(),
    totaalInclBtw: v.number()
  },
  handler: async (ctx, args) => {
    const { externalUserId, workspaceMode } = await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    ensureNotFieldMode(workspaceMode);

    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new ConvexError("Project niet gevonden.");
    }

    const customer = await ctx.db.get(args.klantId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new ConvexError("Klant niet gevonden.");
    }

    // Vertrouw client-aangeleverde bedragen niet blind. Valideer vorm + consistentie,
    // en bind aan de vertrouwde offerte-totalen als er een offerte aan hangt.
    const { subtotaalExBtw, btwTotaal, totaalInclBtw } = args;
    if (![subtotaalExBtw, btwTotaal, totaalInclBtw].every((n) => Number.isFinite(n) && n >= 0)) {
      throw new ConvexError("Factuurbedragen moeten eindige, niet-negatieve getallen zijn.");
    }
    // Zelfde ondergrens als de offerte-flow (die €0-offertes al blokkeert): een
    // factuur van €0 is altijd een invoerfout en zou een gatloos factuurnummer verbruiken.
    if (totaalInclBtw <= 0) {
      throw new ConvexError("Een factuur van €0 is niet toegestaan.");
    }
    if (Math.abs(totaalInclBtw - (subtotaalExBtw + btwTotaal)) > 0.01) {
      throw new ConvexError("Factuurtotaal is inconsistent (totaal incl. btw moet subtotaal + btw zijn).");
    }
    if (!Number.isFinite(args.vervaldatum) || args.vervaldatum <= 0) {
      throw new ConvexError("Vervaldatum is ongeldig.");
    }
    if (args.quoteId) {
      const linkedQuote = await ctx.db.get(args.quoteId);
      if (!linkedQuote || linkedQuote.tenantId !== args.tenantId) {
        throw new ConvexError("Gekoppelde offerte niet gevonden.");
      }
      if (
        Math.abs(linkedQuote.subtotaalExBtw - subtotaalExBtw) > 0.01 ||
        Math.abs(linkedQuote.btwTotaal - btwTotaal) > 0.01 ||
        Math.abs(linkedQuote.totaalInclBtw - totaalInclBtw) > 0.01
      ) {
        throw new ConvexError("Factuurbedragen wijken af van de gekoppelde offerte.");
      }
      // Voorkom dubbele factuur voor dezelfde offerte (zoals createInvoiceFromQuote
      // en processProjectAction dat al doen via existingInvoiceForQuote).
      const existingInvoice = await existingInvoiceForQuote(ctx, args.tenantId, args.quoteId);
      if (existingInvoice) {
        throw new ConvexError("Er bestaat al een factuur voor deze offerte.");
      }
    }

    const invoiceNumber = await nextInvoiceNumber(ctx, args.tenantId);
    const now = Date.now();

    const invoiceId = await ctx.db.insert("invoices", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      klantId: args.klantId,
      quoteId: args.quoteId,
      factuurnummer: invoiceNumber,
      status: "sent",
      factuurdatum: now,
      vervaldatum: args.vervaldatum,
      subtotaalExBtw: args.subtotaalExBtw,
      btwTotaal: args.btwTotaal,
      totaalInclBtw: args.totaalInclBtw,
      betaaldBedrag: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    await ctx.db.patch(args.projectId, {
      status: "invoiced",
      gefactureerdOp: now,
      gewijzigdOp: now
    });
    await completeInvoiceWorkflow(ctx, args.tenantId, project, args.vervaldatum, externalUserId);

    return { invoiceId: String(invoiceId), invoiceNumber };
  }
});

export const createInvoiceFromQuote = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    quoteId: v.string(),
    vervaldatum: v.number()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);

    const { externalUserId, workspaceMode } = await requireMutationRoleForTenantId(ctx, tenant._id, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    ensureNotFieldMode(workspaceMode);

    const quoteId = ctx.db.normalizeId("quotes", args.quoteId);

    if (!quoteId) {
      throw new ConvexError("Offerte niet gevonden.");
    }

    const quote = await ctx.db.get(quoteId);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new ConvexError("Offerte niet gevonden.");
    }

    if (quote.status !== "accepted") {
      throw new ConvexError("Factuur kan alleen worden aangemaakt voor een geaccepteerde offerte.");
    }

    const project = await ctx.db.get(quote.projectId);

    if (!project || project.tenantId !== tenant._id) {
      throw new ConvexError("Project niet gevonden.");
    }

    // Voorkom dubbele factuur voor dezelfde offerte
    const existing = await existingInvoiceForQuote(ctx, tenant._id, quoteId);

    if (existing) {
      if (!["paid", "closed", "cancelled"].includes(project.status)) {
        if (project.status !== "invoiced") {
          const invoicedAt = Date.now();
          await ctx.db.patch(project._id, {
            status: "invoiced",
            gefactureerdOp: project.gefactureerdOp ?? invoicedAt,
            gewijzigdOp: invoicedAt
          });
        }
        await completeInvoiceWorkflow(ctx, tenant._id, project, existing.vervaldatum, externalUserId);
      }

      return {
        invoiceId: String(existing._id),
        invoiceNumber: existing.factuurnummer,
        alreadyExists: true
      };
    }

    // Pas ná het idempotente "bestaat al"-pad: die tak gebruikt existing.vervaldatum
    // en mag niet stranden op een parameter die daar nooit wordt geraadpleegd.
    if (!Number.isFinite(args.vervaldatum) || args.vervaldatum <= 0) {
      throw new ConvexError("Vervaldatum is ongeldig.");
    }

    const invoiceNumber = await nextInvoiceNumber(ctx, tenant._id);
    const now = Date.now();

    const invoiceId = await ctx.db.insert("invoices", {
      tenantId: tenant._id,
      projectId: quote.projectId,
      klantId: quote.klantId,
      quoteId,
      factuurnummer: invoiceNumber,
      status: "sent",
      factuurdatum: now,
      vervaldatum: args.vervaldatum,
      subtotaalExBtw: quote.subtotaalExBtw,
      btwTotaal: quote.btwTotaal,
      totaalInclBtw: quote.totaalInclBtw,
      betaaldBedrag: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    // Projectstatus → gefactureerd
    await ctx.db.patch(quote.projectId, {
      status: "invoiced",
      gefactureerdOp: now,
      gewijzigdOp: now
    });
    await completeInvoiceWorkflow(ctx, tenant._id, project, args.vervaldatum, externalUserId);

    return {
      invoiceId: String(invoiceId),
      invoiceNumber,
      alreadyExists: false
    };
  }
});

const invoiceStatus = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("partially_paid"),
  v.literal("paid"),
  v.literal("overdue"),
  v.literal("cancelled")
);

export const updateInvoiceStatus = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    invoiceId: v.string(),
    status: invoiceStatus
  },
  handler: async (ctx, args) => {
    const { tenant, workspaceMode } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    ensureNotFieldMode(workspaceMode);

    const invoiceId = ctx.db.normalizeId("invoices", args.invoiceId);

    if (!invoiceId) {
      throw new ConvexError("Factuur niet gevonden.");
    }

    const invoice = await ctx.db.get(invoiceId);

    if (!invoice || invoice.tenantId !== tenant._id) {
      throw new ConvexError("Factuur niet gevonden.");
    }

    const now = Date.now();
    const markingPaid = args.status === "paid";

    await ctx.db.patch(invoiceId, {
      status: args.status,
      herinneringVerzondenOp:
        args.status === "overdue" ? invoice.herinneringVerzondenOp ?? now : invoice.herinneringVerzondenOp,
      // Bij handmatig op 'paid' zetten: betaalbedrag/-datum verzoenen met het totaal.
      betaaldBedrag: markingPaid ? invoice.totaalInclBtw : invoice.betaaldBedrag,
      betaaldOp: markingPaid ? invoice.betaaldOp ?? now : invoice.betaaldOp,
      gewijzigdOp: now
    });

    // Als betaald: projectstatus bijwerken
    if (args.status === "paid") {
      const project = await ctx.db.get(invoice.projectId);

      if (project && project.tenantId === tenant._id) {
        await ctx.db.patch(invoice.projectId, {
          status: "paid",
          betaaldOp: now,
          gewijzigdOp: now
        });
      }
    }

    return invoiceId;
  }
});

export const markInvoicePaid = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    invoiceId: v.string(),
    betaaldBedrag: v.number(),
    betaaldOp: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { tenant, workspaceMode } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    ensureNotFieldMode(workspaceMode);

    // Bedrag server-side valideren (consistent met createInvoice); de frontend-guard
    // is niet de enige verdediging tegen een negatief/ongeldig bedrag via de API.
    if (!Number.isFinite(args.betaaldBedrag) || args.betaaldBedrag < 0) {
      throw new ConvexError("Betaald bedrag moet een eindig, niet-negatief getal zijn.");
    }

    const invoiceId = ctx.db.normalizeId("invoices", args.invoiceId);

    if (!invoiceId) {
      throw new ConvexError("Factuur niet gevonden.");
    }

    const invoice = await ctx.db.get(invoiceId);

    if (!invoice || invoice.tenantId !== tenant._id) {
      throw new ConvexError("Factuur niet gevonden.");
    }

    if (invoice.status === "cancelled") {
      throw new ConvexError("Geannuleerde facturen kunnen niet worden bijgewerkt.");
    }

    if (invoice.status === "paid") {
      throw new ConvexError("Deze factuur is al volledig betaald.");
    }

    const now = Date.now();
    const paidAt = args.betaaldOp ?? now;

    // `betaaldBedrag` is de NIEUWE (deel)betaling: tel op bij wat al betaald is, zodat
    // twee deelbetalingen accumuleren i.p.v. elkaar te overschrijven. Cap op het
    // factuurtotaal — een overbetaling mag niet als negatief "openstaand" doorlekken
    // naar de openstaand-rapportages / boekhouder-export.
    const cumulativePaid = roundMoney((invoice.betaaldBedrag ?? 0) + args.betaaldBedrag);
    const isFullyPaid = cumulativePaid >= invoice.totaalInclBtw;
    const storedPaid = isFullyPaid ? invoice.totaalInclBtw : cumulativePaid;
    const newStatus = isFullyPaid
      ? ("paid" as const)
      : storedPaid > 0
      ? ("partially_paid" as const)
      : invoice.status;

    await ctx.db.patch(invoiceId, {
      betaaldBedrag: storedPaid,
      betaaldOp: isFullyPaid ? paidAt : invoice.betaaldOp,
      status: newStatus,
      gewijzigdOp: now
    });

    // Projectstatus naar 'paid' als volledig betaald
    if (isFullyPaid) {
      const project = await ctx.db.get(invoice.projectId);

      if (project && project.tenantId === tenant._id) {
        await ctx.db.patch(invoice.projectId, {
          status: "paid",
          betaaldOp: paidAt,
          gewijzigdOp: now
        });
      }
    }

    return { invoiceId, newStatus };
  }
});
