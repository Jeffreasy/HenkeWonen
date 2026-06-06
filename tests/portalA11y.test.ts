import { describe, it, expect } from "vitest";
import {
  portalRoutes,
  fieldForbiddenTerms,
  technicalForbiddenTerms,
  type RouteConfig
} from "./portalRoutes.data";

const baseUrl = process.env.PORTAL_TEST_BASE_URL ?? "http://localhost:4321";

function attributes(markup: string) {
  const attrs: Record<string, string> = {};
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g;
  let match = attrPattern.exec(markup);

  while (match) {
    attrs[match[1].toLowerCase()] = match[2];
    match = attrPattern.exec(markup);
  }

  return attrs;
}

function visibleText(markup: string) {
  return markup
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findTagBlocks(html: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const blocks: Array<{ attrs: Record<string, string>, inner: string }> = [];
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

function findSelfClosingOrOpenTags(html: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  const tags: Array<{ raw: string, attrs: Record<string, string> }> = [];
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

function hasLabelFor(html: string, id: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<label\\b[^>]*for="${escaped}"`, "i").test(html);
}

function checkButtons(html: string, issues: string[]) {
  for (const button of findTagBlocks(html, "button")) {
    const name = button.attrs["aria-label"] ?? visibleText(button.inner);

    if (!name) {
      issues.push("knop zonder toegankelijke naam gevonden");
    }
  }
}

function checkFields(html: string, issues: string[]) {
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

function checkDutchTechnicalCopy(html: string, issues: string[]) {
  const text = visibleText(html);

  for (const term of technicalForbiddenTerms) {
    if (text.includes(term)) {
      issues.push(`technische of Engelse term zichtbaar: ${term}`);
    }
  }
}

function checkFieldWorkspaceCopy(route: RouteConfig, html: string, issues: string[]) {
  if (!route.isBuitendienst) {
    return;
  }

  const text = visibleText(html);

  for (const term of fieldForbiddenTerms) {
    if (text.includes(term)) {
      issues.push(`ongewenste buitendienst-term zichtbaar: ${term}`);
    }
  }

  const expectedTerms = route.expectedTerms ?? [];
  for (const term of expectedTerms) {
    if (!text.includes(term)) {
      issues.push(`verwachte buitendienst-term ontbreekt: ${term}`);
    }
  }
}

describe("Portal HTML Accessibility & Localization Compliance", () => {
  it.each(portalRoutes)("should satisfy accessibility and Dutch locale rules: $path", async (route) => {
    const response = await fetch(new URL(route.path, baseUrl));
    const html = await response.text();
    const issues: string[] = [];

    expect(response.status).toBe(200);
    expect(html).toMatch(/<html\b[^>]*lang="nl"/i);
    expect(html).toMatch(/<title>[^<]+<\/title>/i);
    expect(html).toContain("<main");
    expect(html).toContain("<nav");
    expect(html).toContain("aria-label=");

    checkButtons(html, issues);
    checkFields(html, issues);
    checkDutchTechnicalCopy(html, issues);
    checkFieldWorkspaceCopy(route, html, issues);

    expect(issues).toEqual([]);
  });
});
