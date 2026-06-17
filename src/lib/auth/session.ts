/**
 * Auth session types and role-based permission helpers.
 *
 * Architecture:
 * - `AppSession` is set on `Astro.locals.session` by `src/middleware.ts` for every request.
 * - Role hierarchy: viewer < user < editor < admin
 * - `workspaceMode` determines which UI is shown: "general" (winkel) or "field" (buitendienst).
 * - All Convex mutations verify the `authzToken` server-side via `convex/authz.ts`.
 */

/** Role hierarchy: viewer < user < editor < admin */
export type AppRole = "viewer" | "user" | "editor" | "admin";

/**
 * Determines which portal entry point the user lands on after login.
 * - `"general"` → Winkel/kantoor (default)
 * - `"field"` → Buitendienst (redirect to `/portal/buitendienst/vandaag`)
 */
export type AppWorkspaceMode = "general" | "field";

/**
 * The authenticated session, available on every portal request via `Astro.locals.session`.
 * Set by `src/middleware.ts` — never constructed manually.
 */
export type AppSession = {
  /** Convex user ID (`users` table) */
  userId: string;
  /** Convex tenant ID (`tenants` table) */
  tenantId: string;
  email: string;
  name?: string;
  role: AppRole;
  workspaceMode: AppWorkspaceMode;
  /** True if workspaceMode was set by the auth provider (LaventeCare), not by user preference */
  workspaceModeFromAuth?: boolean;
  /** Short-lived JWT for authorizing Convex mutations — set by middleware */
  authzToken?: string;
};

/** Interface that auth providers (LaventeCare, dev) must implement. */
export type AuthProvider = {
  getSession(request: Request): Promise<AppSession | null>;
};

/** Asserts session is not null. Throws `Error("Unauthorized")` if missing. */
export function assertSession(session: AppSession | null): AppSession {
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

/** viewer, user, editor, admin can write. Only `viewer` cannot. */
export function canWrite(role: AppRole): boolean {
  return role === "admin" || role === "editor" || role === "user";
}

/** Only `admin` can access beheer, import, suppliers, and settings pages. */
export function canManage(role: AppRole): boolean {
  return role === "admin";
}

/** Whether the user can create/edit customer dossiers and projects. */
export function canEditDossiers(role: AppRole): boolean {
  return canWrite(role);
}

/** Whether the user can create/edit quotes. */
export function canEditQuotes(role: AppRole): boolean {
  return canWrite(role);
}

/** Whether the user can edit catalog products and prices. `editor` and `admin` only. */
export function canEditCatalog(role: AppRole): boolean {
  return role === "admin" || role === "editor";
}

/** Whether the user can see financial data (prices, invoice amounts). `editor` and `admin` only. */
export function canViewFinancials(role: AppRole): boolean {
  return role === "admin" || role === "editor";
}

/** Whether the user can manage monteur-beschikbaarheid (weekrooster + afwezigheid). `editor` and `admin` — gelijk aan de server-side authz van de agenda-mutaties. */
export function canManageAgenda(role: AppRole): boolean {
  return role === "admin" || role === "editor";
}

/** Returns true if the session is in field/buitendienst mode. */
export function isFieldWorkspace(session: AppSession): boolean {
  return session.workspaceMode === "field";
}
