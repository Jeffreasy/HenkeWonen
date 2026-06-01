import type { AstroCookieSetOptions, AstroCookies } from "astro";

const DEFAULT_AUTH_COOKIE_PATHS = ["/", "/api/auth", "/api/v1/auth"];
const DEFAULT_AUTH_COOKIE_NAMES = [
  "access_token",
  "refresh_token",
  "id_token",
  "token",
  "pre_auth_token",
  "csrf_token"
];

const clientReadableCookieNames = new Set(["csrf_token"]);

type ParsedSetCookie = {
  name: string;
  value: string;
  path: string;
  maxAge?: number;
  expires?: Date;
  partitioned?: boolean;
};

export type AppliedLaventeCareCookie = {
  name: string;
  value: string;
  path: string;
  deleted: boolean;
};

function sessionCookieName() {
  return import.meta.env.LAVENTECARE_SESSION_COOKIE ?? "access_token";
}

function isSecureRequest(request: Request) {
  return import.meta.env.PROD || new URL(request.url).protocol === "https:";
}

function isClientReadableCookie(name: string) {
  return clientReadableCookieNames.has(name);
}

function authCookieNames() {
  return new Set([...DEFAULT_AUTH_COOKIE_NAMES, sessionCookieName()]);
}

export function splitSetCookieHeader(header: string) {
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

export function upstreamSetCookies(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;

  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }

  const combined = headers.get("set-cookie");

  return combined ? splitSetCookieHeader(combined) : [];
}

function parseSetCookie(cookie: string): ParsedSetCookie | null {
  const [nameValue, ...attributes] = cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const separator = nameValue?.indexOf("=") ?? -1;

  if (!nameValue || separator === -1) {
    return null;
  }

  const parsed: ParsedSetCookie = {
    name: nameValue.slice(0, separator),
    value: nameValue.slice(separator + 1),
    path: "/"
  };

  for (const attribute of attributes) {
    const [rawKey, ...rawValueParts] = attribute.split("=");
    const key = rawKey.toLowerCase();
    const value = rawValueParts.join("=");

    if (key === "path" && value.trim()) {
      parsed.path = value.trim();
      continue;
    }

    if (key === "max-age") {
      const maxAge = Number.parseInt(value, 10);

      if (Number.isFinite(maxAge)) {
        parsed.maxAge = maxAge;
      }

      continue;
    }

    if (key === "expires") {
      const expires = new Date(value);

      if (!Number.isNaN(expires.getTime())) {
        parsed.expires = expires;
      }

      continue;
    }

    if (key === "partitioned") {
      parsed.partitioned = true;
    }
  }

  return parsed;
}

function cookieOptions(
  parsed: ParsedSetCookie,
  request: Request
): AstroCookieSetOptions {
  const options: AstroCookieSetOptions = {
    path: parsed.path,
    httpOnly: !isClientReadableCookie(parsed.name),
    sameSite: "lax",
    secure: isSecureRequest(request)
  };

  if (parsed.maxAge !== undefined) {
    options.maxAge = parsed.maxAge;
  }

  if (parsed.expires) {
    options.expires = parsed.expires;
  }

  if (parsed.partitioned) {
    options.partitioned = true;
  }

  return options;
}

export function applyLaventeCareSetCookies(
  backendResponse: Response,
  cookies: AstroCookies,
  request: Request
) {
  const applied: AppliedLaventeCareCookie[] = [];

  for (const cookieHeader of upstreamSetCookies(backendResponse.headers)) {
    const parsed = parseSetCookie(cookieHeader);

    if (!parsed) {
      continue;
    }

    const options = cookieOptions(parsed, request);
    const deleted = parsed.maxAge !== undefined && parsed.maxAge <= 0;

    if (deleted) {
      cookies.delete(parsed.name, {
        httpOnly: options.httpOnly,
        path: parsed.path,
        sameSite: "lax",
        secure: options.secure
      });
    } else {
      cookies.set(parsed.name, parsed.value, options);
    }

    applied.push({
      name: parsed.name,
      value: parsed.value,
      path: parsed.path,
      deleted
    });
  }

  return applied;
}

export function clearLaventeCareCookies(cookies: AstroCookies, request: Request) {
  const names = authCookieNames();
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const cookie of cookieHeader.split(";")) {
    const [rawName] = cookie.trim().split("=");
    const name = rawName?.trim();

    if (name && names.has(name)) {
      names.add(name);
    }
  }

  for (const name of names) {
    for (const path of DEFAULT_AUTH_COOKIE_PATHS) {
      cookies.delete(name, {
        httpOnly: !isClientReadableCookie(name),
        path,
        sameSite: "lax",
        secure: isSecureRequest(request)
      });
    }
  }
}

export function firstCookieValue(cookieHeader: string, name: string) {
  for (const cookie of cookieHeader.split(";")) {
    const trimmed = cookie.trim();
    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    if (trimmed.slice(0, separator) === name) {
      const value = trimmed.slice(separator + 1);

      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return undefined;
}

export function cookieHeaderFromAppliedCookies(applied: AppliedLaventeCareCookie[]) {
  const cookies = new Map<string, string>();

  for (const cookie of applied) {
    if (cookie.deleted) {
      cookies.delete(cookie.name);
    } else {
      cookies.set(cookie.name, cookie.value);
    }
  }

  return Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ");
}
