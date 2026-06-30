import { describe, it, expect } from "vitest";
import { timingSafeEqualStr } from "../src/lib/auth/laventeCareSession";

// Auth-2: de LaventeCare-JWT-signatuur wordt constant-time vergeleken i.p.v. `!==`.
describe("timingSafeEqualStr", () => {
  it("is true voor identieke strings", () => {
    expect(timingSafeEqualStr("abc123XYZ", "abc123XYZ")).toBe(true);
  });

  it("is false voor verschillende strings van gelijke lengte", () => {
    expect(timingSafeEqualStr("abc123XYZ", "abc123XYa")).toBe(false);
  });

  it("is false voor strings van verschillende lengte", () => {
    expect(timingSafeEqualStr("abc", "abcd")).toBe(false);
  });

  it("is true voor twee lege strings", () => {
    expect(timingSafeEqualStr("", "")).toBe(true);
  });
});
