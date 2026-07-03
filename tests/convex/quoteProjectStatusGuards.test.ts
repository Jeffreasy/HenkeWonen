import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");
const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

function stubAuth() {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
}

async function base(
  t: ReturnType<typeof convexTest>,
  projectStatus: Doc<"projects">["status"]
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen", naam: "Henke Wonen", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId, externalUserId, email: "a@henke.nl", role: "admin", aangemaaktOp: now, gewijzigdOp: now
    });
    const customerId = await ctx.db.insert("customers", {
      tenantId, type: "private", weergaveNaam: "Testklant", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId, klantId: customerId, titel: "Testproject", status: projectStatus, aangemaaktOp: now, gewijzigdOp: now
    });
    return { tenantId, customerId, projectId };
  });
}

test("createQuote weigert op een geannuleerd dossier (geen stil herleven)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "cancelled");

  await expect(
    t.mutation(api.portal.createQuote, {
      tenantSlug: "henke-wonen", actor, projectId: String(ids.projectId), titel: "Herleefde offerte"
    })
  ).rejects.toThrow(/geannuleerd/i);

  const project = await t.run(async (ctx) => ctx.db.get(ids.projectId as Id<"projects">));
  expect(project?.status).toBe("cancelled");
});

test("createQuote op een lopend dossier (ordering) laat de projectstatus staan (meerwerk)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "ordering");

  await t.mutation(api.portal.createQuote, {
    tenantSlug: "henke-wonen", actor, projectId: String(ids.projectId), titel: "Meerwerk"
  });

  const project = await t.run(async (ctx) => ctx.db.get(ids.projectId as Id<"projects">));
  expect(project?.status).toBe("ordering"); // geen regressie naar quote_draft
});

test("createQuote in de aanloopfase (lead) zet het dossier op quote_draft", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "lead");

  await t.mutation(api.portal.createQuote, {
    tenantSlug: "henke-wonen", actor, projectId: String(ids.projectId), titel: "Eerste offerte"
  });

  const project = await t.run(async (ctx) => ctx.db.get(ids.projectId as Id<"projects">));
  expect(project?.status).toBe("quote_draft");
});

test("offerte afwijzen logt een quote_rejected-event in de dossier-tijdlijn", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "quote_sent");
  const now = Date.now();
  const quoteId = await t.run(async (ctx) =>
    ctx.db.insert("quotes", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      offertenummer: "OFF-2026-10", titel: "Offerte", status: "sent",
      subtotaalExBtw: 100, btwTotaal: 21, totaalInclBtw: 121, aangemaaktOp: now, gewijzigdOp: now
    })
  );

  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen", actor, quoteId: String(quoteId), status: "rejected"
  });

  const { project, events } = await t.run(async (ctx) => ({
    project: await ctx.db.get(ids.projectId as Id<"projects">),
    events: await ctx.db
      .query("projectWorkflowEvents")
      .withIndex("by_project", (q) => q.eq("tenantId", ids.tenantId).eq("projectId", ids.projectId))
      .collect()
  }));
  expect(project?.status).toBe("quote_rejected");
  expect(events.some((event) => event.type === "quote_rejected")).toBe(true);
});

test("een geaccepteerde (nog niet gefactureerde) offerte kan alleen naar geannuleerd", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "quote_accepted");
  const now = Date.now();
  const quoteId = await t.run(async (ctx) =>
    ctx.db.insert("quotes", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      offertenummer: "OFF-2026-11", titel: "Offerte", status: "accepted",
      subtotaalExBtw: 100, btwTotaal: 21, totaalInclBtw: 121, aangemaaktOp: now, gewijzigdOp: now
    })
  );

  await expect(
    t.mutation(api.portal.updateQuoteStatus, {
      tenantSlug: "henke-wonen", actor, quoteId: String(quoteId), status: "draft"
    })
  ).rejects.toThrow(/alleen worden geannuleerd/i);

  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen", actor, quoteId: String(quoteId), status: "cancelled"
  });
  const quote = await t.run(async (ctx) => ctx.db.get(quoteId as Id<"quotes">));
  expect(quote?.status).toBe("cancelled");
});

test("import naar offerte zet de inmeting op converted_to_quote; afwijzen zet 'm terug op reviewed", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "quote_draft");
  const now = Date.now();
  const { quoteId, measurementId } = await t.run(async (ctx) => {
    const qid = await ctx.db.insert("quotes", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      offertenummer: "OFF-2026-12", titel: "Offerte", status: "draft",
      subtotaalExBtw: 0, btwTotaal: 0, totaalInclBtw: 0, aangemaaktOp: now, gewijzigdOp: now
    });
    const mid = await ctx.db.insert("measurements", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      status: "measured", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("measurementLines", {
      tenantId: ids.tenantId, inmetingId: mid,
      productGroep: "flooring", berekeningType: "area",
      invoer: { lengte: 4, breedte: 5 }, resultaat: { m2: 20.6 },
      snijverliesPct: 3, aantal: 20.6, eenheid: "m2",
      offerteRegelType: "product", quotePreparationStatus: "ready_for_quote",
      aangemaaktOp: now, gewijzigdOp: now
    });
    return { quoteId: qid, measurementId: mid };
  });

  const lineIds = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("measurementLines")
        .withIndex("by_measurement", (q) => q.eq("tenantId", ids.tenantId).eq("inmetingId", measurementId))
        .collect()
    ).map((line) => line._id)
  );
  await t.mutation(api.portal.importMeasurementLinesToQuote, {
    tenantSlug: "henke-wonen", actor, quoteId: String(quoteId), lineIds, startSortOrder: 1
  });

  let measurement = await t.run(async (ctx) => ctx.db.get(measurementId as Id<"measurements">));
  expect(measurement?.status).toBe("converted_to_quote");

  // Afwijzen bevrijdt de meetregels én zet de inmetingsstatus terug.
  await t.mutation(api.portal.updateQuoteStatus, {
    tenantSlug: "henke-wonen", actor, quoteId: String(quoteId), status: "rejected"
  });
  measurement = await t.run(async (ctx) => ctx.db.get(measurementId as Id<"measurements">));
  expect(measurement?.status).toBe("reviewed");
  const lines = await t.run(async (ctx) =>
    ctx.db
      .query("measurementLines")
      .withIndex("by_measurement", (q) => q.eq("tenantId", ids.tenantId).eq("inmetingId", measurementId))
      .collect()
  );
  expect(lines.every((line) => line.quotePreparationStatus === "ready_for_quote")).toBe(true);
});
