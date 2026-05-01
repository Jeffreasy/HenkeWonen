import type { AuthProvider } from "./session";
import { devAuthProvider } from "./devAuthProvider";
import { laventeCareAuthProvider } from "./laventeCareAuthProvider";

const authMode = import.meta.env.PUBLIC_AUTH_MODE ?? "dev";

export const authProvider: AuthProvider =
  authMode === "laventecare" ? laventeCareAuthProvider : devAuthProvider;
