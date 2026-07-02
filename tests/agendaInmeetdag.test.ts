import { describe, expect, test } from "vitest";
import { isInmeetdagInputValue, volgendeInmeetdagInputValue } from "../src/lib/agenda";

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
