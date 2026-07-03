import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const adminUserId = "dev-admin-1";
const adminActor = { externalUserId: adminUserId, authzToken: `dev.actor.henke-wonen.${adminUserId}` };
const editorUserId = "dev-editor-1";
const editorActor = {
  externalUserId: editorUserId,
  authzToken: `dev.actor.henke-wonen.${editorUserId}`
};

beforeEach(() => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
  vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
});

type Seeded = {
  tenantId: Id<"tenants">;
  klantId: Id<"customers">;
  projectId: Id<"projects">;
  storageId: Id<"_storage">;
  attachmentId: Id<"dossierAttachments">;
  measurementId: Id<"measurements">;
  quoteId: Id<"quotes">;
};

/**
 * Seedt een klant met een volledige boom: project + ruimte + inmeting (+ruimte/regel) +
 * offerte (+regel) + leveranciersbestelling (+regel) + contactmoment + dossierstuk met
 * bestand. Optioneel een factuur op het project (voor de anonimiseer-tak).
 */
async function seedCustomer(
  t: ReturnType<typeof convexTest>,
  options: { withInvoice: boolean; naam?: string }
): Promise<Seeded> {
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
      externalUserId: adminUserId,
      email: "admin@henke.nl",
      role: "admin",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId,
      externalUserId: editorUserId,
      email: "editor@henke.nl",
      role: "editor",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const klantId = await ctx.db.insert("customers", {
      tenantId,
      type: "private",
      weergaveNaam: options.naam ?? "Jan Jansen",
      email: "jan@example.nl",
      telefoon: "0612345678",
      straat: "Dorpsstraat",
      huisnummer: "1",
      postcode: "1234 AB",
      plaats: "Ergens",
      notities: "Persoonlijke notitie",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const projectId = await ctx.db.insert("projects", {
      tenantId,
      klantId,
      titel: "Woonkamer vloer",
      omschrijving: "vrije tekst",
      interneNotities: "interne notitie",
      klantNotities: "klantnotitie",
      status: "quote_accepted",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const projectRoomId = await ctx.db.insert("projectRooms", {
      tenantId,
      projectId,
      naam: "Woonkamer",
      sortOrder: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const measurementId = await ctx.db.insert("measurements", {
      tenantId,
      projectId,
      klantId,
      status: "measured",
      inmeetdatum: now,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const measurementRoomId = await ctx.db.insert("measurementRooms", {
      tenantId,
      inmetingId: measurementId,
      projectRuimteId: projectRoomId,
      naam: "Woonkamer",
      sortOrder: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("measurementLines", {
      tenantId,
      inmetingId: measurementId,
      ruimteId: measurementRoomId,
      productGroep: "flooring",
      berekeningType: "area",
      invoer: {},
      resultaat: {},
      aantal: 10,
      eenheid: "m2",
      offerteRegelType: "product",
      quotePreparationStatus: "draft",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const quoteId = await ctx.db.insert("quotes", {
      tenantId,
      projectId,
      klantId,
      offertenummer: "OF-2026-001",
      titel: "Offerte woonkamer",
      status: "accepted",
      inleidingTekst: "Beste Jan",
      afsluitTekst: "Met groet",
      subtotaalExBtw: 100,
      btwTotaal: 21,
      totaalInclBtw: 121,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("quoteLines", {
      tenantId,
      quoteId,
      regelType: "product",
      titel: "PVC vloer",
      aantal: 10,
      eenheid: "m2",
      eenheidsprijsExBtw: 10,
      btwTarief: 21,
      regelTotaalExBtw: 100,
      regelBtwTotaal: 21,
      regelTotaalInclBtw: 121,
      sortOrder: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const supplierOrderId = await ctx.db.insert("supplierOrders", {
      tenantId,
      projectId,
      quoteId,
      status: "ordered",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("supplierOrderLines", {
      tenantId,
      bestellingId: supplierOrderId,
      omschrijving: "PVC",
      aantal: 10,
      eenheid: "m2",
      status: "ordered",
      sortOrder: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    await ctx.db.insert("customerContacts", {
      tenantId,
      klantId,
      type: "note",
      titel: "Belde over kleur",
      zichtbaarVoorKlant: false,
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const storageId = await ctx.storage.store(new Blob(["foto-bytes"]));
    const attachmentId = await ctx.db.insert("dossierAttachments", {
      tenantId,
      klantId,
      projectId,
      kind: "photo",
      titel: "Foto situatie",
      storageId,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    if (options.withInvoice) {
      await ctx.db.insert("invoices", {
        tenantId,
        projectId,
        klantId,
        quoteId,
        factuurnummer: "FAC-2026-001",
        status: "paid",
        factuurdatum: now,
        vervaldatum: now,
        subtotaalExBtw: 100,
        btwTotaal: 21,
        totaalInclBtw: 121,
        betaaldBedrag: 121,
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }

    return {
      tenantId,
      klantId,
      projectId,
      storageId,
      attachmentId,
      measurementId,
      quoteId
    };
  });
}

test("deleteCustomer zonder facturen verwijdert alles inclusief de klant", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedCustomer(t, { withInvoice: false });

  const result = await t.mutation(api.portal.deleteCustomer, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    klantId: seeded.klantId,
    bevestigNaam: "Jan Jansen"
  });

  expect(result.mode).toBe("deleted");

  await t.run(async (ctx) => {
    expect(await ctx.db.get(seeded.klantId)).toBeNull();
    expect(await ctx.db.get(seeded.projectId)).toBeNull();
    expect(await ctx.db.get(seeded.quoteId)).toBeNull();
    expect(await ctx.db.get(seeded.measurementId)).toBeNull();
    expect(await ctx.db.get(seeded.attachmentId)).toBeNull();
    // Het fysieke bestand is uit storage verwijderd.
    expect(await ctx.storage.getUrl(seeded.storageId)).toBeNull();

    // Geen wees-records blijven achter.
    const contacts = await ctx.db.query("customerContacts").collect();
    const quoteLines = await ctx.db.query("quoteLines").collect();
    const supplierOrders = await ctx.db.query("supplierOrders").collect();
    const measurementLines = await ctx.db.query("measurementLines").collect();
    expect(contacts).toHaveLength(0);
    expect(quoteLines).toHaveLength(0);
    expect(supplierOrders).toHaveLength(0);
    expect(measurementLines).toHaveLength(0);
  });
});

test("deleteCustomer mét facturen anonimiseert de klant en bewaart de factuur", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedCustomer(t, { withInvoice: true });

  const result = await t.mutation(api.portal.deleteCustomer, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    klantId: seeded.klantId,
    bevestigNaam: "Jan Jansen"
  });

  expect(result.mode).toBe("anonymized");

  await t.run(async (ctx) => {
    const customer = await ctx.db.get(seeded.klantId);
    expect(customer).not.toBeNull();
    // Naam + adres blijven (wettelijk vereist op de factuur).
    expect(customer?.weergaveNaam).toBe("Jan Jansen");
    expect(customer?.plaats).toBe("Ergens");
    // Overige persoonsgegevens gewist.
    expect(customer?.email).toBeUndefined();
    expect(customer?.telefoon).toBeUndefined();
    expect(customer?.notities).toBeUndefined();
    expect(customer?.status).toBe("archived");
    expect(typeof customer?.geanonimiseerdOp).toBe("number");
    expect(customer?.geanonimiseerdDoorExternalUserId).toBe(adminUserId);

    // Factuur blijft staan.
    const invoices = await ctx.db.query("invoices").collect();
    expect(invoices).toHaveLength(1);

    // Het gefactureerde project + offerte blijven bestaan, maar zijn geschoond.
    const project = await ctx.db.get(seeded.projectId);
    expect(project).not.toBeNull();
    expect(project?.omschrijving).toBeUndefined();
    expect(project?.interneNotities).toBeUndefined();
    expect(project?.klantNotities).toBeUndefined();

    const quote = await ctx.db.get(seeded.quoteId);
    expect(quote).not.toBeNull();
    expect(quote?.inleidingTekst).toBeUndefined();
    expect(quote?.afsluitTekst).toBeUndefined();

    // Niet-financiële persoonsgegevens + bestand zijn wél weg.
    expect(await ctx.db.get(seeded.attachmentId)).toBeNull();
    expect(await ctx.storage.getUrl(seeded.storageId)).toBeNull();
    expect(await ctx.db.get(seeded.measurementId)).toBeNull();
    const contacts = await ctx.db.query("customerContacts").collect();
    expect(contacts).toHaveLength(0);
  });
});

test("deleteCustomer verwijdert een niet-gefactureerd project ook in de anonimiseer-tak", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedCustomer(t, { withInvoice: true });
  const now = Date.now();

  // Tweede project op dezelfde klant, zonder factuur.
  const losProjectId = await t.run(async (ctx) => {
    const projectId = await ctx.db.insert("projects", {
      tenantId: seeded.tenantId,
      klantId: seeded.klantId,
      titel: "Los project zonder factuur",
      status: "lead",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    await ctx.db.insert("quotes", {
      tenantId: seeded.tenantId,
      projectId,
      klantId: seeded.klantId,
      offertenummer: "OF-2026-002",
      titel: "Losse offerte",
      status: "draft",
      subtotaalExBtw: 0,
      btwTotaal: 0,
      totaalInclBtw: 0,
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    return projectId;
  });

  await t.mutation(api.portal.deleteCustomer, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    klantId: seeded.klantId,
    bevestigNaam: "Jan Jansen"
  });

  await t.run(async (ctx) => {
    // Het gefactureerde project blijft; het losse project is verwijderd.
    expect(await ctx.db.get(seeded.projectId)).not.toBeNull();
    expect(await ctx.db.get(losProjectId)).toBeNull();
    const quotes = await ctx.db.query("quotes").collect();
    expect(quotes).toHaveLength(1);
    expect(quotes[0].offertenummer).toBe("OF-2026-001");
  });
});

test("deleteCustomer weigert bij een verkeerde bevestigingsnaam en laat de klant staan", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedCustomer(t, { withInvoice: false });

  await expect(
    t.mutation(api.portal.deleteCustomer, {
      tenantSlug: "henke-wonen",
      actor: adminActor,
      klantId: seeded.klantId,
      bevestigNaam: "Verkeerde naam"
    })
  ).rejects.toThrow();

  expect(await t.run((ctx) => ctx.db.get(seeded.klantId))).not.toBeNull();
});

test("deleteCustomer is admin-only (editor mag niet)", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seedCustomer(t, { withInvoice: false });

  await expect(
    t.mutation(api.portal.deleteCustomer, {
      tenantSlug: "henke-wonen",
      actor: editorActor,
      klantId: seeded.klantId,
      bevestigNaam: "Jan Jansen"
    })
  ).rejects.toThrow();

  expect(await t.run((ctx) => ctx.db.get(seeded.klantId))).not.toBeNull();
});
