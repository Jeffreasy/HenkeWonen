import type { AppSession, AuthProvider } from "./session";

export const laventeCareAuthProvider: AuthProvider = {
  async getSession(request: Request): Promise<AppSession | null> {
    const cookieHeader = request.headers.get("cookie") ?? "";

    if (!cookieHeader) {
      return null;
    }

    throw new Error(
      "LaventeCare AuthSystem provider is not connected yet. Replace this placeholder with JWT/JWKS validation or a server-side /auth/me call."
    );
  }
};
