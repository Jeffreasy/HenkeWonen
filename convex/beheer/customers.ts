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
  toCustomer,
  toContact,
  toProject,
  toDossierAttachment,
  customerType,
  customerStatus,
  customerContactType
} from "../portalUtils";


export const list = query({
  args: {
    tenantId: v.id("tenants"),
    actor: readActorValidator,
    status: v.optional(customerStatus)
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
        .query("customers")
        .withIndex("by_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("customers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();
  }
});

export const get = query({
  args: {
    tenantId: v.id("tenants"),
    klantId: v.id("customers"),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    await requireQueryRoleForTenantId(ctx, args.tenantId, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    const customer = await ctx.db.get(args.klantId);

    if (!customer || customer.tenantId !== args.tenantId) {
      return null;
    }

    return customer;
  }
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    type: v.union(v.literal("private"), v.literal("business")),
    weergaveNaam: v.string(),
    voornaam: v.optional(v.string()),
    achternaam: v.optional(v.string()),
    bedrijfsnaam: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    straat: v.optional(v.string()),
    huisnummer: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
    land: v.optional(v.string()),
    notities: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const now = Date.now();

    return await ctx.db.insert("customers", {
      tenantId: args.tenantId,
      type: args.type,
      weergaveNaam: args.weergaveNaam,
      voornaam: args.voornaam,
      achternaam: args.achternaam,
      bedrijfsnaam: args.bedrijfsnaam,
      email: args.email,
      telefoon: args.telefoon,
      straat: args.straat,
      huisnummer: args.huisnummer,
      postcode: args.postcode,
      plaats: args.plaats,
      land: args.land ?? "Nederland",
      notities: args.notities,
      status: "lead",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const updateStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    klantId: v.id("customers"),
    status: customerStatus
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const customer = await ctx.db.get(args.klantId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new ConvexError("Klant niet gevonden.");
    }

    await ctx.db.patch(args.klantId, {
      status: args.status,
      gewijzigdOp: Date.now()
    });

    return args.klantId;
  }
});

export const listContacts = query({
  args: {
    tenantId: v.id("tenants"),
    klantId: v.id("customers"),
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
      .query("customerContacts")
      .withIndex("by_customer", (q) =>
        q.eq("tenantId", args.tenantId).eq("klantId", args.klantId)
      )
      .order("desc")
      .collect();
  }
});

export const createContact = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    klantId: v.id("customers"),
    type: v.union(
      v.literal("note"),
      v.literal("call"),
      v.literal("email"),
      v.literal("visit"),
      v.literal("loaned_item"),
      v.literal("agreement")
    ),
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    uitgeleendItemNaam: v.optional(v.string()),
    verwachteRetourdatum: v.optional(v.number()),
    zichtbaarVoorKlant: v.boolean(),
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

    return await ctx.db.insert("customerContacts", {
      tenantId: args.tenantId,
      klantId: args.klantId,
      type: args.type,
      titel: args.titel,
      omschrijving: args.omschrijving,
      uitgeleendItemNaam: args.uitgeleendItemNaam,
      verwachteRetourdatum: args.verwachteRetourdatum,
      zichtbaarVoorKlant: args.zichtbaarVoorKlant,
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const markLoanedItemReturned = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    contactId: v.id("customerContacts")
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const contact = await ctx.db.get(args.contactId);

    if (!contact || contact.tenantId !== args.tenantId) {
      throw new ConvexError("Contactmoment niet gevonden.");
    }

    await ctx.db.patch(args.contactId, {
      geretourneerdOp: Date.now(),
      gewijzigdOp: Date.now()
    });

    return args.contactId;
  }
});

export const listCustomers = query({
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
    actor: mutationActorValidator,
    type: customerType,
    weergaveNaam: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    straat: v.optional(v.string()),
    huisnummer: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
    notities: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const now = Date.now();

    return await ctx.db.insert("customers", {
      tenantId: tenant._id,
      type: args.type,
      weergaveNaam: args.weergaveNaam,
      email: args.email,
      telefoon: args.telefoon,
      straat: args.straat,
      huisnummer: args.huisnummer,
      postcode: args.postcode,
      plaats: args.plaats,
      land: "Nederland",
      notities: args.notities,
      status: "lead",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

export const updateCustomer = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    klantId: v.string(),
    type: v.optional(customerType),
    weergaveNaam: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    straat: v.optional(v.string()),
    huisnummer: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
    notities: v.optional(v.string()),
    status: v.optional(customerStatus)
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const customer = await ctx.db.get(args.klantId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new ConvexError("Klant niet gevonden.");
    }

    const patch: Partial<Doc<"customers">> = { gewijzigdOp: Date.now() };

    if (args.type !== undefined) patch.type = args.type;
    if (args.weergaveNaam !== undefined) patch.weergaveNaam = args.weergaveNaam;
    const hasArg = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
    if (hasArg(args, "email")) patch.email = args.email;
    if (hasArg(args, "telefoon")) patch.telefoon = args.telefoon;
    if (hasArg(args, "straat")) patch.straat = args.straat;
    if (hasArg(args, "huisnummer")) patch.huisnummer = args.huisnummer;
    if (hasArg(args, "postcode")) patch.postcode = args.postcode;
    if (hasArg(args, "plaats")) patch.plaats = args.plaats;
    if (hasArg(args, "notities")) patch.notities = args.notities;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(customer._id, patch);

    return customer._id;
  }
});

export const customerDetail = query({
  args: {
    tenantSlug: v.string(),
    klantId: v.string(),
    actor: readActorValidator
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);
    const customer = await ctx.db.get(args.klantId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      return null;
    }

    const [projects, contacts, attachments] = await Promise.all([
      ctx.db
        .query("projects")
        .withIndex("by_customer", (q: any) =>
          q.eq("tenantId", tenant._id).eq("klantId", customer._id)
        )
        .collect(),
      ctx.db
        .query("customerContacts")
        .withIndex("by_customer", (q: any) =>
          q.eq("tenantId", tenant._id).eq("klantId", customer._id)
        )
        .order("desc")
        .collect(),
      ctx.db
        .query("dossierAttachments")
        .withIndex("by_customer", (q: any) =>
          q.eq("tenantId", tenant._id).eq("klantId", customer._id)
        )
        .order("desc")
        .collect()
    ]);

    const activeAttachments = attachments.filter(
      (attachment: Doc<"dossierAttachments">) => attachment.status === "active"
    );

    return {
      customer: toCustomer(tenant.slug, customer),
      projects: await Promise.all(
        projects.map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
      ),
      contacts: contacts.map((contact: Doc<"customerContacts">) =>
        toContact(tenant.slug, contact)
      ),
      attachments: await Promise.all(
        activeAttachments.map((attachment: Doc<"dossierAttachments">) =>
          toDossierAttachment(ctx, tenant.slug, attachment)
        )
      )
    };
  }
});

export const createCustomerContact = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    klantId: v.string(),
    type: customerContactType,
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    uitgeleendItemNaam: v.optional(v.string()),
    verwachteRetourdatum: v.optional(v.number()),
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
    const customer = await ctx.db.get(args.klantId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new ConvexError("Klant niet gevonden.");
    }

    const now = Date.now();

    return await ctx.db.insert("customerContacts", {
      tenantId: tenant._id,
      klantId: customer._id,
      type: args.type,
      titel: args.titel,
      omschrijving: args.omschrijving,
      uitgeleendItemNaam: args.uitgeleendItemNaam,
      verwachteRetourdatum: args.verwachteRetourdatum,
      zichtbaarVoorKlant: args.zichtbaarVoorKlant,
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

/**
 * AVG — recht op vergetelheid: verwijdert of anonimiseert een klant met álle gekoppelde
 * gegevens. Admin-only + dubbele bevestiging (`bevestigNaam` moet exact de klantnaam zijn,
 * náást de bevestigingsmodal in de UI).
 *
 * Altijd hard verwijderd (persoonsgegevens zonder bewaarplicht):
 *   dossierstukken (incl. de fysieke bestanden in storage), contactmomenten, inmetingen
 *   (+ruimtes/regels), projecttaken, workflow-events, tijdlijnitems, ruimtes, en
 *   leveranciersbestellingen (+regels). Inmetingen zijn tevens de agenda-items van de klant.
 *
 * Facturen bepalen de uitkomst (wettelijke bewaarplicht 7 jaar):
 *   - GEEN facturen  → alles wordt verwijderd, inclusief de klant zelf (`mode: "deleted"`).
 *   - WÉL facturen   → de facturen blijven staan mét de projecten/offertes die ze onderbouwen
 *     (vrije-tekstvelden daarop worden geschoond); de klant wordt een minimale stub:
 *     naam + adres blijven (verschijnen op de factuur), e-mail/telefoon/notities worden gewist,
 *     status → "archived" en `geanonimiseerdOp` wordt gezet (`mode: "anonymized"`). Projecten/
 *     offertes zónder factuur worden ook dan verwijderd.
 *
 * Per-klant volume is klein (enkele projecten/offertes/regels), dus dit past in één mutation.
 */
export const deleteCustomer = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    klantId: v.string(),
    /** Dubbele bevestiging: moet exact gelijk zijn aan de weergavenaam van de klant. */
    bevestigNaam: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["admin"]
    );

    const customerId = ctx.db.normalizeId("customers", args.klantId);
    if (!customerId) {
      throw new ConvexError("Klant niet gevonden.");
    }
    const customer = await ctx.db.get(customerId);
    if (!customer || customer.tenantId !== tenant._id) {
      throw new ConvexError("Klant niet gevonden.");
    }

    // Dubbele bevestiging (server-side): de getypte naam moet exact matchen. Voorkomt dat
    // een verkeerd doorgegeven id de verkeerde klant wist.
    if (args.bevestigNaam.trim() !== customer.weergaveNaam.trim()) {
      throw new ConvexError(
        "Bevestiging klopt niet: typ de klantnaam exact over om te bevestigen."
      );
    }

    const now = Date.now();
    const counts: Record<string, number> = {};
    const bump = (key: string, n = 1) => {
      counts[key] = (counts[key] ?? 0) + n;
    };

    // Facturen bepalen verwijderen vs. anonimiseren (7 jaar bewaarplicht).
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_customer", (q: any) => q.eq("tenantId", tenant._id).eq("klantId", customerId))
      .collect();
    const hasInvoices = invoices.length > 0;
    const invoicedProjectIds = new Set(invoices.map((inv: Doc<"invoices">) => String(inv.projectId)));

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_customer", (q: any) => q.eq("tenantId", tenant._id).eq("klantId", customerId))
      .collect();

    for (const project of projects) {
      // Een project met factuur onderbouwt die factuur → behouden (geschoond). Overige weg.
      const keepProject = hasInvoices && invoicedProjectIds.has(String(project._id));

      // Inmetingen (= agenda-items) + ruimtes + regels — altijd weg.
      const measurements = await ctx.db
        .query("measurements")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect();
      for (const measurement of measurements) {
        const mLines = await ctx.db
          .query("measurementLines")
          .withIndex("by_measurement", (q: any) =>
            q.eq("tenantId", tenant._id).eq("inmetingId", measurement._id)
          )
          .collect();
        for (const line of mLines) {
          await ctx.db.delete(line._id);
          bump("measurementLines");
        }
        const mRooms = await ctx.db
          .query("measurementRooms")
          .withIndex("by_measurement", (q: any) =>
            q.eq("tenantId", tenant._id).eq("inmetingId", measurement._id)
          )
          .collect();
        for (const room of mRooms) {
          await ctx.db.delete(room._id);
          bump("measurementRooms");
        }
        await ctx.db.delete(measurement._id);
        bump("measurements");
      }

      // Projecttaken, workflow-events en tijdlijnitems — altijd weg.
      for (const [table, index] of [
        ["projectTasks", "by_project"],
        ["projectWorkflowEvents", "by_project"],
        ["timelineEvents", "by_project"]
      ] as const) {
        const rows = await ctx.db
          .query(table)
          .withIndex(index, (q: any) => q.eq("tenantId", tenant._id).eq("projectId", project._id))
          .collect();
        for (const row of rows) {
          await ctx.db.delete(row._id);
          bump(table);
        }
      }

      // Leveranciersbestellingen + regels — altijd weg.
      const supplierOrders = await ctx.db
        .query("supplierOrders")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect();
      for (const order of supplierOrders) {
        const orderLines = await ctx.db
          .query("supplierOrderLines")
          .withIndex("by_order", (q: any) =>
            q.eq("tenantId", tenant._id).eq("bestellingId", order._id)
          )
          .collect();
        for (const line of orderLines) {
          await ctx.db.delete(line._id);
          bump("supplierOrderLines");
        }
        await ctx.db.delete(order._id);
        bump("supplierOrders");
      }

      // Offertes: bij een behouden (gefactureerd) project blijven ze staan als onderbouwing
      // van de factuur, met geschoonde vrije tekst; anders volledig weg.
      const quotes = await ctx.db
        .query("quotes")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect();
      for (const quote of quotes) {
        if (keepProject) {
          await ctx.db.patch(quote._id, {
            inleidingTekst: undefined,
            afsluitTekst: undefined,
            gewijzigdOp: now
          });
          bump("offertesGeanonimiseerd");
        } else {
          const quoteLines = await ctx.db
            .query("quoteLines")
            .withIndex("by_quote", (q: any) =>
              q.eq("tenantId", tenant._id).eq("quoteId", quote._id)
            )
            .collect();
          for (const line of quoteLines) {
            await ctx.db.delete(line._id);
            bump("quoteLines");
          }
          await ctx.db.delete(quote._id);
          bump("quotes");
        }
      }

      // Ruimtes (dossier-ruimtes) — altijd weg.
      const projectRooms = await ctx.db
        .query("projectRooms")
        .withIndex("by_project", (q: any) =>
          q.eq("tenantId", tenant._id).eq("projectId", project._id)
        )
        .collect();
      for (const room of projectRooms) {
        await ctx.db.delete(room._id);
        bump("projectRooms");
      }

      if (keepProject) {
        await ctx.db.patch(project._id, {
          omschrijving: undefined,
          interneNotities: undefined,
          klantNotities: undefined,
          gewijzigdOp: now
        });
        bump("projectenGeanonimiseerd");
      } else {
        await ctx.db.delete(project._id);
        bump("projects");
      }
    }

    // Contactmomenten — altijd weg.
    const contacts = await ctx.db
      .query("customerContacts")
      .withIndex("by_customer", (q: any) => q.eq("tenantId", tenant._id).eq("klantId", customerId))
      .collect();
    for (const contact of contacts) {
      await ctx.db.delete(contact._id);
      bump("customerContacts");
    }

    // Dossierstukken + de fysieke bestanden in storage — altijd weg.
    const attachments = await ctx.db
      .query("dossierAttachments")
      .withIndex("by_customer", (q: any) => q.eq("tenantId", tenant._id).eq("klantId", customerId))
      .collect();
    for (const attachment of attachments) {
      if (attachment.storageId) {
        try {
          await ctx.storage.delete(attachment.storageId);
          bump("bestanden");
        } catch (storageError) {
          // Een ontbrekend/al-verwijderd blob mag de rest van de wissing niet blokkeren.
          console.error("Kon dossierbestand niet uit storage verwijderen.", storageError);
        }
      }
      await ctx.db.delete(attachment._id);
      bump("dossierAttachments");
    }

    if (hasInvoices) {
      // Anonimiseer de klant tot een juridische minimum-stub. Naam + adres blijven staan
      // (verschijnen op de bewaarde factuur); de overige persoonsgegevens worden gewist.
      await ctx.db.patch(customerId, {
        voornaam: undefined,
        achternaam: undefined,
        bedrijfsnaam: undefined,
        email: undefined,
        telefoon: undefined,
        notities: undefined,
        status: "archived",
        geanonimiseerdOp: now,
        geanonimiseerdDoorExternalUserId: externalUserId,
        gewijzigdOp: now
      });

      return {
        mode: "anonymized" as const,
        facturenBewaard: invoices.length,
        counts
      };
    }

    await ctx.db.delete(customerId);
    return { mode: "deleted" as const, counts };
  }
});
