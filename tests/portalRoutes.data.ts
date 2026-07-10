export interface RouteConfig {
  path: string;
  label: string;
  forbidden?: string[]; // Custom forbidden terms for this route (e.g. override global)
  isBuitendienst?: boolean; // If true, checks field forbidden terms & expected terms
  expectedTerms?: string[]; // Expected terms to be present on the page
}

export const fieldForbiddenTerms = ["Catalogus", "Beheer", "Imports", "Leveranciers", "Btw controle"];

export const technicalForbiddenTerms = [
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

export const portalRoutes: RouteConfig[] = [
  { path: "/portal", label: "Start" },
  { path: "/portal?full=1", label: "Start" },
  {
    path: "/portal/buitendienst",
    label: "Vandaag",
    isBuitendienst: true,
    expectedTerms: ["Vandaag", "Inmeten", "Conceptofferte"]
  },
  {
    path: "/portal/buitendienst/vandaag",
    label: "Vandaag",
    isBuitendienst: true,
    expectedTerms: ["Vandaag", "Inmeten", "Conceptofferte"]
  },
  {
    path: "/portal/buitendienst/inmeten",
    label: "Inmeten",
    isBuitendienst: true,
    expectedTerms: ["Vandaag", "Inmeten", "Conceptofferte"]
  },
  {
    path: "/portal/buitendienst/conceptoffertes",
    label: "Conceptoffertes",
    isBuitendienst: true,
    expectedTerms: ["Vandaag", "Inmeten", "Conceptofferte", "Klantversie"]
  },
  {
    path: "/portal/buitendienst/projecten/kn7drc2c79vjw94h17z7e7e7f585tqra",
    label: "Klantbezoek",
    isBuitendienst: true,
    expectedTerms: ["Vandaag", "Inmeten", "Conceptofferte", "Klantversie"]
  },
  { path: "/portal/dossiers", label: "Zoeken in dossiers" },
  { path: "/portal/klanten", label: "Klanten" },
  { path: "/portal/projecten", label: "Projecten" },
  { path: "/portal/projecten/kn7drc2c79vjw94h17z7e7e7f585tqra", label: "Project" },
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
