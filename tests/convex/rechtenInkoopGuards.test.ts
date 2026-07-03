import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

function stubAuth() {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
}

function actorFor(externalUserId: string) {
  return { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };
}

async function base(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen", naam: "Henke Wonen", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId, externalUserId: "dev-admin", email: "a@henke.nl", role: "admin", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId, externalUserId: "dev-kijker", email: "k@henke.nl", role: "viewer", aangemaaktOp: now, gewijzigdOp: now
    });
    const customerId = await ctx.db.insert("customers", {
      tenantId, type: "private", weergaveNaam: "Testklant", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId, klantId: customerId, titel: "Testproject", status: "quote_accepted", aangemaaktOp: now, gewijzigdOp: now
    });
    return { tenantId, customerId, projectId };
  });
}

test("een kijker (viewer) krijgt geen financiële facturendata meer", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  await base(t);

  await expect(
    t.query(api.portal.listInvoices, { tenantSlug: "henke-wonen", actor: actorFor("dev-kijker") })
  ).rejects.toThrow();

  // Een gewone gebruiker (winkel) behoudt toegang.
  await t.run(async (ctx) => {
    const tenant = (await ctx.db.query("tenants").collect())[0];
    await ctx.db.insert("users", {
      tenantId: tenant._id, externalUserId: "dev-winkel", email: "w@henke.nl", role: "user",
      aangemaaktOp: Date.now(), gewijzigdOp: Date.now()
    });
  });
  const result = await t.query(api.portal.listInvoices, {
    tenantSlug: "henke-wonen", actor: actorFor("dev-winkel")
  });
  expect(result).toBeDefined();
});

test("geannuleerde of ontvangen bestellingen kennen een overgangsguard", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const now = Date.now();
  const { cancelledId, receivedId } = await t.run(async (ctx) => {
    const cancelledId = await ctx.db.insert("supplierOrders", {
      tenantId: ids.tenantId, projectId: ids.projectId, status: "cancelled",
      aangemaaktOp: now, gewijzigdOp: now
    });
    const receivedId = await ctx.db.insert("supplierOrders", {
      tenantId: ids.tenantId, projectId: ids.projectId, status: "received", ontvangenOp: now,
      aangemaaktOp: now, gewijzigdOp: now
    });
    return { cancelledId, receivedId };
  });

  // Geannuleerd blijft geannuleerd (race met een offerte-afwijzing).
  await expect(
    t.mutation(api.portal.updateSupplierOrderStatus, {
      tenantSlug: "henke-wonen", actor: actorFor("dev-admin"),
      bestellingId: String(cancelledId), status: "received"
    })
  ).rejects.toThrow(/geannuleerd/i);

  // Volledig ontvangen kan niet terug naar 'besteld'…
  await expect(
    t.mutation(api.portal.updateSupplierOrderStatus, {
      tenantSlug: "henke-wonen", actor: actorFor("dev-admin"),
      bestellingId: String(receivedId), status: "ordered"
    })
  ).rejects.toThrow(/ontvangen/i);

  // …maar een correctie naar 'deels ontvangen' mag, en wist de ontvangstdatum.
  await t.mutation(api.portal.updateSupplierOrderStatus, {
    tenantSlug: "henke-wonen", actor: actorFor("dev-admin"),
    bestellingId: String(receivedId), status: "partially_received"
  });
  const corrected = await t.run(async (ctx) => ctx.db.get(receivedId as Id<"supplierOrders">));
  expect(corrected?.status).toBe("partially_received");
  expect(corrected?.ontvangenOp).toBeUndefined();
});

test("bestellingen genereren zet het dossier op 'ordering' met een workflow-event", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t);
  const now = Date.now();
  await t.run(async (ctx) => {
    const supplierId = await ctx.db.insert("suppliers", {
      tenantId: ids.tenantId, naam: "Roots", status: "active", prijslijstStatus: "received",
      aangemaaktOp: now, gewijzigdOp: now
    });
    const categorieId = await ctx.db.insert("categories", {
      tenantId: ids.tenantId, naam: "PVC click", slug: "pvc-click", sortOrder: 1,
      status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const productId = await ctx.db.insert("products", {
      tenantId: ids.tenantId, naam: "PVC Eiken", leverancierId: supplierId, categorieId,
      productAard: "standard", eenheid: "m2",
      status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    const quoteId = await ctx.db.insert("quotes", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      offertenummer: "OFF-2026-30", titel: "Offerte", status: "accepted",
      subtotaalExBtw: 700, btwTotaal: 147, totaalInclBtw: 847, aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("quoteLines", {
      tenantId: ids.tenantId, quoteId, regelType: "product", productId,
      titel: "PVC Eiken", aantal: 20, eenheid: "m2", eenheidsprijsExBtw: 35, btwTarief: 21,
      regelTotaalExBtw: 700, regelBtwTotaal: 147, regelTotaalInclBtw: 847, sortOrder: 1,
      aangemaaktOp: now, gewijzigdOp: now
    });
  });

  const result = await t.mutation(api.portal.generateSupplierOrdersFromQuote, {
    tenantSlug: "henke-wonen", actor: actorFor("dev-admin"), projectId: String(ids.projectId)
  });
  expect(result.created).toBeGreaterThan(0);

  const { project, events } = await t.run(async (ctx) => ({
    project: await ctx.db.get(ids.projectId as Id<"projects">),
    events: await ctx.db
      .query("projectWorkflowEvents")
      .withIndex("by_project", (q) => q.eq("tenantId", ids.tenantId).eq("projectId", ids.projectId))
      .collect()
  }));
  expect(project?.status).toBe("ordering");
  expect(project?.besteldOp).toBeDefined();
  expect(events.some((event) => event.type === "supplier_order_created")).toBe(true);
});
