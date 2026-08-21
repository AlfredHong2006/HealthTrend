/**
 * Pure data shaping: an analysis response in, plain arrays a chart can draw out.
 *
 * This module knows nothing about React or SVG, and it computes no statistics of its own --
 * every number it touches is copied, not derived. Its one real job is bridging the
 * history/forecast join described in ADR-0005: `trajectory` ends at
 * `last_observation_timestamp`, while `forecast.path[0]` sits at `origin_timestamp`,
 * `lead_days` later, with a slightly different weight -- the same state, propagated forward
 * through real elapsed time. Prepending the last trajectory point to the forecast series
 * gives the two polylines a shared vertex, so the rendered line is continuous rather than
 * showing a gap over that lead period.
 */

import type { DemoAnalysis } from "@/lib/api/types";

export interface WeightPoint {
  date: Date;
  weightKg: number;
}

export interface WeightBandPoint {
  date: Date;
  lowerKg: number;
  upperKg: number;
}

export interface ChartSeries {
  /** Raw scale readings, as submitted/generated -- not the model's estimate of them. */
  observations: WeightPoint[];
  /** The filtered latent-weight line, one point per observation (ADR-0005: online, not smoothed). */
  historyLine: WeightPoint[];
  /** The 95% interval around {@link historyLine}. */
  historyBand: WeightBandPoint[];
  /**
   * The forecast line, beginning at the last history point so it joins with no gap, then
   * following `forecast.path`. Its first point sits at the same timestamp as
   * {@link historyLine}'s last point; its second point is the forecast origin.
   */
  forecastLine: WeightPoint[];
  /** The 95% interval around {@link forecastLine}, joined the same way. */
  forecastBand: WeightBandPoint[];
  /** The instant forecast horizons are measured from -- the "now" marker. */
  originDate: Date;
  /** The full time extent of the chart, from the first observation to the final forecast point. */
  domain: { start: Date; end: Date };
}

type AnalysisForChart = Pick<DemoAnalysis, "observations" | "trajectory" | "forecast">;

export function buildChartSeries(analysis: AnalysisForChart): ChartSeries {
  const observations: WeightPoint[] = analysis.observations.map((observation) => ({
    date: new Date(observation.timestamp),
    weightKg: observation.weight_kg,
  }));

  const historyLine: WeightPoint[] = analysis.trajectory.map((point) => ({
    date: new Date(point.timestamp),
    weightKg: point.w_kg,
  }));

  const historyBand: WeightBandPoint[] = analysis.trajectory.map((point) => ({
    date: new Date(point.timestamp),
    lowerKg: point.w_lower95,
    upperKg: point.w_upper95,
  }));

  const lastHistoryPoint = historyLine.at(-1);
  const lastHistoryBand = historyBand.at(-1);
  const pathPoints = analysis.forecast.path;

  const forecastLine: WeightPoint[] = lastHistoryPoint
    ? [
        lastHistoryPoint,
        ...pathPoints.map((point) => ({ date: new Date(point.timestamp), weightKg: point.w_kg })),
      ]
    : [];

  const forecastBand: WeightBandPoint[] = lastHistoryBand
    ? [
        lastHistoryBand,
        ...pathPoints.map((point) => ({
          date: new Date(point.timestamp),
          lowerKg: point.w_lower95,
          upperKg: point.w_upper95,
        })),
      ]
    : [];

  const originDate = new Date(analysis.forecast.origin_timestamp);
  const start = observations[0]?.date ?? originDate;
  const end = forecastLine.at(-1)?.date ?? originDate;

  return {
    observations,
    historyLine,
    historyBand,
    forecastLine,
    forecastBand,
    originDate,
    domain: { start, end },
  };
}
