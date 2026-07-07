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

    async function template(naam: string, type: string, inleiding: string, voorwaarde: string) {
      return await ctx.db.insert("quoteTemplates", {
        tenantId,
        naam,
        type: type as any,
        inleidingTekst: inleiding,
        afsluitTekst: `Afsluit ${type}`,
        standaardVoorwaarden: [voorwaarde],
        betalingsvoorwaarden: [],
        standaardRegels: [],
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    const defaultTemplate = await template("Standaard", "default", "Standaard inleiding", "Standaard voorwaarde");
    const flooringTemplate = await template("Vloeren", "flooring", "Vloeren inleiding", "Vloeren voorwaarde");

    return { tenantId, projectId, defaultTemplate, flooringTemplate };
  });
}

test("createQuote zonder templateId gebruikt het standaardsjabloon (default)", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);

  const quoteId = await t.mutation(api.portal.createQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId: String(projectId),
    titel: "Offerte A"
  });

  const quote = await t.run(async (ctx) => ctx.db.get(quoteId));
  expect(quote!.inleidingTekst).toBe("Standaard inleiding");
  expect(quote!.voorwaarden).toEqual(["Standaard voorwaarde"]);
});

test("createQuote met een gekozen sjabloon gebruikt dat sjabloon (niet-default bereikbaar)", async () => {
  const t = convexTest(schema, modules);
  const { projectId, flooringTemplate } = await seed(t);

  const quoteId = await t.mutation(api.portal.createQuote, {
    tenantSlug: "henke-wonen",
    actor,
    projectId: String(projectId),
    titel: "Offerte B",
    templateId: String(flooringTemplate)
  });

  const quote = await t.run(async (ctx) => ctx.db.get(quoteId));
  expect(quote!.inleidingTekst).toBe("Vloeren inleiding");
  expect(quote!.voorwaarden).toEqual(["Vloeren voorwaarde"]);
});

test("createQuote met een sjabloon van een andere tenant wordt geweigerd", async () => {
  const t = convexTest(schema, modules);
  const { projectId } = await seed(t);

  const foreignTemplate = await t.run(async (ctx) => {
    const now = Date.now();
    const otherTenantId = await ctx.db.insert("tenants", {
      slug: "andere-winkel",
      naam: "Andere Winkel",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return await ctx.db.insert("quoteTemplates", {
      tenantId: otherTenantId,
      naam: "Vreemd",
      type: "default",
      standaardVoorwaarden: [],
      betalingsvoorwaarden: [],
      standaardRegels: [],
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });

  await expect(
    t.mutation(api.portal.createQuote, {
      tenantSlug: "henke-wonen",
      actor,
      projectId: String(projectId),
      titel: "Offerte C",
      templateId: String(foreignTemplate)
    })
  ).rejects.toThrow(/Offertesjabloon niet gevonden/);
});
