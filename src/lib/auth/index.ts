import type { AuthProvider } from "./session";
import { devAuthProvider } from "./devAuthProvider";
import { laventeCareAuthProvider } from "./laventeCareAuthProvider";

const configuredAuthMode = import.meta.env.AUTH_MODE ?? import.meta.env.PUBLIC_AUTH_MODE;
const allowDevAuth = import.meta.env.DEV || import.meta.env.ALLOW_DEV_AUTH === "true";
const authMode = configuredAuthMode ?? (allowDevAuth ? "dev" : "laventecare");

if (authMode === "dev" && !allowDevAuth) {
  throw new Error("Dev-auth is uitgeschakeld buiten development. Gebruik AUTH_MODE=laventecare.");
}

export const authProvider: AuthProvider =
  authMode === "laventecare" ? laventeCareAuthProvider : devAuthProvider;

export function currentAuthMode() {
  return authMode;
}
