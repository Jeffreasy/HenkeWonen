import type { AppSession, AuthProvider } from "./session";
import {
  getSessionFromJwt,
  getSessionFromMeEndpoint,
  parseCookies
} from "./laventeCareSession";

const sessionCookieName = import.meta.env.LAVENTECARE_SESSION_COOKIE ?? "laventecare_session";
const authMeUrl = import.meta.env.LAVENTECARE_AUTH_ME_URL;
const jwtSecret = import.meta.env.LAVENTECARE_JWT_SECRET;
const fallbackTenantId = import.meta.env.LAVENTECARE_TENANT_SLUG ?? "henke-wonen";

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
    const token = cookies[sessionCookieName] ?? bearerToken(request);

    if (!token && !authMeUrl) {
      return null;
    }

    if (authMeUrl) {
      return await getSessionFromMeEndpoint(request, authMeUrl, fallbackTenantId);
    }

    if (!token || !jwtSecret) {
      return null;
    }

    return await getSessionFromJwt(token, jwtSecret, fallbackTenantId);
  }
};
