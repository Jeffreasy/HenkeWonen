import assert from "node:assert/strict";
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
    `${basePath}.js`,
    path.join(basePath, "index.ts"),
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

    if (resolved.endsWith(".ts")) {
      return loadTsModule(resolved);
    }

    return require(resolved);
  };

  const wrapped = new Function("exports", "require", "module", compiled);
  wrapped(module.exports, localRequire, module);

  return module.exports;
}

const calculators = loadTsModule(path.join(repoRoot, "src/lib/calculators/index.ts"));

const flooring = calculators.calculateFlooring({
  lengthM: 4,
  widthM: 5,
  wastePercent: 10,
  patternType: "straight"
});

assert.equal(flooring.areaM2, 20);
assert.equal(flooring.wasteM2, 2);
assert.equal(flooring.totalM2, 22);
assert.equal(flooring.quoteQuantityM2, 22);
assert.equal(flooring.isIndicative, true);

const plinths = calculators.calculatePlinths({
  perimeterM: 20,
  doorOpeningM: 2,
  wastePercent: 5
});

assert.equal(plinths.netMeter, 18);
assert.equal(plinths.wasteMeter, 0.9);
assert.equal(plinths.totalMeter, 18.9);
assert.equal(plinths.quoteQuantityMeter, 18.9);

const wallPanels = calculators.calculateWallPanels({
  wallWidthM: 4,
  wallHeightM: 2.5,
  panelWidthM: 0.6,
  panelHeightM: 2.6,
  wastePercent: 10
});

assert.equal(wallPanels.wallAreaM2, 10);
assert.equal(wallPanels.panelAreaM2, 1.56);
assert.equal(wallPanels.panelsNeeded, 7);
assert.equal(wallPanels.wastePanels, 1);
assert.equal(wallPanels.totalPanels, 8);
assert.equal(wallPanels.quoteQuantityPieces, 8);

const stairs = calculators.calculateStairs({
  stairType: "closed",
  treadCount: 13,
  riserCount: 13
});

assert.equal(stairs.treadCount, 13);
assert.equal(stairs.riserCount, 13);
assert.equal(stairs.quoteQuantity, 1);
assert.equal(stairs.unit, "stairs");
assert.ok(stairs.notes.includes("closed staircase"));

assert.ok(
  calculators.calculateFlooring({
    lengthM: 0,
    widthM: 5,
    wastePercent: 10,
    patternType: "straight"
  }).validationError
);

assert.ok(
  calculators.calculatePlinths({
    perimeterM: 10,
    doorOpeningM: -1,
    wastePercent: 5
  }).validationError
);

assert.ok(
  calculators.calculateWallPanels({
    wallWidthM: 4,
    wallHeightM: 2.5,
    panelWidthM: 0,
    panelHeightM: 2.6,
    wastePercent: 10
  }).validationError
);

assert.ok(
  calculators.calculateStairs({
    stairType: "straight",
    treadCount: 0,
    riserCount: 0
  }).validationError
);

const wallpaper = calculators.calculateWallpaperRolls({
  wallWidthM: 4,
  wallHeightM: 2.5
});

assert.equal(wallpaper.isIndicative, true);
assert.ok(wallpaper.rollsNeeded > 0);

console.log("Calculator tests passed.");
