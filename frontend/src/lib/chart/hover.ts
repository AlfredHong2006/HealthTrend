/**
 * Nearest-point lookup for the chart's hover tooltip. Pure and framework-free, so it is
 * testable without rendering anything, the same way {@link buildChartSeries} is.
 *
 * A plain linear scan is enough here: a scenario has at most a few hundred points (the
 * largest, `reversal`, is 140 observations plus a 91-point forecast path), and a hover
 * handler firing on pointer move has no latency budget a scan of that size threatens. A
 * binary search over a merged, sorted array would be premature -- it solves a performance
 * problem this dataset does not have.
 */

import type { ChartSeries } from "./series";

export interface HoverPoint {
  date: Date;
  weightKg: number;
  lowerKg: number;
  upperKg: number;
  isForecast: boolean;
}

/**
 * Flatten history and forecast into one chronological array for hover lookup.
 *
 * The forecast line's first point is dropped here: {@link buildChartSeries} repeats the last
 * history point there so the rendered line has no gap, but a tooltip should not report that
 * same instant twice.
 */
export function buildHoverPoints(series: ChartSeries): HoverPoint[] {
  const history: HoverPoint[] = series.historyLine.map((point, index) => {
    const band = series.historyBand[index]!;
    return { date: point.date, weightKg: point.weightKg, lowerKg: band.lowerKg, upperKg: band.upperKg, isForecast: false };
  });

  const forecast: HoverPoint[] = series.forecastLine.slice(1).map((point, index) => {
    const band = series.forecastBand[index + 1]!;
    return { date: point.date, weightKg: point.weightKg, lowerKg: band.lowerKg, upperKg: band.upperKg, isForecast: true };
  });

  return [...history, ...forecast];
}

/** Return the point in `points` whose date is closest to `date`, or `undefined` if empty. */
export function nearestHoverPoint(points: HoverPoint[], date: Date): HoverPoint | undefined {
  const target = date.getTime();
  let best: HoverPoint | undefined;
  let bestDiffMs = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const diff = Math.abs(point.date.getTime() - target);
    if (diff < bestDiffMs) {
      best = point;
      bestDiffMs = diff;
    }
  }

  return best;
}
