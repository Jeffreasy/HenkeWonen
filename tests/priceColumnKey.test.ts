import { describe, it, expect } from "vitest";
import { toAsciiFieldKey } from "../convex/catalog/priceColumnKey";

describe("toAsciiFieldKey", () => {
  it("vervangt het euroteken door EUR (de Masureel-bug)", () => {
    expect(toAsciiFieldKey("Aanbevolen verkoopprijs € incl. BTW 010526/Stuk of m")).toBe(
      "Aanbevolen verkoopprijs EUR incl. BTW 010526/Stuk of m"
    );
    expect(toAsciiFieldKey("Aankoopprijs € excl. BTW 010526/m2")).toBe(
      "Aankoopprijs EUR excl. BTW 010526/m2"
    );
  });

  it("laat normale ASCII-headers (met spaties, punten, slashes) ongemoeid", () => {
    // Belangrijk: bestaande profielen hebben ASCII-sleutels — die moeten identiek blijven.
    expect(toAsciiFieldKey("Adviesverkoopprijs incl. BTW. per verpakking")).toBe(
      "Adviesverkoopprijs incl. BTW. per verpakking"
    );
    expect(toAsciiFieldKey("Adviesverkoopprijs per m1 /stuks")).toBe(
      "Adviesverkoopprijs per m1 /stuks"
    );
    expect(toAsciiFieldKey("Consumer Price")).toBe("Consumer Price");
  });

  it("verwijdert overige non-ASCII/controltekens en collapst witruimte", () => {
    expect(toAsciiFieldKey("Prijs per\tm²")).toBe("Prijs per m");
    expect(toAsciiFieldKey("  dubbele   spaties  ")).toBe("dubbele spaties");
  });

  it("is idempotent en levert nooit een lege sleutel", () => {
    const once = toAsciiFieldKey("Aankoopprijs € excl. BTW");
    expect(toAsciiFieldKey(once)).toBe(once);
    expect(toAsciiFieldKey("€")).toBe("EUR");
    expect(toAsciiFieldKey("")).toBe("kolom");
    expect(toAsciiFieldKey(null)).toBe("kolom");
  });
});
