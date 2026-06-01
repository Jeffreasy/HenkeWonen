import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const [, , scriptPath, ...scriptArgs] = process.argv;

if (!scriptPath) {
  throw new Error("Usage: node tools/run_python_tool.mjs <script.py> [...args]");
}

function hasArg(args, name) {
  return args.includes(name) || args.some((arg) => arg.startsWith(`${name}=`));
}

function restoreNpmConfigArgs(args) {
  const restored = [...args];

  // npm 11 on Windows may convert `npm run x -- --flag` into npm_config_* env vars
  // instead of forwarding them to the script. Restore the flags used by catalog tools.
  if (!hasArg(restored, "--no-write") && ["", "false"].includes(process.env.npm_config_write ?? "unset")) {
    restored.push("--no-write");
  }

  if (!hasArg(restored, "--full") && process.env.npm_config_full === "true") {
    restored.push("--full");
  }

  if (!hasArg(restored, "--source") && process.env.npm_config_source) {
    restored.push("--source", process.env.npm_config_source);
  }

  return restored;
}

const restoredScriptArgs = restoreNpmConfigArgs(scriptArgs);

const bundledPython = join(
  homedir(),
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  process.platform === "win32" ? "python/python.exe" : "python/bin/python"
);

const candidates = [
  process.env.CATALOG_PYTHON,
  process.env.PYTHON,
  existsSync(bundledPython) ? bundledPython : undefined,
  "python",
  "python3",
].filter(Boolean);

function hasExcelRuntime(command) {
  const result = spawnSync(command, ["-c", "import openpyxl"], {
    encoding: "utf8",
    shell: false,
  });

  return result.status === 0;
}

const python = candidates.find((candidate) => hasExcelRuntime(candidate));

if (!python) {
  console.error(
    "Geen Python runtime met openpyxl gevonden. Zet CATALOG_PYTHON naar een Python met openpyxl of installeer openpyxl."
  );
  process.exit(1);
}

const result = spawnSync(python, [resolve(scriptPath), ...restoredScriptArgs], {
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
