import type { AppRole, AppSession, AppWorkspaceMode } from "./session";
import { laventeCareAuthTimeoutMs } from "./laventeCareConfig";

type UnknownRecord = Record<string, unknown>;

const roles: AppRole[] = ["viewer", "user", "editor", "admin"];
const workspaceModes: AppWorkspaceMode[] = ["general", "field"];
const roleAliases: Record<string, AppRole> = {
  administrator: "admin",
  beheerder: "admin",
  manager: "editor",
  medewerker: "user",
  owner: "admin",
  readonly: "viewer",
  "read-only": "viewer",
  superadmin: "admin",
  "super-admin": "admin",
  super_admin: "admin"
};

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

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
          safeDecodeURIComponent(part.slice(0, separator)),
          safeDecodeURIComponent(part.slice(separator + 1))
        ];
      })
  );
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asOptionalRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" ? (value as UnknownRecord) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRole(value: unknown): AppRole | undefined {
  const role =
    asString(value) ??
    asString(asRecord(value).name) ??
    asString(asRecord(value).slug) ??
    asString(asRecord(value).key);

  if (!role) {
    return undefined;
  }

  const normalizedRole = role.toLowerCase().trim().replace(/\s+/gu, "_");
  const aliasedRole = roleAliases[normalizedRole] ?? roleAliases[normalizedRole.replace(/_/gu, "-")];

  return roles.includes(normalizedRole as AppRole)
    ? (normalizedRole as AppRole)
    : aliasedRole;
}

function asWorkspaceMode(value: unknown): AppWorkspaceMode | undefined {
  const workspaceMode = asString(value);

  return workspaceMode && workspaceModes.includes(workspaceMode as AppWorkspaceMode)
    ? (workspaceMode as AppWorkspaceMode)
    : undefined;
}

type SessionTenantOptions = {
  fallbackTenantId?: string;
  forceTenantId?: string;
};

function firstString(...values: unknown[]) {
  for (const value of values) {
    const stringValue = asString(value);

    if (stringValue) {
      return stringValue;
    }
  }

  return undefined;
}

function firstRole(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const role = asRole(item);

        if (role) {
          return role;
        }
      }
    }

    const role = asRole(value);

    if (role) {
      return role;
    }
  }

  return undefined;
}

function fullName(...values: unknown[]) {
  return values.map(asString).filter(Boolean).join(" ").trim() || undefined;
}

function sessionPayloadCandidates(payload: UnknownRecord) {
  const candidates: UnknownRecord[] = [payload];

  for (const key of ["data", "result", "session", "profile"]) {
    const candidate = asOptionalRecord(payload[key]);

    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

function safePayloadShape(payload: UnknownRecord) {
  const data = asOptionalRecord(payload.data);
  const user = asOptionalRecord(payload.user ?? data?.user);

  return {
    topLevelKeys: Object.keys(payload).slice(0, 12),
    dataKeys: data ? Object.keys(data).slice(0, 12) : [],
    userKeys: user ? Object.keys(user).slice(0, 12) : []
  };
}

function sessionFromPayload(
  payload: UnknownRecord,
  { fallbackTenantId, forceTenantId }: SessionTenantOptions = {}
): AppSession | null {
  const source = sessionPayloadCandidates(payload).find((candidate) => {
    const user = asRecord(candidate.user);

    return Boolean(
      firstString(
        candidate.sub,
        candidate.id,
        candidate.userId,
        candidate.externalUserId,
        user.id,
        user.userId,
        user.externalUserId
      ) && firstString(candidate.email, candidate.emailAddress, user.email, user.emailAddress)
    );
  }) ?? payload;
  const user = asRecord(source.user);
  const tenant = asRecord(source.tenant ?? user.tenant);
  const userId =
    firstString(
      source.sub,
      source.id,
      source.userId,
      source.externalUserId,
      user.id,
      user.userId,
      user.externalUserId
    );
  const email = firstString(source.email, source.emailAddress, user.email, user.emailAddress);
  const tenantId =
    forceTenantId ??
    firstString(
      source.tenantSlug,
      source.tenantId,
      user.tenantSlug,
      user.tenantId,
      tenant.slug,
      tenant.id
    ) ??
    fallbackTenantId;
  const role = firstRole(
    source.role,
    source.userRole,
    source.roles,
    source.permissions,
    user.role,
    user.userRole,
    user.roles,
    user.permissions
  );
  const workspaceModeFromAuth = asWorkspaceMode(source.workspaceMode ?? user.workspaceMode);
  const workspaceMode = workspaceModeFromAuth ?? "general";

  if (!userId || !email || !tenantId || !role) {
    return null;
  }

  return {
    userId,
    tenantId,
    email,
    name:
      firstString(source.name, user.name, source.displayName, user.displayName) ??
      fullName(source.firstName, source.lastName) ??
      fullName(user.firstName, user.lastName),
    role,
    workspaceMode,
    workspaceModeFromAuth: Boolean(workspaceModeFromAuth)
  };
}

function sessionCookieName() {
  return import.meta.env.LAVENTECARE_SESSION_COOKIE ?? "access_token";
}

function tokenFromCookieHeader(cookieHeader: string) {
  const cookies = parseCookies(cookieHeader);

  return cookies[sessionCookieName()] ?? cookies.access_token ?? cookies.token ?? cookies.id_token;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : undefined;
}

export function authTokenFromRequest(request: Request) {
  return tokenFromCookieHeader(request.headers.get("cookie") ?? "") ?? bearerToken(request);
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

/**
 * Constant-time vergelijking van twee (base64url-)strings van gelijke lengte. Voorkomt
 * een timing-side-channel op de HMAC-signatuur (WebCrypto-runtime: geen Node
 * `timingSafeEqual` beschikbaar). De lengtecheck lekt alleen de — vaste — HMAC-lengte.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyJwt(token: string, secret: string) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const expectedSignature = await sign(`${header}.${payload}`, secret);

  if (!timingSafeEqualStr(signature, expectedSignature)) {
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
  fallbackTenantId?: string,
  tenantHeaderId?: string,
  forceTenantId?: string
) {
  const headers: HeadersInit = {
    accept: "application/json",
    cookie: request.headers.get("cookie") ?? ""
  };
  const authToken = authTokenFromRequest(request);

  if (tenantHeaderId) {
    headers["X-Tenant-ID"] = tenantHeaderId;
  }

  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  // Begrensd: dit staat in het hot path van elke /portal-request. Zonder timeout
  // hangt de hele app zodra de auth-dienst niet reageert; met timeout vangt de
  // middleware dit af met een nette storingspagina.
  let response: Response;
  try {
    response = await fetch(meUrl, {
      headers,
      signal: AbortSignal.timeout(laventeCareAuthTimeoutMs())
    });
  } catch (fetchError) {
    throw new Error("LaventeCare AuthSystem is niet bereikbaar (timeout of netwerkfout).", {
      cause: fetchError
    });
  }

  if (response.status === 401 || response.status === 403) {
    console.warn("LaventeCare /auth/me weigerde sessie.", {
      hasAuthToken: Boolean(authToken),
      hasCookieHeader: Boolean(request.headers.get("cookie")),
      status: response.status
    });

    return null;
  }

  if (!response.ok) {
    throw new Error(`LaventeCare AuthSystem gaf HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as UnknownRecord;
  const session = sessionFromPayload(payload, {
    fallbackTenantId,
    forceTenantId
  });

  if (!session) {
    console.warn("LaventeCare /auth/me payload kon niet naar portalsessie worden vertaald.", safePayloadShape(payload));
  }

  return session;
}

export async function getSessionFromJwt(
  token: string,
  secret: string,
  fallbackTenantId?: string,
  forceTenantId?: string
) {
  const payload = await verifyJwt(token, secret);

  return payload
    ? sessionFromPayload(payload, {
        fallbackTenantId,
        forceTenantId
      })
    : null;
}
