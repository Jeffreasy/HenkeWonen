import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const externalUserId = "dev-user-1";
const actor = { externalUserId, authzToken: `dev.actor.henke-wonen.${externalUserId}` };

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

async function seed(t: ReturnType<typeof convexTest>) {
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
      titel: "Testproject",
      status: "lead",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return { tenantId, klantId, projectId };
  });
}

test("createDossierAttachment legt een dossierstuk vast op de klant (zonder project)", async () => {
  const t = convexTest(schema, modules);
  const { klantId } = await seed(t);

  const id = await t.mutation(api.portal.createDossierAttachment, {
    tenantSlug: "henke-wonen",
    actor,
    klantId,
    kind: "physical_dossier",
    titel: "Fysieke map kast 3"
  });

  const row = await t.run((ctx) => ctx.db.get(id));
  expect(row?.status).toBe("active");
  expect(row?.titel).toBe("Fysieke map kast 3");
  expect(row?.projectId).toBeUndefined();
  expect(row?.createdByExternalUserId).toBe(externalUserId);
});

test("createDossierAttachment koppelt aan een project van dezelfde klant", async () => {
  const t = convexTest(schema, modules);
  const { klantId, projectId } = await seed(t);

  const id = await t.mutation(api.portal.createDossierAttachment, {
    tenantSlug: "henke-wonen",
    actor,
    klantId,
    projectId,
    kind: "floor_plan",
    titel: "Plattegrond woonkamer"
  });

  const row = await t.run((ctx) => ctx.db.get(id));
  expect(row?.projectId).toBe(projectId);
});

test("createDossierAttachment weigert een project van een andere klant", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, klantId } = await seed(t);
  const now = Date.now();

  const anderProjectId = await t.run(async (ctx) => {
    const andereKlant = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: "Andere klant",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return await ctx.db.insert("projects", {
      tenantId,
      klantId: andereKlant,
      titel: "Ander project",
      status: "lead",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  await expect(
    t.mutation(api.portal.createDossierAttachment, {
      tenantSlug: "henke-wonen",
      actor,
      klantId,
      projectId: anderProjectId,
      kind: "floor_plan",
      titel: "Verkeerd gekoppeld"
    })
  ).rejects.toThrow();
});

test("archiveDossierAttachment verbergt het stuk uit customerDetail", async () => {
  const t = convexTest(schema, modules);
  const { klantId } = await seed(t);

  const blijft = await t.mutation(api.portal.createDossierAttachment, {
    tenantSlug: "henke-wonen",
    actor,
    klantId,
    kind: "photo",
    titel: "Foto situatie"
  });
  const wegId = await t.mutation(api.portal.createDossierAttachment, {
    tenantSlug: "henke-wonen",
    actor,
    klantId,
    kind: "scan",
    titel: "Te archiveren scan"
  });

  await t.mutation(api.portal.archiveDossierAttachment, {
    tenantSlug: "henke-wonen",
    actor,
    attachmentId: wegId
  });

  const detail = await t.query(api.portal.customerDetail, {
    tenantSlug: "henke-wonen",
    klantId,
    actor
  });

  expect(detail?.attachments).toHaveLength(1);
  expect(detail?.attachments[0].id).toBe(blijft);
  expect(detail?.attachments[0].titel).toBe("Foto situatie");
});

test("customerDetail geeft geen permanente URL meer terug, alleen hasFile", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, klantId } = await seed(t);
  const now = Date.now();

  // Stuk mét bestand (storageId) en stuk zonder (fysieke-map-verwijzing).
  await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["foto-bytes"]));
    await ctx.db.insert("dossierAttachments", {
      tenantId,
      klantId,
      kind: "photo",
      titel: "Met bestand",
      storageId,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("dossierAttachments", {
      tenantId,
      klantId,
      kind: "physical_dossier",
      titel: "Zonder bestand",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  const detail = await t.query(api.portal.customerDetail, {
    tenantSlug: "henke-wonen",
    klantId,
    actor
  });

  const byTitle = new Map(detail?.attachments.map((a) => [a.titel, a]));
  expect(byTitle.get("Met bestand")?.hasFile).toBe(true);
  expect(byTitle.get("Zonder bestand")?.hasFile).toBe(false);
  // Er lekt geen directe/permanente URL meer via de query.
  for (const attachment of detail?.attachments ?? []) {
    expect((attachment as Record<string, unknown>).fileUrl).toBeUndefined();
  }
});

test("getDossierAttachmentFile levert de storage-URL voor een actief stuk met bestand", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, klantId } = await seed(t);
  const now = Date.now();

  const attachmentId = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["pdf-bytes"]));
    return await ctx.db.insert("dossierAttachments", {
      tenantId,
      klantId,
      kind: "scan",
      titel: "Werkbon",
      bestandsnaam: "werkbon.pdf",
      bestandstype: "application/pdf",
      storageId,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  const file = await t.query(api.portal.getDossierAttachmentFile, {
    tenantSlug: "henke-wonen",
    actor,
    attachmentId
  });

  expect(file).not.toBeNull();
  expect(typeof file?.url).toBe("string");
  expect(file?.url.length).toBeGreaterThan(0);
  expect(file?.bestandsnaam).toBe("werkbon.pdf");
  expect(file?.bestandstype).toBe("application/pdf");
});

test("getDossierAttachmentFile weigert een gearchiveerd of bestandsloos stuk (null)", async () => {
  const t = convexTest(schema, modules);
  const { tenantId, klantId } = await seed(t);
  const now = Date.now();

  const { gearchiveerd, zonderBestand } = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["x"]));
    const gearchiveerd = await ctx.db.insert("dossierAttachments", {
      tenantId,
      klantId,
      kind: "scan",
      titel: "Gearchiveerd",
      storageId,
      status: "archived",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const zonderBestand = await ctx.db.insert("dossierAttachments", {
      tenantId,
      klantId,
      kind: "physical_dossier",
      titel: "Alleen verwijzing",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return { gearchiveerd, zonderBestand };
  });

  expect(
    await t.query(api.portal.getDossierAttachmentFile, {
      tenantSlug: "henke-wonen",
      actor,
      attachmentId: gearchiveerd
    })
  ).toBeNull();
  expect(
    await t.query(api.portal.getDossierAttachmentFile, {
      tenantSlug: "henke-wonen",
      actor,
      attachmentId: zonderBestand
    })
  ).toBeNull();
});

test("getDossierAttachmentFile lekt geen bestand van een andere tenant (null)", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  const now = Date.now();

  // Een tweede tenant met een eigen klant + dossierstuk-met-bestand.
  const vreemdAttachmentId = await t.run(async (ctx) => {
    const andereTenant = await ctx.db.insert("tenants", {
      slug: "andere-winkel",
      naam: "Andere Winkel",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const andereKlant = await ctx.db.insert("customers", {
      tenantId: andereTenant,
      type: "private",
      weergaveNaam: "Klant B",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const storageId = await ctx.storage.store(new Blob(["geheim"]));
    return await ctx.db.insert("dossierAttachments", {
      tenantId: andereTenant,
      klantId: andereKlant,
      kind: "scan",
      titel: "Vreemd stuk",
      storageId,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  // Actor van henke-wonen mag het stuk van de andere tenant niet kunnen ophalen.
  expect(
    await t.query(api.portal.getDossierAttachmentFile, {
      tenantSlug: "henke-wonen",
      actor,
      attachmentId: vreemdAttachmentId
    })
  ).toBeNull();
});

test("getDossierAttachmentFile eist het proxy-geheim zodra DOSSIERBESTAND_PROXY_SECRET staat", async () => {
  vi.stubEnv("DOSSIERBESTAND_PROXY_SECRET", "server-only-geheim");

  const t = convexTest(schema, modules);
  const { tenantId, klantId } = await seed(t);
  const now = Date.now();

  const attachmentId = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["pdf-bytes"]));
    return await ctx.db.insert("dossierAttachments", {
      tenantId,
      klantId,
      kind: "scan",
      titel: "Werkbon",
      storageId,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  // Zonder (of met een verkeerd) geheim — zoals een client die de query rechtstreeks
  // aanroept — lekt de permanente URL niet.
  expect(
    await t.query(api.portal.getDossierAttachmentFile, {
      tenantSlug: "henke-wonen",
      actor,
      attachmentId
    })
  ).toBeNull();
  expect(
    await t.query(api.portal.getDossierAttachmentFile, {
      tenantSlug: "henke-wonen",
      actor,
      attachmentId,
      proxySecret: "fout"
    })
  ).toBeNull();

  // De proxyroute (met het juiste geheim) krijgt het bestand wel.
  const file = await t.query(api.portal.getDossierAttachmentFile, {
    tenantSlug: "henke-wonen",
    actor,
    attachmentId,
    proxySecret: "server-only-geheim"
  });
  expect(file).not.toBeNull();
  expect(typeof file?.url).toBe("string");
});
