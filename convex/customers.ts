import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRoleForTenantId } from "./authz";

const customerStatus = v.union(
  v.literal("lead"),
  v.literal("active"),
  v.literal("inactive"),
  v.literal("archived")
);

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
