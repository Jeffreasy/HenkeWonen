const baseUrl = process.env.PORTAL_TEST_BASE_URL ?? "http://localhost:4321";

const routes = [
  { path: "/portal", label: "Overzicht" },
  { path: "/portal/klanten", label: "Klanten" },
  { path: "/portal/projecten", label: "Projecten" },
  { path: "/portal/projecten/kn7drc2c79vjw94h17z7e7e7f585tqra", label: "Projectopvolging" },
  { path: "/portal/offertes", label: "Offertes" },
  { path: "/portal/offertes/kx7cwgd02r1qy4rph5d79abx5n85vd21", label: "Offertebuilder" },
  { path: "/portal/catalogus", label: "Catalogus" },
  { path: "/portal/leveranciers", label: "Leveranciers" },
  { path: "/portal/imports", label: "Imports" },
  { path: "/portal/import-profielen", label: "Importprofielen" },
  { path: "/portal/catalogus/data-issues", label: "Datakwaliteit" },
  { path: "/portal/instellingen/offertetemplates", label: "Offertesjablonen" }
];

function stripHtml(value) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function checkRoute(route) {
  const url = new URL(route.path, baseUrl);
  const response = await fetch(url);
  const html = await response.text();
  const text = stripHtml(html);
  const issues = [];

  if (response.status !== 200) {
    issues.push(`verwachte HTTP 200, kreeg ${response.status}`);
  }

  if (/Application error|Unhandled Runtime Error|Internal Server Error/i.test(html)) {
    issues.push("runtime-fouttekst gevonden");
  }

  if (!/<main\b/i.test(html)) {
    issues.push("main landmark ontbreekt");
  }

  if (!/<nav\b/i.test(html)) {
    issues.push("navigatie-landmark ontbreekt");
  }

  if (!text.toLowerCase().includes(route.label.toLowerCase())) {
    issues.push(`verwacht hoofdlabel niet gevonden: ${route.label}`);
  }

  return {
    route: route.path,
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
      route: route.path,
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
