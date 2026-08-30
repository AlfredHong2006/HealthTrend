/**
 * The points the canvas crosshair can land on, and the lookup that finds the nearest one.
 *
 * Deliberately a V2-local variant of `src/lib/chart/hover.ts` rather than a change to it.
 * Two differences matter here and neither belongs in V1: the lookup returns an *index* (the
 * canvas steps through points with the arrow keys, which needs a position, not a value), and
 * each history point carries the raw reading recorded at the same instant so the readout can
 * show measurement and estimate side by side without computing a difference between them.
 *
 * A linear scan is enough, for the reason `hover.ts` already gives: a few hundred points, and
 * a pointer handler has no latency budget a scan that size threatens.
 */

import type { ChartSeries } from "@/lib/chart/series";

export interface InspectionPoint {
  date: Date;
  /** The estimated latent weight -- the trajectory, or the forecast continuing it. */
  weightKg: number;
  lowerKg: number;
  upperKg: number;
  isForecast: boolean;
  /** The raw scale reading at this instant, where there is one. Forecast points have none. */
  readingKg: number | null;
}

/**
 * Flatten history and forecast into one chronological array.
 *
 * The forecast line's first point is dropped: `buildChartSeries` repeats the last history
 * point there to join the polylines, and the readout must not report that instant twice.
 */
export function buildInspectionPoints(series: ChartSeries): InspectionPoint[] {
  // One trajectory point per observation, at the same instant (ADR-0005), and `windowSeries`
  // slices both at one shared index. If that ever stops holding, the reading is omitted
  // rather than paired with the wrong estimate.
  const readingsAligned = series.observations.length === series.historyLine.length;

  const history: InspectionPoint[] = series.historyLine.map((point, index) => {
    const band = series.historyBand[index];
    return {
      date: point.date,
      weightKg: point.weightKg,
      lowerKg: band?.lowerKg ?? point.weightKg,
      upperKg: band?.upperKg ?? point.weightKg,
      isForecast: false,
      readingKg: readingsAligned ? (series.observations[index]?.weightKg ?? null) : null,
    };
  });

  const forecast: InspectionPoint[] = series.forecastLine.slice(1).map((point, index) => {
    const band = series.forecastBand[index + 1];
    return {
      date: point.date,
      weightKg: point.weightKg,
      lowerKg: band?.lowerKg ?? point.weightKg,
      upperKg: band?.upperKg ?? point.weightKg,
      isForecast: true,
      readingKg: null,
    };
  });

  return [...history, ...forecast];
}

/** The index of the point closest in time to `date`, or `null` if there are none. */
export function nearestInspectionIndex(
  points: readonly InspectionPoint[],
  date: Date,
): number | null {
  const target = date.getTime();
  let bestIndex: number | null = null;
  let bestDiffMs = Number.POSITIVE_INFINITY;

  points.forEach((point, index) => {
    const diff = Math.abs(point.date.getTime() - target);
    if (diff < bestDiffMs) {
      bestIndex = index;
      bestDiffMs = diff;
    }
  });

  return bestIndex;
}

/** Move the crosshair by `step` points, stopping at either end rather than wrapping. */
export function stepInspectionIndex(
  current: number | null,
  step: number,
  length: number,
): number | null {
  if (length === 0) {
    return null;
  }
  if (current === null) {
    return step < 0 ? length - 1 : 0;
  }
  return Math.min(length - 1, Math.max(0, current + step));
}
