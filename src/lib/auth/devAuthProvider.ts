import type { AppSession, AuthProvider } from "./session";

const DEFAULT_DEV_SESSION: AppSession = {
  userId: "dev-user-jeffrey",
  tenantId: "henke-wonen",
  email: "dev@laventecare.nl",
  name: "LaventeCare Dev",
  role: "admin"
};

export const devAuthProvider: AuthProvider = {
  async getSession(): Promise<AppSession> {
    return DEFAULT_DEV_SESSION;
  }
};
