import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

// convex-test laadt de functie-modules; tests staan buiten convex/, dus expliciet de glob.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

/** Een geldige inmeetdag (di/wo/do) op het middaguur. getDay: 2=di, 3=wo, 4=do. */
function inmeetdagNoon(getDay: number) {
  const d = new Date(2026, 5, 1, 12, 0, 0);
  while (d.getDay() !== getDay) d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

async function seed(t: ReturnType<typeof convexTest>, initialDate: number) {
  const now = Date.now();
  const externalUserId = "dev-user-1";

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
    const klantId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Testklant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId,
      klantId,
      titel: "Testdossier",
      status: "lead",
      inmeetdatum: initialDate,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const inmetingId = await ctx.db.insert("measurements", {
      tenantId,
      projectId,
      klantId,
      status: "draft",
      inmeetdatum: initialDate,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return { tenantId, externalUserId, projectId, inmetingId };
  });
}

test("updateMeasurement synct de nieuwe inmeetdatum terug naar het dossier", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");

  const t = convexTest(schema, modules);
  const initialDate = Date.now();
  const { tenantId, externalUserId, projectId, inmetingId } = await seed(t, initialDate);

  const newDate = inmeetdagNoon(3); // woensdag — geldige inmeetdag
  const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

  await t.mutation(api.projecten.measurements.updateMeasurement, {
    tenantId,
    actor,
    inmetingId,
    inmeetdatum: newDate
  });

  const project = await t.run((ctx) => ctx.db.get(projectId));
  const measurement = await t.run((ctx) => ctx.db.get(inmetingId));
  expect(measurement?.inmeetdatum).toBe(newDate);
  expect(project?.inmeetdatum).toBe(newDate); // dossier loopt mee
});

test("updateProject synct de nieuwe inmeetdatum naar de laatste inmeting", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");

  const t = convexTest(schema, modules);
  const initialDate = Date.now();
  const { externalUserId, projectId, inmetingId } = await seed(t, initialDate);

  const newDate = inmeetdagNoon(4); // donderdag — geldige inmeetdag
  const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

  await t.mutation(api.projecten.core.updateProject, {
    tenantSlug: "henke-wonen",
    actor,
    projectId,
    inmeetdatum: newDate
  });

  const project = await t.run((ctx) => ctx.db.get(projectId));
  const measurement = await t.run((ctx) => ctx.db.get(inmetingId));
  expect(project?.inmeetdatum).toBe(newDate);
  expect(measurement?.inmeetdatum).toBe(newDate); // inmeting loopt mee
});
