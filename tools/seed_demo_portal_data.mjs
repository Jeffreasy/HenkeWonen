import { spawnSync } from "node:child_process";

const args = [
  "convex",
  "dev",
  "--once",
  "--tail-logs",
  "disable",
  "--env-file",
  ".env.local",
  "--run",
  "demoSeed:run"
];

const result = spawnSync("npx", args, {
  cwd: process.cwd(),
  env: { ...process.env, ALLOW_CONVEX_TOOLING: "true" },
  shell: true,
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
