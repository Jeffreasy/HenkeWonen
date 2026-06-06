import { beforeAll, describe, it, expect, vi } from "vitest";
import { formatDate, addDays } from "../src/lib/dates";
import {
  roundMoney,
  calculateVat,
  calculateIncVat,
  formatEuro,
  calculateLineTotals
} from "../src/lib/money";
import {
  matchesShortcut,
  isTypingTarget,
  formatShortcutKeys
} from "../src/lib/keyboard";
import { getTheme, applyTheme } from "../src/lib/theme";

// Setup browser API mocks for theme and keyboard tests
beforeAll(() => {
  const store: Record<string, string> = {};
  
  global.localStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { for (const k in store) delete store[k]; }),
    length: 0,
    key: vi.fn(() => null),
  };

  global.window = {
    dispatchEvent: vi.fn(),
    matchMedia: vi.fn().mockReturnValue({
      matches: true, // system theme prefers dark
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }),
  } as any;

  global.document = {
    documentElement: {
      setAttribute: vi.fn(),
    },
    cookie: "",
  } as any;
});

describe("Core Utilities - Dates", () => {
  it("formatDate should format millisecond timestamps to nl-NL date format", () => {
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate(0)).toBe("-");
    
    // Date.UTC(2026, 5, 6) = June 6, 2026
    const timestamp = Date.UTC(2026, 5, 6);
    expect(formatDate(timestamp)).toBe("06-06-2026");
  });

  it("addDays should return a date offset by the given number of days", () => {
    const start = new Date(Date.UTC(2026, 5, 6));
    const next = addDays(start, 5);
    expect(next.getUTCDate()).toBe(11);
    expect(next.getUTCMonth()).toBe(5);
  });
});

describe("Core Utilities - Money & Pricing", () => {
  it("roundMoney should round correctly to 2 decimal places", () => {
    expect(roundMoney(10.123)).toBe(10.12);
    expect(roundMoney(10.125)).toBe(10.13);
    expect(roundMoney(10.127)).toBe(10.13);
  });

  it("calculateVat should return correct VAT amount rounded", () => {
    expect(calculateVat(100, 21)).toBe(21);
    expect(calculateVat(10.5, 9)).toBe(0.95); // 0.945 rounded to 0.95
  });

  it("calculateIncVat should return total amount including VAT", () => {
    expect(calculateIncVat(100, 21)).toBe(121);
    expect(calculateIncVat(10.5, 9)).toBe(11.45);
  });

  it("formatEuro should format value as EUR currency", () => {
    const formatted = formatEuro(1234.5);
    expect(formatted).toContain("€");
    // nl-NL uses non-breaking spaces or regular space between currency and value
    expect(formatted.replace(/\s/g, " ")).toContain("1.234,50");
  });

  it("calculateLineTotals should compute net totals, VAT, and gross totals", () => {
    const totals = calculateLineTotals(3, 150.5, 21, 50);
    // (3 * 150.5) - 50 = 451.5 - 50 = 401.5
    // VAT = 401.5 * 0.21 = 84.315 -> rounded 84.32
    // Total = 401.5 + 84.32 = 485.82
    expect(totals.subtotalExVat).toBe(401.5);
    expect(totals.vatTotal).toBe(84.32);
    expect(totals.totalIncVat).toBe(485.82);
  });
});

describe("Core Utilities - Keyboard Shortcuts", () => {
  it("matchesShortcut should correctly match events and definitions", () => {
    const shortcut = { key: "k", ctrl: true, description: "Search" };
    
    const matchedEvent = {
      key: "k",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false
    } as unknown as KeyboardEvent;

    const unmatchedEvent = {
      key: "j",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false
    } as unknown as KeyboardEvent;

    expect(matchesShortcut(matchedEvent, shortcut)).toBe(true);
    expect(matchesShortcut(unmatchedEvent, shortcut)).toBe(false);
  });

  it("isTypingTarget should identify editable elements", () => {
    const inputElement = { tagName: "INPUT" } as unknown as HTMLElement;
    const divElement = { tagName: "DIV", isContentEditable: false } as unknown as HTMLElement;

    const inputEvent = { target: inputElement } as unknown as KeyboardEvent;
    const divEvent = { target: divElement } as unknown as KeyboardEvent;

    expect(isTypingTarget(inputEvent)).toBe(true);
    expect(isTypingTarget(divEvent)).toBe(false);
  });

  it("formatShortcutKeys should format shortcut key labels for display", () => {
    const shortcut = { key: "k", ctrl: true, shift: true, description: "Format" };
    const label = formatShortcutKeys(shortcut);
    expect(label).toContain("Ctrl");
    expect(label).toContain("Shift");
    expect(label).toContain("K");
  });
});

describe("Core Utilities - Theme State", () => {
  it("getTheme should retrieve theme from localStorage", () => {
    localStorage.setItem("theme", "dark");
    expect(getTheme()).toBe("dark");

    localStorage.removeItem("theme");
    expect(getTheme()).toBe("system");
  });

  it("applyTheme should save theme, set html attributes and write cookie", () => {
    applyTheme("light");
    expect(localStorage.setItem).toHaveBeenCalledWith("theme", "light");
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith("data-theme", "light");
    expect(document.cookie).toContain("theme=light");

    applyTheme("system");
    // Since mock window preferred theme prefers dark, system theme should resolve to dark
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith("data-theme", "dark");
    expect(document.cookie).toContain("theme=dark");
  });
});
