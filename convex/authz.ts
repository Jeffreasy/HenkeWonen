import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("viewer"),
  v.literal("user"),
  v.literal("editor"),
  v.literal("admin")
);

export const workspaceModeValidator = v.union(v.literal("general"), v.literal("field"));

export const mutationActorValidator = v.object({
  externalUserId: v.string(),
  authzToken: v.string()
});

export type AppRole = "viewer" | "user" | "editor" | "admin";
export type AppWorkspaceMode = "general" | "field";

type TokenKind = "actor" | "sync";

type TokenPayload = {
  kind: TokenKind;
  sub: string;
  tenant: string;
  iat: number;
  exp: number;
};

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

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

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

function isValidDevToken(
  token: string,
  expectedKind: TokenKind,
  expectedTenantSlug: string,
  expectedExternalUserId?: string
) {
  const [, kind, tenantSlug, externalUserId] = token.split(".");

  if (!externalUserId) {
    return false;
  }

  return (
    token.startsWith("dev.") &&
    kind === expectedKind &&
    tenantSlug === expectedTenantSlug &&
    externalUserId.startsWith("dev-") &&
    (!expectedExternalUserId || externalUserId === expectedExternalUserId)
  );
}

async function verifyToken(
  token: string,
  expectedKind: TokenKind,
  expectedTenantSlug: string,
  expectedExternalUserId?: string
) {
  const secret = process.env.AUTHZ_TOKEN_SECRET;

  if (!secret) {
    if (isValidDevToken(token, expectedKind, expectedTenantSlug, expectedExternalUserId)) {
      return;
    }

    throw new Error("AUTHZ_TOKEN_SECRET ontbreekt voor beveiligde mutaties.");
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    throw new Error("Ongeldige autorisatie.");
  }

  const [body, signature] = parts;
  const expectedSignature = await sign(body, secret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error("Ongeldige autorisatie.");
  }

  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as TokenPayload;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    payload.kind !== expectedKind ||
    payload.tenant !== expectedTenantSlug ||
    payload.exp <= nowSeconds ||
    (expectedExternalUserId && payload.sub !== expectedExternalUserId)
  ) {
    throw new Error("Ongeldige autorisatie.");
  }
}

export async function requireSyncToken(
  syncToken: string,
  tenantSlug: string,
  externalUserId?: string
) {
  await verifyToken(syncToken, "sync", tenantSlug, externalUserId);
}

export async function requireMutationRole(
  ctx: any,
  tenantSlug: string,
  actor: { externalUserId: string; authzToken: string },
  allowedRoles: AppRole[]
) {
  await verifyToken(actor.authzToken, "actor", tenantSlug, actor.externalUserId);

  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q: any) => q.eq("slug", tenantSlug))
    .first();

  if (!tenant || tenant.status !== "active") {
    throw new Error("Tenant niet gevonden.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_external_user", (q: any) => q.eq("externalUserId", actor.externalUserId))
    .first();

  if (!user || user.tenantId !== tenant._id) {
    throw new Error("Gebruiker heeft geen toegang tot deze tenant.");
  }

  if (!allowedRoles.includes(user.role)) {
    throw new Error("Geen rechten voor deze wijziging.");
  }

  return {
    tenant,
    role: user.role as AppRole,
    externalUserId: actor.externalUserId
  };
}

export async function requireMutationRoleForTenantId(
  ctx: any,
  tenantId: any,
  actor: { externalUserId: string; authzToken: string },
  allowedRoles: AppRole[]
) {
  const tenant = await ctx.db.get(tenantId);

  if (!tenant || tenant.status !== "active") {
    throw new Error("Tenant niet gevonden.");
  }

  return await requireMutationRole(ctx, tenant.slug, actor, allowedRoles);
}

export function requireConvexToolingEnabled(toolName: string) {
  if (process.env.ALLOW_CONVEX_TOOLING !== "true") {
    throw new Error(
      `${toolName} is uitgeschakeld. Zet ALLOW_CONVEX_TOOLING=true alleen voor bewuste lokale of beheeracties.`
    );
  }
}
