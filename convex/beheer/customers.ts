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
  customerContactType,
  teamMemberNamesByExternalId
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

    // Een geanonimiseerde stub (AVG) is bevroren — status terug op actief zou de
    // "vergeten" klant weer in de werkvoorraad zetten (zelfde guard als updateCustomer).
    if (customer.geanonimiseerdOp !== undefined) {
      throw new ConvexError(
        "Deze klant is geanonimiseerd (AVG) en kan niet meer worden bewerkt."
      );
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

    // Geen nieuwe persoonsgegevens vastleggen op een geanonimiseerde stub (AVG) —
    // zelfde guard als createCustomerContact.
    if (customer.geanonimiseerdOp !== undefined) {
      throw new ConvexError(
        "Deze klant is geanonimiseerd (AVG); er kunnen geen contactmomenten meer worden vastgelegd."
      );
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
    const { tenant, externalUserId } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const now = Date.now();

    const customerId = await ctx.db.insert("customers", {
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

    // Een intake-notitie is (ook) het eerste klantcontact: leg 'm vast als
    // contactmoment zodat hij met datum en auteur in de Contactmomenten-tijdlijn
    // terugkomt. Het notitieveld op de klantkaart blijft de actuele werknotitie
    // (en wordt bij bewerken overschreven) — de tijdlijn bewaart wat er bij het
    // eerste contact is gezegd. Geldt voor winkel- én buitendienst-intake.
    const intakeNote = args.notities?.trim();
    if (intakeNote) {
      await ctx.db.insert("customerContacts", {
        tenantId: tenant._id,
        klantId: customerId,
        type: "note",
        titel: "Intake-notitie",
        omschrijving: intakeNote,
        zichtbaarVoorKlant: false,
        createdByExternalUserId: externalUserId,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    return customerId;
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

    // Een geanonimiseerde stub (AVG) is bevroren: opnieuw persoonsgegevens toevoegen of
    // de status terug op actief zetten zou de wissing ongedaan maken.
    if (customer.geanonimiseerdOp !== undefined) {
      throw new ConvexError(
        "Deze klant is geanonimiseerd (AVG) en kan niet meer worden bewerkt."
      );
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

    // Auteur van elk contactmoment tonen: resolve externalUserId → teamlid-naam.
    const teamNames = await teamMemberNamesByExternalId(ctx, tenant._id);

    return {
      customer: toCustomer(tenant.slug, customer),
      projects: await Promise.all(
        projects.map((project: Doc<"projects">) => toProject(ctx, tenant.slug, project))
      ),
      contacts: contacts.map((contact: Doc<"customerContacts">) =>
        toContact(tenant.slug, contact, {
          vastgelegdDoor: contact.createdByExternalUserId
            ? teamNames.get(contact.createdByExternalUserId)
            : undefined
        })
      ),
      attachments: activeAttachments.map((attachment: Doc<"dossierAttachments">) =>
        toDossierAttachment(tenant.slug, attachment)
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
    /** Opvolgdatum: voedt het dashboard-signaal Klantopvolging. */
    opvolgenOp: v.optional(v.number()),
    /** Optionele koppeling aan een projectdossier (zelfde klant). */
    projectId: v.optional(v.string()),
    // Default intern (zichtbaar-voor-klant verschijnt op de klantversie van de offerte).
    zichtbaarVoorKlant: v.optional(v.boolean())
    // Bewust géén createdByExternalUserId-arg meer: de auteur komt altijd uit
    // de geauthenticeerde actor (geen author-spoofing; arg werd al genegeerd).
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

    // Geen nieuwe persoonsgegevens vastleggen op een geanonimiseerde stub (AVG).
    if (customer.geanonimiseerdOp !== undefined) {
      throw new ConvexError(
        "Deze klant is geanonimiseerd (AVG); er kunnen geen contactmomenten meer worden vastgelegd."
      );
    }

    // Projectkoppeling valideren: het project moet van deze tenant én deze klant zijn.
    let projectId: Id<"projects"> | undefined;
    if (args.projectId) {
      const normalizedProjectId = ctx.db.normalizeId("projects", args.projectId);
      const project = normalizedProjectId ? await ctx.db.get(normalizedProjectId) : null;
      if (!project || project.tenantId !== tenant._id || project.klantId !== customer._id) {
        throw new ConvexError("Project niet gevonden bij deze klant.");
      }
      projectId = project._id;
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
      opvolgenOp: args.opvolgenOp,
      projectId,
      zichtbaarVoorKlant: args.zichtbaarVoorKlant ?? false,
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

/** Gedeelde guards voor het muteren van een bestaand contactmoment. */
async function requireEditableContact(
  ctx: any,
  tenantId: Id<"tenants">,
  contactId: string
): Promise<Doc<"customerContacts">> {
  const normalizedId = ctx.db.normalizeId("customerContacts", contactId);
  const contact = normalizedId ? await ctx.db.get(normalizedId) : null;

  if (!contact || contact.tenantId !== tenantId) {
    throw new ConvexError("Contactmoment niet gevonden.");
  }

  const customer = await ctx.db.get(contact.klantId);
  if (customer?.geanonimiseerdOp !== undefined) {
    throw new ConvexError(
      "Deze klant is geanonimiseerd (AVG); contactmomenten kunnen niet meer worden aangepast."
    );
  }

  return contact;
}

/**
 * Corrigeer een contactmoment (typefout, verkeerde type-keuze, retourdatum).
 * Zelfde rollen als aanmaken: ook de monteur moet zijn eigen notitie kunnen
 * rechtzetten. De auteur blijft de oorspronkelijke vastlegger.
 */
export const updateCustomerContact = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    contactId: v.string(),
    type: customerContactType,
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    uitgeleendItemNaam: v.optional(v.string()),
    verwachteRetourdatum: v.optional(v.number()),
    /** Weglaten of undefined = opvolgdatum wissen (afgehandeld). */
    opvolgenOp: v.optional(v.number()),
    zichtbaarVoorKlant: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const contact = await requireEditableContact(ctx, tenant._id, args.contactId);

    await ctx.db.patch(contact._id, {
      type: args.type,
      titel: args.titel,
      omschrijving: args.omschrijving,
      uitgeleendItemNaam: args.uitgeleendItemNaam,
      verwachteRetourdatum: args.verwachteRetourdatum,
      opvolgenOp: args.opvolgenOp,
      zichtbaarVoorKlant: args.zichtbaarVoorKlant ?? contact.zichtbaarVoorKlant,
      gewijzigdOp: Date.now()
    });

    return contact._id;
  }
});

/**
 * Dashboard-signaal "Klantopvolging": contactmomenten met een verstreken of
 * vandaag-verlopende opvolgdatum, plus uitgeleende items waarvan de
 * retourdatum is verstreken zonder retour. Tenant-breed, met klantnaam en
 * link-informatie voor het klantdossier.
 */
export const customerFollowUps = query({
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

    // Einde van vandaag: alles met een opvolgdatum t/m vandaag vraagt actie.
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [dueContacts, loanedItems] = await Promise.all([
      ctx.db
        .query("customerContacts")
        .withIndex("by_follow_up", (q: any) =>
          q.eq("tenantId", tenant._id).lte("opvolgenOp", endOfToday.getTime())
        )
        .collect(),
      ctx.db
        .query("customerContacts")
        .withIndex("by_type", (q: any) => q.eq("tenantId", tenant._id).eq("type", "loaned_item"))
        .collect()
    ]);

    // "Te laat" pas ná de afgesproken dag: een retourdatum van vandaag is nog op tijd.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const overdueLoans = loanedItems.filter(
      (contact: Doc<"customerContacts">) =>
        contact.geretourneerdOp === undefined &&
        contact.verwachteRetourdatum !== undefined &&
        contact.verwachteRetourdatum < startOfToday.getTime()
    );

    // Klantnamen resolven voor beide lijsten in één keer.
    const customerIds = new Set<string>();
    for (const contact of [...dueContacts, ...overdueLoans]) {
      customerIds.add(String(contact.klantId));
    }
    const customerNames = new Map<string, string>();
    for (const id of customerIds) {
      const customer = await ctx.db.get(id as Id<"customers">);
      if (customer && customer.tenantId === tenant._id) {
        customerNames.set(id, customer.weergaveNaam);
      }
    }

    const toSignal = (contact: Doc<"customerContacts">) => ({
      contactId: String(contact._id),
      klantId: String(contact.klantId),
      klantNaam: customerNames.get(String(contact.klantId)) ?? "Onbekende klant",
      titel: contact.titel,
      type: contact.type,
      uitgeleendItemNaam: contact.uitgeleendItemNaam,
      opvolgenOp: contact.opvolgenOp,
      verwachteRetourdatum: contact.verwachteRetourdatum
    });

    return {
      // De index pakt ook rijen zonder opvolgenOp niet (lte op undefined matcht niet),
      // maar filter defensief; nieuwste deadline eerst.
      followUps: dueContacts
        .filter((contact: Doc<"customerContacts">) => contact.opvolgenOp !== undefined)
        .sort(
          (a: Doc<"customerContacts">, b: Doc<"customerContacts">) =>
            (a.opvolgenOp ?? 0) - (b.opvolgenOp ?? 0)
        )
        .map(toSignal),
      overdueLoans: overdueLoans
        .sort(
          (a: Doc<"customerContacts">, b: Doc<"customerContacts">) =>
            (a.verwachteRetourdatum ?? 0) - (b.verwachteRetourdatum ?? 0)
        )
        .map(toSignal)
    };
  }
});

/**
 * Verwijder een contactmoment (verkeerde klant, dubbel vastgelegd). Bewust
 * editor/admin: verwijderen uit een klantdossier is winkel-beheer, geen
 * veldactie — de monteur corrigeert via updateCustomerContact.
 */
export const deleteCustomerContact = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    contactId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "editor",
      "admin"
    ]);
    const contact = await requireEditableContact(ctx, tenant._id, args.contactId);

    await ctx.db.delete(contact._id);

    return contact._id;
  }
});

/**
 * Retour van een uitgeleend item vastleggen (of ongedaan maken bij een misklik).
 * Alleen geldig op type "loaned_item" — de oude variant kon per ongeluk een
 * telefoonnotitie als "geretourneerd" markeren.
 */
export const markCustomerLoanedItemReturned = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    contactId: v.string(),
    returned: v.boolean()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const contact = await requireEditableContact(ctx, tenant._id, args.contactId);

    if (contact.type !== "loaned_item") {
      throw new ConvexError("Alleen uitgeleende items kunnen als geretourneerd worden gemarkeerd.");
    }

    await ctx.db.patch(contact._id, {
      geretourneerdOp: args.returned ? Date.now() : undefined,
      gewijzigdOp: Date.now()
    });

    return contact._id;
  }
});

/**
 * AVG — recht op vergetelheid: verwijdert of anonimiseert een klant met álle gekoppelde
 * gegevens. Admin-only + dubbele bevestiging (`bevestigNaam` moet exact de klantnaam zijn,
 * náást de bevestigingsmodal in de UI).
 *
 * Altijd hard verwijderd (persoonsgegevens zonder bewaarplicht):
 *   dossierstukken (incl. de fysieke bestanden in storage), contactmomenten, inmetingen
 *   (+ruimtes/regels), projecttaken en workflow-events. Inmetingen zijn tevens de
 *   agenda-items van de klant.
 *
 * Facturen bepalen de uitkomst (wettelijke bewaarplicht 7 jaar):
 *   - GEEN facturen  → alles wordt verwijderd, inclusief de klant zelf (`mode: "deleted"`).
 *   - WÉL facturen   → de facturen blijven staan mét de gefactureerde projecten/offertes die
 *     ze onderbouwen: vrije tekst wordt geschoond, titels worden generiek ("… (geanonimiseerd)"),
 *     het project gaat op "closed" zodat het niet als actioneel dossier blijft hangen, en de
 *     ruimtes + leveranciersbestellingen van dat project blijven staan (financiële/fysieke
 *     onderbouwing van de factuur — geen persoonsgegevens; offerte-regels verwijzen bovendien
 *     hard naar de ruimtes). De klant wordt een minimale stub: naam + adres blijven (verschijnen
 *     op de factuur), e-mail/telefoon/notities worden gewist, status → "archived" en
 *     `geanonimiseerdOp` wordt gezet (`mode: "anonymized"`). Projecten/offertes zónder factuur
 *     worden ook dan verwijderd.
 *
 * Elke wissing schrijft een regel in het AVG-wisregister (`customerErasures`): wie, wanneer,
 * welke modus en de teller per tabel — aantoonbaarheid zonder de gewiste gegevens te bewaren.
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

    // Een stub nogmaals "verwijderen" zou opnieuw anonimiseren en de audittrail
    // (geanonimiseerdOp/-Door) overschrijven; de wissing is al uitgevoerd.
    if (customer.geanonimiseerdOp !== undefined) {
      throw new ConvexError(
        "Deze klant is al geanonimiseerd; de facturen blijven wettelijk 7 jaar bewaard."
      );
    }

    const now = Date.now();
    const counts: Record<string, number> = {};
    const bump = (key: string, n = 1) => {
      counts[key] = (counts[key] ?? 0) + n;
    };
    // storageIds waarvan het fysieke bestand niet verwijderd kon worden — komen in het
    // wisregister zodat een naloop mogelijk blijft (anders is het blob-adres definitief kwijt).
    const storageWaarschuwingen: string[] = [];

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
    const keptProjectIds = new Set<string>();

    for (const project of projects) {
      // Een project met factuur onderbouwt die factuur → behouden (geschoond). Overige weg.
      const keepProject = hasInvoices && invoicedProjectIds.has(String(project._id));
      if (keepProject) {
        keptProjectIds.add(String(project._id));
      }

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

      // Projecttaken en workflow-events — altijd weg.
      for (const [table, index] of [
        ["projectTasks", "by_project"],
        ["projectWorkflowEvents", "by_project"]
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

      // Leveranciersbestellingen + regels: bij een behouden (gefactureerd) project blijven
      // ze staan — het is de inkoop-/kostprijsonderbouwing van de bewaarde factuur en bevat
      // geen persoonsgegevens (spiegel van cancelOpenSupplierOrders, dat ontvangen
      // bestellingen ook bewust bewaart). Bij een verwijderd project gaan ze mee weg.
      if (!keepProject) {
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
          // Titel is vrije tekst en bevat in de praktijk vaak klantnaam/adres; het
          // offertenummer blijft de koppeling met de factuur. Regel-omschrijvingen
          // (vrije tekst met plaatsings-/klantdetails) worden ook geschoond — titel,
          // aantallen en bedragen blijven als financiële onderbouwing staan.
          await ctx.db.patch(quote._id, {
            titel: "Offerte (geanonimiseerd)",
            inleidingTekst: undefined,
            afsluitTekst: undefined,
            gewijzigdOp: now
          });
          const keptQuoteLines = await ctx.db
            .query("quoteLines")
            .withIndex("by_quote", (q: any) =>
              q.eq("tenantId", tenant._id).eq("quoteId", quote._id)
            )
            .collect();
          for (const line of keptQuoteLines) {
            if (line.omschrijving !== undefined) {
              await ctx.db.patch(line._id, { omschrijving: undefined, gewijzigdOp: now });
              bump("offerteRegelsGeschoond");
            }
          }
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

      // Ruimtes (dossier-ruimtes): bij een behouden project blijven ze staan — de bewaarde
      // offerte-regels verwijzen er hard naar (projectRuimteId, dezelfde invariant die
      // deleteProjectRoom afdwingt) en een ruimtenaam is geen persoonsgegeven.
      if (!keepProject) {
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
      }

      if (keepProject) {
        // Titel is vrije tekst (vaak "Vloer fam. X — straatnaam"); generiek maken. Status
        // naar closed zodat het geen actioneel dossier blijft waarop iemand per ongeluk
        // een nieuwe inmeting voor de vergeten klant plant.
        await ctx.db.patch(project._id, {
          titel: "Project (geanonimiseerd)",
          omschrijving: undefined,
          interneNotities: undefined,
          klantNotities: undefined,
          status: "closed",
          afgeslotenOp: project.afgeslotenOp ?? now,
          gewijzigdOp: now
        });
        bump("projectenGeanonimiseerd");
      } else {
        await ctx.db.delete(project._id);
        bump("projects");
      }
    }

    // Sluitveeg via de klant-indexen: offertes en tijdlijnitems die aan deze klant hangen
    // maar via de projecten-loop niet bereikt zijn (wees-rijen met een verdwenen project —
    // hetzelfde soort weesrecords als de eerdere eindfase-audit opruimde). Offertes van
    // behouden projecten blijven uiteraard staan.
    const klantQuotes = await ctx.db
      .query("quotes")
      .withIndex("by_customer", (q: any) => q.eq("tenantId", tenant._id).eq("klantId", customerId))
      .collect();
    for (const quote of klantQuotes) {
      if (keptProjectIds.has(String(quote.projectId))) {
        continue;
      }
      const orphanLines = await ctx.db
        .query("quoteLines")
        .withIndex("by_quote", (q: any) => q.eq("tenantId", tenant._id).eq("quoteId", quote._id))
        .collect();
      for (const line of orphanLines) {
        await ctx.db.delete(line._id);
        bump("quoteLines");
      }
      await ctx.db.delete(quote._id);
      bump("quotes");
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
          // Een ontbrekend/al-verwijderd blob mag de rest van de wissing niet blokkeren,
          // maar het adres mag ook niet stilletjes verdwijnen: registreer het in het
          // wisregister zodat een naloop mogelijk blijft.
          console.error("Kon dossierbestand niet uit storage verwijderen.", storageError);
          storageWaarschuwingen.push(String(attachment.storageId));
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

      await ctx.db.insert("customerErasures", {
        tenantId: tenant._id,
        klantWeergaveNaam: customer.weergaveNaam,
        mode: "anonymized",
        counts,
        storageWaarschuwingen: storageWaarschuwingen.length > 0 ? storageWaarschuwingen : undefined,
        uitgevoerdDoorExternalUserId: externalUserId,
        uitgevoerdOp: now
      });

      return {
        mode: "anonymized" as const,
        facturenBewaard: invoices.length,
        counts
      };
    }

    await ctx.db.delete(customerId);
    await ctx.db.insert("customerErasures", {
      tenantId: tenant._id,
      klantWeergaveNaam: customer.weergaveNaam,
      mode: "deleted",
      counts,
      storageWaarschuwingen: storageWaarschuwingen.length > 0 ? storageWaarschuwingen : undefined,
      uitgevoerdDoorExternalUserId: externalUserId,
      uitgevoerdOp: now
    });

    return { mode: "deleted" as const, counts };
  }
});
