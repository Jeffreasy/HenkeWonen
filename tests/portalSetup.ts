import { spawn } from "node:child_process";
import net from "node:net";

let serverProcess: any = null;

const host = "127.0.0.1";
const startPort = 4323;

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findPort(): Promise<number> {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }
  throw new Error(`Geen vrije testpoort gevonden vanaf ${startPort}.`);
}

function stopServer(child: any) {
  if (!child || child.exitCode !== null) {
    return;
  }
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore"
    });
    return;
  }
  child.kill("SIGTERM");
}

export async function setup() {
  const port = await findPort();
  const baseUrl = `http://${host}:${port}`;
  
  process.env.PORTAL_TEST_BASE_URL = baseUrl;
  
  const cmd = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm run dev -- --host ${host} --port ${port}`]
    : ["run", "dev", "--", "--host", host, "--port", String(port)];

  serverProcess = spawn(cmd, args, {
    env: {
      ...process.env,
      AUTH_MODE: "dev",
      PUBLIC_AUTH_MODE: "dev",
      ALLOW_DEV_AUTH: "true",
      DEV_AUTH_ROLE: "admin",
      DEV_AUTH_TENANT_ID: "henke-wonen",
      DEV_AUTH_USER_ID: "dev-user-jeffrey",
      DEV_AUTH_EMAIL: "dev@laventecare.nl",
      DEV_AUTH_NAME: "LaventeCare Dev"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const startedAt = Date.now();
  const timeoutMs = 45_000;

  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Portal testserver stopte voortijdig met exit code ${serverProcess.exitCode}.`);
    }

    try {
      const response = await fetch(`${baseUrl}/login`, {
        redirect: "manual"
      });

      if (response.status < 500) {
        console.log(`\n[portalSetup] Server is online op ${baseUrl}`);
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  stopServer(serverProcess);
  throw new Error(`Portal testserver niet bereikbaar binnen ${timeoutMs}ms.`);
}

export function teardown() {
  if (serverProcess) {
    console.log("\n[portalSetup] Server stoppen...");
    stopServer(serverProcess);
  }
}
