const baseUrl = process.env.PORTAL_TEST_BASE_URL ?? "http://localhost:4321";
const fieldForbiddenTerms = ["Catalogus", "Beheer", "Imports", "Leveranciers", "Btw controle"];

const routes = [
  "/portal",
  "/portal?full=1",
  "/portal/buitendienst",
  "/portal/buitendienst/projecten/kn7drc2c79vjw94h17z7e7e7f585tqra",
  "/portal/dossiers",
  "/portal/klanten",
  "/portal/projecten",
  "/portal/projecten/kn7drc2c79vjw94h17z7e7e7f585tqra",
  "/portal/offertes",
  "/portal/offertes/kx7cwgd02r1qy4rph5d79abx5n85vd21",
  "/portal/catalogus",
  "/portal/beheer",
  "/portal/leveranciers",
  "/portal/imports",
  "/portal/import-profielen",
  "/portal/catalogus/data-issues",
  "/portal/instellingen/offertetemplates"
];

function attributes(markup) {
  const attrs = {};
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g;
  let match = attrPattern.exec(markup);

  while (match) {
    attrs[match[1].toLowerCase()] = match[2];
    match = attrPattern.exec(markup);
  }

  return attrs;
}

function visibleText(markup) {
  return markup
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findTagBlocks(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const blocks = [];
  let match = pattern.exec(html);

  while (match) {
    blocks.push({
      attrs: attributes(match[1]),
      inner: match[2]
    });
    match = pattern.exec(html);
  }

  return blocks;
}

function findSelfClosingOrOpenTags(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  const tags = [];
  let match = pattern.exec(html);

  while (match) {
    tags.push({
      raw: match[0],
      attrs: attributes(match[1])
    });
    match = pattern.exec(html);
  }

  return tags;
}

function hasLabelFor(html, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<label\\b[^>]*for="${escaped}"`, "i").test(html);
}

function checkButtons(html, issues) {
  for (const button of findTagBlocks(html, "button")) {
    const name = button.attrs["aria-label"] ?? visibleText(button.inner);

    if (!name) {
      issues.push("knop zonder toegankelijke naam gevonden");
    }
  }
}

function checkFields(html, issues) {
  for (const tagName of ["input", "select", "textarea"]) {
    for (const field of findSelfClosingOrOpenTags(html, tagName)) {
      const type = field.attrs.type ?? "";

      if (type === "hidden") {
        continue;
      }

      const id = field.attrs.id;
      const hasAccessibleName =
        Boolean(field.attrs["aria-label"]) ||
        Boolean(field.attrs["aria-labelledby"]) ||
        Boolean(id && hasLabelFor(html, id));

      if (!hasAccessibleName) {
        issues.push(`${tagName} zonder label of aria-label gevonden`);
      }
    }
  }
}

function checkDutchTechnicalCopy(html, issues) {
  const text = visibleText(html);
  const rawTerms = [
    "Production import status",
    "BLOCKED",
    "READY",
    "Duplicate EAN issues",
    "unknown VAT",
    "allowUnknownVatMode",
    "preview rows",
    "price rules",
    "quote draft",
    "defaultLines",
    "lineType",
    "paymentTerms",
    "sectionKey",
    "defaultEnabled",
    "categoryHint",
    "productKindHint"
  ];

  for (const term of rawTerms) {
    if (text.includes(term)) {
      issues.push(`technische of Engelse term zichtbaar: ${term}`);
    }
  }
}

function checkFieldWorkspaceCopy(path, html, issues) {
  if (!path.startsWith("/portal/buitendienst")) {
    return;
  }

  const text = visibleText(html);

  for (const term of fieldForbiddenTerms) {
    if (text.includes(term)) {
      issues.push(`ongewenste buitendienst-term zichtbaar: ${term}`);
    }
  }

  for (const term of ["Vandaag", "Inmeten", "Conceptofferte", "Klantversie"]) {
    if (!text.includes(term)) {
      issues.push(`verwachte buitendienst-term ontbreekt: ${term}`);
    }
  }
}

async function checkRoute(path) {
  const response = await fetch(new URL(path, baseUrl));
  const html = await response.text();
  const issues = [];

  if (response.status !== 200) {
    issues.push(`verwachte HTTP 200, kreeg ${response.status}`);
  }

  if (!/<html\b[^>]*lang="nl"/i.test(html)) {
    issues.push("html lang=\"nl\" ontbreekt");
  }

  if (!/<title>[^<]+<\/title>/i.test(html)) {
    issues.push("documenttitel ontbreekt");
  }

  if (!/<main\b/i.test(html)) {
    issues.push("main landmark ontbreekt");
  }

  if (!/<nav\b[^>]*aria-label=/i.test(html)) {
    issues.push("nav landmark zonder aria-label gevonden");
  }

  checkButtons(html, issues);
  checkFields(html, issues);
  checkDutchTechnicalCopy(html, issues);
  checkFieldWorkspaceCopy(path, html, issues);

  return {
    route: path,
    status: response.status,
    ok: issues.length === 0,
    issues
  };
}

const results = [];

for (const route of routes) {
  try {
    results.push(await checkRoute(route));
  } catch (error) {
    results.push({
      route,
      status: "ERROR",
      ok: false,
      issues: [error instanceof Error ? error.message : String(error)]
    });
  }
}

console.table(
  results.map((result) => ({
    route: result.route,
    status: result.status,
    ok: result.ok,
    issues: result.issues.join("; ")
  }))
);

if (results.some((result) => !result.ok)) {
  process.exitCode = 1;
}
