import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { computeProjectNextStep, projectWorklistItem } from "../../convex/projecten/nextStep";
import { fieldBucket } from "../../convex/projecten/fieldService";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");
const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

function stubAuth() {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
}

const DAG = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// B7 — de terugweg (afgeronde inmeting) is zichtbaar voor de winkel
// ---------------------------------------------------------------------------
describe("B7: afgeronde inmeting geeft een signaal richting winkel", () => {
  test("draft → measured logt een measurement_completed-workflow-event", async () => {
    stubAuth();
    const t = convexTest(schema, modules);
    const now = Date.now();
    const ids = await t.run(async (ctx) => {
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
        tenantId, klantId: customerId, titel: "Testproject", status: "measurement_planned", aangemaaktOp: now, gewijzigdOp: now
      });
      const measurementId = await ctx.db.insert("measurements", {
        tenantId, projectId, klantId: customerId, status: "draft", gemetenDoor: "Wim",
        aangemaaktOp: now, gewijzigdOp: now
      });
      return { tenantId, projectId, measurementId };
    });

    await t.mutation(api.projecten.measurements.updateMeasurement, {
      tenantId: ids.tenantId, actor, inmetingId: ids.measurementId, status: "measured"
    });

    const events = await t.run(async (ctx) =>
      ctx.db
        .query("projectWorkflowEvents")
        .withIndex("by_project", (q) => q.eq("tenantId", ids.tenantId).eq("projectId", ids.projectId))
        .collect()
    );
    expect(events.some((event) => event.type === "measurement_completed")).toBe(true);
  });

  test("nextStep toont 'Offerte maken' zodra de inmeting is afgerond", () => {
    const nogNietGemeten = computeProjectNextStep({
      status: "measurement_planned", projectId: "p1", latestQuoteId: null, invoiceId: null,
      measurementStatus: "draft"
    });
    expect(nogNietGemeten.actionLabel).toBe("Inmeting uitvoeren");

    const gemeten = computeProjectNextStep({
      status: "measurement_planned", projectId: "p1", latestQuoteId: null, invoiceId: null,
      measurementStatus: "measured"
    });
    expect(gemeten.kind).toBe("make_quote");
    expect(gemeten.phaseLabel).toBe("Inmeting afgerond");
  });

  test("werklijst-item schakelt om naar 'offerte maken' na een afgeronde inmeting", () => {
    expect(projectWorklistItem("measurement_planned")?.title).toBe("Inmeting voorbereiden");
    expect(
      projectWorklistItem("measurement_planned", { measurementCompleted: true })?.title
    ).toContain("offerte maken");
  });
});

// ---------------------------------------------------------------------------
// O7/O14/O12 — buitendienst-buckets: afgerond werk stroomt door, na-meting en
// montage zijn zichtbaar
// ---------------------------------------------------------------------------
describe("O7/O14/O12: buitendienst-buckets", () => {
  const now = Date.now();
  const gisteren = now - DAG;
  const overMorgen = now + 2 * DAG;

  test("O7: een al ingemeten bezoek van gisteren blijft niet in 'Vandaag' hangen", () => {
    const project = { status: "measurement_planned", inmeetdatum: gisteren } as unknown as Doc<"projects">;
    const gemeten = { status: "measured", inmeetdatum: gisteren } as unknown as Doc<"measurements">;
    expect(fieldBucket(project, undefined, gemeten, now, [])).toBe("quote");

    // Niet-gemeten bezoek van gisteren blijft wél (terecht) achterstallig in Vandaag.
    const concept = { status: "draft", inmeetdatum: gisteren } as unknown as Doc<"measurements">;
    expect(fieldBucket(project, undefined, concept, now, [])).toBe("today");
  });

  test("O14: een geplande na-meting op een al gemeten dossier valt onder 'Inmeten'", () => {
    const project = { status: "measurement_planned", inmeetdatum: overMorgen } as unknown as Doc<"projects">;
    const gemeten = { status: "measured", inmeetdatum: overMorgen } as unknown as Doc<"measurements">;
    expect(fieldBucket(project, undefined, gemeten, now, [])).toBe("measure");
  });

  test("O12: een geplande montagedatum bereikt de buitendienst in de bestelfase", () => {
    const project = {
      status: "ordering", uitvoerdatum: now
    } as unknown as Doc<"projects">;
    // Montagedag zelf → Vandaag bezoeken.
    expect(fieldBucket(project, undefined, undefined, now, [])).toBe("today");

    // Na facturatie is de montage historie: geen eeuwige 'Vandaag'.
    const gefactureerd = {
      status: "invoiced", uitvoerdatum: gisteren
    } as unknown as Doc<"projects">;
    expect(fieldBucket(gefactureerd, undefined, undefined, now, [])).toBe("followUp");
  });
});

// ---------------------------------------------------------------------------
// B20 — vrije statuspatch-mutaties zijn een admin-vangnet
// ---------------------------------------------------------------------------
describe("B20: vrije statuspatch alleen voor admin", () => {
  test("updateProjectStatus weigert een gewone gebruiker", async () => {
    stubAuth();
    const t = convexTest(schema, modules);
    const now = Date.now();
    const ids = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        slug: "henke-wonen", naam: "Henke Wonen", status: "active", aangemaaktOp: now, gewijzigdOp: now
      });
      await ctx.db.insert("users", {
        tenantId, externalUserId: "monteur", email: "wim@henke.nl", role: "user", aangemaaktOp: now, gewijzigdOp: now
      });
      const customerId = await ctx.db.insert("customers", {
        tenantId, type: "private", weergaveNaam: "Testklant", status: "active", aangemaaktOp: now, gewijzigdOp: now
      });
      const projectId = await ctx.db.insert("projects", {
        tenantId, klantId: customerId, titel: "Testproject", status: "lead", aangemaaktOp: now, gewijzigdOp: now
      });
      return { tenantId, projectId };
    });

    await expect(
      t.mutation(api.portal.updateProjectStatus, {
        tenantSlug: "henke-wonen",
        actor: { externalUserId: "monteur", authzToken: "dev.actor.henke-wonen.monteur" },
        projectId: String(ids.projectId),
        status: "paid"
      })
    ).rejects.toThrow();

    const project = await t.run(async (ctx) => ctx.db.get(ids.projectId));
    expect(project?.status).toBe("lead");
  });
});
