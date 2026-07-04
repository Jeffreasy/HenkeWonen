import { describe, it, expect } from "vitest";
import {
  taskPriority,
  workItemUrgency,
  workItemLevel,
  urgencyRank,
  invoicePaymentTermDays,
  calculateLineTotals,
  isDueTodayOrEarlier,
  importedMeasurementLineTitle,
  importedMeasurementLineDescription
} from "../convex/portalUtils";

describe("Convex Portal Utilities", () => {
  it("mapt de werklijst-tone naar het gedeelde rood/oranje/groen-niveau", () => {
    // danger = haast (vandaag/morgen of probleem) → rood
    expect(workItemUrgency("danger")).toBe("red");
    // warning = actie nodig (nieuwe aanvraag, concept, deze week) → oranje
    expect(workItemUrgency("warning")).toBe("orange");
    // info/success = loopt / op schema → groen
    expect(workItemUrgency("info")).toBe("green");
    expect(workItemUrgency("success")).toBe("green");
    // onbekende/neutrale tones vallen veilig terug op groen (geen valse urgentie)
    expect(workItemUrgency("neutral")).toBe("green");
    expect(workItemUrgency("accent")).toBe("green");
  });

  it("houdt taskPriority.tone consistent met workItemUrgency (winkel = tablet)", () => {
    const now = Date.UTC(2026, 5, 6, 12, 0, 0);
    for (const dueAt of [
      Date.UTC(2026, 5, 6, 17, 0, 0), // vandaag → rood/danger
      Date.UTC(2026, 5, 11, 12, 0, 0), // deze week → oranje/warning
      Date.UTC(2026, 6, 1, 12, 0, 0) // ver weg → groen/success
    ]) {
      const p = taskPriority(dueAt, now);
      expect(workItemUrgency(p.tone)).toBe(p.level);
    }
  });

  it("weegt de bezoekdatum mee zodat een inmeting van vandaag rood is (winkel = tablet)", () => {
    const now = Date.UTC(2026, 5, 6, 12, 0, 0);
    const vandaag = Date.UTC(2026, 5, 6, 16, 0, 0);
    const dezeWeek = Date.UTC(2026, 5, 11, 12, 0, 0);
    const verWeg = Date.UTC(2026, 6, 1, 12, 0, 0);

    // "measurement_planned" heeft status-tone "info" (op zichzelf groen). Met een geplande
    // inmeting van vandaag/te laat moet het item rood zijn — precies wat cardUrgency op de
    // tablet toont; voorheen bleef het dashboard ten onrechte groen ("op schema").
    expect(workItemLevel("info", vandaag, now)).toBe("red");
    expect(workItemLevel("info", dezeWeek, now)).toBe("orange");
    expect(workItemLevel("info", verWeg, now)).toBe("green");

    // De datum-tak van workItemLevel moet exact de tablet-drempels volgen (taskPriority).
    for (const visitAt of [vandaag, dezeWeek, verWeg]) {
      expect(workItemLevel("info", visitAt, now)).toBe(taskPriority(visitAt, now).level);
    }
  });

  it("valt zonder bezoekdatum terug op de status-tone en verlaagt nooit onder de status", () => {
    const now = Date.UTC(2026, 5, 6, 12, 0, 0);
    const verWeg = Date.UTC(2026, 6, 1, 12, 0, 0);

    // Geen bezoekdatum → puur de status-tone (zoals offerte-/leaditems zonder bezoek).
    expect(workItemLevel("danger")).toBe("red");
    expect(workItemLevel("warning")).toBe("orange");
    expect(workItemLevel("info")).toBe("green");

    // We nemen het URGENTSTE van status en datum: een probleem-item (danger) met een
    // verre bezoekdatum blijft rood, niet groen.
    expect(workItemLevel("danger", verWeg, now)).toBe("red");
    expect(workItemLevel("warning", verWeg, now)).toBe("orange");
  });

  it("rangschikt urgentie rood < oranje < groen (rood sorteert bovenaan)", () => {
    expect(urgencyRank("red")).toBeLessThan(urgencyRank("orange"));
    expect(urgencyRank("orange")).toBeLessThan(urgencyRank("green"));
  });

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
