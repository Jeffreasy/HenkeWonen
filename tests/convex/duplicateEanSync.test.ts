import { convexTest } from "convex-test";
import { beforeEach, expect, test, vi } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

const adminUserId = "dev-admin-1";
const adminActor = { externalUserId: adminUserId, authzToken: `dev.actor.henke-wonen.${adminUserId}` };

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
      externalUserId: adminUserId,
      email: "admin@henke.nl",
      role: "admin",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const categorieId = await ctx.db.insert("categories", {
      tenantId,
      naam: "Behang",
      slug: "behang",
      sortOrder: 1,
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const alphaId = await ctx.db.insert("suppliers", {
      tenantId,
      naam: "Alpha",
      prijslijstStatus: "received",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
    const betaId = await ctx.db.insert("suppliers", {
      tenantId,
      naam: "Beta",
      prijslijstStatus: "received",
      aangemaaktOp: now,
      gewijzigdOp: now
    });

    const insertProduct = async (
      leverancierId: Id<"suppliers">,
      naam: string,
      sku: string,
      ean?: string,
      status: "active" | "archived" = "active"
    ) =>
      await ctx.db.insert("products", {
        tenantId,
        categorieId,
        leverancierId,
        naam,
        sku,
        ean,
        productAard: "standard",
        eenheid: "roll",
        status,
        aangemaaktOp: now,
        gewijzigdOp: now
      });

    // Alpha: E1 dubbel (2x actief), E2 uniek, één zonder EAN, E3 gearchiveerd.
    const p1 = await insertProduct(alphaId, "Bruges Lait (Bruges 2)", "A1", "E1");
    const p2 = await insertProduct(alphaId, "Bruges Lait (Bruges 3)", "A2", "E1");
    await insertProduct(alphaId, "Uniek product", "A3", "E2");
    await insertProduct(alphaId, "Zonder EAN", "A4");
    await insertProduct(alphaId, "Oud product", "A5", "E1", "archived");
    // Beta deelt E1 met Alpha, maar dubbele EAN's gelden per leverancier.
    await insertProduct(betaId, "Ander merk zelfde EAN", "B1", "E1");

    return { tenantId, alphaId, p1, p2 };
  });
}

async function runFullSync(t: ReturnType<typeof convexTest>, syncRunId: string) {
  let cursor: string | undefined;
  let created = 0;
  let updated = 0;
  let rounds = 0;

  do {
    const chunk = await t.mutation(api.catalog.review.syncDuplicateEanIssues, {
      tenantSlug: "henke-wonen",
      actor: adminActor,
      syncRunId,
      supplierCursor: cursor
    });
    created += chunk.created;
    updated += chunk.updated;
    rounds += 1;
    cursor = chunk.isDone ? undefined : (chunk.nextCursor ?? undefined);
  } while (cursor);

  const finalized = await t.mutation(api.catalog.review.finalizeDuplicateEanIssueSync, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    syncRunId
  });

  return { created, updated, rounds, resolvedStale: finalized.resolvedStale };
}

test("bulkbeoordeling zet alle open signalen op 'gescheiden houden' en laat andere statussen staan", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seed(t);

  // Tweede dubbele groep bij Alpha zodat er 2 open signalen zijn.
  await t.run(async (ctx) => {
    const now = Date.now();
    const categorieId = (await ctx.db.get(seeded.p1))!.categorieId;
    for (const sku of ["A7", "A8"]) {
      await ctx.db.insert("products", {
        tenantId: seeded.tenantId,
        categorieId,
        leverancierId: seeded.alphaId,
        naam: "Tweede groep",
        sku,
        ean: "E9",
        productAard: "standard",
        eenheid: "roll",
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
    }
  });
  await runFullSync(t, "run-1");

  // Eén signaal al bewust toegestaan; de bulk mag daar niet aankomen.
  const review = await t.query(api.catalog.review.duplicateEanReview, {
    tenantSlug: "henke-wonen",
    actor: adminActor
  });
  expect(review.duplicateGroupCount).toBe(2);
  await t.mutation(api.catalog.review.updateDuplicateEanIssueReview, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    issueId: review.groups[0].issueId as string,
    decision: "accepted_duplicate"
  });

  const bulk = await t.mutation(api.catalog.review.bulkReviewOpenDuplicateEanIssues, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    decision: "keep_separate"
  });
  expect(bulk.patched).toBe(1);
  expect(bulk.isDone).toBe(true);

  const after = await t.query(api.catalog.review.duplicateEanReview, {
    tenantSlug: "henke-wonen",
    actor: adminActor
  });
  const statuses = after.groups.map((group) => group.issueStatus).sort();
  expect(statuses).toEqual(["accepted", "reviewed"]);
  const bulkReviewed = after.groups.find((group) => group.issueStatus === "reviewed");
  expect(bulkReviewed?.reviewDecision).toBe("keep_separate");
});

test("catalogus-scan registreert dubbele EAN's per leverancier en bewaart beslissingen", async () => {
  const t = convexTest(schema, modules);
  const seeded = await seed(t);

  // Eerste scan: 1 groep (Alpha/E1) — per leverancier, alleen actieve producten.
  const first = await runFullSync(t, "run-1");
  expect(first.created).toBe(1);
  expect(first.updated).toBe(0);
  expect(first.rounds).toBe(2); // Alpha + Beta

  const review = await t.query(api.catalog.review.duplicateEanReview, {
    tenantSlug: "henke-wonen",
    actor: adminActor
  });
  expect(review.duplicateGroupCount).toBe(1);
  const group = review.groups[0];
  expect(group.supplier).toBe("Alpha");
  expect(group.ean).toBe("E1");
  expect(group.productIds).toHaveLength(2);
  // V2-producten hebben een sku (geen artikelnummer) — de scan neemt die over.
  expect(group.articleNumbers.sort()).toEqual(["A1", "A2"]);
  expect(group.issueStatus).toBe("open");
  expect(group.issueId).toBeTruthy();

  // Beslissing vastleggen → status accepted.
  await t.mutation(api.catalog.review.updateDuplicateEanIssueReview, {
    tenantSlug: "henke-wonen",
    actor: adminActor,
    issueId: group.issueId as string,
    decision: "accepted_duplicate",
    notities: "Zelfde stof in twee collectieboeken."
  });

  // Her-scan met ongewijzigde samenstelling: beslissing blijft staan.
  const second = await runFullSync(t, "run-2");
  expect(second.created).toBe(0);
  expect(second.updated).toBe(1);
  expect(second.resolvedStale).toBe(0);
  const afterSecond = await t.query(api.catalog.review.duplicateEanReview, {
    tenantSlug: "henke-wonen",
    actor: adminActor
  });
  expect(afterSecond.groups[0].issueStatus).toBe("accepted");

  // Samenstelling wijzigt (derde product met E1) → signaal opnieuw open.
  await t.run(async (ctx) => {
    await ctx.db.insert("products", {
      tenantId: seeded.tenantId,
      categorieId: (await ctx.db.get(seeded.p1))!.categorieId,
      leverancierId: seeded.alphaId,
      naam: "Bruges Lait (Naturellement)",
      sku: "A6",
      ean: "E1",
      productAard: "standard",
      eenheid: "roll",
      status: "active",
      aangemaaktOp: Date.now(),
      gewijzigdOp: Date.now()
    });
  });
  await runFullSync(t, "run-3");
  const afterThird = await t.query(api.catalog.review.duplicateEanReview, {
    tenantSlug: "henke-wonen",
    actor: adminActor
  });
  expect(afterThird.groups[0].issueStatus).toBe("open");
  expect(afterThird.groups[0].productIds).toHaveLength(3);

  // Alle E1-producten op één na archiveren → geen groep meer → stale wordt opgelost.
  await t.run(async (ctx) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_supplier", (q: any) =>
        q.eq("tenantId", seeded.tenantId).eq("leverancierId", seeded.alphaId)
      )
      .collect();
    for (const product of products) {
      if (product.ean === "E1" && product.sku !== "A1" && product.status === "active") {
        await ctx.db.patch(product._id, { status: "archived" });
      }
    }
  });
  const fourth = await runFullSync(t, "run-4");
  expect(fourth.created).toBe(0);
  expect(fourth.updated).toBe(0);
  expect(fourth.resolvedStale).toBe(1);
  const afterFourth = await t.query(api.catalog.review.duplicateEanReview, {
    tenantSlug: "henke-wonen",
    actor: adminActor
  });
  expect(afterFourth.groups[0].issueStatus).toBe("resolved");
});
