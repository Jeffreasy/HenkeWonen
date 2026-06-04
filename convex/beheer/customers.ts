import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRole, requireMutationRoleForTenantId } from "../authz";
import type { Doc, Id } from "../_generated/dataModel";
import {
  toCustomer,
  toContact,
  toProject,
  requireTenant,
  customerType,
  customerStatus,
  customerContactType
} from "../portalUtils";


export const list = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(customerStatus)
  },
  handler: async (ctx, args) => {
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
    customerId: v.id("customers")
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);

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
    displayName: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    companyName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    houseNumber: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string())
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
      displayName: args.displayName,
      firstName: args.firstName,
      lastName: args.lastName,
      companyName: args.companyName,
      email: args.email,
      phone: args.phone,
      street: args.street,
      houseNumber: args.houseNumber,
      postalCode: args.postalCode,
      city: args.city,
      country: args.country ?? "Nederland",
      notes: args.notes,
      status: "lead",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    customerId: v.id("customers"),
    status: customerStatus
  },
  handler: async (ctx, args) => {
    await requireMutationRoleForTenantId(ctx, args.tenantId, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const customer = await ctx.db.get(args.customerId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new Error("Customer not found");
    }

    await ctx.db.patch(args.customerId, {
      status: args.status,
      updatedAt: Date.now()
    });

    return args.customerId;
  }
});

export const listContacts = query({
  args: {
    tenantId: v.id("tenants"),
    customerId: v.id("customers")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerContacts")
      .withIndex("by_customer", (q) =>
        q.eq("tenantId", args.tenantId).eq("customerId", args.customerId)
      )
      .order("desc")
      .collect();
  }
});

export const createContact = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    customerId: v.id("customers"),
    type: v.union(
      v.literal("note"),
      v.literal("call"),
      v.literal("email"),
      v.literal("visit"),
      v.literal("loaned_item"),
      v.literal("agreement")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    loanedItemName: v.optional(v.string()),
    expectedReturnDate: v.optional(v.number()),
    visibleToCustomer: v.boolean(),
    createdByExternalUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { externalUserId } = await requireMutationRoleForTenantId(
      ctx,
      args.tenantId,
      args.actor,
      ["user", "editor", "admin"]
    );
    const customer = await ctx.db.get(args.customerId);

    if (!customer || customer.tenantId !== args.tenantId) {
      throw new Error("Customer not found");
    }

    const now = Date.now();

    return await ctx.db.insert("customerContacts", {
      tenantId: args.tenantId,
      customerId: args.customerId,
      type: args.type,
      title: args.title,
      description: args.description,
      loanedItemName: args.loanedItemName,
      expectedReturnDate: args.expectedReturnDate,
      visibleToCustomer: args.visibleToCustomer,
      createdByExternalUserId: externalUserId,
      createdAt: now,
      updatedAt: now
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
      throw new Error("Contact not found");
    }

    await ctx.db.patch(args.contactId, {
      returnedAt: Date.now(),
      updatedAt: Date.now()
    });

    return args.contactId;
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
    actor: mutationActorValidator,
    type: customerType,
    displayName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    houseNumber: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    notes: v.optional(v.string())
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
      displayName: args.displayName,
      email: args.email,
      phone: args.phone,
      street: args.street,
      houseNumber: args.houseNumber,
      postalCode: args.postalCode,
      city: args.city,
      country: "Nederland",
      notes: args.notes,
      status: "lead",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const updateCustomer = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    customerId: v.string(),
    type: v.optional(customerType),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    street: v.optional(v.string()),
    houseNumber: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(customerStatus)
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);
    const customer = await ctx.db.get(args.customerId as Id<"customers">);

    if (!customer || customer.tenantId !== tenant._id) {
      throw new Error("Customer not found");
    }

    const patch: Partial<Doc<"customers">> = { updatedAt: Date.now() };

    if (args.type !== undefined) patch.type = args.type;
    if (args.displayName !== undefined) patch.displayName = args.displayName;
    const hasArg = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
    if (hasArg(args, "email")) patch.email = args.email;
    if (hasArg(args, "phone")) patch.phone = args.phone;
    if (hasArg(args, "street")) patch.street = args.street;
    if (hasArg(args, "houseNumber")) patch.houseNumber = args.houseNumber;
    if (hasArg(args, "postalCode")) patch.postalCode = args.postalCode;
    if (hasArg(args, "city")) patch.city = args.city;
    if (hasArg(args, "notes")) patch.notes = args.notes;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(customer._id, patch);

    return customer._id;
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
    actor: mutationActorValidator,
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
    const { tenant, externalUserId } = await requireMutationRole(
      ctx,
      args.tenantSlug,
      args.actor,
      ["user", "editor", "admin"]
    );
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
      createdByExternalUserId: externalUserId,
      createdAt: now,
      updatedAt: now
    });
  }
});
