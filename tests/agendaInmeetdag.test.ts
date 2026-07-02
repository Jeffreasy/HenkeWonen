import { describe, expect, test } from "vitest";
import {
  isInmeetdagInputValue,
  kiesbareMonteurs,
  volgendeInmeetdagInputValue
} from "../src/lib/agenda";

// Vaste ankers: 2026-07-02 is een donderdag (inmeetdag), 2026-07-03 een vrijdag.

describe("volgendeInmeetdagInputValue", () => {
  test("vanaf donderdag → eerstvolgende dinsdag (strikt ná vandaag)", () => {
    expect(volgendeInmeetdagInputValue(new Date("2026-07-02T09:00:00"))).toBe("2026-07-07");
  });

  test("vanaf woensdag → donderdag (de dag erna)", () => {
    expect(volgendeInmeetdagInputValue(new Date("2026-07-01T09:00:00"))).toBe("2026-07-02");
  });

  test("vanaf vrijdag → dinsdag (weekend overslaan)", () => {
    expect(volgendeInmeetdagInputValue(new Date("2026-07-03T09:00:00"))).toBe("2026-07-07");
  });

  test("vanaf maandag → dinsdag", () => {
    expect(volgendeInmeetdagInputValue(new Date("2026-07-06T09:00:00"))).toBe("2026-07-07");
  });
});

describe("isInmeetdagInputValue", () => {
  test("dinsdag/woensdag/donderdag zijn inmeetdagen", () => {
    expect(isInmeetdagInputValue("2026-07-07")).toBe(true);
    expect(isInmeetdagInputValue("2026-07-08")).toBe(true);
    expect(isInmeetdagInputValue("2026-07-02")).toBe(true);
  });

  test("vrijdag en weekend niet", () => {
    expect(isInmeetdagInputValue("2026-07-03")).toBe(false);
    expect(isInmeetdagInputValue("2026-07-04")).toBe(false);
    expect(isInmeetdagInputValue("2026-07-05")).toBe(false);
  });

  test("lege of onzinnige invoer is geen inmeetdag", () => {
    expect(isInmeetdagInputValue("")).toBe(false);
    expect(isInmeetdagInputValue("geen-datum")).toBe(false);
  });
});

describe("kiesbareMonteurs (agenda-whitelist voor monteurkeuze)", () => {
  const wim = { naam: "Wim", role: "editor", toonInAgenda: true };
  const simone = { naam: "Simone", role: "editor", toonInAgenda: false };
  const admin = { naam: "Admin", role: "admin", toonInAgenda: null };
  const kijker = { naam: "Kijker", role: "viewer", toonInAgenda: true };

  test("zodra iemand is aangevinkt geldt de whitelist (winkel/admin vallen af)", () => {
    expect(kiesbareMonteurs([wim, simone, admin, kijker])).toEqual([wim]);
  });

  test("zonder aangevinkte gebruikers zijn alle niet-kijkers kiesbaar (fallback)", () => {
    const zonderWhitelist = [
      { naam: "A", role: "editor", toonInAgenda: null },
      { naam: "B", role: "admin", toonInAgenda: undefined },
      kijker
    ];
    expect(kiesbareMonteurs(zonderWhitelist).map((m) => m.naam)).toEqual(["A", "B"]);
  });

  test("kijkers doen nooit mee, ook niet met toonInAgenda: true", () => {
    expect(kiesbareMonteurs([kijker])).toEqual([]);
  });
});
