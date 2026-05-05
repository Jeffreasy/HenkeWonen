import type { AuthProvider } from "./session";
import { devAuthProvider } from "./devAuthProvider";
import { laventeCareAuthProvider } from "./laventeCareAuthProvider";
import { resolveAuthMode } from "./mode";

const authMode = resolveAuthMode();

export const authProvider: AuthProvider =
  authMode === "laventecare" ? laventeCareAuthProvider : devAuthProvider;

export function currentAuthMode() {
  return authMode;
}
