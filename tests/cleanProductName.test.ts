import { describe, expect, it } from "vitest";
import { cleanProductDisplayName } from "../convex/catalog/pilot";

function product(name: string, colorName?: string) {
  return { name, colorName };
}

describe("cleanProductDisplayName — schone klant-/offertenaam", () => {
  it("laat al-schone namen ongemoeid (geen regressie)", () => {
    expect(cleanProductDisplayName(product("Select eiken dryback beige"), "PVC Dryback", "Floorlife")).toBe(
      "Select eiken dryback beige"
    );
    expect(cleanProductDisplayName(product("Amsterdam (recht)"), "Plinten", "Co-pro")).toBe(
      "Amsterdam (recht)"
    );
    // EVC: kleurcode "3011" niet in de naam -> niet rommelig -> ongemoeid.
    expect(
      cleanProductDisplayName(product("Floorlife Mayfair beige", "3011"), "PVC Dryback", "EVC")
    ).toBe("Floorlife Mayfair beige");
  });

  it("herbouwt de Moduleo/Roots PVC-naam tot merk + kleur (leverancier Unilin Flooring)", () => {
    expect(
      cleanProductDisplayName(
        product("MOD ROOTS 0,55 EIR COUNTRY OAK 54991Q Country Oak 54991 RO54991SDP40849", "Country Oak 54991"),
        "PVC Dryback",
        "Unilin Flooring"
      )
    ).toBe("Moduleo Country Oak 54991");

    expect(
      cleanProductDisplayName(
        product("MOD ROOTS 0,55 ALLEGRO 46252CD Allegro 46252 RO46252MT49299", "Allegro 46252"),
        "PVC Dryback",
        "Unilin Flooring"
      )
    ).toBe("Moduleo Allegro 46252");
  });

  it("ontdubbelt een niet-aangrenzend herhaald fragment (Texdecor) en plakt de kleur erbij", () => {
    expect(
      cleanProductDisplayName(
        product("BEAUTY FULL IMAGE 2 BEAUTY FULL IMAGE UNI", "GRIS ANTHRACITE"),
        "Behang",
        "Caselio"
      )
    ).toBe("Caselio Beauty Full Image 2 Uni · Gris Anthracite");
  });

  it("strip de Texdecor-merkcode (CAD) en plakt de kleur erbij", () => {
    expect(
      cleanProductDisplayName(product("BABYLONE CAD BABEL", "ENCRE / ROUILLE"), "Behang", "Casadeco")
    ).toBe("Casadeco Babylone Babel · Encre / Rouille");
  });

  it("verwijdert de Headlam-code (ZLB); kleur staat al in de naam dus niet dubbel", () => {
    expect(
      cleanProductDisplayName(product("ADORABLE ZLB 62MV OYSTER Vitrage", "62MV OYSTER"), "Gordijnen", "Headlam")
    ).toBe("Headlam Adorable 62MV Oyster Vitrage");
  });

  it("verwijdert een gelekte bron-bestandsnaam (Interfloor)", () => {
    expect(
      cleanProductDisplayName(
        product("400 ab active-SDN 609 henke-swifterbant-artikeloverzicht", "609"),
        "Tapijt",
        "Interfloor"
      )
    ).toBe("Interfloor 400 ab active-SDN 609");
  });

  it("valt terug op de bestaande naam als er niets bruikbaars overblijft", () => {
    // Alleen ruis-tokens (CAD + codes) -> niets over -> bestaande naam ongewijzigd.
    expect(cleanProductDisplayName(product("CAD 12345AB 0,55"), "Behang", "Casadeco")).toBe(
      "CAD 12345AB 0,55"
    );
  });
});
