import type { AppRole, AppSession, AppWorkspaceMode } from "./session";

type UnknownRecord = Record<string, unknown>;

const roles: AppRole[] = ["viewer", "user", "editor", "admin"];
const workspaceModes: AppWorkspaceMode[] = ["general", "field"];

export function parseCookies(cookieHeader: string) {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");

        if (separator === -1) {
          return [part, ""];
        }

        return [
          decodeURIComponent(part.slice(0, separator)),
          decodeURIComponent(part.slice(separator + 1))
        ];
      })
  );
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRole(value: unknown): AppRole | undefined {
  const role = asString(value);

  return role && roles.includes(role as AppRole) ? (role as AppRole) : undefined;
}

function asWorkspaceMode(value: unknown): AppWorkspaceMode | undefined {
  const workspaceMode = asString(value);

  return workspaceMode && workspaceModes.includes(workspaceMode as AppWorkspaceMode)
    ? (workspaceMode as AppWorkspaceMode)
    : undefined;
}

function sessionFromPayload(payload: UnknownRecord, fallbackTenantId?: string): AppSession | null {
  const user = asRecord(payload.user);
  const tenant = asRecord(payload.tenant);
  const userId =
    asString(payload.sub) ??
    asString(payload.userId) ??
    asString(payload.externalUserId) ??
    asString(user.id) ??
    asString(user.externalUserId);
  const email = asString(payload.email) ?? asString(user.email);
  const tenantId =
    asString(payload.tenantSlug) ??
    asString(payload.tenantId) ??
    asString(tenant.slug) ??
    asString(tenant.id) ??
    fallbackTenantId;
  const role = asRole(payload.role ?? user.role);
  const workspaceMode = asWorkspaceMode(payload.workspaceMode ?? user.workspaceMode) ?? "general";

  if (!userId || !email || !tenantId || !role) {
    return null;
  }

  return {
    userId,
    tenantId,
    email,
    name: asString(payload.name) ?? asString(user.name),
    role,
    workspaceMode
  };
}

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

async function verifyJwt(token: string, secret: string) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const expectedSignature = await sign(`${header}.${payload}`, secret);

  if (signature !== expectedSignature) {
    return null;
  }

  const decodedHeader = JSON.parse(new TextDecoder().decode(base64UrlDecode(header))) as UnknownRecord;

  if (decodedHeader.alg !== "HS256") {
    return null;
  }

  const decodedPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as UnknownRecord;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = typeof decodedPayload.exp === "number" ? decodedPayload.exp : undefined;
  const notBefore = typeof decodedPayload.nbf === "number" ? decodedPayload.nbf : undefined;

  if ((expiresAt && expiresAt <= nowSeconds) || (notBefore && notBefore > nowSeconds)) {
    return null;
  }

  return decodedPayload;
}

export async function getSessionFromMeEndpoint(
  request: Request,
  meUrl: string,
  fallbackTenantId?: string
) {
  const response = await fetch(meUrl, {
    headers: {
      accept: "application/json",
      cookie: request.headers.get("cookie") ?? ""
    }
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`LaventeCare AuthSystem gaf HTTP ${response.status}.`);
  }

  return sessionFromPayload((await response.json()) as UnknownRecord, fallbackTenantId);
}

export async function getSessionFromJwt(
  token: string,
  secret: string,
  fallbackTenantId?: string
) {
  const payload = await verifyJwt(token, secret);

  return payload ? sessionFromPayload(payload, fallbackTenantId) : null;
}
