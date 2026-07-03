import { describe, expect, it } from "vitest";
import {
  dossierContentDisposition,
  isInlineSafeType,
  resolveDossierContentType
} from "../src/lib/dossierBestand";

describe("resolveDossierContentType", () => {
  it("neemt een geldig opgeslagen type over (zonder parameters, lowercased)", () => {
    expect(resolveDossierContentType("application/PDF")).toBe("application/pdf");
    expect(resolveDossierContentType("text/plain; charset=utf-8")).toBe("text/plain");
  });

  it("valt terug op het upstream-type en anders op octet-stream", () => {
    expect(resolveDossierContentType(undefined, "image/png")).toBe("image/png");
    expect(resolveDossierContentType(undefined, null)).toBe("application/octet-stream");
  });

  it("weigert onbruikbare of injectie-gevoelige waardes", () => {
    expect(resolveDossierContentType("niet-een-type")).toBe("application/octet-stream");
    expect(resolveDossierContentType("text/html\r\nx-injected: 1")).toBe(
      "application/octet-stream"
    );
  });
});

describe("isInlineSafeType / dossierContentDisposition", () => {
  it("laat alleen render-veilige types inline openen", () => {
    expect(isInlineSafeType("image/jpeg")).toBe(true);
    expect(isInlineSafeType("application/pdf")).toBe(true);
    // Actieve inhoud rendert niet inline op de portal-origin (stored-XSS-vector).
    expect(isInlineSafeType("text/html")).toBe(false);
    expect(isInlineSafeType("image/svg+xml")).toBe(false);
    expect(dossierContentDisposition("text/html", "x.html")).toMatch(/^attachment/u);
    expect(dossierContentDisposition("image/jpeg", "x.jpg")).toMatch(/^inline/u);
  });

  it("overleeft niet-Latin-1-bestandsnamen (ByteString) via ASCII-fallback + filename*", () => {
    // En-dash (U+2013) komt standaard uit Word/macOS-autocorrect en brak de header eerst.
    const value = dossierContentDisposition("application/pdf", "Offerte – juli 2026.pdf");

    // De hele headerwaarde moet ByteString-veilig zijn (geen codepoints > 0xFF).
    for (const char of value) {
      expect(char.codePointAt(0) ?? 0).toBeLessThanOrEqual(0xff);
    }
    expect(value).toContain('filename="Offerte  juli 2026.pdf"');
    expect(value).toContain("filename*=UTF-8''Offerte%20%E2%80%93%20juli%202026.pdf");
  });

  it("ontsmet quotes/backslashes/control-chars en werkt zonder bestandsnaam", () => {
    const value = dossierContentDisposition("application/pdf", 'a"b\\c\r\nd.pdf');
    expect(value).toContain('filename="abcd.pdf"');
    expect(dossierContentDisposition("application/pdf")).toBe("inline");
  });
});
