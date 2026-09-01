/**
 * Chart density for the V2 canvas: the frozen table in
 * docs/design/09_1B_Implementation_Spec/Implementation Spec.dc.html §4 ("TrajectoryChart
 * density"), kept out of the component the same way V1 keeps `src/lib/chart/layout.ts` out of
 * `TrendChart` -- so the breakpoint behaviour is testable without rendering anything.
 *
 * The chart's furniture reservation is fixed in the component, keyed off the width the
 * component measures itself -- there is no density prop and no caller coordination, and a chart
 * placed in any column gets the right furniture for the space it actually has.
 *
 * The 1B Editorial design puts the weight axis on the **left**, in the manner of an ordinary
 * chart, and keeps a distinct **terminal value flag** on the right reporting the current trend
 * weight -- the one thing borrowed from a charting instrument. So the left margin reserves room
 * for axis tick labels, and the right margin reserves room for the flag: boxed at full width,
 * an inline value at compact, and gone below 360 (the hero states the identical number two
 * blocks above, so nothing is lost).
 */

/** ≥640: full furniture. 360–639: compact. <360: narrow -- the flag disappears entirely. */
export const V2_WIDE_BREAKPOINT = 640;
export const V2_COMPACT_BREAKPOINT = 360;

/** Kept for compatibility with call sites that only need a single wide/narrow split. */
export const V2_MID_BREAKPOINT = V2_WIDE_BREAKPOINT;

export type ChartDensity = "wide" | "compact" | "narrow";

export function v2DensityFor(width: number): ChartDensity {
  if (width >= V2_WIDE_BREAKPOINT) {
    return "wide";
  }
  return width >= V2_COMPACT_BREAKPOINT ? "compact" : "narrow";
}

export interface V2ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Left: room for a tabular axis-tick label ("76.5" at wide, "77" once ticks drop to zero
// decimals below 640). Right: the terminal flag -- boxed at wide, an inline value at compact,
// and just clearance from the edge once it is absent below 360. Top: headroom for the "now"
// label above the origin divider; not part of the frozen table, which specifies none, so it
// stays constant across densities. Bottom: one row of date ticks.
const MARGIN: Record<ChartDensity, V2ChartMargin> = {
  wide: { top: 18, right: 92, bottom: 30, left: 52 },
  compact: { top: 16, right: 16, bottom: 26, left: 40 },
  narrow: { top: 16, right: 12, bottom: 26, left: 34 },
};

export function v2MarginFor(width: number): V2ChartMargin {
  return MARGIN[v2DensityFor(width)];
}

/** Date ticks along the bottom: enough to read the axis, never enough to crowd it. */
export function v2DateTickCount(width: number): number {
  if (width < V2_COMPACT_BREAKPOINT) return 3;
  if (width < V2_WIDE_BREAKPOINT) return 4;
  if (width < 900) return 6;
  return 8;
}

/** Weight ticks up the left-hand axis: 5 at full precision, 3 once ticks drop to whole units. */
export function v2WeightTickCount(width: number): number {
  return width >= V2_WIDE_BREAKPOINT ? 5 : 3;
}

/**
 * A tick is a scale, not a claim: it drops to zero decimals below 640, while the hero, the
 * crosshair readout and the ledger keep full precision throughout.
 */
export function v2AxisDecimals(width: number): number {
  return width >= V2_WIDE_BREAKPOINT ? 1 : 0;
}

export type TerminalFlagStyle = "boxed" | "inline" | "absent";

/**
 * The terminal flag's three states, matching the density it is drawn at. Boxed at full width;
 * an inline azure value above a leader line at compact (same information, no filled box, 76px
 * cheaper); absent below 360, where the hero states the identical number two blocks above.
 */
export function v2TerminalFlagStyle(width: number): TerminalFlagStyle {
  const density = v2DensityFor(width);
  if (density === "wide") return "boxed";
  return density === "compact" ? "inline" : "absent";
}

/** The goal label sits at the plot's right edge at full width, and moves left once the chart
 * narrows below 640, clear of the projection band that otherwise crowds it there. */
export function v2GoalLabelSide(width: number): "left" | "right" {
  return width >= V2_WIDE_BREAKPOINT ? "right" : "left";
}
