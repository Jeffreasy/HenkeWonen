import type { AstroCookies } from "astro";
import type { AppSession, AuthProvider } from "./session";
import {
  getSessionFromJwt,
  getSessionFromMeEndpoint,
  parseCookies
} from "./laventeCareSession";
import {
  applyLaventeCareSetCookies,
  clearLaventeCareCookies,
  cookieHeaderFromAppliedCookies,
  firstCookieValue
} from "./laventeCareCookies";
import {
  laventeCareApiBaseUrl,
  henkeTenantSlug,
  laventeCareAuthMeUrl,
  laventeCareTenantId
} from "./laventeCareConfig";

const sessionCookieName = import.meta.env.LAVENTECARE_SESSION_COOKIE ?? "access_token";
const authMeUrl = laventeCareAuthMeUrl();
const jwtSecret = import.meta.env.LAVENTECARE_JWT_SECRET;
const appTenantSlug = henkeTenantSlug();
const authTenantId = laventeCareTenantId();

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }

  return authorization.slice("bearer ".length).trim();
}

function requestWithCookieHeader(request: Request, cookieHeader: string) {
  const headers = new Headers(request.headers);

  headers.set("cookie", cookieHeader);

  return new Request(request.url, {
    headers,
    method: "GET"
  });
}

async function getSessionFromCookieHeader(request: Request, cookieHeader: string) {
  const sessionRequest = requestWithCookieHeader(request, cookieHeader);

  if (authMeUrl && authTenantId) {
    return await getSessionFromMeEndpoint(
      sessionRequest,
      authMeUrl,
      appTenantSlug,
      authTenantId,
      appTenantSlug
    );
  }

  if (!jwtSecret) {
    return null;
  }

  const cookies = parseCookies(cookieHeader);
  const token = cookies[sessionCookieName] ?? cookies.access_token;

  return token ? await getSessionFromJwt(token, jwtSecret, appTenantSlug, appTenantSlug) : null;
}

export const laventeCareAuthProvider: AuthProvider = {
  async getSession(request: Request): Promise<AppSession | null> {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookies = parseCookies(cookieHeader);
    const token = cookies[sessionCookieName] ?? cookies.access_token ?? bearerToken(request);

    if (!token) {
      return null;
    }

    if (authMeUrl && authTenantId) {
      return await getSessionFromMeEndpoint(
        request,
        authMeUrl,
        appTenantSlug,
        authTenantId,
        appTenantSlug
      );
    }

    if (!token || !jwtSecret) {
      return null;
    }

    return await getSessionFromJwt(token, jwtSecret, appTenantSlug, appTenantSlug);
  }
};

export async function refreshLaventeCareSession(
  request: Request,
  cookies: AstroCookies
): Promise<AppSession | null> {
  if (!authTenantId) {
    return null;
  }

  const requestCookieHeader = request.headers.get("cookie") ?? "";
  const refreshToken =
    firstCookieValue(requestCookieHeader, "refresh_token") ?? cookies.get("refresh_token")?.value;

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${laventeCareApiBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie: `refresh_token=${encodeURIComponent(refreshToken)}`,
        "X-Tenant-ID": authTenantId
      },
      redirect: "manual"
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearLaventeCareCookies(cookies, request);
      }

      return null;
    }

    const appliedCookies = applyLaventeCareSetCookies(response, cookies, request);
    const refreshedCookieHeader = cookieHeaderFromAppliedCookies(appliedCookies);

    if (!refreshedCookieHeader) {
      return null;
    }

    return await getSessionFromCookieHeader(request, refreshedCookieHeader);
  } catch (error) {
    console.warn("LaventeCare sessie kon niet server-side worden vernieuwd.", error);

    return null;
  }
}
