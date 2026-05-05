import type { AppSession, AppWorkspaceMode, AuthProvider } from "./session";

function devRole(): AppSession["role"] {
  const role = import.meta.env.DEV_AUTH_ROLE;

  if (role === "viewer" || role === "user" || role === "editor" || role === "admin") {
    return role;
  }

  return "admin";
}

function devWorkspaceMode(): AppWorkspaceMode {
  return import.meta.env.DEV_AUTH_WORKSPACE_MODE === "field" ? "field" : "general";
}

export const devAuthProvider: AuthProvider = {
  async getSession(): Promise<AppSession> {
    return {
      userId: import.meta.env.DEV_AUTH_USER_ID ?? "dev-user-jeffrey",
      tenantId: import.meta.env.DEV_AUTH_TENANT_ID ?? "henke-wonen",
      email: import.meta.env.DEV_AUTH_EMAIL ?? "dev@laventecare.nl",
      name: import.meta.env.DEV_AUTH_NAME ?? "LaventeCare Dev",
      role: devRole(),
      workspaceMode: devWorkspaceMode()
    };
  }
};
