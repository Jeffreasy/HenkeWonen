import type { AppSession, AuthProvider } from "./session";
import {
  getSessionFromJwt,
  getSessionFromMeEndpoint,
  parseCookies
} from "./laventeCareSession";
import {
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
