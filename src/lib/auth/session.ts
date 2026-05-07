export type AppRole = "viewer" | "user" | "editor" | "admin";
export type AppWorkspaceMode = "general" | "field";

export type AppSession = {
  userId: string;
  tenantId: string;
  email: string;
  name?: string;
  role: AppRole;
  workspaceMode: AppWorkspaceMode;
  workspaceModeFromAuth?: boolean;
  authzToken?: string;
};

export type AuthProvider = {
  getSession(request: Request): Promise<AppSession | null>;
};

export function assertSession(session: AppSession | null): AppSession {
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

export function canWrite(role: AppRole): boolean {
  return role === "admin" || role === "editor" || role === "user";
}

export function canManage(role: AppRole): boolean {
  return role === "admin";
}

export function canEditDossiers(role: AppRole): boolean {
  return canWrite(role);
}

export function canEditQuotes(role: AppRole): boolean {
  return canWrite(role);
}

export function canEditCatalog(role: AppRole): boolean {
  return role === "admin" || role === "editor";
}

export function canViewFinancials(role: AppRole): boolean {
  return role === "admin" || role === "editor";
}

export function isFieldWorkspace(session: AppSession): boolean {
  return session.workspaceMode === "field";
}
