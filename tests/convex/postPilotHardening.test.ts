import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createHmac } from "node:crypto";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { selectPurchasePrice } from "../../convex/inkoop/core";
import { assertValidRoomDimensions } from "../../convex/portalUtils";

const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");
const SECRET = "test-secret-postpilot";

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Auth-1 — rol vastgepind aan het (ondertekende) sync-token
// ---------------------------------------------------------------------------
function b64url(buf: Buffer) {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function mintSyncToken(role: string | undefined) {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    kind: "sync",
    sub: "real-user",
    tenant: "henke-wonen",
    iat: now,
    exp: now + 3600
  };
  if (role !== undefined) {
    payload.role = role;
  }
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", SECRET).update(body).digest());
  return `${body}.${sig}`;
}
async function insertTenant(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("tenants", {
      slug: "henke-wonen",
      naam: "Henke Wonen",
      status: "active",
      aangemaaktOp: now,
      gewijzigdOp: now
    });
  });
}

describe("Auth-1: rol-binding in sync-token", () => {
  test("ensureUser weigert een rol die niet matcht met het token (geen self-escalatie)", async () => {
    vi.stubEnv("AUTHZ_TOKEN_SECRET", SECRET);
    const t = convexTest(schema, modules);
    const tenantId = await insertTenant(t);

    await expect(
      t.mutation(api.beheer.users.ensureUser, {
        tenantId,
        externalUserId: "real-user",
        email: "u@henke.nl",
        role: "admin",
        syncToken: mintSyncToken("user")
      })
    ).rejects.toThrow(/komt niet overeen|autorisatie/i);
  });

  test("ensureUser accepteert een rol die wél matcht met het token", async () => {
    vi.stubEnv("AUTHZ_TOKEN_SECRET", SECRET);
    const t = convexTest(schema, modules);
    const tenantId = await insertTenant(t);

    const userId = await t.mutation(api.beheer.users.ensureUser, {
      tenantId,
      externalUserId: "real-user",
      email: "u@henke.nl",
      role: "user",
      syncToken: mintSyncToken("user")
    });
    expect(userId).toBeTruthy();
  });

  test("backward-compat: een oud token zónder rol handhaaft niet (blijft werken)", async () => {
    vi.stubEnv("AUTHZ_TOKEN_SECRET", SECRET);
    const t = convexTest(schema, modules);
    const tenantId = await insertTenant(t);

    const userId = await t.mutation(api.beheer.users.ensureUser, {
      tenantId,
      externalUserId: "real-user",
      email: "u@henke.nl",
      role: "admin",
      syncToken: mintSyncToken(undefined)
    });
    expect(userId).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// F1 — ruimtematen server-side gevalideerd
// ---------------------------------------------------------------------------
describe("F1: assertValidRoomDimensions", () => {
  test("weigert negatieve, NaN en Infinity maten", () => {
    expect(() => assertValidRoomDimensions({ breedteM: -1 })).toThrow(/ruimtemaat/i);
    expect(() => assertValidRoomDimensions({ oppervlakteM2: Number.NaN })).toThrow(/ruimtemaat/i);
    expect(() => assertValidRoomDimensions({ omtrekMeter: Number.POSITIVE_INFINITY })).toThrow(
      /ruimtemaat/i
    );
  });

  test("accepteert geldige en ontbrekende maten", () => {
    expect(() => assertValidRoomDimensions({ breedteM: 3, lengteM: 4, oppervlakteM2: 12 })).not.toThrow();
    expect(() => assertValidRoomDimensions({})).not.toThrow();
    expect(() => assertValidRoomDimensions({ breedteM: undefined })).not.toThrow();
  });

  test("addMeasurementRoom weigert een negatieve maat via de mutation", async () => {
    vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
    vi.stubEnv("ALLOW_DEV_AUTHZ_TOKENS", "true");
    const t = convexTest(schema, modules);
    const { tenantId, inmetingId } = await t.run(async (ctx) => {
      const now = Date.now();
      const tenantId = await ctx.db.insert("tenants", {
        slug: "henke-wonen",
        naam: "Henke Wonen",
        status: "active",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      await ctx.db.insert("users", {
        tenantId,
        externalUserId: "dev-user-1",
        email: "a@henke.nl",
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
        status: "measurement_planned",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      const inmetingId = await ctx.db.insert("measurements", {
        tenantId,
        projectId,
        klantId,
        status: "draft",
        aangemaaktOp: now,
        gewijzigdOp: now
      });
      return { tenantId, inmetingId };
    });

    await expect(
      t.mutation(api.projecten.measurements.addMeasurementRoom, {
        tenantId,
        actor: { externalUserId: "dev-user-1", authzToken: "dev.actor.henke-wonen.dev-user-1" },
        inmetingId,
        naam: "Woonkamer",
        breedteM: -5
      })
    ).rejects.toThrow(/ruimtemaat/i);
  });
});

// ---------------------------------------------------------------------------
// F6 — selectPurchasePrice negeert 0/negatieve inkoopprijzen
// ---------------------------------------------------------------------------
describe("F6: selectPurchasePrice", () => {
  const now = 1_000;
  function price(prijsSoort: "net_purchase" | "purchase", bedrag: number): Doc<"productPrices"> {
    return { prijsSoort, bedrag, _creationTime: 1 } as unknown as Doc<"productPrices">;
  }

  test("een 0-inkoopprijs telt als afwezig (bron 'none')", () => {
    expect(selectPurchasePrice([price("net_purchase", 0)], now).bron).toBe("none");
  });

  test("een negatieve inkoopprijs telt als afwezig (bron 'none')", () => {
    expect(selectPurchasePrice([price("net_purchase", -5)], now).bron).toBe("none");
  });

  test("een geldige inkoopprijs wordt gekozen", () => {
    const result = selectPurchasePrice([price("net_purchase", 10)], now);
    expect(result.bron).toBe("net_purchase");
    expect(result.bedrag).toBe(10);
  });

  test("een 0 net_purchase valt door naar een geldige purchase i.p.v. 0 te kiezen", () => {
    const result = selectPurchasePrice([price("net_purchase", 0), price("purchase", 8)], now);
    expect(result.bron).toBe("purchase");
    expect(result.bedrag).toBe(8);
  });
});
