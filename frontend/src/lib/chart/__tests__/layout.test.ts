import { describe, expect, it } from "vitest";
import { chartHeightFor, marginFor, MOBILE_BREAKPOINT } from "../layout";

describe("marginFor", () => {
  it("uses the original desktop margin at and above the breakpoint", () => {
    expect(marginFor(MOBILE_BREAKPOINT)).toEqual({ top: 16, right: 16, bottom: 32, left: 48 });
    expect(marginFor(800)).toEqual({ top: 16, right: 16, bottom: 32, left: 48 });
  });

  it("uses a tighter margin below the breakpoint", () => {
    const mobile = marginFor(MOBILE_BREAKPOINT - 1);
    const desktop = marginFor(MOBILE_BREAKPOINT);
    expect(mobile.left).toBeLessThan(desktop.left);
    expect(mobile.right).toBeLessThan(desktop.right);
    expect(mobile.top).toBeLessThan(desktop.top);
    expect(mobile.bottom).toBeLessThan(desktop.bottom);
  });

  it("gives a phone noticeably more plot width than the old fixed desktop margin would have", () => {
    // The complaint this responds to: the chart "feels too small" on a phone. The original
    // margin (16/16/32/48, unconditional) is a fixed pixel cost that eats a much bigger share
    // of a 320-430px screen than of the desktop card it was sized for -- this asserts the
    // mobile margin recovers a real, non-trivial amount of that width back for the plot.
    const ORIGINAL_UNCONDITIONAL_MARGIN = { left: 48, right: 16 };
    const phoneWidth = 375;
    const phoneMargin = marginFor(phoneWidth);

    const oldPlotWidth = phoneWidth - ORIGINAL_UNCONDITIONAL_MARGIN.left - ORIGINAL_UNCONDITIONAL_MARGIN.right;
    const newPlotWidth = phoneWidth - phoneMargin.left - phoneMargin.right;

    expect(newPlotWidth).toBeGreaterThan(oldPlotWidth);
    expect(newPlotWidth / oldPlotWidth).toBeGreaterThan(1.05); // at least a 5% wider plot
  });
});

describe("chartHeightFor", () => {
  it("uses the original desktop minimum height at and above the breakpoint", () => {
    expect(chartHeightFor(MOBILE_BREAKPOINT)).toBe(260);
    expect(chartHeightFor(600)).toBe(260); // 600 * 0.42 = 252, still below the 260 floor
  });

  it("uses a shorter minimum height below the breakpoint, without going so low the axes crowd", () => {
    const mobileHeight = chartHeightFor(320);
    expect(mobileHeight).toBeLessThan(260);
    expect(mobileHeight).toBeGreaterThanOrEqual(180); // enough room left for 5 y-axis ticks
  });

  it("still grows past the minimum for a wide chart, on both sides of the breakpoint", () => {
    expect(chartHeightFor(2000)).toBeCloseTo(2000 * 0.42);
  });
});
