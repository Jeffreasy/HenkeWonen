const baseUrl = process.env.PORTAL_TEST_BASE_URL ?? "http://localhost:4321";
const fieldForbiddenTerms = ["Catalogus", "Beheer", "Imports", "Leveranciers", "Btw controle"];

const routes = [
  { path: "/portal", label: "Start" },
  { path: "/portal?full=1", label: "Start" },
  {
    path: "/portal/buitendienst",
    label: "Buitendienst werkplek",
    forbidden: fieldForbiddenTerms
  },
  {
    path: "/portal/buitendienst/projecten/kn7drc2c79vjw94h17z7e7e7f585tqra",
    label: "Klantbezoek",
    forbidden: fieldForbiddenTerms
  },
  { path: "/portal/dossiers", label: "Dossiers" },
  { path: "/portal/klanten", label: "Klanten" },
  { path: "/portal/projecten", label: "Projecten" },
  { path: "/portal/projecten/kn7drc2c79vjw94h17z7e7e7f585tqra", label: "Projectwerkplek" },
  { path: "/portal/offertes", label: "Offertes" },
  { path: "/portal/offertes/kx7cwgd02r1qy4rph5d79abx5n85vd21", label: "Offerte samenstellen" },
  { path: "/portal/catalogus", label: "Catalogus" },
  { path: "/portal/beheer", label: "Beheer" },
  { path: "/portal/leveranciers", label: "Leveranciers" },
  { path: "/portal/imports", label: "Prijslijsten" },
  { path: "/portal/import-profielen", label: "Btw controle" },
  { path: "/portal/catalogus/data-issues", label: "Productcontrole" },
  { path: "/portal/instellingen/offertetemplates", label: "Offerteteksten" }
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

  for (const forbiddenTerm of route.forbidden ?? []) {
    if (text.includes(forbiddenTerm)) {
      issues.push(`ongewenste buitendienst-term zichtbaar: ${forbiddenTerm}`);
    }
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
