import { describe, expect, test } from "vitest";
import { defaultTopicId } from "../src/components/help/HelpGuideModal";

describe("defaultTopicId", () => {
  test("buitendienst-modus opent altijd het tablet-onderwerp", () => {
    expect(defaultTopicId("buitendienst", "/portal/buitendienst/vandaag")).toBe("tablet");
    expect(defaultTopicId("buitendienst", "/portal/buitendienst/projecten/x")).toBe("tablet");
  });

  test("offertes → winkel-flow", () => {
    expect(defaultTopicId("winkel", "/portal/offertes")).toBe("winkel-flow");
    expect(defaultTopicId("winkel", "/portal/offertes/abc")).toBe("winkel-flow");
  });

  test("facturen → na-akkoord", () => {
    expect(defaultTopicId("winkel", "/portal/facturen")).toBe("na-akkoord");
  });

  test("dossiers, klanten en agenda → winkel-flow", () => {
    expect(defaultTopicId("winkel", "/portal/dossiers")).toBe("winkel-flow");
    expect(defaultTopicId("winkel", "/portal/klanten")).toBe("winkel-flow");
    expect(defaultTopicId("winkel", "/portal/agenda")).toBe("winkel-flow");
  });

  test("buitendienst-paginas in winkel-modus → tablet", () => {
    expect(defaultTopicId("winkel", "/portal/buitendienst/vandaag")).toBe("tablet");
  });

  test("overige portalpaginas → kleuren", () => {
    expect(defaultTopicId("winkel", "/portal")).toBe("kleuren");
    expect(defaultTopicId("winkel", "/portal/imports")).toBe("kleuren");
    expect(defaultTopicId("winkel", "/portal/catalogus")).toBe("kleuren");
  });
});
