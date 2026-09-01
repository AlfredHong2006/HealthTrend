import { describe, expect, it } from "vitest";
import {
  v2AxisDecimals,
  v2DateTickCount,
  v2DensityFor,
  V2_COMPACT_BREAKPOINT,
  V2_WIDE_BREAKPOINT,
  v2GoalLabelSide,
  v2MarginFor,
  v2TerminalFlagStyle,
  v2WeightTickCount,
} from "../layout";

describe("v2DensityFor", () => {
  it("splits at the frozen breakpoints", () => {
    expect(v2DensityFor(V2_WIDE_BREAKPOINT)).toBe("wide");
    expect(v2DensityFor(V2_WIDE_BREAKPOINT - 1)).toBe("compact");
    expect(v2DensityFor(V2_COMPACT_BREAKPOINT)).toBe("compact");
    expect(v2DensityFor(V2_COMPACT_BREAKPOINT - 1)).toBe("narrow");
  });
});

describe("v2MarginFor", () => {
  it("reserves the left margin for the axis, matching the frozen table (52/40/34)", () => {
    expect(v2MarginFor(1440).left).toBe(52);
    expect(v2MarginFor(390).left).toBe(40);
    expect(v2MarginFor(320).left).toBe(34);
  });

  it("reserves the right margin for the terminal flag, matching the frozen table (92/16/12)", () => {
    expect(v2MarginFor(1440).right).toBe(92);
    expect(v2MarginFor(390).right).toBe(16);
    expect(v2MarginFor(320).right).toBe(12);
  });

  it("reserves the bottom margin for one row of date ticks, matching the frozen table (30/26/26)", () => {
    expect(v2MarginFor(1440).bottom).toBe(30);
    expect(v2MarginFor(390).bottom).toBe(26);
    expect(v2MarginFor(320).bottom).toBe(26);
  });

  it("gives a 320px phone most of its width to the plot", () => {
    const margin = v2MarginFor(320);
    expect((320 - margin.left - margin.right) / 320).toBeGreaterThan(0.7);
  });
});

describe("v2WeightTickCount and v2AxisDecimals", () => {
  it("shows 5 ticks at one decimal when wide, 3 ticks at zero decimals otherwise", () => {
    expect(v2WeightTickCount(1440)).toBe(5);
    expect(v2AxisDecimals(1440)).toBe(1);
    expect(v2WeightTickCount(390)).toBe(3);
    expect(v2AxisDecimals(390)).toBe(0);
    expect(v2WeightTickCount(320)).toBe(3);
    expect(v2AxisDecimals(320)).toBe(0);
  });
});

describe("v2DateTickCount", () => {
  it("thins the date axis as the canvas narrows", () => {
    expect(v2DateTickCount(320)).toBeLessThan(v2DateTickCount(390));
    expect(v2DateTickCount(1280)).toBeGreaterThan(v2DateTickCount(390));
  });

  it("never asks for so few ticks that the axis stops being readable", () => {
    expect(v2DateTickCount(280)).toBeGreaterThanOrEqual(3);
  });
});

describe("v2TerminalFlagStyle", () => {
  it("is boxed at wide, an inline value at compact, and absent below 360", () => {
    expect(v2TerminalFlagStyle(1440)).toBe("boxed");
    expect(v2TerminalFlagStyle(390)).toBe("inline");
    expect(v2TerminalFlagStyle(320)).toBe("absent");
  });
});

describe("v2GoalLabelSide", () => {
  it("moves from the plot's right edge to its left edge below 640", () => {
    expect(v2GoalLabelSide(1440)).toBe("right");
    expect(v2GoalLabelSide(390)).toBe("left");
    expect(v2GoalLabelSide(320)).toBe("left");
  });
});
