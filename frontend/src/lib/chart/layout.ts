/**
 * Pure sizing math for the chart: the margin and minimum height it renders at for a given
 * measured width. Split out from TrendChart.tsx (the same way format.ts and hover.ts are)
 * so the mobile/desktop breakpoint behaviour is testable without rendering anything.
 *
 * Below `MOBILE_BREAKPOINT`, the chart switches to a tighter margin and a shorter minimum
 * height, so a narrow phone spends more of its (scarcer) pixels on the plot itself rather
 * than on axis gutters and vertical padding sized for a desktop-width card. At and above it,
 * every number here is the original, pre-breakpoint desktop/tablet value.
 */

export const MOBILE_BREAKPOINT = 480;

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const DESKTOP_MARGIN: ChartMargin = { top: 16, right: 16, bottom: 32, left: 48 };
const MOBILE_MARGIN: ChartMargin = { top: 12, right: 12, bottom: 26, left: 34 };

const DESKTOP_MIN_HEIGHT = 260;
const MOBILE_MIN_HEIGHT = 210;

export function marginFor(width: number): ChartMargin {
  return width < MOBILE_BREAKPOINT ? MOBILE_MARGIN : DESKTOP_MARGIN;
}

/** Mirrors the `min-height` TrendChart.module.css sets on `.canvas` at the same breakpoint. */
export function chartHeightFor(width: number): number {
  const minHeight = width < MOBILE_BREAKPOINT ? MOBILE_MIN_HEIGHT : DESKTOP_MIN_HEIGHT;
  return Math.max(minHeight, width * 0.42);
}
