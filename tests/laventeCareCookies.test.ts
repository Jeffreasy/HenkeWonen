import { describe, it, expect, vi } from "vitest";
import {
  splitSetCookieHeader,
  upstreamSetCookies,
  firstCookieValue,
  cookieHeaderFromAppliedCookies,
  applyLaventeCareJsonTokenCookies,
  clearLaventeCareCookies
} from "../src/lib/auth/laventeCareCookies";
import { parseCookies } from "../src/lib/auth/laventeCareSession";

describe("LaventeCare Cookies Helpers", () => {
  it("splitSetCookieHeader should split headers on commas but respect expires date commas", () => {
    const header = "access_token=123; Path=/; Expires=Sat, 06 Jun 2026 12:00:00 GMT; HttpOnly, refresh_token=456; Path=/";
    const cookies = splitSetCookieHeader(header);
    expect(cookies.length).toBe(2);
    expect(cookies[0]).toBe("access_token=123; Path=/; Expires=Sat, 06 Jun 2026 12:00:00 GMT; HttpOnly");
    expect(cookies[1]).toBe("refresh_token=456; Path=/");
  });

  it("upstreamSetCookies should extract set-cookie values", () => {
    const headers = new Headers();
    headers.append("set-cookie", "a=1");
    headers.append("set-cookie", "b=2");
    
    const list = upstreamSetCookies(headers);
    expect(list).toContain("a=1");
    expect(list).toContain("b=2");
  });

  it("firstCookieValue should fetch correct decoded cookie value from Cookie header", () => {
    const cookieHeader = "other=xyz; access_token=encoded%20value; test=foo";
    expect(firstCookieValue(cookieHeader, "access_token")).toBe("encoded value");
    expect(firstCookieValue(cookieHeader, "missing")).toBeUndefined();
  });

  it("parseCookies should preserve malformed encoded values instead of throwing", () => {
    expect(parseCookies("access_token=abc%ZZ; valid=encoded%20value")).toEqual({
      access_token: "abc%ZZ",
      valid: "encoded value"
    });
  });

  it("cookieHeaderFromAppliedCookies should generate formatted Cookie header", () => {
    const applied = [
      { name: "token1", value: "val1", path: "/", deleted: false },
      { name: "token2", value: "val2", path: "/", deleted: false },
      { name: "token1", value: "val1", path: "/", deleted: true }
    ];

    const header = cookieHeaderFromAppliedCookies(applied);
    expect(header).toBe("token2=val2");
  });

  it("applyLaventeCareJsonTokenCookies should set token cookies", () => {
    const mockCookies = {
      set: vi.fn()
    } as any;
    const request = { url: "http://localhost:4321" } as any;

    const payload = {
      accessToken: "abc",
      refreshToken: "def"
    };

    const applied = applyLaventeCareJsonTokenCookies(payload, mockCookies, request);
    expect(applied.length).toBe(2);
    expect(mockCookies.set).toHaveBeenCalledTimes(2);
  });

  it("clearLaventeCareCookies should clear auth cookies", () => {
    const mockCookies = {
      delete: vi.fn()
    } as any;
    const request = {
      url: "http://localhost:4321",
      headers: new Headers({
        cookie: "access_token=123; refresh_token=456"
      })
    } as any;

    const applied = clearLaventeCareCookies(mockCookies, request);
    expect(applied.some(c => c.name === "access_token" && c.deleted)).toBe(true);
    expect(mockCookies.delete).toHaveBeenCalled();
  });
});
