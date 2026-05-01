export type AppRole = "viewer" | "user" | "editor" | "admin";

export type AppSession = {
  userId: string;
  tenantId: string;
  email: string;
  name?: string;
  role: AppRole;
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
  return role === "admin" || role === "editor";
}

export function canManage(role: AppRole): boolean {
  return role === "admin";
}
