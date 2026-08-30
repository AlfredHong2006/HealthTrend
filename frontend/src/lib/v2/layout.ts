/**
 * Sizing math for the V2 canvas, kept out of the component the same way V1 keeps
 * `src/lib/chart/layout.ts` out of `TrendChart` -- so the breakpoint behaviour is testable
 * without rendering anything.
 *
 * The V2 canvas differs from V1's in one structural way: the weight axis is on the **right**,
 * next to the value flag that reports the current trend weight, in the manner of a charting
 * instrument. So the right margin carries the axis labels *and* the flag, and the left margin
 * carries nothing at all. That is why these numbers are not V1's mirrored.
 *
 * Height is not computed here: the V2 canvas takes its height from CSS (a tall, sticky column
 * on desktop; a shorter block that scrolls away on a phone) and measures it, rather than
 * deriving one ratio that has to serve both.
 */

/** Below this the canvas uses the tighter margins and fewer ticks a phone has room for. */
export const V2_COMPACT_BREAKPOINT = 560;

export interface V2ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Right: a "76.5" tick label plus the value flag beside it. Top: headroom for the "now" label
// sitting above the divider. Bottom: one row of date ticks. Left: not an axis gutter -- just
// enough that the first date tick's label is not sliced in half by the edge of the drawing.
const WIDE_MARGIN: V2ChartMargin = { top: 18, right: 58, bottom: 30, left: 16 };
const COMPACT_MARGIN: V2ChartMargin = { top: 16, right: 48, bottom: 26, left: 16 };

export function v2MarginFor(width: number): V2ChartMargin {
  return width < V2_COMPACT_BREAKPOINT ? COMPACT_MARGIN : WIDE_MARGIN;
}

/** Date ticks along the bottom: enough to read the axis, never enough to crowd it. */
export function v2DateTickCount(width: number): number {
  if (width < 400) return 3;
  if (width < V2_COMPACT_BREAKPOINT) return 4;
  if (width < 900) return 6;
  return 8;
}

/** Weight ticks up the right-hand axis. */
export function v2WeightTickCount(height: number): number {
  return height < 300 ? 4 : 5;
}
