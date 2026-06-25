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
