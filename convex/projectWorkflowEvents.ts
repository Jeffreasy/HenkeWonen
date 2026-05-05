import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { mutationActorValidator, requireMutationRoleForTenantId } from "./authz";

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

export const listByProject = query({
  args: {
    tenantId: v.id("tenants"),
    projectId: v.id("projects")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projectWorkflowEvents")
      .withIndex("by_project", (q) =>
        q.eq("tenantId", args.tenantId).eq("projectId", args.projectId)
      )
      .collect();
  }
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    actor: mutationActorValidator,
    projectId: v.id("projects"),
    type: workflowEventType,
    title: v.string(),
    description: v.optional(v.string()),
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
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new Error("Project not found");
    }

    return await ctx.db.insert("projectWorkflowEvents", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      type: args.type,
      title: args.title,
      description: args.description,
      visibleToCustomer: args.visibleToCustomer,
      createdByExternalUserId: externalUserId,
      createdAt: Date.now()
    });
  }
});
