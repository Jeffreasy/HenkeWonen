import { describe, expect, it } from "vitest";
import { buildCostBreakdown, shouldShowCostBreakdown } from "../src/lib/documents/costBreakdown";

function line(regelType: string, regelTotaalExBtw: number) {
  return { regelType, regelTotaalExBtw };
}

describe("buildCostBreakdown", () => {
  it("categoriseert product+materiaal als Materiaal en werkzaamheid+arbeid als Arbeid", () => {
    const rows = buildCostBreakdown([
      line("product", 1000),
      line("material", 480),
      line("service", 400),
      line("labor", 260)
    ]);
    const byCategory = Object.fromEntries(rows.map((row) => [row.category, row.amount]));
    expect(byCategory.materiaal).toBe(1480);
    expect(byCategory.arbeid).toBe(660);
  });

  it("telt handmatig en korting als Overig en negeert tekstregels", () => {
    const rows = buildCostBreakdown([
      line("product", 1000),
      line("manual", 50),
      line("discount", -100),
      line("text", 0)
    ]);
    const byCategory = Object.fromEntries(rows.map((row) => [row.category, row.amount]));
    expect(byCategory.materiaal).toBe(1000);
    expect(byCategory.overig).toBe(-50);
    expect(rows.some((row) => row.category === "arbeid")).toBe(false);
  });

  it("sommeert exact op tot het subtotaal (excl. btw)", () => {
    const lines = [
      line("product", 1000),
      line("service", 400),
      line("material", 480),
      line("discount", -80),
      line("text", 0)
    ];
    const subtotal = lines.reduce((sum, current) => sum + current.regelTotaalExBtw, 0);
    const rows = buildCostBreakdown(lines);
    const sum = rows.reduce((total, row) => total + row.amount, 0);
    expect(sum).toBe(subtotal);
  });

  it("laat nul-categorieën weg", () => {
    const rows = buildCostBreakdown([line("product", 1000)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("materiaal");
  });
});

describe("shouldShowCostBreakdown", () => {
  it("toont pas bij een echte mix (minstens twee categorieën)", () => {
    expect(shouldShowCostBreakdown(buildCostBreakdown([line("product", 1000)]))).toBe(false);
    expect(
      shouldShowCostBreakdown(buildCostBreakdown([line("product", 1000), line("service", 400)]))
    ).toBe(true);
  });
});
