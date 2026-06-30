import { describe, it, expect } from "vitest";
import {
  roundMoney,
  getOutstandingAmount,
  formatMoneyInput
} from "../src/lib/money";

describe("getOutstandingAmount", () => {
  it("berekent het restant (totaal − betaald)", () => {
    expect(getOutstandingAmount(1000, 300)).toBe(700);
  });

  it("clamped op 0 wanneer betaald groter is dan het totaal (geen negatief)", () => {
    expect(getOutstandingAmount(1000, 1500)).toBe(0);
  });

  it("is 0 als de factuur volledig betaald is", () => {
    expect(getOutstandingAmount(1000, 1000)).toBe(0);
  });

  it("rondt af op centen, gelijk aan roundMoney (geen floating-point-afwijking)", () => {
    // 100.10 - 0.20 = 99.89999999999999 zonder afronding.
    expect(getOutstandingAmount(100.1, 0.2)).toBe(roundMoney(100.1 - 0.2));
    expect(getOutstandingAmount(100.1, 0.2)).toBe(99.9);
  });
});

describe("formatMoneyInput", () => {
  it("formatteert met komma-decimaal en twee cijfers (1250 → 1250,00)", () => {
    expect(formatMoneyInput(1250)).toBe("1250,00");
  });

  it("rondt af op twee decimalen", () => {
    expect(formatMoneyInput(99.9)).toBe("99,90");
    expect(formatMoneyInput(0)).toBe("0,00");
  });
});
