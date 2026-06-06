import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { requireConvexToolingEnabled, requireSyncToken } from "../convex/authz";

describe("Convex Authorization Logic", () => {
  const oldEnv = process.env;

  beforeEach(() => {
    process.env = { ...oldEnv };
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  it("should enforce Convex tooling flag", () => {
    process.env.ALLOW_CONVEX_TOOLING = "false";
    expect(() => requireConvexToolingEnabled("TestTool")).toThrow(/TestTool is uitgeschakeld/);

    process.env.ALLOW_CONVEX_TOOLING = "true";
    expect(() => requireConvexToolingEnabled("TestTool")).not.toThrow();
  });
  
  it("should allow valid dev tokens when ALLOW_DEV_AUTHZ_TOKENS is enabled", async () => {
    process.env.ALLOW_DEV_AUTHZ_TOKENS = "true";
    delete process.env.AUTHZ_TOKEN_SECRET;

    // dev.sync.<tenant>.<userId>
    const validDevToken = "dev.sync.henke-wonen.dev-user-123";
    await expect(requireSyncToken(validDevToken, "henke-wonen", "dev-user-123")).resolves.not.toThrow();

    // Wrong tenant
    await expect(requireSyncToken(validDevToken, "wrong-tenant", "dev-user-123")).rejects.toThrow();

    // Wrong user
    await expect(requireSyncToken(validDevToken, "henke-wonen", "dev-user-999")).rejects.toThrow();
  });
});
