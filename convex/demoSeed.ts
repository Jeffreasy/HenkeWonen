import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const tenantSlug = "henke-wonen";
const nowUser = "demo-seed";

function now() {
  return Date.now();
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

async function ensureTenant(ctx: any): Promise<Id<"tenants">> {
  const existing = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q: any) => q.eq("slug", tenantSlug))
    .first();

  if (existing) {
    return existing._id;
  }

  const timestamp = now();

  return await ctx.db.insert("tenants", {
    slug: tenantSlug,
    name: "Henke Wonen",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function findCustomer(ctx: any, tenantId: Id<"tenants">, displayName: string) {
  return await ctx.db
    .query("customers")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("displayName"), displayName))
    .first();
}

async function ensureCustomer(
  ctx: any,
  tenantId: Id<"tenants">,
  customer: {
    type: "private" | "business";
    displayName: string;
    email?: string;
    phone?: string;
    city?: string;
    status: "lead" | "active";
    notes?: string;
  }
) {
  const existing = await findCustomer(ctx, tenantId, customer.displayName);
  const timestamp = now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      type: customer.type,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      status: customer.status,
      notes: customer.notes,
      updatedAt: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("customers", {
    tenantId,
    type: customer.type,
    displayName: customer.displayName,
    email: customer.email,
    phone: customer.phone,
    city: customer.city,
    country: "Nederland",
    notes: customer.notes,
    status: customer.status,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function findProject(ctx: any, tenantId: Id<"tenants">, title: string) {
  return await ctx.db
    .query("projects")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .filter((q: any) => q.eq(q.field("title"), title))
    .first();
}

async function ensureProject(
  ctx: any,
  tenantId: Id<"tenants">,
  project: {
    customerId: Id<"customers">;
    title: string;
    description: string;
    status:
      | "lead"
      | "quote_draft"
      | "quote_sent"
      | "quote_accepted"
      | "measurement_planned"
      | "execution_planned"
      | "ordering"
      | "invoiced";
    internalNotes?: string;
    customerNotes?: string;
  }
) {
  const existing = await findProject(ctx, tenantId, project.title);
  const timestamp = now();
  const statusDates = {
    acceptedAt: project.status === "quote_accepted" ? timestamp : undefined,
    measurementPlannedAt: project.status === "measurement_planned" ? timestamp : undefined,
    executionPlannedAt: project.status === "execution_planned" ? timestamp : undefined,
    orderedAt: project.status === "ordering" ? timestamp : undefined,
    invoicedAt: project.status === "invoiced" ? timestamp : undefined
  };

  if (existing) {
    await ctx.db.patch(existing._id, {
      customerId: project.customerId,
      title: project.title,
      description: project.description,
      status: project.status,
      internalNotes: project.internalNotes,
      customerNotes: project.customerNotes,
      ...statusDates,
      updatedAt: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("projects", {
    tenantId,
    customerId: project.customerId,
    title: project.title,
    description: project.description,
    status: project.status,
    internalNotes: project.internalNotes,
    customerNotes: project.customerNotes,
    createdByExternalUserId: nowUser,
    ...statusDates,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function ensureRoom(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  room: { name: string; areaM2?: number; perimeterMeter?: number; sortOrder: number }
) {
  const existing = await ctx.db
    .query("projectRooms")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .filter((q: any) => q.eq(q.field("name"), room.name))
    .first();
  const timestamp = now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      areaM2: room.areaM2,
      perimeterMeter: room.perimeterMeter,
      sortOrder: room.sortOrder,
      updatedAt: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("projectRooms", {
    tenantId,
    projectId,
    name: room.name,
    areaM2: room.areaM2,
    perimeterMeter: room.perimeterMeter,
    sortOrder: room.sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function ensureContact(
  ctx: any,
  tenantId: Id<"tenants">,
  customerId: Id<"customers">,
  contact: {
    type: "note" | "call" | "email" | "visit" | "loaned_item" | "agreement";
    title: string;
    description?: string;
    loanedItemName?: string;
    expectedReturnDate?: number;
    returnedAt?: number;
    visibleToCustomer: boolean;
  }
) {
  const existing = await ctx.db
    .query("customerContacts")
    .withIndex("by_customer", (q: any) => q.eq("tenantId", tenantId).eq("customerId", customerId))
    .filter((q: any) => q.eq(q.field("title"), contact.title))
    .first();
  const timestamp = now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      description: contact.description,
      loanedItemName: contact.loanedItemName,
      expectedReturnDate: contact.expectedReturnDate,
      returnedAt: contact.returnedAt,
      visibleToCustomer: contact.visibleToCustomer,
      updatedAt: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("customerContacts", {
    tenantId,
    customerId,
    type: contact.type,
    title: contact.title,
    description: contact.description,
    loanedItemName: contact.loanedItemName,
    expectedReturnDate: contact.expectedReturnDate,
    returnedAt: contact.returnedAt,
    visibleToCustomer: contact.visibleToCustomer,
    createdByExternalUserId: nowUser,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function ensureWorkflowEvent(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  event: {
    type:
      | "customer_contact"
      | "quote_created"
      | "measurement_requested"
      | "measurement_planned"
      | "quote_sent"
      | "quote_accepted"
      | "execution_planned"
      | "supplier_order_created"
      | "invoice_created";
    title: string;
    description?: string;
    visibleToCustomer: boolean;
  }
) {
  const existing = await ctx.db
    .query("projectWorkflowEvents")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .filter((q: any) => q.eq(q.field("title"), event.title))
    .first();
  const timestamp = now();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("projectWorkflowEvents", {
    tenantId,
    projectId,
    type: event.type,
    title: event.title,
    description: event.description,
    visibleToCustomer: event.visibleToCustomer,
    createdByExternalUserId: nowUser,
    createdAt: timestamp
  });
}

async function findQuote(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  title: string
) {
  return await ctx.db
    .query("quotes")
    .withIndex("by_project", (q: any) => q.eq("tenantId", tenantId).eq("projectId", projectId))
    .filter((q: any) => q.eq(q.field("title"), title))
    .first();
}

async function ensureQuote(
  ctx: any,
  tenantId: Id<"tenants">,
  projectId: Id<"projects">,
  customerId: Id<"customers">,
  quote: {
    quoteNumber: string;
    title: string;
    status: "draft" | "accepted";
  }
) {
  const existing = await findQuote(ctx, tenantId, projectId, quote.title);
  const timestamp = now();
  const terms = [
    "Prijzen zijn inclusief 21% btw.",
    "De te leggen ruimtes dienen volledig leeg te zijn bij aanvang van de werkzaamheden.",
    "Water en stroom zijn beschikbaar.",
    "Bij overschrijving hanteert Henke Wonen een betalingstermijn van 8 dagen."
  ];

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: quote.status,
      terms,
      acceptedAt: quote.status === "accepted" ? timestamp : existing.acceptedAt,
      updatedAt: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("quotes", {
    tenantId,
    projectId,
    customerId,
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    status: quote.status,
    introText: "Hartelijk dank voor uw bezoek aan Henke Wonen. Hieronder vindt u onze offerte.",
    closingText: "Wij horen graag of alles naar wens is.",
    terms,
    subtotalExVat: 0,
    vatTotal: 0,
    totalIncVat: 0,
    acceptedAt: quote.status === "accepted" ? timestamp : undefined,
    createdByExternalUserId: nowUser,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function ensureQuoteLine(
  ctx: any,
  tenantId: Id<"tenants">,
  quoteId: Id<"quotes">,
  line: {
    lineType: "product" | "service" | "labor" | "material" | "discount" | "text" | "manual";
    title: string;
    quantity: number;
    unit: string;
    unitPriceExVat: number;
    vatRate: number;
    discountExVat?: number;
    sortOrder: number;
  }
) {
  const existing = await ctx.db
    .query("quoteLines")
    .withIndex("by_quote", (q: any) => q.eq("tenantId", tenantId).eq("quoteId", quoteId))
    .filter((q: any) => q.eq(q.field("title"), line.title))
    .first();
  const totals = calculateLineTotals(
    line.lineType,
    line.quantity,
    line.unitPriceExVat,
    line.vatRate,
    line.discountExVat
  );
  const timestamp = now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...line,
      ...totals,
      updatedAt: timestamp
    });

    return existing._id;
  }

  return await ctx.db.insert("quoteLines", {
    tenantId,
    quoteId,
    ...line,
    ...totals,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function recalculateQuote(ctx: any, tenantId: Id<"tenants">, quoteId: Id<"quotes">) {
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
    updatedAt: now()
  });
}

export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const timestamp = now();
    const tenantId = await ensureTenant(ctx);

    const privateCustomerId = await ensureCustomer(ctx, tenantId, {
      type: "private",
      displayName: "Demo - Familie De Vries",
      email: "familie.devries@example.test",
      phone: "06-12345678",
      city: "Swifterbant",
      status: "active",
      notes: "Zoekt rustige PVC vloer voor benedenverdieping. Interne demo-data voor UX QA."
    });
    const businessCustomerId = await ensureCustomer(ctx, tenantId, {
      type: "business",
      displayName: "Demo - Zorgpraktijk De Linde",
      email: "info@delinde.example.test",
      phone: "0321-555010",
      city: "Dronten",
      status: "active",
      notes: "Zakelijke klant met wachtruimte en behandelkamer."
    });
    const leadCustomerId = await ensureCustomer(ctx, tenantId, {
      type: "private",
      displayName: "Demo - Mevrouw Jansen",
      email: "m.jansen@example.test",
      phone: "06-87654321",
      city: "Lelystad",
      status: "lead",
      notes: "Oriënteert op traprenovatie en raamdecoratie."
    });

    await ensureContact(ctx, tenantId, privateCustomerId, {
      type: "call",
      title: "Telefoongesprek over PVC beneden",
      description: "Klant wil offerte voor woonkamer, keuken en hal.",
      visibleToCustomer: false
    });
    await ensureContact(ctx, tenantId, privateCustomerId, {
      type: "visit",
      title: "Winkelbezoek met stalen",
      description: "Ambiant/Floorlife stalen bekeken in winkel.",
      visibleToCustomer: false
    });
    await ensureContact(ctx, tenantId, privateCustomerId, {
      type: "loaned_item",
      title: "PVC stalenmap meegegeven",
      loanedItemName: "Stalenmap PVC warm eiken",
      expectedReturnDate: timestamp + 7 * 24 * 60 * 60 * 1000,
      visibleToCustomer: false
    });
    await ensureContact(ctx, tenantId, businessCustomerId, {
      type: "agreement",
      title: "Afspraak inmeten praktijkruimte",
      description: "Wachtruimte en behandelkamer moeten apart worden opgenomen.",
      visibleToCustomer: false
    });
    await ensureContact(ctx, tenantId, leadCustomerId, {
      type: "note",
      title: "Lead traprenovatie",
      description: "Wil prijsindicatie voor rechte trap en open trap toeslag.",
      visibleToCustomer: false
    });

    const pvcProjectId = await ensureProject(ctx, tenantId, {
      customerId: privateCustomerId,
      title: "Demo - PVC benedenverdieping",
      description: "Woonkamer, keuken en hal in PVC dryback met egaliseren.",
      status: "quote_draft",
      internalNotes: "Let op bestaande plavuizen en droogtijd egalisatie.",
      customerNotes: "Ruimtes moeten leeg zijn bij aanvang werkzaamheden."
    });
    const measurementProjectId = await ensureProject(ctx, tenantId, {
      customerId: businessCustomerId,
      title: "Demo - Praktijkruimte vloer en plinten",
      description: "Inmeten voor projectvloer, plinten en entreezone.",
      status: "measurement_planned",
      internalNotes: "Inmeting plannen buiten spreekuren.",
      customerNotes: "Wachtruimte blijft toegankelijk tot uitvoering."
    });
    const executionProjectId = await ensureProject(ctx, tenantId, {
      customerId: leadCustomerId,
      title: "Demo - Traprenovatie en raamdecoratie",
      description: "Traprenovatie PVC met plissé raamdecoratie.",
      status: "execution_planned",
      internalNotes: "Controleer kleur strip bij akkoord.",
      customerNotes: "Uitvoering in overleg met klant."
    });

    await ensureRoom(ctx, tenantId, pvcProjectId, {
      name: "Woonkamer",
      areaM2: 36.5,
      perimeterMeter: 25.8,
      sortOrder: 1
    });
    await ensureRoom(ctx, tenantId, pvcProjectId, {
      name: "Hal",
      areaM2: 8.2,
      perimeterMeter: 13.4,
      sortOrder: 2
    });
    await ensureRoom(ctx, tenantId, executionProjectId, {
      name: "Trap",
      areaM2: 0,
      perimeterMeter: 0,
      sortOrder: 1
    });

    await ensureWorkflowEvent(ctx, tenantId, pvcProjectId, {
      type: "quote_created",
      title: "Offerte aangemaakt",
      description: "Conceptofferte voor PVC benedenverdieping.",
      visibleToCustomer: false
    });
    await ensureWorkflowEvent(ctx, tenantId, measurementProjectId, {
      type: "measurement_planned",
      title: "Inmeting gepland",
      description: "Wim meet praktijkruimte in.",
      visibleToCustomer: false
    });
    await ensureWorkflowEvent(ctx, tenantId, executionProjectId, {
      type: "customer_contact",
      title: "Klantvraag over stripkleur",
      description: "Klant vraagt of zwarte strip mogelijk is.",
      visibleToCustomer: false
    });
    await ensureWorkflowEvent(ctx, tenantId, executionProjectId, {
      type: "execution_planned",
      title: "Uitvoering ingepland",
      description: "Traprenovatie en raamdecoratie staan ingepland.",
      visibleToCustomer: false
    });

    const draftQuoteId = await ensureQuote(ctx, tenantId, pvcProjectId, privateCustomerId, {
      quoteNumber: "DEMO-OFF-2026-001",
      title: "Demo - Conceptofferte PVC beneden",
      status: "draft"
    });
    const acceptedQuoteId = await ensureQuote(ctx, tenantId, executionProjectId, leadCustomerId, {
      quoteNumber: "DEMO-OFF-2026-002",
      title: "Demo - Geaccepteerde offerte trap en raamdecoratie",
      status: "accepted"
    });

    const draftLines = [
      {
        lineType: "product" as const,
        title: "PVC dryback warm eiken geleverd incl. snijverlies",
        quantity: 45,
        unit: "m2",
        unitPriceExVat: 28.95,
        vatRate: 21,
        sortOrder: 1
      },
      {
        lineType: "material" as const,
        title: "Zwevende zelfklevende ondervloer tbv PVC",
        quantity: 45,
        unit: "m2",
        unitPriceExVat: 9.95,
        vatRate: 21,
        sortOrder: 2
      },
      {
        lineType: "service" as const,
        title: "Primeren en egaliseren",
        quantity: 45,
        unit: "m2",
        unitPriceExVat: 15.95,
        vatRate: 21,
        sortOrder: 3
      },
      {
        lineType: "labor" as const,
        title: "Legkosten PVC rechte plank",
        quantity: 45,
        unit: "m2",
        unitPriceExVat: 17.5,
        vatRate: 21,
        sortOrder: 4
      },
      {
        lineType: "discount" as const,
        title: "Afrondingskorting",
        quantity: 1,
        unit: "stuk",
        unitPriceExVat: 0,
        vatRate: 21,
        discountExVat: 75,
        sortOrder: 5
      },
      {
        lineType: "text" as const,
        title: "Ruimtes dienen leeg te zijn bij aanvang werkzaamheden.",
        quantity: 0,
        unit: "tekst",
        unitPriceExVat: 0,
        vatRate: 0,
        sortOrder: 6
      }
    ];
    const acceptedLines = [
      {
        lineType: "manual" as const,
        title: "PVC trap rechte trap vaste prijs",
        quantity: 1,
        unit: "trap",
        unitPriceExVat: 1595,
        vatRate: 21,
        sortOrder: 1
      },
      {
        lineType: "product" as const,
        title: "Plissé raamdecoratie woonkamer",
        quantity: 2,
        unit: "stuk",
        unitPriceExVat: 245,
        vatRate: 21,
        sortOrder: 2
      },
      {
        lineType: "labor" as const,
        title: "Montage raamdecoratie",
        quantity: 2,
        unit: "stuk",
        unitPriceExVat: 55,
        vatRate: 21,
        sortOrder: 3
      }
    ];

    for (const line of draftLines) {
      await ensureQuoteLine(ctx, tenantId, draftQuoteId, line);
    }
    for (const line of acceptedLines) {
      await ensureQuoteLine(ctx, tenantId, acceptedQuoteId, line);
    }
    await recalculateQuote(ctx, tenantId, draftQuoteId);
    await recalculateQuote(ctx, tenantId, acceptedQuoteId);

    return {
      tenantSlug,
      customers: {
        privateCustomerId,
        businessCustomerId,
        leadCustomerId
      },
      projects: {
        pvcProjectId,
        measurementProjectId,
        executionProjectId
      },
      quotes: {
        draftQuoteId,
        acceptedQuoteId
      }
    };
  }
});
