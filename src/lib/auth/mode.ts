export type AuthMode = "dev" | "laventecare";

function configuredAuthMode(): AuthMode | undefined {
  const configuredMode = import.meta.env.AUTH_MODE ?? import.meta.env.PUBLIC_AUTH_MODE;

  if (configuredMode === "dev" || configuredMode === "laventecare") {
    return configuredMode;
  }

  if (configuredMode) {
    console.warn(`Onbekende AUTH_MODE genegeerd: ${configuredMode}`);
  }

  return undefined;
}

function allowsDevAuth() {
  return import.meta.env.DEV || import.meta.env.ALLOW_DEV_AUTH === "true";
}

export function resolveAuthMode(): AuthMode {
  const mode = configuredAuthMode();
  const allowDevAuth = allowsDevAuth();

  if (mode === "dev" && !allowDevAuth) {
    console.warn(
      "Dev-auth configuratie genegeerd buiten development. Gebruik AUTH_MODE=laventecare."
    );
    return "laventecare";
  }

  return mode ?? (allowDevAuth ? "dev" : "laventecare");
}
