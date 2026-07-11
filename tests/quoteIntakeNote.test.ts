import { describe, expect, it } from "vitest";
import { intakeNoteFromProject } from "../src/lib/quotes/intakeNote";

/**
 * De offerte-werkbank toont de gespreksnotitie uit de intake boven de posten
 * (werkblad-audit 2026-07-11): alleen échte gespreksinhoud, nooit de
 * automatisch gegenereerde standaardomschrijving van het intakemenu.
 */
describe("intakeNoteFromProject", () => {
  it("geeft de gespreksnotitie terug zoals genoteerd", () => {
    expect(intakeNoteFromProject("Roots 55 Mattina UBG 30, 2 zwarte strippen")).toBe(
      "Roots 55 Mattina UBG 30, 2 zwarte strippen"
    );
  });

  it("trimt witruimte maar bewaart regelafbrekingen binnen de notitie", () => {
    expect(intakeNoteFromProject("  Trap: open, hele draai.\nMat op maat.  ")).toBe(
      "Trap: open, hele draai.\nMat op maat."
    );
  });

  it("onderdrukt de automatische standaardomschrijving van het intakemenu", () => {
    expect(
      intakeNoteFromProject("Aanvraag gestart vanuit klantdossier: PVC vloer.")
    ).toBeNull();
    expect(
      intakeNoteFromProject("Aanvraag gestart vanuit klantdossier: directe verkoop.")
    ).toBeNull();
    expect(intakeNoteFromProject("Aanvraag gestart vanuit klantdossier.")).toBeNull();
  });

  it("geeft null bij een ontbrekende of lege omschrijving", () => {
    expect(intakeNoteFromProject(undefined)).toBeNull();
    expect(intakeNoteFromProject("")).toBeNull();
    expect(intakeNoteFromProject("   ")).toBeNull();
  });
});
