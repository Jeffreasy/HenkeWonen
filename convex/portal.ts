import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const customerType = v.union(v.literal("private"), v.literal("business"));

const customerContactType = v.union(
  v.literal("note"),
  v.literal("call"),
  v.literal("email"),
  v.literal("visit"),
  v.literal("loaned_item"),
  v.literal("agreement")
);

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

const quoteLineType = v.union(
  v.literal("product"),
  v.literal("service"),
  v.literal("labor"),
  v.literal("material"),
  v.literal("discount"),
  v.literal("text"),
  v.literal("manual")
);

const workflowEventType = v.union(
  v.literal("customer_contact"),
  v.literal("quote_created"),
  v.literal("measurement_requested"),
  v.literal("measurement_planned"),
  v.literal("quote_sent"),
  v.literal("quote_accepted"),
  v.literal("thank_you_letter_sent"),
  v.literal("execution_planned"),
  v.literal("supplier_order_created"),
  v.literal("invoice_created"),
  v.literal("payment_reminder_sent"),
  v.literal("payment_received"),
  v.literal("bookkeeper_export_sent"),
  v.literal("closed")
);

const productListStatus = v.union(
  v.literal("unknown"),
  v.literal("requested"),
  v.literal("received"),
  v.literal("download_available"),
  v.literal("not_available"),
  v.literal("manual_only")
);

async function getTenant(ctx: any, tenantSlug: string): Promise<Doc<"tenants"> | null> {
  return await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q: any) => q.eq("slug", tenantSlug))
    .first();
}

async function requireTenant(ctx: any, tenantSlug: string): Promise<Doc<"tenants">> {
  const tenant = await getTenant(ctx, tenantSlug);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateLineTotals(
  lineType: string,
  quantity: number,
  unitPriceExVat: number,
  vatRate: number,
  discountExVat?: number
) {
  if (lineType === "text") {
    return { lineTotalExVat: 0, lineVatTotal: 0, lineTotalIncVat: 0 };
  }

  const lineTotalExVat = roundMoney(quantity * unitPriceExVat - (discountExVat ?? 0));
  const lineVatTotal = roundMoney(lineTotalExVat * (vatRate / 100));

  return {
    lineTotalExVat,
    lineVatTotal,
    lineTotalIncVat: roundMoney(lineTotalExVat + lineVatTotal)
  };
}

async function recalculateQuote(ctx: any, tenantId: Id<"tenants">, quoteId: Id<"quotes">) {
  const quote = await ctx.db.get(quoteId);

  if (!quote || quote.tenantId !== tenantId) {
    throw new Error("Quote not found");
  }

  const lines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", tenantId).eq("quoteId", quoteId))
    .collect();
  const subtotalExVat = roundMoney(
    lines.reduce((sum: number, line: Doc<"quoteLines">) => sum + line.lineTotalExVat, 0)
  );
  const vatTotal = roundMoney(
    lines.reduce((sum: number, line: Doc<"quoteLines">) => sum + line.lineVatTotal, 0)
  );

  await ctx.db.patch(quoteId, {
    subtotalExVat,
    vatTotal,
    totalIncVat: roundMoney(subtotalExVat + vatTotal),
    updatedAt: Date.now()
  });
}

function toCustomer(tenantSlug: string, customer: Doc<"customers">) {
  return {
    id: String(customer._id),
    tenantId: tenantSlug,
    type: customer.type,
    displayName: customer.displayName,
    email: customer.email,
    phone: customer.phone,
    street: customer.street,
    houseNumber: customer.houseNumber,
    postalCode: customer.postalCode,
    city: customer.city,
    notes: customer.notes,
    status: customer.status,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt
  };
}

function toRoom(room: Doc<"projectRooms">) {
  return {
    id: String(room._id),
    projectId: String(room.projectId),
    name: room.name,
    floor: room.floor,
    widthCm: room.widthCm,
    lengthCm: room.lengthCm,
    areaM2: room.areaM2,
    perimeterMeter: room.perimeterMeter,
    notes: room.notes,
    sortOrder: room.sortOrder
  };
}

async function getRooms(ctx: any, tenantId: Id<"tenants">, projectId: Id<"projects">) {
  const rooms = await ctx.db
    .query("projectRooms")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .collect();

  return rooms.sort((left: Doc<"projectRooms">, right: Doc<"projectRooms">) => {
    return left.sortOrder - right.sortOrder;
  });
}

async function toProject(ctx: any, tenantSlug: string, project: Doc<"projects">) {
  const rooms = await getRooms(ctx, project.tenantId, project._id);

  return {
    id: String(project._id),
    tenantId: tenantSlug,
    customerId: String(project.customerId),
    title: project.title,
    description: project.description,
    status: project.status,
    measurementDate: project.measurementDate,
    executionDate: project.executionDate,
    internalNotes: project.internalNotes,
    customerNotes: project.customerNotes,
    acceptedAt: project.acceptedAt,
    measurementPlannedAt: project.measurementPlannedAt,
    executionPlannedAt: project.executionPlannedAt,
    orderedAt: project.orderedAt,
    invoicedAt: project.invoicedAt,
    paidAt: project.paidAt,
    closedAt: project.closedAt,
    rooms: rooms.map(toRoom),
    createdByExternalUserId: project.createdByExternalUserId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function toContact(tenantSlug: string, contact: Doc<"customerContacts">) {
  return {
    id: String(contact._id),
    tenantId: tenantSlug,
    customerId: String(contact.customerId),
    type: contact.type,
    title: contact.title,
    description: contact.description,
    loanedItemName: contact.loanedItemName,
    expectedReturnDate: contact.expectedReturnDate,
    returnedAt: contact.returnedAt,
    visibleToCustomer: contact.visibleToCustomer,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt
  };
}

function toWorkflowEvent(tenantSlug: string, event: Doc<"projectWorkflowEvents">) {
  return {
    id: String(event._id),
    tenantId: tenantSlug,
    projectId: String(event.projectId),
    type: event.type,
    title: event.title,
    description: event.description,
    visibleToCustomer: event.visibleToCustomer,
    createdAt: event.createdAt
  };
}

function toQuoteLine(line: Doc<"quoteLines">) {
  return {
    id: String(line._id),
    quoteId: String(line.quoteId),
    projectRoomId: line.projectRoomId ? String(line.projectRoomId) : undefined,
    lineType: line.lineType,
    title: line.title,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPriceExVat: line.unitPriceExVat,
    vatRate: line.vatRate,
    discountExVat: line.discountExVat,
    lineTotalExVat: line.lineTotalExVat,
    lineVatTotal: line.lineVatTotal,
    lineTotalIncVat: line.lineTotalIncVat,
    sortOrder: line.sortOrder,
    metadata: line.metadata
  };
}

async function toQuote(ctx: any, tenantSlug: string, quote: Doc<"quotes">) {
  const lines = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", quote.tenantId).eq("quoteId", quote._id))
    .collect();

  return {
    id: String(quote._id),
    tenantId: tenantSlug,
    projectId: String(quote.projectId),
    customerId: String(quote.customerId),
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    status: quote.status,
    validUntil: quote.validUntil,
    introText: quote.introText,
    closingText: quote.closingText,
    terms: quote.terms,
    paymentTerms: quote.paymentTerms,
    subtotalExVat: quote.subtotalExVat,
    vatTotal: quote.vatTotal,
    totalIncVat: quote.totalIncVat,
    lines: lines
      .sort((left: Doc<"quoteLines">, right: Doc<"quoteLines">) => left.sortOrder - right.sortOrder)
      .map(toQuoteLine),
    createdByExternalUserId: quote.createdByExternalUserId,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt
  };
}

function toSupplier(
  tenantSlug: string,
  supplier: Doc<"suppliers">,
  metrics?: {
    activeProductCount?: number;
    importProfileCount?: number;
    importBatchCount?: number;
    sourceFileCount?: number;
    sourceFileNames?: string[];
    latestImportStatus?: string;
    latestImportAt?: number;
  }
) {
  return {
    id: String(supplier._id),
    tenantId: tenantSlug,
    name: supplier.name,
    contactName: supplier.contactName,
    email: supplier.email,
    phone: supplier.phone,
    productListStatus: supplier.productListStatus,
    notes: supplier.notes,
    lastContactAt: supplier.lastContactAt,
    expectedAt: supplier.expectedAt,
    activeProductCount: metrics?.activeProductCount ?? 0,
    importProfileCount: metrics?.importProfileCount ?? 0,
    importBatchCount: metrics?.importBatchCount ?? 0,
    sourceFileCount: metrics?.sourceFileCount ?? 0,
    sourceFileNames: metrics?.sourceFileNames ?? [],
    latestImportStatus: metrics?.latestImportStatus,
    latestImportAt: metrics?.latestImportAt,
    updatedAt: supplier.updatedAt
  };
}

async function findSupplierByName(ctx: any, tenantId: Id<"tenants">, name: string) {
  return await ctx.db
    .query("suppliers")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("name"), name))
    .first();
}

export const dashboard = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await getTenant(ctx, args.tenantSlug);

    if (!tenant) {
      return {
        customerCount: 0,
        activeProjectCount: 0,
        quoteCount: 0,
        catalogCount: 0,
        importStatus: "geen imports",
        projects: []
      };
    }

    const [customers, projects, quotes, products, imports] = await Promise.all([
      ctx.db
        .query("customers")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("quotes")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .collect(),
      ctx.db
        .query("products")
        .withIndex("by_status", (q: any) => q.eq("tenantId", tenant._id).eq("status", "active"))
        .collect(),
      ctx.db
        .query("productImportBatches")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
        .order("desc")
        .collect()
    ]);

    const visibleProjects = await Promise.all(
      projects
        .filter((project: Doc<"projects">) => project.status !== "closed")
        .slice(0, 6)
        .map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
    );

    return {
      customerCount: customers.length,
      activeProjectCount: projects.filter(
        (project: Doc<"projects">) => project.status !== "closed"
      ).length,
      quoteCount: quotes.length,
      catalogCount: products.length,
      importStatus: imports[0]?.status ?? "geen imports",
      projects: visibleProjects
    };
  }
});

export const listCustomers = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .order("desc")
      .collect();

    return customers.map((customer: Doc<"customers">) => toCustomer(tenant.slug, customer));
  }
});

export const createCustomer = mutation({
  args: {
    tenantSlug: v.string(),
    type: customerType,
    displayName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const now = Date.now();

    return await ctx.db.insert("customers", {
      tenantId: tenant._id,
      type: args.type,
      displayName: args.displayName,
      email: args.email,
      phone: args.phone,
      city: args.city,
      country: "Nederland",
      notes: args.notes,
      status: "lead",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const customerDetail = query({
  args: {
    tenantSlug: v.string(),
    customerId: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const customer = await ctx.db.get(args.customerId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      return null;
    }

    const [projects, contacts] = await Promise.all([
      ctx.db
        .query("projects")
        .withIndex("by_customer", (q: any) =>
          q.eq("tenantId", tenant._id).eq("customerId", customer._id)
        )
        .collect(),
      ctx.db
        .query("customerContacts")
        .withIndex("by_customer", (q: any) =>
          q.eq("tenantId", tenant._id).eq("customerId", customer._id)
        )
        .order("desc")
        .collect()
    ]);

    return {
      customer: toCustomer(tenant.slug, customer),
      projects: await Promise.all(
        projects.map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
      ),
      contacts: contacts.map((contact: Doc<"customerContacts">) =>
        toContact(tenant.slug, contact)
      )
    };
  }
});

export const createCustomerContact = mutation({
  args: {
    tenantSlug: v.string(),
    customerId: v.string(),
    type: customerContactType,
    title: v.string(),
    description: v.optional(v.string()),
    loanedItemName: v.optional(v.string()),
    expectedReturnDate: v.optional(v.number()),
    visibleToCustomer: v.boolean(),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const customer = await ctx.db.get(args.customerId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new Error("Customer not found");
    }

    const now = Date.now();

    return await ctx.db.insert("customerContacts", {
      tenantId: tenant._id,
      customerId: customer._id,
      type: args.type,
      title: args.title,
      description: args.description,
      loanedItemName: args.loanedItemName,
      expectedReturnDate: args.expectedReturnDate,
      visibleToCustomer: args.visibleToCustomer,
      createdByExternalUserId: args.createdByExternalUserId,
      createdAt: now,
      updatedAt: now
    });
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

export const createProject = mutation({
  args: {
    tenantSlug: v.string(),
    customerId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
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
      createdByExternalUserId: args.createdByExternalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const projectDetail = query({
  args: {
    tenantSlug: v.string(),
    projectId: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      return null;
    }

    const [customer, workflowEvents] = await Promise.all([
      ctx.db.get(project.customerId),
      ctx.db
        .query("projectWorkflowEvents")
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
        .map((event: Doc<"projectWorkflowEvents">) => toWorkflowEvent(tenant.slug, event))
    };
  }
});

export const addProjectRoom = mutation({
  args: {
    tenantSlug: v.string(),
    projectId: v.string(),
    name: v.string(),
    areaM2: v.optional(v.number()),
    perimeterMeter: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
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

export const updateProjectStatus = mutation({
  args: {
    tenantSlug: v.string(),
    projectId: v.string(),
    status: projectStatus,
    workflowType: v.optional(workflowEventType),
    workflowTitle: v.optional(v.string()),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
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
        createdByExternalUserId: args.createdByExternalUserId,
        createdAt: now
      });
    }

    return project._id;
  }
});

export const createWorkflowEvent = mutation({
  args: {
    tenantSlug: v.string(),
    projectId: v.string(),
    type: workflowEventType,
    title: v.string(),
    description: v.optional(v.string()),
    visibleToCustomer: v.boolean(),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
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
      createdByExternalUserId: args.createdByExternalUserId,
      createdAt: Date.now()
    });
  }
});

export const listQuotesWorkspace = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
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
        .map((template: Doc<"quoteTemplates">) => ({
          id: String(template._id),
          tenantId: tenant.slug,
          name: template.name,
          type: template.type,
          introText: template.introText,
          closingText: template.closingText,
          sections: template.sections,
          defaultTerms: template.defaultTerms,
          paymentTerms: template.paymentTerms ?? [],
          defaultLines: template.defaultLines
        }))
    };
  }
});

export const createQuote = mutation({
  args: {
    tenantSlug: v.string(),
    projectId: v.string(),
    title: v.string(),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const project = await ctx.db.get(args.projectId as Id<"projects">);

    if (!project || project.tenantId !== tenant._id) {
      throw new Error("Project not found");
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
      customerId: project.customerId,
      quoteNumber: `OFF-${new Date(now).getFullYear()}-${now}`,
      title: args.title,
      status: "draft",
      introText: template?.introText,
      closingText: template?.closingText,
      terms: template?.defaultTerms ?? [],
      paymentTerms: template?.paymentTerms ?? [],
      subtotalExVat: 0,
      vatTotal: 0,
      totalIncVat: 0,
      createdByExternalUserId: args.createdByExternalUserId,
      createdAt: now,
      updatedAt: now
    });

    await ctx.db.patch(project._id, {
      status: "quote_draft",
      updatedAt: now
    });
    await ctx.db.insert("projectWorkflowEvents", {
      tenantId: tenant._id,
      projectId: project._id,
      type: "quote_created",
      title: "Offerte aangemaakt",
      visibleToCustomer: false,
      createdByExternalUserId: args.createdByExternalUserId,
      createdAt: now
    });

    return quoteId;
  }
});

export const addQuoteLine = mutation({
  args: {
    tenantSlug: v.string(),
    quoteId: v.string(),
    projectRoomId: v.optional(v.string()),
    lineType: quoteLineType,
    title: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    unitPriceExVat: v.number(),
    vatRate: v.number(),
    discountExVat: v.optional(v.number()),
    sortOrder: v.number(),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new Error("Quote not found");
    }

    const projectRoomId = args.projectRoomId
      ? (args.projectRoomId as Id<"projectRooms">)
      : undefined;

    if (projectRoomId) {
      const projectRoom = await ctx.db.get(projectRoomId);

      if (
        !projectRoom ||
        projectRoom.tenantId !== tenant._id ||
        projectRoom.projectId !== quote.projectId
      ) {
        throw new Error("Project room not found");
      }
    }

    const totals = calculateLineTotals(
      args.lineType,
      args.quantity,
      args.unitPriceExVat,
      args.vatRate,
      args.discountExVat
    );
    const now = Date.now();
    const lineId = await ctx.db.insert("quoteLines", {
      tenantId: tenant._id,
      quoteId: quote._id,
      projectRoomId,
      lineType: args.lineType,
      title: args.title,
      description: args.description,
      quantity: args.quantity,
      unit: args.unit,
      unitPriceExVat: args.unitPriceExVat,
      vatRate: args.vatRate,
      discountExVat: args.discountExVat,
      lineTotalExVat: totals.lineTotalExVat,
      lineVatTotal: totals.lineVatTotal,
      lineTotalIncVat: totals.lineTotalIncVat,
      sortOrder: args.sortOrder,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now
    });

    await recalculateQuote(ctx, tenant._id, quote._id);

    return lineId;
  }
});

export const deleteQuoteLine = mutation({
  args: {
    tenantSlug: v.string(),
    lineId: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const line = await ctx.db.get(args.lineId as Id<"quoteLines">);

    if (!line || line.tenantId !== tenant._id) {
      throw new Error("Quote line not found");
    }

    await ctx.db.delete(line._id);
    await recalculateQuote(ctx, tenant._id, line.quoteId);

    return line._id;
  }
});

export const updateQuoteTerms = mutation({
  args: {
    tenantSlug: v.string(),
    quoteId: v.string(),
    terms: v.array(v.string()),
    paymentTerms: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const quote = await ctx.db.get(args.quoteId as Id<"quotes">);

    if (!quote || quote.tenantId !== tenant._id) {
      throw new Error("Quote not found");
    }

    await ctx.db.patch(quote._id, {
      terms: args.terms,
      paymentTerms: args.paymentTerms ?? [],
      updatedAt: Date.now()
    });

    return quote._id;
  }
});

export const listSuppliers = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    const profiles = await ctx.db
      .query("importProfiles")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    const supplierMetrics = new Map<string, {
      activeProductCount: number;
      importProfileCount: number;
      importBatchCount: number;
      sourceFileCount: number;
      sourceFileNames: string[];
      latestImportStatus?: string;
      latestImportAt?: number;
    }>();

    await Promise.all(
      suppliers.map(async (supplier: Doc<"suppliers">) => {
        const [products, batches, priceLists] = await Promise.all([
          ctx.db
            .query("products")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
            )
            .collect(),
          ctx.db
            .query("productImportBatches")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
            )
            .order("desc")
            .collect(),
          ctx.db
            .query("priceLists")
            .withIndex("by_supplier", (q: any) =>
              q.eq("tenantId", tenant._id).eq("supplierId", supplier._id)
            )
            .collect()
        ]);

        const importProfileCount = profiles.filter(
          (profile: Doc<"importProfiles">) =>
            profile.status === "active" &&
            (String(profile.supplierId ?? "") === String(supplier._id) ||
              profile.supplierName === supplier.name)
        ).length;
        const latestBatch = batches[0];
        const sourceFileNames = Array.from(
          new Set(
            [
              ...priceLists.map((priceList: Doc<"priceLists">) => priceList.sourceFileName),
              ...batches.map(
                (batch: Doc<"productImportBatches">) => batch.sourceFileName ?? batch.fileName
              )
            ].filter(Boolean)
          )
        ).sort((left, right) => left.localeCompare(right, "nl"));

        supplierMetrics.set(String(supplier._id), {
          activeProductCount: products.filter((product: Doc<"products">) => product.status === "active")
            .length,
          importProfileCount,
          importBatchCount: batches.length,
          sourceFileCount: sourceFileNames.length,
          sourceFileNames,
          latestImportStatus: latestBatch?.status,
          latestImportAt: latestBatch?.committedAt ?? latestBatch?.importedAt ?? latestBatch?.createdAt
        });
      })
    );

    return suppliers
      .sort((left: Doc<"suppliers">, right: Doc<"suppliers">) =>
        left.name.localeCompare(right.name, "nl")
      )
      .map((supplier: Doc<"suppliers">) =>
        toSupplier(tenant.slug, supplier, supplierMetrics.get(String(supplier._id)))
      );
  }
});

export const createSupplier = mutation({
  args: {
    tenantSlug: v.string(),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    productListStatus: v.optional(productListStatus),
    lastContactAt: v.optional(v.number()),
    expectedAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const existing = await findSupplierByName(ctx, tenant._id, args.name);

    if (existing) {
      return existing._id;
    }

    const now = Date.now();

    return await ctx.db.insert("suppliers", {
      tenantId: tenant._id,
      name: args.name,
      contactName: args.contactName,
      email: args.email,
      phone: args.phone,
      notes: args.notes,
      productListStatus: args.productListStatus ?? "unknown",
      lastContactAt: args.lastContactAt,
      expectedAt: args.expectedAt,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateSupplierProductListStatus = mutation({
  args: {
    tenantSlug: v.string(),
    supplierId: v.string(),
    productListStatus
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const supplier = await ctx.db.get(args.supplierId as Id<"suppliers">);

    if (!supplier || supplier.tenantId !== tenant._id) {
      throw new Error("Supplier not found");
    }

    await ctx.db.patch(supplier._id, {
      productListStatus: args.productListStatus,
      updatedAt: Date.now()
    });

    return supplier._id;
  }
});

export const listQuoteTemplates = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const templates = await ctx.db
      .query("quoteTemplates")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return templates.map((template: Doc<"quoteTemplates">) => ({
      id: String(template._id),
      tenantId: tenant.slug,
      name: template.name,
      type: template.type,
      status: template.status,
      introText: template.introText,
      closingText: template.closingText,
      sections: template.sections ?? [],
      defaultTerms: template.defaultTerms,
      paymentTerms: template.paymentTerms ?? [],
      defaultLines: template.defaultLines
    }));
  }
});

export const updateQuoteTemplateContent = mutation({
  args: {
    tenantSlug: v.string(),
    templateId: v.string(),
    defaultTerms: v.array(v.string()),
    paymentTerms: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const template = await ctx.db.get(args.templateId as Id<"quoteTemplates">);

    if (!template || template.tenantId !== tenant._id) {
      throw new Error("Quote template not found");
    }

    await ctx.db.patch(template._id, {
      defaultTerms: args.defaultTerms,
      paymentTerms: args.paymentTerms ?? [],
      updatedAt: Date.now()
    });

    return template._id;
  }
});

export const listCategories = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return categories
      .sort((left: Doc<"categories">, right: Doc<"categories">) => left.sortOrder - right.sortOrder)
      .map((category: Doc<"categories">) => ({
        id: String(category._id),
        tenantId: tenant.slug,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        status: category.status
      }));
  }
});

export const listServiceRules = query({
  args: {
    tenantSlug: v.string()
  },
  handler: async (ctx, args) => {
    const tenant = await requireTenant(ctx, args.tenantSlug);
    const rules = await ctx.db
      .query("serviceCostRules")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
      .collect();

    return rules
      .sort((left: Doc<"serviceCostRules">, right: Doc<"serviceCostRules">) =>
        left.name.localeCompare(right.name, "nl")
      )
      .map((rule: Doc<"serviceCostRules">) => ({
        id: String(rule._id),
        tenantId: tenant.slug,
        name: rule.name,
        description: rule.description,
        calculationType: rule.calculationType,
        priceExVat: rule.priceExVat,
        vatRate: rule.vatRate,
        status: rule.status
      }));
  }
});
