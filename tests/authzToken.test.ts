import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createSessionAuthzToken,
  createConvexSyncToken,
  mutationActorFromSession
} from "../src/lib/auth/authzToken";
import type { AppSession } from "../src/lib/auth/session";

describe("Authorization Token Generator", () => {
  const session: AppSession = {
    userId: "test-user-456",
    email: "test@henkewonen.nl",
    tenantId: "henke-wonen",
    workspaceMode: "general",
    role: "admin"
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should create dev token if AUTHZ_TOKEN_SECRET is missing and in dev environment", async () => {
    vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
    vi.stubEnv("DEV", true);

    const token = await createSessionAuthzToken(session);
    expect(token).toBe("dev.actor.henke-wonen.test-user-456");

    const syncToken = await createConvexSyncToken(session);
    expect(syncToken).toBe("dev.sync.henke-wonen.test-user-456");
  });

  it("should throw error if AUTHZ_TOKEN_SECRET is missing and not in dev environment", async () => {
    vi.stubEnv("AUTHZ_TOKEN_SECRET", "");
    vi.stubEnv("DEV", false); // not dev

    await expect(createSessionAuthzToken(session)).rejects.toThrow(
      "AUTHZ_TOKEN_SECRET ontbreekt"
    );
  });

  it("should create signed HMAC token if AUTHZ_TOKEN_SECRET is defined", async () => {
    vi.stubEnv("AUTHZ_TOKEN_SECRET", "super-secret-key-12345");

    const token = await createSessionAuthzToken(session);
    const parts = token.split(".");
    expect(parts.length).toBe(2);

    const [body, signature] = parts;
    expect(body.length).toBeGreaterThan(0);
    expect(signature.length).toBeGreaterThan(0);

    // Decode body
    const decoded = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    expect(decoded.kind).toBe("actor");
    expect(decoded.sub).toBe("test-user-456");
    expect(decoded.tenant).toBe("henke-wonen");
  });

  it("should create mutation actor from session", () => {
    const sessionWithToken: AppSession = {
      ...session,
      authzToken: "my-token"
    };

    const actor = mutationActorFromSession(sessionWithToken);
    expect(actor.externalUserId).toBe("test-user-456");
    expect(actor.authzToken).toBe("my-token");

    const sessionWithoutToken: AppSession = { ...session };
    expect(() => mutationActorFromSession(sessionWithoutToken)).toThrow(
      "Sessie mist autorisatie"
    );
  });
});
