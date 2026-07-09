import { describe, expect, it } from "vitest";
import {
  MEASUREMENT_AUTOSTART_VALUE,
  MEASUREMENT_WORKTYPES,
  measurementAutostartQuery,
  measurementWorktypeFromSearch,
  measurementWorktypeQuery,
  shouldAutostartMeasurement
} from "../src/lib/measurementIntent";
import { customerScopeOptions } from "../src/components/customers/CustomerIntakePanel";

const SNELROUTE = `?intent=${MEASUREMENT_AUTOSTART_VALUE}`;

describe("shouldAutostartMeasurement (snelroute auto-start)", () => {
  const base = {
    search: SNELROUTE,
    hasMeasurement: false,
    canEdit: true,
    alreadyAutostarted: false
  };

  it("start als de vlag in de URL staat, er nog geen inmeting is en de gebruiker rechten heeft", () => {
    expect(shouldAutostartMeasurement(base)).toBe(true);
  });

  it("start niet zonder de vlag (of met een andere waarde)", () => {
    expect(shouldAutostartMeasurement({ ...base, search: "" })).toBe(false);
    expect(shouldAutostartMeasurement({ ...base, search: "?intent=iets-anders" })).toBe(false);
    expect(shouldAutostartMeasurement({ ...base, search: "?foo=bar" })).toBe(false);
  });

  it("start niet als er al een inmeting bestaat (niet dubbel starten)", () => {
    expect(shouldAutostartMeasurement({ ...base, hasMeasurement: true })).toBe(false);
  });

  it("start niet zonder bewerkrechten", () => {
    expect(shouldAutostartMeasurement({ ...base, canEdit: false })).toBe(false);
  });

  it("start exact één keer (guard tegen herhaling)", () => {
    expect(shouldAutostartMeasurement({ ...base, alreadyAutostarted: true })).toBe(false);
  });

  it("negeert overige querystring-parameters naast de vlag", () => {
    expect(
      shouldAutostartMeasurement({ ...base, search: `?ref=winkel&intent=${MEASUREMENT_AUTOSTART_VALUE}` })
    ).toBe(true);
  });
});

describe("measurementAutostartQuery", () => {
  it("levert het juiste querystring-fragment", () => {
    expect(measurementAutostartQuery()).toBe(`?intent=${MEASUREMENT_AUTOSTART_VALUE}`);
  });
});

describe("werksoort-hint (dossier-intake -> inmeet-paneel)", () => {
  it("roundtrip: elke geldige werksoort overleeft query -> parse", () => {
    for (const worktype of MEASUREMENT_WORKTYPES) {
      expect(measurementWorktypeFromSearch(measurementWorktypeQuery(worktype))).toBe(worktype);
    }
  });

  it("weigert onbekende of ontbrekende waarden (geen open redirect naar een rare tab)", () => {
    expect(measurementWorktypeFromSearch("")).toBeNull();
    expect(measurementWorktypeFromSearch("?werksoort=")).toBeNull();
    expect(measurementWorktypeFromSearch("?werksoort=hacky")).toBeNull();
    expect(measurementWorktypeFromSearch("?anders=vloer")).toBeNull();
  });

  it("werkt naast andere parameters", () => {
    expect(measurementWorktypeFromSearch("?intent=inmeten&werksoort=behang")).toBe("behang");
  });

  it("elke intake-werksoort verwijst naar een geldige inmeet-tab", () => {
    for (const scope of customerScopeOptions) {
      if (scope.werksoort !== undefined) {
        expect(MEASUREMENT_WORKTYPES).toContain(scope.werksoort);
      }
    }
  });

  it("alle inmeet-opties uit de intake hebben een werksoort; alleen verkoop/overig niet", () => {
    for (const scope of customerScopeOptions) {
      if (scope.target === "quote" || scope.id === "overig") {
        expect(scope.werksoort).toBeUndefined();
      } else {
        expect(scope.werksoort).toBeDefined();
      }
    }
  });
});
