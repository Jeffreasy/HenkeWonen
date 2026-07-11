/**
 * Intakenotitie uit het dossier voor de offerte-werkbank.
 *
 * Bij het starten van een inmeettraject noteert de winkel wat er met de klant
 * is besproken ("Roots 55 Mattina, 2 zwarte strippen"); dat wordt de
 * projectomschrijving. De offerte-werkbank toont die notitie boven de posten,
 * zodat de medewerker ziet welke producten en arbeid erop moeten zonder terug
 * te bladeren naar het dossier.
 *
 * De automatisch gegenereerde standaardomschrijving ("Aanvraag gestart vanuit
 * klantdossier…") is geen gespreksinhoud en levert dus geen notitie op.
 */
const GENERATED_DESCRIPTION_PREFIX = "Aanvraag gestart vanuit klantdossier";

export function intakeNoteFromProject(omschrijving: string | undefined): string | null {
  const note = omschrijving?.trim();
  if (!note || note.startsWith(GENERATED_DESCRIPTION_PREFIX)) {
    return null;
  }
  return note;
}
