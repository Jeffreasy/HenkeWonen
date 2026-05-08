import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PRODUCTION_CONVEX_DEPLOYMENT = "prod:accomplished-kangaroo-354";
export const PRODUCTION_CONVEX_URL =
  "https://accomplished-kangaroo-354.eu-west-1.convex.cloud";
export const PRODUCTION_CONVEX_SITE_URL =
  "https://accomplished-kangaroo-354.eu-west-1.convex.site";

const VALUE_OPTIONS = new Set([
  "--date-stamp",
  "--decisions-file",
  "--env-file",
  "--result-file",
  "--target",
  "--tenant"
]);

export function parseToolArgs(argv) {
  const flags = new Set();
  const values = new Map();
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const equalsIndex = arg.indexOf("=");
    const name = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);

    if (equalsIndex !== -1) {
      values.set(name, arg.slice(equalsIndex + 1));
      continue;
    }

    if (VALUE_OPTIONS.has(name)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${name} mist een waarde.`);
      }
      values.set(name, value);
      index += 1;
      continue;
    }

    flags.add(name);
  }

  return { flags, values, positionals };
}

export function hasFlag(args, flag) {
  return args.flags.has(flag);
}

export function optionValue(args, optionName) {
  return args.values.get(optionName);
}

function cleanEnvValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function loadEnvFile(path) {
  if (!existsSync(path)) {
    return false;
  }

  const raw = readFileSync(path, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    if (key && rest.length > 0 && !process.env[key]) {
      process.env[key] = cleanEnvValue(rest.join("="));
    }
  }

  return true;
}

function inferTarget({ targetOption, convexDeployment, convexUrl }) {
  const normalizedTarget = String(targetOption ?? "").toLowerCase();

  if (normalizedTarget === "production" || normalizedTarget === "prod") {
    return "production";
  }

  if (["development", "dev", "local"].includes(normalizedTarget)) {
    return "development";
  }

  if (convexDeployment === PRODUCTION_CONVEX_DEPLOYMENT || convexUrl === PRODUCTION_CONVEX_URL) {
    return "production";
  }

  if (convexDeployment?.startsWith("dev:") || convexDeployment === "local") {
    return "development";
  }

  return "unknown";
}

function hasLiteralNewlineArtifact(value) {
  return typeof value === "string" && /\\r|\\n|\r|\n/u.test(value);
}

export function loadCatalogToolEnv({
  root,
  argv,
  defaultTenantSlug = "henke-wonen"
}) {
  const args = parseToolArgs(argv);
  const envFileExplicit = Boolean(optionValue(args, "--env-file") ?? process.env.CATALOG_ENV_FILE);
  const skipEnvFile = hasFlag(args, "--no-env-file");
  const envFileOption = skipEnvFile
    ? undefined
    : optionValue(args, "--env-file") ?? process.env.CATALOG_ENV_FILE ?? ".env.local";
  const envPath = envFileOption ? resolve(root, envFileOption) : undefined;
  const envFileLoaded = envPath ? loadEnvFile(envPath) : false;
  const tenantSlug =
    optionValue(args, "--tenant") ??
    args.positionals[0] ??
    process.env.HENKE_TENANT_SLUG ??
    defaultTenantSlug;
  const targetOption = optionValue(args, "--target") ?? process.env.CATALOG_TARGET;
  const convexUrl = cleanEnvValue(process.env.PUBLIC_CONVEX_URL);
  const convexDeployment = cleanEnvValue(process.env.CONVEX_DEPLOYMENT);

  if (typeof convexUrl === "string") {
    process.env.PUBLIC_CONVEX_URL = convexUrl;
  }

  if (typeof convexDeployment === "string") {
    process.env.CONVEX_DEPLOYMENT = convexDeployment;
  }

  return {
    args,
    envFileLoaded,
    envPath,
    tenantSlug,
    target: inferTarget({ targetOption, convexDeployment, convexUrl }),
    targetOption,
    convexUrl,
    convexDeployment,
    envFileExplicit,
    skipEnvFile
  };
}

export function requireCatalogToolTarget(
  toolEnv,
  {
    operation,
    mutates = false,
    requireAuthzSecret = false,
    productionConfirmFlag,
    allowUnknownVatMode = false,
    disallowProductionAllowUnknown = false
  }
) {
  const productionFlag =
    hasFlag(toolEnv.args, "--production") ||
    ["production", "prod"].includes(String(toolEnv.targetOption ?? "").toLowerCase());

  if (!toolEnv.convexUrl) {
    throw new Error(
      `PUBLIC_CONVEX_URL ontbreekt. Gebruik --env-file of CATALOG_ENV_FILE voor ${operation}.`
    );
  }

  for (const [key, value] of [
    ["CONVEX_DEPLOYMENT", toolEnv.convexDeployment],
    ["PUBLIC_CONVEX_URL", toolEnv.convexUrl],
    ["PUBLIC_CONVEX_HTTP_ACTIONS_URL", process.env.PUBLIC_CONVEX_HTTP_ACTIONS_URL],
    ["CONVEX_SITE_URL", process.env.CONVEX_SITE_URL],
    ["AUTH_MODE", process.env.AUTH_MODE],
    ["PUBLIC_AUTH_MODE", process.env.PUBLIC_AUTH_MODE]
  ]) {
    if (hasLiteralNewlineArtifact(value)) {
      throw new Error(`${key} bevat een literal newline artifact. Trek/schrijf de env opnieuw schoon.`);
    }
  }

  if (toolEnv.target === "production") {
    if (!toolEnv.envFileExplicit && !toolEnv.skipEnvFile) {
      throw new Error(
        `${operation} op production vereist --env-file/ CATALOG_ENV_FILE of bewust --no-env-file met shell-env.`
      );
    }

    if (!productionFlag) {
      throw new Error(
        `${operation} wijst naar production, maar mist --production of --target=production.`
      );
    }

    if (
      toolEnv.convexDeployment !== PRODUCTION_CONVEX_DEPLOYMENT ||
      toolEnv.convexUrl !== PRODUCTION_CONVEX_URL
    ) {
      throw new Error(
        `${operation} mag alleen naar ${PRODUCTION_CONVEX_DEPLOYMENT} / ${PRODUCTION_CONVEX_URL}.`
      );
    }

    if (disallowProductionAllowUnknown && allowUnknownVatMode) {
      throw new Error("--allow-unknown-vat is uitgeschakeld voor production.");
    }

    if (mutates && productionConfirmFlag && !hasFlag(toolEnv.args, productionConfirmFlag)) {
      throw new Error(
        `${operation} muteert production. Voeg bewust ${productionConfirmFlag} toe.`
      );
    }

    if (requireAuthzSecret && !process.env.AUTHZ_TOKEN_SECRET) {
      throw new Error(
        `${operation} op production vereist AUTHZ_TOKEN_SECRET in het gekozen env-bestand.`
      );
    }
  } else if (productionFlag) {
    throw new Error(
      `${operation} kreeg een production-flag, maar de geladen env is target=${toolEnv.target}.`
    );
  }

  if (mutates && toolEnv.target === "unknown") {
    throw new Error(
      `${operation} muteert data, maar het Convex target is onbekend. Zet CONVEX_DEPLOYMENT of --target expliciet.`
    );
  }
}

export function targetSummary(toolEnv) {
  return {
    tenantSlug: toolEnv.tenantSlug,
    target: toolEnv.target,
    convexDeployment: toolEnv.convexDeployment,
    convexUrl: toolEnv.convexUrl,
    envFile: toolEnv.envPath,
    envFileLoaded: toolEnv.envFileLoaded,
    skipEnvFile: toolEnv.skipEnvFile
  };
}
