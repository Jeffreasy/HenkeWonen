/**
 * Start de Astro dev-server in dev-auth-modus voor lokale UI-reviews,
 * zonder .env.local aan te passen (echte proces-env wint van dotenv).
 * Niet voor productiegebruik.
 */
import { spawn } from "node:child_process";

const port = process.env.PREVIEW_PORT ?? "4399";

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["astro", "dev", "--port", port],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      AUTH_MODE: "dev",
      PUBLIC_AUTH_MODE: "dev",
      ALLOW_DEV_AUTH: "true",
      DEV_AUTH_ROLE: "admin",
      DEV_AUTH_WORKSPACE_MODE: "general"
    }
  }
);

child.on("exit", (code) => process.exit(code ?? 0));
