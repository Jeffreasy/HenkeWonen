import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const moduleCache = new Map();

function resolveModule(request, parentFile) {
  if (!request.startsWith(".")) {
    return request;
  }

  const basePath = path.resolve(path.dirname(parentFile), request);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js")
  ];

  const resolved = candidates.find((candidate) => fs.existsSync(candidate));

  if (!resolved) {
    throw new Error(`Cannot resolve ${request} from ${parentFile}`);
  }

  return resolved;
}

function loadTsModule(filePath) {
  const absolutePath = path.resolve(filePath);
  const cached = moduleCache.get(absolutePath);

  if (cached) {
    return cached.exports;
  }

  const source = fs.readFileSync(absolutePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true
    },
    fileName: absolutePath
  }).outputText;

  const module = { exports: {} };
  moduleCache.set(absolutePath, module);

  const localRequire = (request) => {
    const resolved = resolveModule(request, absolutePath);

    if (!resolved.startsWith(".") && !path.isAbsolute(resolved)) {
      return require(resolved);
    }

    if (resolved.endsWith(".ts") || resolved.endsWith(".tsx")) {
      return loadTsModule(resolved);
    }

    return require(resolved);
  };

  const wrapped = new Function("exports", "require", "module", compiled);
  wrapped(module.exports, localRequire, module);

  return module.exports;
}

loadTsModule(path.join(repoRoot, "tests/quoteDocumentModel.test.ts"));
loadTsModule(path.join(repoRoot, "tests/quoteDocumentPreview.test.tsx"));
