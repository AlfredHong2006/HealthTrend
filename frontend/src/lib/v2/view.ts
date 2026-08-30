/**
 * Client-side view windows over an analysis the backend has already returned.
 *
 * Two independent windows, both pure slicing and neither one a new capability: how much
 * *history* the canvas draws (1M / 3M / 6M / 1Y / ALL) and how far *ahead* it draws the
 * forecast (7 / 30 / 90 days). The honesty ledger in docs/design/V2_DESIGN.md names
 * time-range selection as a view over data already published; the forward window is the same
 * operation pointed the other way -- the horizons are still fixed at 7/30/90 by the backend,
 * and every one of them stays readable in the statistics tier whichever window is selected.
 *
 * The forward window exists because the 90-day interval is genuinely wide (about 18 kg on the
 * gradual-loss scenario against roughly 6 kg of history), so drawing it unconditionally
 * compresses the history it is supposed to explain. Narrowing the drawn look-ahead is a
 * choice about the viewport, not about the numbers: nothing is hidden, rounded or reweighted.
 */

import type { ChartSeries } from "@/lib/chart/series";

const MS_PER_DAY = 86_400_000;

/** A forecast path point sits exactly on a day boundary; a second of slack absorbs float noise. */
const BOUNDARY_TOLERANCE_MS = 1_000;

export type HistoryRangeId = "1M" | "3M" | "6M" | "1Y" | "ALL";

export interface HistoryRange {
  id: HistoryRangeId;
  label: string;
  /** Days of history to keep, counted back from the forecast origin. `null` keeps everything. */
  days: number | null;
  /** What a screen reader hears instead of the two-character label. */
  description: string;
}

export const HISTORY_RANGES: readonly HistoryRange[] = [
  { id: "1M", label: "1M", days: 30, description: "one month of history" },
  { id: "3M", label: "3M", days: 90, description: "three months of history" },
  { id: "6M", label: "6M", days: 182, description: "six months of history" },
  { id: "1Y", label: "1Y", days: 365, description: "one year of history" },
  { id: "ALL", label: "ALL", days: null, description: "all history" },
];

export const DEFAULT_HISTORY_RANGE_ID: HistoryRangeId = "ALL";

/**
 * The ranges worth offering for a series spanning `spanDays`.
 *
 * A range longer than the data selects exactly the same points ALL does, so offering it would
 * be a control that visibly does nothing. ALL is always offered.
 */
export function availableHistoryRanges(spanDays: number): HistoryRange[] {
  return HISTORY_RANGES.filter((range) => range.days === null || range.days < spanDays);
}

export type ForecastWindowId = "7D" | "30D" | "90D";

export interface ForecastWindow {
  id: ForecastWindowId;
  label: string;
  days: number;
  description: string;
}

/** Exactly the horizons the backend publishes (`FORECAST_HORIZONS_DAYS`), nothing invented. */
export const FORECAST_WINDOWS: readonly ForecastWindow[] = [
  { id: "7D", label: "7d", days: 7, description: "seven days ahead" },
  { id: "30D", label: "30d", days: 30, description: "thirty days ahead" },
  { id: "90D", label: "90d", days: 90, description: "ninety days ahead" },
];

export const DEFAULT_FORECAST_WINDOW_ID: ForecastWindowId = "30D";

export interface ViewWindow {
  /** Days of history, or `null` for all of it. */
  historyDays: number | null;
  /** Days of forecast drawn past the origin. */
  forecastDays: number;
}

/** Apply both windows, history first, and return a series with the narrowed domain. */
export function windowSeries(series: ChartSeries, window: ViewWindow): ChartSeries {
  return sliceForecast(sliceHistory(series, window.historyDays), window.forecastDays);
}

/**
 * Keep the last `days` of history, counted back from the forecast origin.
 *
 * `observations`, `historyLine` and `historyBand` are index-aligned by construction (one
 * trajectory point per observation, at the same instant), so they are sliced at one shared
 * index rather than filtered separately -- three independent filters would silently
 * de-align if that ever stopped holding, and the inspection readout depends on the alignment.
 */
function sliceHistory(series: ChartSeries, days: number | null): ChartSeries {
  const total = series.historyLine.length;
  if (days === null || total === 0) {
    return series;
  }

  const cutoffMs = series.originDate.getTime() - days * MS_PER_DAY;
  const found = series.historyLine.findIndex((point) => point.date.getTime() >= cutoffMs);
  // Never leave a single point: one vertex draws no line, and the window would look empty
  // rather than tight. Two is the minimum that still renders as a trend.
  const from = Math.min(found < 0 ? total - 1 : found, Math.max(0, total - 2));

  const historyLine = series.historyLine.slice(from);
  const historyBand = series.historyBand.slice(from);
  const observations =
    series.observations.length === total
      ? series.observations.slice(from)
      : series.observations.filter((point) => point.date.getTime() >= cutoffMs);

  const firstKeptMs = historyLine[0]!.date.getTime();
  const startMs = Math.min(Math.max(cutoffMs, series.domain.start.getTime()), firstKeptMs);

  return {
    ...series,
    observations,
    historyLine,
    historyBand,
    domain: { start: new Date(startMs), end: series.domain.end },
  };
}

/**
 * Keep the forecast out to `days` past the origin.
 *
 * Index 0 of both forecast arrays is the repeated last *history* point that
 * {@link buildChartSeries} prepends so the two polylines share a vertex; it sits before the
 * origin and is always kept, or the forecast would detach from the trend it continues.
 */
function sliceForecast(series: ChartSeries, days: number): ChartSeries {
  const cutoffMs = series.originDate.getTime() + days * MS_PER_DAY + BOUNDARY_TOLERANCE_MS;
  const keep = (date: Date, index: number) => index === 0 || date.getTime() <= cutoffMs;

  const forecastLine = series.forecastLine.filter((point, index) => keep(point.date, index));
  const forecastBand = series.forecastBand.filter((point, index) => keep(point.date, index));
  const endMs = forecastLine.at(-1)?.date.getTime() ?? series.domain.end.getTime();

  return {
    ...series,
    forecastLine,
    forecastBand,
    domain: { start: series.domain.start, end: new Date(endMs) },
  };
}
