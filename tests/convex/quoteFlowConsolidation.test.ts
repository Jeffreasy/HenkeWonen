import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");
const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

function stubAuth() {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
}

async function base(
  t: ReturnType<typeof convexTest>,
  projectStatus: "quote_draft" | "ordering" = "quote_draft"
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen",
      naam: "Henke Wonen",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId,
      externalUserId,
      email: "admin@henke.nl",
      role: "admin",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const customerId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Testklant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId,
      klantId: customerId,
      titel: "Testproject",
      status: projectStatus,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return { tenantId, customerId, projectId };
  });
}

type Ids = { tenantId: Id<"tenants">; customerId: Id<"customers">; projectId: Id<"projects"> };

async function draftQuote(t: ReturnType<typeof convexTest>, ids: Ids, nummer: string) {
  const now = Date.now();
  return await t.run(async (ctx) =>
    ctx.db.insert("quotes", {
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      klantId: ids.customerId,
      offertenummer: nummer,
      titel: "Offerte " + nummer,
      status: "draft",
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    })
  );
}

async function convertedLine(t: ReturnType<typeof convexTest>, ids: Ids, quoteId: Id<"quotes">) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const inmetingId = await ctx.db.insert("measurements", {
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      klantId: ids.customerId,
      status: "converted_to_quote",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return await ctx.db.insert("measurementLines", {
      tenantId: ids.tenantId,
      inmetingId,
      productGroep: "flooring",
      berekeningType: "area",
      invoer: {},
      resultaat: {},
      aantal: 12,
      eenheid: "m2",
      offerteRegelType: "product",
      quotePreparationStatus: "converted",
      geconverteerdeOfferteId: quoteId,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });
}

function prijsRegel(t: ReturnType<typeof convexTest>, quoteId: Id<"quotes">) {
  return t.mutation(api.portal.addQuoteLine, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId,
    regelType: "product",
    titel: "PVC dryback",
    aantal: 10,
    eenheid: "m2",
    eenheidsprijsExBtw: 50,
    btwTarief: 21,
    sortOrder: 1
  });
}

test("winkel-akkoord (processProjectAction) dwingt nu de prijs-/leeg-gate af", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  await draftQuote(t, ids, "OFF-LEEG"); // geen geprijsde regel
  await expect(
    t.mutation(api.portal.processProjectAction, {
      tenantSlug: "henke-wonen",
      actor,
      projectId: String(ids.projectId),
      action: "quote_accepted"
    })
  ).rejects.toThrow(/geprijsde regels|prijs/i);
});

test("winkel-akkoord op een meerwerkofferte laat een lopend dossier in ordering staan", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "ordering");
  const quoteId = await draftQuote(t, ids, "OFF-MEERWERK");
  await prijsRegel(t, quoteId);

  await t.mutation(api.portal.processProjectAction, {
    tenantSlug: "henke-wonen",
    actor,
    projectId: String(ids.projectId),
    action: "quote_accepted",
    quoteId: String(quoteId)
  });

  const { project, quote } = await t.run(async (ctx) => ({
    project: await ctx.db.get(ids.projectId),
    quote: await ctx.db.get(quoteId)
  }));
  expect(quote?.status).toBe("accepted");
  expect(project?.status).toBe("ordering");
});

test("winkel-akkoord annuleert sibling-offertes én bevrijdt hun inmeetregels", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  // B: concept met een geïmporteerde inmeetregel.
  const quoteB = await draftQuote(t, ids, "OFF-B");
  const lineB = await convertedLine(t, ids, quoteB);
  const followUpTaskId = await t.run(async (ctx) =>
    ctx.db.insert("projectTasks", {
      tenantId: ids.tenantId,
      projectId: ids.projectId,
      quoteId: quoteB,
      type: "quote_follow_up",
      titel: "Offerte B opvolgen",
      vervaltOp: Date.now() + 86400000,
      status: "open",
      aangemaaktOp: Date.now(),
      gewijzigdOp: Date.now()
    })
  );
  // A: geprijsd + als laatste gewijzigd (latestQuoteForProject) → wordt geaccepteerd.
  const quoteA = await draftQuote(t, ids, "OFF-A");
  await prijsRegel(t, quoteA);

  await t.mutation(api.portal.processProjectAction, {
    tenantSlug: "henke-wonen",
    actor,
    projectId: String(ids.projectId),
    action: "quote_accepted"
  });

  const qA = await t.run(async (ctx) => ctx.db.get(quoteA));
  const qB = await t.run(async (ctx) => ctx.db.get(quoteB));
  const ml = await t.run(async (ctx) => ctx.db.get(lineB));
  const followUpTask = await t.run(async (ctx) => ctx.db.get(followUpTaskId));
  const events = await t.run(async (ctx) =>
    ctx.db
      .query("projectWorkflowEvents")
      .withIndex("by_project", (q) => q.eq("tenantId", ids.tenantId).eq("projectId", ids.projectId))
      .collect()
  );
  expect(qA?.status).toBe("accepted");
  expect(qB?.status).toBe("cancelled");
  expect(ml?.quotePreparationStatus).toBe("ready_for_quote");
  expect(ml?.geconverteerdeOfferteId).toBeUndefined();
  expect(followUpTask?.status).toBe("dismissed");
  expect(
    events.some(
      (event) =>
        event.titel === "Offerte automatisch geannuleerd" &&
        event.omschrijving?.includes("OFF-B") &&
        event.omschrijving?.includes("OFF-A")
    )
  ).toBe(true);
});

test("winkel-annulering (processProjectAction 'cancelled') bevrijdt de inmeetregels", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const quoteId = await draftQuote(t, ids, "OFF-C");
  const lineId = await convertedLine(t, ids, quoteId);

  await t.mutation(api.portal.processProjectAction, {
    tenantSlug: "henke-wonen",
    actor,
    projectId: String(ids.projectId),
    action: "cancelled"
  });

  const ml = await t.run(async (ctx) => ctx.db.get(lineId));
  expect(ml?.quotePreparationStatus).toBe("ready_for_quote");
});

test("verlopen offerte (expired) bevrijdt de inmeetregels", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const quoteId = await draftQuote(t, ids, "OFF-EXP");
  const lineId = await convertedLine(t, ids, quoteId);

  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen",
    actor,
    quoteId,
    status: "expired"
  });

  const ml = await t.run(async (ctx) => ctx.db.get(lineId));
  expect(ml?.quotePreparationStatus).toBe("ready_for_quote");
  expect(ml?.geconverteerdeOfferteId).toBeUndefined();
});
