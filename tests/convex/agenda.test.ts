import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

// convex-test laadt de functie-modules; tests staan buiten convex/, dus expliciet de glob.
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const externalUserId = "dev-admin-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };
const DAG_MS = 24 * 60 * 60 * 1000;

function enableDevAuth() {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
}

async function seedTenant(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen",
      naam: "Henke Wonen",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    // Actor-gebruiker (admin) waarmee de API-calls geautoriseerd worden.
    await ctx.db.insert("users", {
      tenantId,
      externalUserId,
      email: "admin@henke.nl",
      role: "admin",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return tenantId;
  });
}

async function seedMonteur(t: ReturnType<typeof convexTest>, tenantId: any, naam: string) {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      tenantId,
      externalUserId: `ext-${naam.toLowerCase()}`,
      email: `${naam.toLowerCase()}@henke.nl`,
      naam,
      role: "user",
      workspaceMode: "field",
      aangemaaktOp: now,
      gewijzigdOp: now
    })
  );
}

async function seedBezoek(
  t: ReturnType<typeof convexTest>,
  tenantId: any,
  gemetenDoor: string,
  inmeetdatum: number
) {
  const now = Date.now();
  await t.run(async (ctx) => {
    const klantId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Klant " + gemetenDoor,
      status: "lead",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const projectId = await ctx.db.insert("projects", {
      tenantId,
      klantId,
      titel: "Inmeting " + gemetenDoor,
      status: "measurement_planned",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("measurements", {
      tenantId,
      projectId,
      klantId,
      status: "draft",
      inmeetdatum,
      gemetenDoor,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });
}

test("werktijden: round-trip via set/get en validatie", async () => {
  enableDevAuth();
  const t = convexTest(schema, modules);
  const tenantId = await seedTenant(t);
  const wim = await seedMonteur(t, tenantId, "Wim");

  await t.mutation(api.portal.setMonteurWerktijden, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    werktijden: [
      { weekdag: 0, startMinuut: 480, eindMinuut: 1020 },
      { weekdag: 1, startMinuut: 480, eindMinuut: 720 }
    ]
  });

  const werktijden = await t.query(api.portal.getMonteurWerktijden, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim
  });
  expect(werktijden).toHaveLength(2);
  expect(werktijden[0]).toMatchObject({ weekdag: 0, startMinuut: 480, eindMinuut: 1020 });

  // Idempotent vervangen: tweede set overschrijft de eerste (geen stapeling).
  await t.mutation(api.portal.setMonteurWerktijden, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    werktijden: [{ weekdag: 2, startMinuut: 540, eindMinuut: 1000 }]
  });
  const naVervang = await t.query(api.portal.getMonteurWerktijden, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim
  });
  expect(naVervang).toHaveLength(1);
  expect(naVervang[0].weekdag).toBe(2);

  // Validatie: starttijd ná eindtijd wordt geweigerd.
  await expect(
    t.mutation(api.portal.setMonteurWerktijden, {
      tenantSlug: "henke-wonen",
      actor,
      userId: wim,
      werktijden: [{ weekdag: 0, startMinuut: 1020, eindMinuut: 480 }]
    })
  ).rejects.toThrow(/vóór de eindtijd/i);

  // Validatie: ongeldige weekdag.
  await expect(
    t.mutation(api.portal.setMonteurWerktijden, {
      tenantSlug: "henke-wonen",
      actor,
      userId: wim,
      werktijden: [{ weekdag: 7, startMinuut: 480, eindMinuut: 1020 }]
    })
  ).rejects.toThrow(/weekdag/i);
});

test("agendaWeek: bezoeken gematcht op monteurnaam, week-venster, werktijden en afwezigheid", async () => {
  enableDevAuth();
  const t = convexTest(schema, modules);
  const tenantId = await seedTenant(t);
  const wim = await seedMonteur(t, tenantId, "Wim");
  await seedMonteur(t, tenantId, "Bob");

  const weekStart = Date.now();
  await seedBezoek(t, tenantId, "Wim", weekStart + 1 * DAG_MS); // binnen de week, Wim
  await seedBezoek(t, tenantId, "Bob", weekStart + 2 * DAG_MS); // binnen de week, Bob
  await seedBezoek(t, tenantId, "Wim", weekStart - 1 * DAG_MS); // buiten de week → niet meetellen

  await t.mutation(api.portal.setMonteurWerktijden, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    werktijden: [{ weekdag: 0, startMinuut: 480, eindMinuut: 1020 }]
  });
  await t.mutation(api.portal.addAfwezigheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    type: "verlof",
    vanafDatum: weekStart + 3 * DAG_MS,
    totDatum: weekStart + 4 * DAG_MS,
    heleDag: true,
    reden: "Vrije dag"
  });

  // Alleen Wim opvragen.
  const wimAgenda = await t.query(api.portal.agendaWeek, {
    tenantSlug: "henke-wonen",
    actor,
    weekStart,
    userId: wim
  });
  expect(wimAgenda.monteurs).toHaveLength(1);
  const wimEntry = wimAgenda.monteurs[0];
  expect(wimEntry.monteur.naam).toBe("Wim");
  expect(wimEntry.bezoeken).toHaveLength(1); // alleen het in-week bezoek
  expect(wimEntry.bezoeken[0].gemetenDoor).toBe("Wim");
  expect(wimEntry.werktijden).toHaveLength(1);
  expect(wimEntry.afwezigheden).toHaveLength(1);
  expect(wimEntry.afwezigheden[0].type).toBe("verlof");

  // Alle monteurs (+ admin) opvragen: Wim heeft 1, Bob heeft 1 in-week bezoek.
  const alle = await t.query(api.portal.agendaWeek, {
    tenantSlug: "henke-wonen",
    actor,
    weekStart
  });
  const byNaam = Object.fromEntries(alle.monteurs.map((m: any) => [m.monteur.naam, m]));
  expect(byNaam["Wim"].bezoeken).toHaveLength(1);
  expect(byNaam["Bob"].bezoeken).toHaveLength(1);
});

test("agendaWeek: tenant-isolatie — geen bezoeken van een andere tenant", async () => {
  enableDevAuth();
  const t = convexTest(schema, modules);
  const tenantId = await seedTenant(t);
  const wim = await seedMonteur(t, tenantId, "Wim");

  // Tweede tenant met een eigen monteur 'Wim' + bezoek op hetzelfde moment.
  const weekStart = Date.now();
  const otherTenantId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("tenants", {
      slug: "andere-tenant",
      naam: "Andere",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });
  await seedMonteur(t, otherTenantId, "Wim");
  await seedBezoek(t, otherTenantId, "Wim", weekStart + 1 * DAG_MS);

  const wimAgenda = await t.query(api.portal.agendaWeek, {
    tenantSlug: "henke-wonen",
    actor,
    weekStart,
    userId: wim
  });
  expect(wimAgenda.monteurs[0].bezoeken).toHaveLength(0); // niets uit de andere tenant
});
