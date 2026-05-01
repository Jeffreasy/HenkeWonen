import type { AppRole } from "./auth/session";

export function requireRole(role: AppRole, allowedRoles: AppRole[]): void {
  if (!allowedRoles.includes(role)) {
    throw new Error("Forbidden");
  }
}

export function canEditCatalog(role: AppRole): boolean {
  return role === "admin" || role === "editor";
}

export function canEditQuote(role: AppRole): boolean {
  return role === "admin" || role === "editor" || role === "user";
}

export function canViewFinancials(role: AppRole): boolean {
  return role === "admin" || role === "editor";
}
