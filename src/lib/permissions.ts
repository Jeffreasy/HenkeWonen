import {
  canEditCatalog as canEditCatalogForRole,
  canEditQuotes as canEditQuotesForRole,
  canViewFinancials as canViewFinancialsForRole,
  type AppRole
} from "./auth/session";

export function requireRole(role: AppRole, allowedRoles: AppRole[]): void {
  if (!allowedRoles.includes(role)) {
    throw new Error("Forbidden");
  }
}

export function canEditCatalog(role: AppRole): boolean {
  return canEditCatalogForRole(role);
}

export function canEditQuote(role: AppRole): boolean {
  return canEditQuotesForRole(role);
}

export function canViewFinancials(role: AppRole): boolean {
  return canViewFinancialsForRole(role);
}
