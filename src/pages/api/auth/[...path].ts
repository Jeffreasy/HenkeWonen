import type { APIRoute } from "astro";
import { laventeCareApiBaseUrl, laventeCareTenantId } from "../../../lib/auth/laventeCareConfig";

export const prerender = false;

const ALLOWED_AUTH_PATHS = new Set([
  "login",
  "logout",
  "me",
  "refresh",
  "token",
  "mfa/verify",
  "mfa/send-email"
]);

const SENSITIVE_AUTH_RESPONSE_FIELDS = new Set([
  "access_token",
  "refresh_token",
  "id_token",
  "token",
  "pre_auth_token"
]);

function splitSetCookieHeader(header: string) {
  const cookies: string[] = [];
  let start = 0;

  for (let index = 0; index < header.length; index += 1) {
    if (header[index] !== ",") {
      continue;
    }

    const nextPart = header.slice(index + 1).trimStart();

    if (/^[^=;,\s]+=/u.test(nextPart)) {
      cookies.push(header.slice(start, index).trim());
      start = index + 1;
    }
  }

  cookies.push(header.slice(start).trim());

  return cookies.filter(Boolean);
}

function upstreamSetCookies(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;

  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }

  const combined = headers.get("set-cookie");

  return combined ? splitSetCookieHeader(combined) : [];
}

function rewriteSetCookie(cookie: string, request: Request) {
  const isSecureRequest = new URL(request.url).protocol === "https:";
  const isProduction = import.meta.env.PROD;
  const [nameValue, ...attributes] = cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const filteredAttributes = attributes.filter((attribute) => {
    return (
      !/^domain=/iu.test(attribute) &&
      !/^path=/iu.test(attribute) &&
      !/^samesite=/iu.test(attribute) &&
      !/^partitioned$/iu.test(attribute) &&
      !/^httponly$/iu.test(attribute) &&
      !/^secure$/iu.test(attribute)
    );
  });

  const rewritten = [nameValue, "Path=/", "HttpOnly", "SameSite=Lax", ...filteredAttributes];

  if (isProduction || isSecureRequest) {
    rewritten.push("Secure");
  }

  return rewritten.join("; ");
}

function expireCookie(name: string, request: Request) {
  const isSecureRequest = new URL(request.url).protocol === "https:";
  const isProduction = import.meta.env.PROD;
  const attributes = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];

  if (isProduction || isSecureRequest) {
    attributes.push("Secure");
  }

  return `${name}=; ${attributes.join("; ")}`;
}

function logoutCookieNames(request: Request) {
  const names = new Set([
    "access_token",
    "refresh_token",
    import.meta.env.LAVENTECARE_SESSION_COOKIE ?? "access_token"
  ]);
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const cookie of cookieHeader.split(";")) {
    const [name] = cookie.trim().split("=");

    if (name) {
      names.add(name);
    }
  }

  return Array.from(names);
}

function stripSensitiveAuthFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSensitiveAuthFields);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, itemValue] of Object.entries(value)) {
    if (SENSITIVE_AUTH_RESPONSE_FIELDS.has(key)) {
      continue;
    }

    sanitized[key] = stripSensitiveAuthFields(itemValue);
  }

  return sanitized;
}

async function logout(context: Parameters<APIRoute>[0]) {
  const response = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json"
    }
  });

  for (const cookieName of logoutCookieNames(context.request)) {
    response.headers.append("set-cookie", expireCookie(cookieName, context.request));
  }

  const tenantId = laventeCareTenantId();

  if (!tenantId) {
    return response;
  }

  try {
    const upstreamUrl = new URL(`${laventeCareApiBaseUrl()}/auth/logout`);
    const requestUrl = new URL(context.request.url);
    const cookie = context.request.headers.get("cookie");
    const authorization = context.request.headers.get("authorization");
    const headers: HeadersInit = {
      accept: context.request.headers.get("accept") ?? "application/json",
      "X-Tenant-ID": tenantId
    };

    upstreamUrl.search = requestUrl.search;

    if (cookie) {
      headers.cookie = cookie;
    }

    if (authorization) {
      headers.authorization = authorization;
    }

    const upstream = await fetch(upstreamUrl, {
      method: context.request.method.toUpperCase(),
      headers,
      redirect: "manual"
    });

    for (const cookieHeader of upstreamSetCookies(upstream.headers)) {
      response.headers.append("set-cookie", rewriteSetCookie(cookieHeader, context.request));
    }
  } catch (logoutError) {
    console.warn("Upstream logout niet bereikbaar; lokale sessie is wel gewist.", logoutError);
  }

  return response;
}

function sanitizeJson(contentType: string, body: ArrayBuffer) {
  if (!contentType.toLowerCase().includes("application/json")) {
    return body;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(body));

    return new TextEncoder().encode(JSON.stringify(stripSensitiveAuthFields(payload)));
  } catch {
    return body;
  }
}

async function proxyAuth(context: Parameters<APIRoute>[0]) {
  const path = (context.params.path ?? "").replace(/^\/+|\/+$/gu, "");
  const tenantId = laventeCareTenantId();

  if (!ALLOWED_AUTH_PATHS.has(path)) {
    return new Response(JSON.stringify({ error: "Auth-route niet beschikbaar." }), {
      status: 404,
      headers: {
        "content-type": "application/json"
      }
    });
  }

  if (path === "logout") {
    return await logout(context);
  }

  if (!tenantId) {
    return new Response(
      JSON.stringify({
        error: "LaventeCare tenant is nog niet geconfigureerd."
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }

  const upstreamUrl = new URL(`${laventeCareApiBaseUrl()}/auth/${path}`);
  const requestUrl = new URL(context.request.url);

  upstreamUrl.search = requestUrl.search;

  const headers: HeadersInit = {
    accept: context.request.headers.get("accept") ?? "application/json",
    "X-Tenant-ID": tenantId
  };
  const contentType = context.request.headers.get("content-type");
  const cookie = context.request.headers.get("cookie");
  const authorization = context.request.headers.get("authorization");

  if (contentType) {
    headers["content-type"] = contentType;
  }

  if (cookie) {
    headers.cookie = cookie;
  }

  if (authorization) {
    headers.authorization = authorization;
  }

  const method = context.request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await context.request.arrayBuffer();
  const upstream = await fetch(upstreamUrl, {
    method,
    headers,
    body,
    redirect: "manual"
  });
  const upstreamBody = await upstream.arrayBuffer();
  const upstreamContentType = upstream.headers.get("content-type") ?? "application/json";
  const responseBody = sanitizeJson(upstreamContentType, upstreamBody);
  const response = new Response(responseBody, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      "cache-control": "no-store",
      "content-type": upstreamContentType
    }
  });

  for (const cookieHeader of upstreamSetCookies(upstream.headers)) {
    response.headers.append("set-cookie", rewriteSetCookie(cookieHeader, context.request));
  }

  return response;
}

export const GET: APIRoute = proxyAuth;
export const POST: APIRoute = proxyAuth;
export const DELETE: APIRoute = proxyAuth;
