import { describe, expect, it } from "vitest";
import {
  v2DateTickCount,
  v2MarginFor,
  v2WeightTickCount,
  V2_COMPACT_BREAKPOINT,
} from "../layout";

describe("v2MarginFor", () => {
  it("puts almost all of the gutter on the right, where the axis and value flag are", () => {
    const margin = v2MarginFor(1000);
    expect(margin.right).toBeGreaterThan(margin.left * 3);
  });

  it("leaves room for the value flag inside the right margin at every width", () => {
    // The flag is drawn `margin.right - 12` wide, offset 5px from the plot edge, so the
    // margin has to hold both without the flag escaping the SVG.
    for (const width of [320, 375, 430, 560, 900, 1280]) {
      const margin = v2MarginFor(width);
      const flagWidth = margin.right - 12;
      expect(flagWidth).toBeGreaterThan(28); // wide enough for "76.5" at 11px
      expect(5 + flagWidth).toBeLessThanOrEqual(margin.right);
    }
  });

  it("tightens below the compact breakpoint and is unchanged at and above it", () => {
    const compact = v2MarginFor(V2_COMPACT_BREAKPOINT - 1);
    const wide = v2MarginFor(V2_COMPACT_BREAKPOINT);
    expect(compact.right).toBeLessThan(wide.right);
    expect(compact.bottom).toBeLessThan(wide.bottom);
    expect(v2MarginFor(1280)).toEqual(wide);
  });

  it("gives a 320px phone more than three quarters of its width to the plot", () => {
    const margin = v2MarginFor(320);
    expect((320 - margin.left - margin.right) / 320).toBeGreaterThan(0.75);
  });
});

describe("v2DateTickCount", () => {
  it("thins the date axis as the canvas narrows", () => {
    expect(v2DateTickCount(320)).toBeLessThan(v2DateTickCount(375 + 100));
    expect(v2DateTickCount(1280)).toBeGreaterThan(v2DateTickCount(560));
  });

  it("never asks for so few ticks that the axis stops being readable", () => {
    expect(v2DateTickCount(280)).toBeGreaterThanOrEqual(3);
  });
});

describe("v2WeightTickCount", () => {
  it("drops a tick on a short plot so the labels do not crowd", () => {
    expect(v2WeightTickCount(260)).toBeLessThan(v2WeightTickCount(520));
  });
});
