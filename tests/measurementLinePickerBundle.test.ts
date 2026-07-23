import { describe, expect, it } from "vitest";
import {
  measurementLineSelectionIds,
  toggleMeasurementLineSelection
} from "../src/components/quotes/MeasurementLinePicker";

type ReadyLineItem = Parameters<typeof toggleMeasurementLineSelection>[1][number];

function readyLine(
  id: string,
  bundle?: {
    id: string;
    role: "material" | "labor" | "surcharge";
  }
): ReadyLineItem {
  return {
    measurement: { _id: "measurement-1" },
    room: null,
    line: {
      _id: id,
      productGroep: "stairs",
      berekeningType: "stairs",
      invoer: {},
      resultaat: {},
      aantal: 1,
      eenheid: "stairs",
      offerteRegelType: bundle?.role === "material" ? "material" : "labor",
      productNaam: `Regel ${id}`,
      bundleId: bundle?.id,
      bundleType: bundle ? "stair_renovation" : undefined,
      bundleRole: bundle?.role,
      sectionKey: bundle ? "traprenovatie" : undefined
    }
  };
}

describe("atomische selectie van inmeetbundels", () => {
  const material = readyLine("material", { id: "stair-bundle-1", role: "material" });
  const labor = readyLine("labor", { id: "stair-bundle-1", role: "labor" });
  const surcharge = readyLine("surcharge", { id: "stair-bundle-1", role: "surcharge" });
  const standalone = readyLine("standalone");
  const readyLines = [material, labor, surcharge, standalone];

  it("geeft voor een bundelregel alle bijbehorende regel-id's terug", () => {
    expect(measurementLineSelectionIds(readyLines, labor)).toEqual([
      "material",
      "labor",
      "surcharge"
    ]);
    expect(measurementLineSelectionIds(readyLines, standalone)).toEqual(["standalone"]);
  });

  it("selecteert en deselecteert de volledige trapbundel in een handeling", () => {
    const selected = toggleMeasurementLineSelection(["standalone"], readyLines, labor, true);
    expect(selected).toEqual(["material", "labor", "surcharge", "standalone"]);

    const deselected = toggleMeasurementLineSelection(selected, readyLines, material, false);
    expect(deselected).toEqual(["standalone"]);
  });
});
