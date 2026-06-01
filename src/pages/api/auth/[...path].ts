import type { APIRoute } from "astro";
import { laventeCareApiBaseUrl, laventeCareTenantId } from "../../../lib/auth/laventeCareConfig";
import {
  appendLaventeCareCookieHeaders,
  applyLaventeCareJsonTokenCookies,
  applyLaventeCareSetCookies,
  clearLaventeCareCookies
} from "../../../lib/auth/laventeCareCookies";

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
  "accessToken",
  "refresh_token",
  "refreshToken",
  "id_token",
  "idToken",
  "token",
  "pre_auth_token",
  "preAuthToken"
]);

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

function parseJsonBody(contentType: string, body: ArrayBuffer) {
  if (!contentType.toLowerCase().includes("application/json")) {
    return undefined;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    return undefined;
  }
}

function jsonResponseBody(payload: unknown) {
  return new TextEncoder().encode(JSON.stringify(stripSensitiveAuthFields(payload)));
}

async function logout(context: Parameters<APIRoute>[0]) {
  const response = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json"
    }
  });

  const appliedCookies = clearLaventeCareCookies(context.cookies, context.request);

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

    appliedCookies.push(...applyLaventeCareSetCookies(upstream, context.cookies, context.request));
  } catch (logoutError) {
    console.warn("Upstream logout niet bereikbaar; lokale sessie is wel gewist.", logoutError);
  }

  appendLaventeCareCookieHeaders(response, appliedCookies, context.request);

  return response;
}

function sanitizeJson(contentType: string, body: ArrayBuffer) {
  if (!contentType.toLowerCase().includes("application/json")) {
    return body;
  }

  const payload = parseJsonBody(contentType, body);

  return payload === undefined ? body : jsonResponseBody(payload);
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
  const upstreamJson = parseJsonBody(upstreamContentType, upstreamBody);
  const responseBody =
    upstreamJson === undefined ? sanitizeJson(upstreamContentType, upstreamBody) : jsonResponseBody(upstreamJson);
  const response = new Response(responseBody, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      "cache-control": "no-store",
      "content-type": upstreamContentType
    }
  });

  const appliedCookies = applyLaventeCareSetCookies(upstream, context.cookies, context.request);
  if (upstream.ok && upstreamJson !== undefined) {
    appliedCookies.push(...applyLaventeCareJsonTokenCookies(upstreamJson, context.cookies, context.request));
  }
  appendLaventeCareCookieHeaders(response, appliedCookies, context.request);

  return response;
}

export const GET: APIRoute = proxyAuth;
export const POST: APIRoute = proxyAuth;
export const DELETE: APIRoute = proxyAuth;
