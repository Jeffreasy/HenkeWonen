const DEFAULT_API_BASE_URL = "https://laventecareauthsystems.onrender.com/api/v1";
const DEFAULT_APP_TENANT_SLUG = "henke-wonen";

function cleanValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/u, "");
}

export function laventeCareApiBaseUrl() {
  return withoutTrailingSlash(
    cleanValue(import.meta.env.LAVENTECARE_API_URL) ??
      cleanValue(import.meta.env.LAVENTECARE_AUTH_API_URL) ??
      cleanValue(import.meta.env.PUBLIC_LAVENTECARE_API_URL) ??
      cleanValue(import.meta.env.PUBLIC_API_URL) ??
      DEFAULT_API_BASE_URL
  );
}

export function laventeCareTenantId() {
  return (
    cleanValue(import.meta.env.LAVENTECARE_TENANT_ID) ??
    cleanValue(import.meta.env.PUBLIC_TENANT_ID) ??
    cleanValue(import.meta.env.TENANT_ID) ??
    cleanValue(import.meta.env.PUBLIC_DEV_TENANT_ID)
  );
}

export function henkeTenantSlug() {
  return (
    cleanValue(import.meta.env.HENKE_TENANT_SLUG) ??
    cleanValue(import.meta.env.APP_TENANT_SLUG) ??
    DEFAULT_APP_TENANT_SLUG
  );
}

export function laventeCareAuthMeUrl() {
  return (
    cleanValue(import.meta.env.LAVENTECARE_AUTH_ME_URL) ??
    `${laventeCareApiBaseUrl()}/auth/me`
  );
}

export function laventeCareLoginUrl() {
  return cleanValue(import.meta.env.LAVENTECARE_LOGIN_URL);
}

export function hasLaventeCareApiConnection() {
  return Boolean(laventeCareTenantId());
}

export function laventeCareTenantHeaders() {
  const tenantId = laventeCareTenantId();

  return tenantId ? { "X-Tenant-ID": tenantId } : {};
}
