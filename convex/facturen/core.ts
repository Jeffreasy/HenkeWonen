import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRoleForTenantId } from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import { requireTenant } from "../portalUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function nextInvoiceNumber(ctx: any, tenantId: Id<"tenants">): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;

  const existing = await ctx.db
    .query("invoices")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .collect();

  const yearInvoices = existing.filter((inv: Doc<"invoices">) =>
    inv.invoiceNumber.startsWith(prefix)
  );

  const highest = yearInvoices.reduce((max: number, inv: Doc<"invoices">) => {
    const num = parseInt(inv.invoiceNumber.replace(prefix, ""), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  const next = String(highest + 1).padStart(3, "0");
  return `${prefix}${next}`;
}

function toInvoice(tenantSlug: string, invoice: Doc<"invoices">) {
  return {
    id: String(invoice._id),
    tenantId: tenantSlug,
    projectId: String(invoice.projectId),
    customerId: String(invoice.customerId),
    quoteId: invoice.quoteId ? String(invoice.quoteId) : undefined,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    subtotalExVat: invoice.subtotalExVat,
    vatTotal: invoice.vatTotal,
    totalIncVat: invoice.totalIncVat,
    paidAmount: invoice.paidAmount,
    paidAt: invoice.paidAt,
    reminderSentAt: invoice.reminderSentAt,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const listInvoices = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);

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
      .sort((left, right) => right.createdAt - left.createdAt);

    const customerById = new Map(
      customers.map((c: Doc<"customers">) => [String(c._id), c.displayName])
    );
    const projectById = new Map(
      projects.map((p: Doc<"projects">) => [String(p._id), p.title])
    );

    return invoices.map((invoice: Doc<"invoices">) => ({
      ...toInvoice(tenant.slug, invoice),
      customerName: customerById.get(String(invoice.customerId)) ?? "-",
      projectTitle: projectById.get(String(invoice.projectId)) ?? "-"
    }));
  }
});

export const invoiceDetail = query({
  args: {
    tenantSlug: v.string(),
    invoiceId: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const invoiceId = ctx.db.normalizeId("invoices", args.invoiceId);

    if (!invoiceId) {
      return null;
    }

    const invoice = await ctx.db.get(invoiceId);

    if (!invoice || invoice.tenantId !== tenant._id) {
      return null;
    }

    const [customer, project, quote] = await Promise.all([
      ctx.db.get(invoice.customerId),
      ctx.db.get(invoice.projectId),
      invoice.quoteId ? ctx.db.get(invoice.quoteId) : Promise.resolve(null)
    ]);

    return {
      invoice: toInvoice(tenant.slug, invoice),
      customer: customer && customer.tenantId === tenant._id
        ? {
            id: String(customer._id),
            displayName: customer.displayName,
            email: customer.email,
            phone: customer.phone,
            type: customer.type
          }
        : null,
      project: project && project.tenantId === tenant._id
        ? {
            id: String(project._id),
            title: project.title,
            status: project.status
          }
        : null,
      quote: quote && quote.tenantId === tenant._id
        ? {
            id: String(quote._id),
            quoteNumber: quote.quoteNumber,
            title: quote.title,
            status: quote.status
          }
        : null
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
    customerId: v.id("customers"),
    quoteId: v.optional(v.id("quotes")),
    dueDate: v.number(),
    subtotalExVat: v.number(),
    vatTotal: v.number(),
    totalIncVat: v.number()
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project niet gevonden.");
    }

    const customer = await ctx.db.get(args.customerId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new Error("Klant niet gevonden.");
    }

    const invoiceNumber = await nextInvoiceNumber(ctx, args.tenantId);
    const now = Date.now();

    const invoiceId = await ctx.db.insert("invoices", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      customerId: args.customerId,
      quoteId: args.quoteId,
      invoiceNumber,
      status: "sent",
      invoiceDate: now,
      dueDate: args.dueDate,
      subtotalExVat: args.subtotalExVat,
      vatTotal: args.vatTotal,
      totalIncVat: args.totalIncVat,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now
    });

    return { invoiceId, invoiceNumber };
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
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    invoiceId: v.string(),
    status: invoiceStatus
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const invoiceId = ctx.db.normalizeId("invoices", args.invoiceId);

    if (!invoiceId) {
      throw new Error("Factuur niet gevonden.");
    }

    const invoice = await ctx.db.get(invoiceId);

    if (!invoice || invoice.tenantId !== args.tenantId) {
      throw new Error("Factuur niet gevonden.");
    }

    const now = Date.now();

    await ctx.db.patch(invoiceId, {
      status: args.status,
      reminderSentAt:
        args.status === "overdue" ? invoice.reminderSentAt ?? now : invoice.reminderSentAt,
      updatedAt: now
    });

    // Als betaald: projectstatus bijwerken
    if (args.status === "paid") {
      const project = await ctx.db.get(invoice.projectId);

      if (project && project.tenantId === args.tenantId) {
        await ctx.db.patch(invoice.projectId, {
          status: "paid",
          paidAt: now,
          updatedAt: now
        });
      }
    }

    return invoiceId;
  }
});

export const markInvoicePaid = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    invoiceId: v.string(),
    paidAmount: v.number(),
    paidAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const invoiceId = ctx.db.normalizeId("invoices", args.invoiceId);

    if (!invoiceId) {
      throw new Error("Factuur niet gevonden.");
    }

    const invoice = await ctx.db.get(invoiceId);

    if (!invoice || invoice.tenantId !== args.tenantId) {
      throw new Error("Factuur niet gevonden.");
    }

    if (invoice.status === "cancelled") {
      throw new Error("Geannuleerde facturen kunnen niet worden bijgewerkt.");
    }

    const now = Date.now();
    const paidAt = args.paidAt ?? now;

    // Bepaal nieuwe status op basis van betaald bedrag
    const isFullyPaid = args.paidAmount >= invoice.totalIncVat;
    const newStatus = isFullyPaid
      ? ("paid" as const)
      : args.paidAmount > 0
      ? ("partially_paid" as const)
      : invoice.status;

    await ctx.db.patch(invoiceId, {
      paidAmount: args.paidAmount,
      paidAt: isFullyPaid ? paidAt : invoice.paidAt,
      status: newStatus,
      updatedAt: now
    });

    // Projectstatus naar 'paid' als volledig betaald
    if (isFullyPaid) {
      const project = await ctx.db.get(invoice.projectId);

      if (project && project.tenantId === args.tenantId) {
        await ctx.db.patch(invoice.projectId, {
          status: "paid",
          paidAt,
          updatedAt: now
        });
      }
    }

    return { invoiceId, newStatus };
  }
});
