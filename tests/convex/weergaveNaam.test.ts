import { expect, test } from "vitest";
import { weergaveNaam } from "../../convex/beheer/agenda";

test("weergaveNaam: ingesteld naam-veld wint", () => {
  expect(weergaveNaam({ naam: "Catalogus Dev", email: "dev@laventecare.nl" })).toBe("Catalogus Dev");
});

test("weergaveNaam: zonder naam → nette afleiding van het e-mail-lokaaldeel", () => {
  expect(weergaveNaam({ naam: undefined, email: "Wim@henkewonen.nl" })).toBe("Wim");
  expect(weergaveNaam({ naam: null, email: "jeffrey@laventecare.nl" })).toBe("Jeffrey");
  expect(weergaveNaam({ email: "jan.jansen@henkewonen.nl" })).toBe("Jan Jansen");
});

test("weergaveNaam: lege naam telt als geen naam", () => {
  expect(weergaveNaam({ naam: "   ", email: "simone@henkewonen.nl" })).toBe("Simone");
});

test("weergaveNaam: agendaWeergaveNaam-override wint van naam en e-mail", () => {
  expect(
    weergaveNaam({ agendaWeergaveNaam: "Winkel", naam: "Simone", email: "simone@henkewonen.nl" })
  ).toBe("Winkel");
  // lege override telt als geen override → terug naar naam
  expect(
    weergaveNaam({ agendaWeergaveNaam: "  ", naam: "Simone", email: "simone@henkewonen.nl" })
  ).toBe("Simone");
});
