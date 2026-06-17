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

/** Als seedBezoek, maar met klusgrootte (omvang) én geeft de projectId terug. */
async function seedBezoekMet(
  t: ReturnType<typeof convexTest>,
  tenantId: any,
  gemetenDoor: string,
  inmeetdatum: number,
  omvang?: "klein" | "volledig"
): Promise<any> {
  const now = Date.now();
  return await t.run(async (ctx) => {
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
      omvang,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return projectId;
  });
}

// Vaste referentiedagen in juni 2026 (lokale tijd, middag-verankerd):
//   ma 15 / vr 19 = geen inmeetdag, di 16 / wo 17 / do 18 = inmeetdagen.
const MA_15_JUNI = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
const DI_16_JUNI = new Date(2026, 5, 16, 12, 0, 0, 0).getTime();
const WO_17_JUNI = new Date(2026, 5, 17, 12, 0, 0, 0).getTime();
const DO_18_JUNI = new Date(2026, 5, 18, 12, 0, 0, 0).getTime();
const VR_19_JUNI = new Date(2026, 5, 19, 12, 0, 0, 0).getTime();

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

test("inmeetBeschikbaarheid: inmeetdag-detectie, vast venster en lege capaciteit", async () => {
  enableDevAuth();
  const t = convexTest(schema, modules);
  const tenantId = await seedTenant(t);
  const wim = await seedMonteur(t, tenantId, "Wim");

  // Maandag is geen inmeetdag.
  const maandag = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    datum: MA_15_JUNI
  });
  expect(maandag.isInmeetdag).toBe(false);
  expect(maandag.weekdag).toBe(0);
  expect(maandag.venster).toMatchObject({ startMinuut: 990, eindMinuut: 1050 });
  expect(maandag.maxCapaciteit).toBe(2);
  expect(maandag.vrijeCapaciteit).toBe(2);

  // Dinsdag is wél een inmeetdag; zonder boekingen is alles vrij.
  const dinsdag = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    datum: DI_16_JUNI
  });
  expect(dinsdag.isInmeetdag).toBe(true);
  expect(dinsdag.weekdag).toBe(1);
  expect(dinsdag.gebruikteCapaciteit).toBe(0);
  expect(dinsdag.vrijeCapaciteit).toBe(2);
  expect(dinsdag.bezoeken).toHaveLength(0);

  // Ook de bovenrand van de reeks: wo en do zijn inmeetdagen, vr niet.
  for (const [datum, verwacht] of [
    [WO_17_JUNI, true],
    [DO_18_JUNI, true],
    [VR_19_JUNI, false]
  ] as const) {
    const res = await t.query(api.portal.inmeetBeschikbaarheid, {
      tenantSlug: "henke-wonen",
      actor,
      userId: wim,
      datum
    });
    expect(res.isInmeetdag).toBe(verwacht);
    expect(res.venster).toMatchObject({ startMinuut: 990, eindMinuut: 1050 });
  }
});

test("inmeetBeschikbaarheid: capaciteit telt klusgrootte (klein=1, volledig=2, onbekend=1)", async () => {
  enableDevAuth();
  const t = convexTest(schema, modules);
  const tenantId = await seedTenant(t);
  const wim = await seedMonteur(t, tenantId, "Wim");

  // Eén klein klusje → nog 1 plek vrij.
  await seedBezoekMet(t, tenantId, "Wim", DI_16_JUNI, "klein");
  let res = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    datum: DI_16_JUNI
  });
  expect(res.gebruikteCapaciteit).toBe(1);
  expect(res.vrijeCapaciteit).toBe(1);
  expect(res.bezoeken).toHaveLength(1);
  expect(res.bezoeken[0].omvang).toBe("klein");

  // Nog een klein klusje erbij → dag vol (2/2).
  await seedBezoekMet(t, tenantId, "Wim", DI_16_JUNI, "klein");
  res = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    datum: DI_16_JUNI
  });
  expect(res.gebruikteCapaciteit).toBe(2);
  expect(res.vrijeCapaciteit).toBe(0);
  expect(res.bezoeken).toHaveLength(2);

  // Aparte monteur: één volledige woning vult de hele dag (2 units).
  const bob = await seedMonteur(t, tenantId, "Bob");
  await seedBezoekMet(t, tenantId, "Bob", DI_16_JUNI, "volledig");
  const bobRes = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: bob,
    datum: DI_16_JUNI
  });
  expect(bobRes.gebruikteCapaciteit).toBe(2);
  expect(bobRes.vrijeCapaciteit).toBe(0);

  // Onbekende omvang (legacy) telt als klein (1 unit).
  const nina = await seedMonteur(t, tenantId, "Nina");
  await seedBezoekMet(t, tenantId, "Nina", DI_16_JUNI);
  const ninaRes = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: nina,
    datum: DI_16_JUNI
  });
  expect(ninaRes.gebruikteCapaciteit).toBe(1);

  // Overboeking (geen harde handhaving): klein + volledig = 3 units; vrij wordt op 0 geklemd.
  const tom = await seedMonteur(t, tenantId, "Tom");
  await seedBezoekMet(t, tenantId, "Tom", DI_16_JUNI, "klein");
  await seedBezoekMet(t, tenantId, "Tom", DI_16_JUNI, "volledig");
  const tomRes = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: tom,
    datum: DI_16_JUNI
  });
  expect(tomRes.gebruikteCapaciteit).toBe(3);
  expect(tomRes.vrijeCapaciteit).toBe(0);
});

test("inmeetBeschikbaarheid: afwezigheid melden en excludeProjectId niet meetellen", async () => {
  enableDevAuth();
  const t = convexTest(schema, modules);
  const tenantId = await seedTenant(t);
  const wim = await seedMonteur(t, tenantId, "Wim");

  // Afwezigheid die exact de inmeetdag dekt.
  const dagMidernacht = new Date(2026, 5, 16, 0, 0, 0, 0).getTime();
  await t.mutation(api.portal.addAfwezigheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    type: "ziek",
    vanafDatum: dagMidernacht,
    totDatum: dagMidernacht,
    heleDag: true,
    reden: "Griep"
  });
  const metAfwezig = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    datum: DI_16_JUNI
  });
  expect(metAfwezig.afwezig).not.toBeNull();
  expect(metAfwezig.afwezig?.type).toBe("ziek");

  // excludeProjectId: het bezoek van het eigen dossier telt niet mee bij herplannen.
  const eigenProject = await seedBezoekMet(t, tenantId, "Wim", DI_16_JUNI, "volledig");
  const zonderExclude = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    datum: DI_16_JUNI
  });
  expect(zonderExclude.gebruikteCapaciteit).toBe(2);

  const metExclude = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    datum: DI_16_JUNI,
    excludeProjectId: eigenProject
  });
  expect(metExclude.gebruikteCapaciteit).toBe(0);
});

test("startOrPlanMeasurement: herplannen behoudt omvang en werkt de monteur bij", async () => {
  enableDevAuth();
  const t = convexTest(schema, modules);
  const tenantId = await seedTenant(t);
  const wim = await seedMonteur(t, tenantId, "Wim");
  const bob = await seedMonteur(t, tenantId, "Bob");

  // Begin: dossier + inmeting (volledige woning, Wim) op dinsdag.
  const projectId = await t.run(async (ctx) => {
    const now = Date.now();
    const klantId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Klant",
      status: "lead",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const pid = await ctx.db.insert("projects", {
      tenantId,
      klantId,
      titel: "Dossier",
      status: "measurement_planned",
      inmeetdatum: DI_16_JUNI,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("measurements", {
      tenantId,
      projectId: pid,
      klantId,
      status: "draft",
      inmeetdatum: DI_16_JUNI,
      gemetenDoor: "Wim",
      omvang: "volledig",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return pid;
  });

  // Herplan naar woensdag, andere monteur (Bob), omvang ongewijzigd meegestuurd ("volledig").
  await t.mutation(api.portal.startOrPlanMeasurement, {
    tenantSlug: "henke-wonen",
    actor,
    projectId,
    inmeetdatum: WO_17_JUNI,
    gemetenDoor: "Bob",
    omvang: "volledig"
  });

  const meting = await t.run((ctx) =>
    ctx.db
      .query("measurements")
      .withIndex("by_project", (q) => q.eq("tenantId", tenantId).eq("projectId", projectId))
      .first()
  );
  expect(meting?.omvang).toBe("volledig"); // NIET stil teruggevallen naar "klein"
  expect(meting?.gemetenDoor).toBe("Bob"); // monteur is bijgewerkt
  expect(meting?.inmeetdatum).toBe(WO_17_JUNI);

  // Capaciteit volgt mee: Bob heeft woensdag de volle dag (2 units), Wim niets.
  const bobRes = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: bob,
    datum: WO_17_JUNI
  });
  expect(bobRes.gebruikteCapaciteit).toBe(2);
  const wimRes = await t.query(api.portal.inmeetBeschikbaarheid, {
    tenantSlug: "henke-wonen",
    actor,
    userId: wim,
    datum: WO_17_JUNI
  });
  expect(wimRes.gebruikteCapaciteit).toBe(0);
});
