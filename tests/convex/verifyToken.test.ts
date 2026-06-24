import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { createHmac } from "node:crypto";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

// Test het ECHTE HMAC-productiepad van convex/authz.ts:verifyToken (niet de dev-token-
// shortcut). Het token-formaat spiegelt src/lib/auth/authzToken.ts:createToken:
//   body = base64url(JSON({kind,sub,tenant,iat,exp})), sig = base64url(HMAC-SHA256(secret, body)).
const SECRET = "test-secret-abc123";
const modules = import.meta.glob("../../convex/**/!(*.*.*)*.*s");

function b64url(buf: Buffer) {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function mint(payload: Record<string, unknown>, secret = SECRET) {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}
function payload(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { kind: "actor", sub: "real-user", tenant: "henke-wonen", iat: now, exp: now + 3600, ...overrides };
}

async function setupTenant(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert("tenants", {
      slug: "henke-wonen", naam: "Henke Wonen", status: "active", aangemaaktOp: now, gewijzigdOp: now
    });
    await ctx.db.insert("users", {
      tenantId, externalUserId: "real-user", email: "u@henke.nl", role: "admin", aangemaaktOp: now, gewijzigdOp: now
    });
  });
}

function callDashboard(t: ReturnType<typeof convexTest>, authzToken: string) {
  return t.query(api.portal.dashboard, {
    tenantSlug: "henke-wonen", actor: { externalUserId: "real-user", authzToken }
  });
}

test("verifyToken accepteert een correct ondertekend, geldig actor-token", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", SECRET);
  const t = convexTest(schema, modules);
  await setupTenant(t);
  const result = await callDashboard(t, mint(payload()));
  expect(result).toBeTruthy();
});

test("verifyToken wijst een gemanipuleerde signature af", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", SECRET);
  const t = convexTest(schema, modules);
  await setupTenant(t);
  const token = mint(payload());
  const last = token.at(-1);
  const tampered = token.slice(0, -1) + (last === "A" ? "B" : "A"); // zelfde lengte, kapotte sig
  await expect(callDashboard(t, tampered)).rejects.toThrow(/autorisatie/i);
});

test("verifyToken wijst een verlopen token af", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", SECRET);
  const t = convexTest(schema, modules);
  await setupTenant(t);
  const now = Math.floor(Date.now() / 1000);
  await expect(callDashboard(t, mint(payload({ exp: now - 10 })))).rejects.toThrow(/autorisatie/i);
});

test("verifyToken wijst een token voor een andere tenant af", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", SECRET);
  const t = convexTest(schema, modules);
  await setupTenant(t);
  await expect(callDashboard(t, mint(payload({ tenant: "andere-tenant" })))).rejects.toThrow(/autorisatie/i);
});

test("verifyToken wijst een token met een verkeerde secret af", async () => {
  vi.stubEnv("AUTHZ_TOKEN_SECRET", SECRET);
  const t = convexTest(schema, modules);
  await setupTenant(t);
  await expect(callDashboard(t, mint(payload(), "verkeerd-secret"))).rejects.toThrow(/autorisatie/i);
});
