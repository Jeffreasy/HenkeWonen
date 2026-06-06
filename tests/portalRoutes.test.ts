import { describe, it, expect } from "vitest";

import { portalRoutes, fieldForbiddenTerms } from "./portalRoutes.data";

const baseUrl = process.env.PORTAL_TEST_BASE_URL ?? "http://localhost:4321";

function stripHtml(value: string) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("Portal HTTP Route Smoke Tests", () => {
  it.each(portalRoutes)("should respond correctly on route: $path", async (route) => {
    const url = new URL(route.path, baseUrl);
    const response = await fetch(url);
    const html = await response.text();
    const text = stripHtml(html);

    expect(response.status).toBe(200);
    expect(html).not.toMatch(/Application error|Unhandled Runtime Error|Internal Server Error/i);
    expect(html).toContain("<main");
    expect(html).toContain("<nav");
    expect(text.toLowerCase()).toContain(route.label.toLowerCase());

    const forbidden = route.forbidden ?? (route.isBuitendienst ? fieldForbiddenTerms : []);
    for (const forbiddenTerm of forbidden) {
      expect(text).not.toContain(forbiddenTerm);
    }
  });
});
