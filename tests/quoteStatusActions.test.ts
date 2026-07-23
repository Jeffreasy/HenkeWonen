import { describe, expect, test } from "vitest";
import { getQuoteStatusActions } from "../src/lib/quotes/quoteStatusActions";
import type { QuoteStatus } from "../src/lib/portalTypes";

function targets(status: QuoteStatus, mode: "full" | "field" = "full") {
  return getQuoteStatusActions(status, mode).map((action) => action.status);
}

describe("offertestatusknoppen", () => {
  test("toont per status alleen geldige winkelacties", () => {
    expect(targets("draft")).toEqual(["sent", "accepted", "rejected", "cancelled"]);
    expect(targets("sent")).toEqual(["draft", "accepted", "rejected", "cancelled"]);
    expect(targets("accepted")).toEqual(["cancelled"]);
    expect(targets("rejected")).toEqual(["draft"]);
    expect(targets("cancelled")).toEqual(["draft"]);
    expect(targets("expired")).toEqual(["draft"]);
  });

  test("beperkt de buitendienst tot verzenden, akkoord en afwijzen", () => {
    expect(targets("draft", "field")).toEqual(["sent", "accepted", "rejected"]);
    expect(targets("sent", "field")).toEqual(["accepted", "rejected"]);
    expect(targets("accepted", "field")).toEqual([]);
    expect(targets("rejected", "field")).toEqual([]);
    expect(targets("cancelled", "field")).toEqual([]);
    expect(targets("expired", "field")).toEqual([]);
  });

  test("toont geen statusacties op een geannuleerd of afgesloten dossier", () => {
    expect(getQuoteStatusActions("draft", "full", "cancelled")).toEqual([]);
    expect(getQuoteStatusActions("sent", "field", "closed")).toEqual([]);
  });

  test("legt professionele bevestigingsteksten centraal vast", () => {
    const actions = getQuoteStatusActions("draft");
    expect(actions.find((action) => action.status === "sent")?.label).toBe("Markeer verzonden");
    expect(actions.find((action) => action.status === "accepted")?.label).toBe("Akkoord");
    expect(actions.find((action) => action.status === "rejected")?.description).toContain(
      "leveranciersbestellingen"
    );
  });
});
