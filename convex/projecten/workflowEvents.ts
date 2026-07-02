import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRoleForTenantId,
  requireQueryRoleForTenantId
} from "../authz";

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
    projectId: v.id("projects"),
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
    titel: v.string(),
    omschrijving: v.optional(v.string()),
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
    const project = await ctx.db.get(args.projectId);

    if (!project || project.tenantId !== args.tenantId) {
      throw new ConvexError("Project niet gevonden.");
    }

    return await ctx.db.insert("projectWorkflowEvents", {
      tenantId: args.tenantId,
      projectId: args.projectId,
      type: args.type,
      titel: args.titel,
      omschrijving: args.omschrijving,
      zichtbaarVoorKlant: args.zichtbaarVoorKlant,
      createdByExternalUserId: externalUserId,
      aangemaaktOp: Date.now()
    });
  }
});
