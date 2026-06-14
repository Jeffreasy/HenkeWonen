import { describe, it, expect } from "vitest";
import {
  taskPriority,
  invoicePaymentTermDays,
  calculateLineTotals,
  isDueTodayOrEarlier,
  importedMeasurementLineTitle,
  importedMeasurementLineDescription
} from "../convex/portalUtils";

describe("Convex Portal Utilities", () => {
  it("should calculate correct task priority levels", () => {
    const now = Date.UTC(2026, 5, 6, 12, 0, 0); // June 6, 2026
    
    // Due today: daysUntilDue = 0 -> red
    const dueToday = Date.UTC(2026, 5, 6, 17, 0, 0);
    expect(taskPriority(dueToday, now).level).toBe("red");

    // Due in 5 days -> orange
    const dueSoon = Date.UTC(2026, 5, 11, 12, 0, 0);
    expect(taskPriority(dueSoon, now).level).toBe("orange");

    // Due in 10 days -> green
    const dueFar = Date.UTC(2026, 5, 16, 12, 0, 0);
    expect(taskPriority(dueFar, now).level).toBe("green");
  });

  it("should retrieve correct invoice payment terms", () => {
    expect(invoicePaymentTermDays({ type: "business" } as any)).toBe(21);
    expect(invoicePaymentTermDays({ type: "private" } as any)).toBe(8);
    expect(invoicePaymentTermDays(null)).toBe(8);
  });

  it("should calculate line item totals correctly", () => {
    const productLine = calculateLineTotals("product", 2, 50, 21, 10);
    expect(productLine.lineTotalExVat).toBe(90);
    expect(productLine.lineVatTotal).toBe(18.9);
    expect(productLine.lineTotalIncVat).toBe(108.9);

    const textLine = calculateLineTotals("text", 2, 50, 21, 10);
    expect(textLine.lineTotalIncVat).toBe(0);
  });

  it("should check if date is due today or earlier", () => {
    const now = Date.now();
    
    // Past date (yesterday)
    expect(isDueTodayOrEarlier(now - 24 * 3600 * 1000, now)).toBe(true);

    // Today (current moment)
    expect(isDueTodayOrEarlier(now, now)).toBe(true);

    // Tomorrow (36 hours in the future is definitely tomorrow)
    expect(isDueTodayOrEarlier(now + 36 * 3600 * 1000, now)).toBe(false);
  });

  it("should format imported measurement line title and description", () => {
    const line = {
      productGroep: "flooring",
      berekeningType: "area",
      snijverliesPct: 10,
      notities: "Controleer hoek."
    } as any;

    const room = { naam: "Woonkamer" } as any;

    expect(importedMeasurementLineTitle(line, room)).toBe("Vloeren - Oppervlakte - Woonkamer");
    
    const description = importedMeasurementLineDescription(line);
    expect(description).toContain("Snijverlies: 10%");
    expect(description).toContain("Meetnotitie: Controleer hoek.");
  });
});
