import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectTimelinePanel } from "../src/components/projects/ProjectTimelinePanel";
import type { PortalQuote } from "../src/lib/portalTypes";

const draftQuote = {
  id: "q1",
  offertenummer: "OFF-1",
  status: "draft"
} as unknown as Omit<PortalQuote, "lines">;

const acceptedQuote = {
  id: "q1",
  offertenummer: "OFF-1",
  status: "accepted"
} as unknown as Omit<PortalQuote, "lines">;

function renderPanel(projectStatus: string, latestQuote: Omit<PortalQuote, "lines"> | null) {
  return renderToStaticMarkup(
    React.createElement(ProjectTimelinePanel, {
      workflowEvents: [],
      klantContacten: [],
      latestQuote,
      projectStatus,
      canEdit: true,
      onProcessAction: () => {}
    })
  );
}

/**
 * Statusacties zijn fase-gebonden: een verse aanvraag mag geen "Leverancier
 * bestellen"/"Export boekhouder"/"Project afsluiten" tonen (audit winkelflow
 * 2026-07-10) — elke actie verschijnt pas als hij aan de beurt is.
 */
describe("ProjectTimelinePanel statusacties per fase", () => {
  it("toont géén statusacties op een verse aanvraag zonder offerte", () => {
    const html = renderPanel("lead", null);
    expect(html).not.toContain("Offerte akkoord");
    expect(html).not.toContain("Leverancier bestellen");
    expect(html).not.toContain("Factuur aanmaken");
    expect(html).not.toContain("Export boekhouder");
    expect(html).not.toContain("Project afsluiten");
  });

  it("toont alleen 'Offerte akkoord' zodra er een offerte is in de offertefase", () => {
    const html = renderPanel("quote_sent", draftQuote);
    expect(html).toContain("Offerte akkoord");
    expect(html).not.toContain("Leverancier bestellen");
    expect(html).not.toContain("Export boekhouder");
    expect(html).not.toContain("Project afsluiten");
  });

  it("toont bestellen + factureren na akkoord", () => {
    const html = renderPanel("quote_accepted", acceptedQuote);
    expect(html).not.toContain("Offerte akkoord");
    expect(html).toContain("Leverancier bestellen");
    expect(html).toContain("Factuur aanmaken");
    expect(html).not.toContain("Export boekhouder");
  });

  it("toont boekhouder-export en afsluiten pas vanaf gefactureerd", () => {
    const html = renderPanel("invoiced", acceptedQuote);
    expect(html).not.toContain("Leverancier bestellen");
    expect(html).not.toContain("Factuur aanmaken");
    expect(html).toContain("Export boekhouder");
    expect(html).toContain("Project afsluiten");
  });

  it("toont niets meer op een gesloten dossier", () => {
    const html = renderPanel("closed", acceptedQuote);
    for (const label of [
      "Offerte akkoord",
      "Leverancier bestellen",
      "Factuur aanmaken",
      "Export boekhouder",
      "Project afsluiten"
    ]) {
      expect(html).not.toContain(label);
    }
  });
});
