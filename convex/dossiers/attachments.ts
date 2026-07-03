import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  mutationActorValidator,
  readActorValidator,
  requireMutationRole,
  requireQueryRole
} from "../authz";
import { dossierAttachmentKind } from "../portalUtils";

/**
 * Resolvet de storage-URL van één dossierstuk. Wordt UITSLUITEND server-side aangeroepen
 * door de proxyroute /portal/dossierbestand/[id]: de teruggegeven Convex-storage-URL is
 * publiek en login-loos en mag de server NIET verlaten. De proxy controleert de sessie en
 * streamt de bytes door, zodat er nergens een permanente bestandslink in de client belandt
 * (AVG-audit 2026-07-03, punt 1). Geeft null terug als het stuk niet bestaat, niet bij deze
 * tenant hoort, gearchiveerd is of geen bestand heeft.
 */
export const getDossierAttachmentFile = query({
  args: {
    tenantSlug: v.string(),
    actor: readActorValidator,
    attachmentId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireQueryRole(ctx, args.tenantSlug, args.actor, [
      "viewer",
      "user",
      "editor",
      "admin"
    ]);

    const attachmentId = ctx.db.normalizeId("dossierAttachments", args.attachmentId);
    if (!attachmentId) {
      return null;
    }

    const attachment = await ctx.db.get(attachmentId);
    if (
      !attachment ||
      attachment.tenantId !== tenant._id ||
      attachment.status !== "active" ||
      !attachment.storageId
    ) {
      return null;
    }

    const url = await ctx.storage.getUrl(attachment.storageId);
    if (!url) {
      return null;
    }

    return {
      url,
      bestandsnaam: attachment.bestandsnaam,
      bestandstype: attachment.bestandstype
    };
  }
});

/**
 * Vraagt een eenmalige upload-URL aan Convex storage. De client POST't het bestand
 * naar deze URL en koppelt de teruggekregen storageId daarna via createDossierAttachment.
 */
export const generateDossierAttachmentUploadUrl = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator
  },
  handler: async (ctx, args) => {
    await requireMutationRole(ctx, args.tenantSlug, args.actor, ["user", "editor", "admin"]);

    return await ctx.storage.generateUploadUrl();
  }
});

/**
 * Legt een dossierstuk vast bij een klant (optioneel gekoppeld aan een project).
 * `storageId` is optioneel: een fysieke-map-verwijzing heeft alleen titel/notitie.
 */
export const createDossierAttachment = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    klantId: v.string(),
    projectId: v.optional(v.string()),
    kind: dossierAttachmentKind,
    titel: v.string(),
    omschrijving: v.optional(v.string()),
    bestandsnaam: v.optional(v.string()),
    bestandstype: v.optional(v.string()),
    bestandsgrootteBytes: v.optional(v.number()),
    storageId: v.optional(v.string())
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

    let projectId: Id<"projects"> | undefined;

    if (args.projectId) {
      const project = await ctx.db.get(args.projectId as Id<"projects">);

      if (!project || project.tenantId !== tenant._id || project.klantId !== customer._id) {
        throw new ConvexError("Project niet gevonden bij deze klant.");
      }

      projectId = project._id;
    }

    const now = Date.now();

    return await ctx.db.insert("dossierAttachments", {
      tenantId: tenant._id,
      klantId: customer._id,
      projectId,
      kind: args.kind,
      titel: args.titel,
      omschrijving: args.omschrijving,
      bestandsnaam: args.bestandsnaam,
      bestandstype: args.bestandstype,
      bestandsgrootteBytes: args.bestandsgrootteBytes,
      storageId: args.storageId as Id<"_storage"> | undefined,
      status: "active",
      createdByExternalUserId: externalUserId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  }
});

/** Archiveert een dossierstuk (omkeerbaar — blijft bewaard, verdwijnt uit de lijst). */
export const archiveDossierAttachment = mutation({
  args: {
    tenantSlug: v.string(),
    actor: mutationActorValidator,
    attachmentId: v.string()
  },
  handler: async (ctx, args) => {
    const { tenant } = await requireMutationRole(ctx, args.tenantSlug, args.actor, [
      "user",
      "editor",
      "admin"
    ]);

    const attachment = await ctx.db.get(args.attachmentId as Id<"dossierAttachments">);

    if (!attachment || attachment.tenantId !== tenant._id) {
      throw new ConvexError("Dossierstuk niet gevonden.");
    }

    await ctx.db.patch(attachment._id, { status: "archived", gewijzigdOp: Date.now() });

    return attachment._id;
  }
});
