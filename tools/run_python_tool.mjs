import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const [, , scriptPath, ...scriptArgs] = process.argv;

if (!scriptPath) {
  throw new Error("Usage: node tools/run_python_tool.mjs <script.py> [...args]");
}

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

const result = spawnSync(python, [resolve(scriptPath), ...scriptArgs], {
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
