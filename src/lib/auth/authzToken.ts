import type { AppSession } from "./session";

type AuthzTokenKind = "actor" | "sync";

type AuthzTokenPayload = {
  kind: AuthzTokenKind;
  sub: string;
  tenant: string;
  iat: number;
  exp: number;
};

const TOKEN_TTL_SECONDS = 8 * 60 * 60;

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function devToken(kind: AuthzTokenKind, session: AppSession) {
  return `dev.${kind}.${session.tenantId}.${session.userId}`;
}

async function createToken(kind: AuthzTokenKind, session: AppSession) {
  const secret = import.meta.env.AUTHZ_TOKEN_SECRET;

  if (!secret) {
    if (import.meta.env.DEV) {
      return devToken(kind, session);
    }

    throw new Error("AUTHZ_TOKEN_SECRET ontbreekt voor productiemutaties.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: AuthzTokenPayload = {
    kind,
    sub: session.userId,
    tenant: session.tenantId,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS
  };
  const body = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(body, secret);

  return `${body}.${signature}`;
}

export function mutationActorFromSession(session: AppSession) {
  if (!session.authzToken) {
    throw new Error("Sessie mist autorisatie voor wijzigingen.");
  }

  return {
    externalUserId: session.userId,
    authzToken: session.authzToken
  };
}

export async function createSessionAuthzToken(session: AppSession) {
  return await createToken("actor", session);
}

export async function createConvexSyncToken(session: AppSession) {
  return await createToken("sync", session);
}
