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

// Ruim genoeg voor een cold start van de auth-dienst (Render), maar begrensd:
// zonder timeout hangt elke /portal-request oneindig als LaventeCare niet reageert.
const DEFAULT_AUTH_TIMEOUT_MS = 15_000;

export function laventeCareAuthTimeoutMs() {
  const raw = cleanValue(import.meta.env.LAVENTECARE_AUTH_TIMEOUT_MS);
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AUTH_TIMEOUT_MS;
}

export function hasLaventeCareApiConnection() {
  return Boolean(laventeCareTenantId());
}

export function laventeCareTenantHeaders() {
  const tenantId = laventeCareTenantId();

  return tenantId ? { "X-Tenant-ID": tenantId } : {};
}
