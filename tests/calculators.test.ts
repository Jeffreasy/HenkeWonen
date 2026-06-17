import { describe, it, expect } from "vitest";
import {
  calculateFlooring,
  calculatePlinths,
  calculateWallPanels,
  calculateStairs,
  calculateWallpaperRolls
} from "../src/lib/calculators/index";

describe("Measurements Calculators", () => {
  it("should calculate flooring values correctly", () => {
    const flooring = calculateFlooring({
      lengthM: 4,
      widthM: 5,
      wastePercent: 10,
      patternType: "straight"
    });

    expect(flooring.areaM2).toBe(20);
    expect(flooring.wasteM2).toBe(2);
    expect(flooring.totalM2).toBe(22);
    expect(flooring.quoteQuantityM2).toBe(22);
    expect(flooring.isIndicative).toBe(true);
  });

  it("should calculate plinths values correctly", () => {
    const plinths = calculatePlinths({
      perimeterM: 20,
      doorOpeningM: 2,
      wastePercent: 5
    });

    expect(plinths.netMeter).toBe(18);
    expect(plinths.wasteMeter).toBe(0.9);
    expect(plinths.totalMeter).toBe(18.9);
    expect(plinths.quoteQuantityMeter).toBe(18.9);
  });

  it("should calculate wall panels values correctly", () => {
    const wallPanels = calculateWallPanels({
      wallWidthM: 4,
      wallHeightM: 2.5,
      panelWidthM: 0.6,
      panelHeightM: 2.6,
      wastePercent: 10
    });

    expect(wallPanels.wallAreaM2).toBe(10);
    expect(wallPanels.panelAreaM2).toBe(1.56);
    expect(wallPanels.panelsNeeded).toBe(7);
    expect(wallPanels.wastePanels).toBe(1);
    expect(wallPanels.totalPanels).toBe(8);
    expect(wallPanels.quoteQuantityPieces).toBe(8);
  });

  it("should stack wall panels in multiple rows when shorter than the wall height", () => {
    const wallPanels = calculateWallPanels({
      wallWidthM: 4,
      wallHeightM: 2.5,
      panelWidthM: 0.6,
      panelHeightM: 2.4,
      wastePercent: 10
    });

    // 7 stroken over de breedte × 2 rijen (2,4 m paneel onder een 2,5 m wand) = 14.
    expect(wallPanels.validationError).toBeUndefined();
    expect(wallPanels.columns).toBe(7);
    expect(wallPanels.rows).toBe(2);
    expect(wallPanels.panelsNeeded).toBe(14);
    expect(wallPanels.totalPanels).toBe(16); // ceil(14 × 1.1)
  });

  it("should not undercount when the panel is taller than the wall (overhoogte)", () => {
    const wallPanels = calculateWallPanels({
      wallWidthM: 4,
      wallHeightM: 2.6,
      panelWidthM: 0.25,
      panelHeightM: 3,
      wastePercent: 0
    });

    // 16 stroken (4 / 0,25) × 1 rij; de oude oppervlaktedeling gaf onterecht 14.
    expect(wallPanels.columns).toBe(16);
    expect(wallPanels.rows).toBe(1);
    expect(wallPanels.panelsNeeded).toBe(16);
    expect(wallPanels.totalPanels).toBe(16);
  });

  it("should calculate stairs values correctly", () => {
    const stairs = calculateStairs({
      stairType: "closed",
      treadCount: 13,
      riserCount: 13
    });

    expect(stairs.treadCount).toBe(13);
    expect(stairs.riserCount).toBe(13);
    expect(stairs.quoteQuantity).toBe(1);
    expect(stairs.unit).toBe("stairs");
    expect(stairs.notes).toContain("closed staircase");
  });

  it("should catch validation errors for invalid inputs", () => {
    expect(
      calculateFlooring({
        lengthM: 0,
        widthM: 5,
        wastePercent: 10,
        patternType: "straight"
      }).validationError
    ).toBeTruthy();

    expect(
      calculatePlinths({
        perimeterM: 10,
        doorOpeningM: -1,
        wastePercent: 5
      }).validationError
    ).toBeTruthy();

    expect(
      calculateWallPanels({
        wallWidthM: 4,
        wallHeightM: 2.5,
        panelWidthM: 0,
        panelHeightM: 2.6,
        wastePercent: 10
      }).validationError
    ).toBeTruthy();

    expect(
      calculateStairs({
        stairType: "straight",
        treadCount: 0,
        riserCount: 0
      }).validationError
    ).toBeTruthy();
  });

  it("should calculate wallpaper rolls needed", () => {
    const wallpaper = calculateWallpaperRolls({
      wallWidthM: 4,
      wallHeightM: 2.5
    });

    expect(wallpaper.isIndicative).toBe(true);
    expect(wallpaper.rollsNeeded).toBeGreaterThan(0);
  });

  it("should account for pattern repeat in wallpaper calculation", () => {
    const withRepeat = calculateWallpaperRolls({
      wallWidthM: 4,
      wallHeightM: 2.5,
      patternRepeatCm: 30
    });
    const withoutRepeat = calculateWallpaperRolls({
      wallWidthM: 4,
      wallHeightM: 2.5,
      patternRepeatCm: 0
    });

    // baanLengteM = 2.5 + 0.30 = 2.80m bij rapport
    expect(withRepeat.baanLengteM).toBeCloseTo(2.8, 2);
    // Een grotere baanlengte geeft meer rollen nodig
    expect(withRepeat.rollsNeeded).toBeGreaterThanOrEqual(withoutRepeat.rollsNeeded);
  });

  it("applies waste to the strip count, not the rounded roll count (no doubling on small jobs)", () => {
    // 1m breed → 2 banen; 1m hoog, rol 10,05m → 10 banen/rol → basis = 1 rol.
    // 10% snijverlies mag dit NIET naar 2 rollen tillen (oude bug: ceil(1×1,1)=2).
    const result = calculateWallpaperRolls({
      wallWidthM: 1,
      wallHeightM: 1,
      wastePercent: 10
    });

    expect(result.baseRollsNeeded).toBe(1);
    expect(result.rollsNeeded).toBe(1);
  });

  it("should return validationError when baan is longer than roll", () => {
    const result = calculateWallpaperRolls({
      wallWidthM: 2,
      wallHeightM: 12, // baanlengte 12m > rollengte 10.05m
      rollLengthM: 10
    });

    expect(result.validationError).toBeTruthy();
  });

  it("should clamp netMeter to 0 when doorOpening exceeds perimeter", () => {
    const result = calculatePlinths({
      perimeterM: 5,
      doorOpeningM: 8, // groter dan omtrek
      wastePercent: 5
    });

    expect(result.netMeter).toBe(0);
    expect(result.validationError).toBeTruthy();
  });
});
