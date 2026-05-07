import { spawn } from "node:child_process";
import net from "node:net";

const host = "127.0.0.1";
const startPort = Number(process.env.PORTAL_TEST_START_PORT ?? 4323);

function cmdQuote(value) {
  if (/^[\w./:=@-]+$/u.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}

function spawnCommand(name, args, options) {
  if (process.platform === "win32" && name === "npm") {
    return spawn("cmd.exe", ["/d", "/s", "/c", ["npm", ...args].map(cmdQuote).join(" ")], options);
  }

  return spawn(name, args, options);
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findPort() {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }

  throw new Error(`Geen vrije testpoort gevonden vanaf ${startPort}.`);
}

async function waitForServer(baseUrl, child) {
  const startedAt = Date.now();
  const timeoutMs = Number(process.env.PORTAL_TEST_SERVER_TIMEOUT_MS ?? 45_000);

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Portal testserver stopte voortijdig met exit code ${child.exitCode}.`);
    }

    try {
      const response = await fetch(`${baseUrl}/login`, {
        redirect: "manual"
      });

      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Portal testserver niet bereikbaar binnen ${timeoutMs}ms.`);
}

function stopServer(child) {
  if (child.exitCode !== null) {
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

function pipePrefixed(stream, prefix) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    for (const line of chunk.split(/\r?\n/u)) {
      if (line.trim()) {
        console.log(`${prefix} ${line}`);
      }
    }
  });
}

const port = await findPort();
const baseUrl = `http://${host}:${port}`;
const server = spawnCommand(
  "npm",
  ["run", "dev", "--", "--host", host, "--port", String(port)],
  {
    env: {
      ...process.env,
      AUTH_MODE: "dev",
      PUBLIC_AUTH_MODE: "dev",
      ALLOW_DEV_AUTH: "true",
      DEV_AUTH_ROLE: process.env.DEV_AUTH_ROLE ?? "admin",
      DEV_AUTH_TENANT_ID: process.env.DEV_AUTH_TENANT_ID ?? "henke-wonen",
      DEV_AUTH_USER_ID: process.env.DEV_AUTH_USER_ID ?? "dev-user-jeffrey",
      DEV_AUTH_EMAIL: process.env.DEV_AUTH_EMAIL ?? "dev@laventecare.nl",
      DEV_AUTH_NAME: process.env.DEV_AUTH_NAME ?? "LaventeCare Dev"
    },
    stdio: ["ignore", "pipe", "pipe"]
  }
);

pipePrefixed(server.stdout, "[portal-test-server]");
pipePrefixed(server.stderr, "[portal-test-server]");

try {
  await waitForServer(baseUrl, server);

  const test = spawnCommand("node", ["tools/test_portal_routes.mjs"], {
    env: {
      ...process.env,
      PORTAL_TEST_BASE_URL: baseUrl
    },
    stdio: "inherit"
  });
  const exitCode = await new Promise((resolve) => {
    test.on("exit", (code) => resolve(code ?? 1));
  });

  process.exitCode = exitCode;
} finally {
  stopServer(server);
}
