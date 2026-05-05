import { createHmac } from "node:crypto";

const TOKEN_TTL_SECONDS = 8 * 60 * 60;

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function createAuthzToken(kind, tenantSlug, externalUserId) {
  const secret = process.env.AUTHZ_TOKEN_SECRET;

  if (!secret) {
    return `dev.${kind}.${tenantSlug}.${externalUserId}`;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const body = encodeBase64Url(
    JSON.stringify({
      kind,
      sub: externalUserId,
      tenant: tenantSlug,
      iat: nowSeconds,
      exp: nowSeconds + TOKEN_TTL_SECONDS
    })
  );
  const signature = createHmac("sha256", secret).update(body).digest("base64url");

  return `${body}.${signature}`;
}

export function createToolMutationActor(tenantSlug) {
  const externalUserId =
    process.env.TOOL_AUTH_USER_ID ?? process.env.DEV_AUTH_USER_ID ?? "dev-user-jeffrey";

  return {
    externalUserId,
    authzToken: createAuthzToken("actor", tenantSlug, externalUserId)
  };
}
