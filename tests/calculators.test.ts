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
});
