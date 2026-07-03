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

/** Eerstvolgende inmeetdag (di/wo/do) in de toekomst, verankerd rond het middaguur. */
function volgendeInmeetdag(): number {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (![2, 3, 4].includes(d.getDay())); // getDay: di=2, wo=3, do=4
  return d.getTime();
}

/** Eerstvolgende vrijdag (geen inmeetdag) in de toekomst, rond het middaguur. */
function volgendeVrijdag(): number {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== 5);
  return d.getTime();
}

async function base(
  t: ReturnType<typeof convexTest>,
  projectStatus: Doc<"projects">["status"] = "lead"
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

test("dossier annuleren zegt het toekomstige inmeetbezoek af (agenda + capaciteit vrij)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "measurement_planned");
  const now = Date.now();
  const inmeetdag = volgendeInmeetdag();
  const measurementId = await t.run(async (ctx) => {
    await ctx.db.patch(ids.projectId as Id<"projects">, { inmeetdatum: inmeetdag });
    return ctx.db.insert("measurements", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      status: "draft", inmeetdatum: inmeetdag, aangemaaktOp: now, gewijzigdOp: now
    });
  });

  await t.mutation(api.portal.processProjectAction, {
    tenantSlug: "henke-wonen", actor, projectId: String(ids.projectId), action: "cancelled"
  });

  const { measurement, project } = await t.run(async (ctx) => ({
    measurement: await ctx.db.get(measurementId as Id<"measurements">),
    project: await ctx.db.get(ids.projectId as Id<"projects">)
  }));
  expect(project?.status).toBe("cancelled");
  expect(measurement?.inmeetdatum).toBeUndefined();
  expect(project?.inmeetdatum).toBeUndefined();
});

test("inmeetdatum leegmaken in het dossier zegt de afspraak af en synct naar de inmeting", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "measurement_planned");
  const now = Date.now();
  const inmeetdag = volgendeInmeetdag();
  const measurementId = await t.run(async (ctx) => {
    await ctx.db.patch(ids.projectId as Id<"projects">, { inmeetdatum: inmeetdag });
    return ctx.db.insert("measurements", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      status: "draft", inmeetdatum: inmeetdag, aangemaaktOp: now, gewijzigdOp: now
    });
  });

  await t.mutation(api.portal.updateProject, {
    tenantSlug: "henke-wonen", actor, projectId: String(ids.projectId),
    titel: "Testproject", inmeetdatum: null
  });

  const { measurement, project } = await t.run(async (ctx) => ({
    measurement: await ctx.db.get(measurementId as Id<"measurements">),
    project: await ctx.db.get(ids.projectId as Id<"projects">)
  }));
  expect(project?.inmeetdatum).toBeUndefined();
  expect(measurement?.inmeetdatum).toBeUndefined();
});

test("status/notities opslaan blokkeert niet op een ongewijzigde legacy datum buiten di/wo/do", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "measurement_planned");
  const now = Date.now();
  const vrijdag = volgendeVrijdag();
  const measurementId = await t.run(async (ctx) =>
    ctx.db.insert("measurements", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      status: "draft", inmeetdatum: vrijdag, aangemaaktOp: now, gewijzigdOp: now
    })
  );

  // Het samenvattingsformulier stuurt de (ongewijzigde) datum altijd mee.
  await t.mutation(api.projecten.measurements.updateMeasurement, {
    tenantId: ids.tenantId, actor, inmetingId: measurementId,
    status: "measured", inmeetdatum: vrijdag, notities: "drempel keuken, eerst egaliseren"
  });

  const measurement = await t.run(async (ctx) => ctx.db.get(measurementId as Id<"measurements">));
  expect(measurement?.status).toBe("measured");
  expect(measurement?.notities).toBe("drempel keuken, eerst egaliseren");

  // Een ECHTE datumwijziging naar een niet-inmeetdag blijft geweigerd.
  await expect(
    t.mutation(api.projecten.measurements.updateMeasurement, {
      tenantId: ids.tenantId, actor, inmetingId: measurementId,
      inmeetdatum: vrijdag + 7 * 24 * 60 * 60 * 1000
    })
  ).rejects.toThrow(/dinsdag, woensdag of donderdag/i);
});

test("afspraak verzetten op een lopend dossier zet de status niet terug naar 'Inmeting gepland'", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "quote_sent");
  const now = Date.now();
  await t.run(async (ctx) =>
    ctx.db.insert("measurements", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      status: "measured", aangemaaktOp: now, gewijzigdOp: now
    })
  );

  await t.mutation(api.portal.startOrPlanMeasurement, {
    tenantSlug: "henke-wonen", actor, projectId: String(ids.projectId),
    inmeetdatum: volgendeInmeetdag()
  });

  const project = await t.run(async (ctx) => ctx.db.get(ids.projectId as Id<"projects">));
  expect(project?.status).toBe("quote_sent"); // geen regressie
});

test("server weigert een monteur die niet (meer) op de agenda-whitelist staat", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "lead");
  const now = Date.now();
  const { simoneId } = await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      tenantId: ids.tenantId, externalUserId: "wim", email: "wim@henke.nl", naam: "Wim",
      role: "user", toonInAgenda: true, aangemaaktOp: now, gewijzigdOp: now
    });
    const simoneId = await ctx.db.insert("users", {
      tenantId: ids.tenantId, externalUserId: "simone", email: "simone@henke.nl", naam: "Simone",
      role: "editor", toonInAgenda: false, aangemaaktOp: now, gewijzigdOp: now
    });
    return { simoneId };
  });

  await expect(
    t.mutation(api.portal.startOrPlanMeasurement, {
      tenantSlug: "henke-wonen", actor, projectId: String(ids.projectId),
      inmeetdatum: volgendeInmeetdag(), gemetenDoor: "Simone", gemetenDoorUserId: simoneId
    })
  ).rejects.toThrow(/niet \(meer\) als monteur in de agenda/i);
});

test("naamswijziging 'Ingemeten door' synct gemetenDoorUserId (teamlid) of wist 'm (vrije tekst)", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "measurement_planned");
  const now = Date.now();
  const { wimId, measurementId } = await t.run(async (ctx) => {
    const wimId = await ctx.db.insert("users", {
      tenantId: ids.tenantId, externalUserId: "wim", email: "wim@henke.nl", naam: "Wim",
      role: "user", toonInAgenda: true, aangemaaktOp: now, gewijzigdOp: now
    });
    const measurementId = await ctx.db.insert("measurements", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      status: "draft", gemetenDoor: "Piet", aangemaaktOp: now, gewijzigdOp: now
    });
    return { wimId, measurementId };
  });

  // Vrije tekst → éénduidig teamlid: userId wordt gezet.
  await t.mutation(api.projecten.measurements.updateMeasurement, {
    tenantId: ids.tenantId, actor, inmetingId: measurementId, gemetenDoor: "Wim"
  });
  let measurement = await t.run(async (ctx) => ctx.db.get(measurementId as Id<"measurements">));
  expect(measurement?.gemetenDoorUserId).toBe(wimId);

  // Teamlid → vrije tekst: userId wordt gewist (agenda hangt niet op de oude monteur).
  await t.mutation(api.projecten.measurements.updateMeasurement, {
    tenantId: ids.tenantId, actor, inmetingId: measurementId, gemetenDoor: "Externe ZZP-er"
  });
  measurement = await t.run(async (ctx) => ctx.db.get(measurementId as Id<"measurements">));
  expect(measurement?.gemetenDoor).toBe("Externe ZZP-er");
  expect(measurement?.gemetenDoorUserId).toBeUndefined();
});

test("'Inmeting starten' via createForProject zet het dossier op measurement_planned mét workflow-event", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "lead");

  await t.mutation(api.projecten.measurements.createForProject, {
    tenantId: ids.tenantId, actor, projectId: ids.projectId, klantId: ids.customerId
  });

  const { project, events } = await t.run(async (ctx) => ({
    project: await ctx.db.get(ids.projectId as Id<"projects">),
    events: await ctx.db
      .query("projectWorkflowEvents")
      .withIndex("by_project", (q) => q.eq("tenantId", ids.tenantId).eq("projectId", ids.projectId))
      .collect()
  }));
  expect(project?.status).toBe("measurement_planned");
  expect(events.some((event) => event.type === "measurement_planned")).toBe(true);
});

test("akkoord verwerken accepteert de expliciet meegegeven offerte, niet 'de nieuwste'", async () => {
  stubAuth();
  const t = convexTest(schema, modules);
  const ids = await base(t, "quote_sent");
  const now = Date.now();
  const { oudereQuoteId, nieuwereQuoteId } = await t.run(async (ctx) => {
    const oudereQuoteId = await ctx.db.insert("quotes", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      offertenummer: "OFF-2026-20", titel: "Getoonde offerte", status: "sent",
      subtotaalExBtw: 100, btwTotaal: 21, totaalInclBtw: 121,
      aangemaaktOp: now - 1000, gewijzigdOp: now - 1000
    });
    await ctx.db.insert("quoteLines", {
      tenantId: ids.tenantId, quoteId: oudereQuoteId, regelType: "manual",
      titel: "Werk", aantal: 1, eenheid: "stuk", eenheidsprijsExBtw: 100, btwTarief: 21,
      regelTotaalExBtw: 100, regelBtwTotaal: 21, regelTotaalInclBtw: 121, sortOrder: 1,
      aangemaaktOp: now - 1000, gewijzigdOp: now - 1000
    });
    // Race: intussen is er een nieuwere (lege) conceptofferte bijgekomen.
    const nieuwereQuoteId = await ctx.db.insert("quotes", {
      tenantId: ids.tenantId, projectId: ids.projectId, klantId: ids.customerId,
      offertenummer: "OFF-2026-21", titel: "Tussendoor-concept", status: "draft",
      subtotaalExBtw: 0, btwTotaal: 0, totaalInclBtw: 0, aangemaaktOp: now, gewijzigdOp: now
    });
    return { oudereQuoteId, nieuwereQuoteId };
  });

  await t.mutation(api.portal.processProjectAction, {
    tenantSlug: "henke-wonen", actor, projectId: String(ids.projectId),
    action: "quote_accepted", quoteId: String(oudereQuoteId)
  });

  const { oudere, nieuwere } = await t.run(async (ctx) => ({
    oudere: await ctx.db.get(oudereQuoteId as Id<"quotes">),
    nieuwere: await ctx.db.get(nieuwereQuoteId as Id<"quotes">)
  }));
  expect(oudere?.status).toBe("accepted");
  // De sibling-cancel ruimt het tussendoor-concept op (bestaand gedrag).
  expect(nieuwere?.status).toBe("cancelled");
});
