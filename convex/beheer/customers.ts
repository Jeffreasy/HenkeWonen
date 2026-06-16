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
      throw new ConvexError("Customer not found");
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
      throw new ConvexError("Customer not found");
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
      throw new ConvexError("Contact not found");
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
      throw new ConvexError("Customer not found");
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

    const [projects, contacts] = await Promise.all([
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
      throw new ConvexError("Customer not found");
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
