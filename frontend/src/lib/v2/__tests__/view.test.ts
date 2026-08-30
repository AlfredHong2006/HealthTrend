import { describe, expect, it } from "vitest";
import type { ChartSeries } from "@/lib/chart/series";
import {
  availableHistoryRanges,
  DEFAULT_FORECAST_WINDOW_ID,
  DEFAULT_HISTORY_RANGE_ID,
  FORECAST_WINDOWS,
  HISTORY_RANGES,
  windowSeries,
} from "../view";

const MS_PER_DAY = 86_400_000;
const ORIGIN = new Date("2026-08-20T12:00:00.000Z");
/** The lead between the last weigh-in and the forecast origin, as ADR-0005 describes it. */
const LEAD_MS = 0.25 * MS_PER_DAY;

/**
 * A synthetic series with the same shape `buildChartSeries` produces: `historyDays` daily
 * points ending one lead before the origin, index-aligned observations, and a daily forecast
 * path whose first element repeats the last history point so the polylines share a vertex.
 */
function makeSeries(historyDays: number, forecastDays: number): ChartSeries {
  const historyDates = Array.from(
    { length: historyDays },
    (_, index) => new Date(ORIGIN.getTime() - LEAD_MS - (historyDays - 1 - index) * MS_PER_DAY),
  );
  const observations = historyDates.map((date, index) => ({ date, weightKg: 80 - index * 0.05 }));
  const historyLine = historyDates.map((date, index) => ({ date, weightKg: 80 - index * 0.05 }));
  const historyBand = historyDates.map((date, index) => ({
    date,
    lowerKg: 79 - index * 0.05,
    upperKg: 81 - index * 0.05,
  }));

  const pathDates = Array.from(
    { length: forecastDays + 1 },
    (_, index) => new Date(ORIGIN.getTime() + index * MS_PER_DAY),
  );
  const forecastLine = [
    historyLine.at(-1)!,
    ...pathDates.map((date, index) => ({ date, weightKg: 76 - index * 0.05 })),
  ];
  const forecastBand = [
    historyBand.at(-1)!,
    ...pathDates.map((date, index) => ({
      date,
      lowerKg: 75 - index * 0.1,
      upperKg: 77 + index * 0.1,
    })),
  ];

  return {
    observations,
    historyLine,
    historyBand,
    forecastLine,
    forecastBand,
    originDate: ORIGIN,
    domain: { start: historyDates[0]!, end: pathDates.at(-1)! },
  };
}

describe("availableHistoryRanges", () => {
  it("offers only ranges shorter than the data, so no control is a no-op", () => {
    expect(availableHistoryRanges(119).map((range) => range.id)).toEqual(["1M", "3M", "ALL"]);
  });

  it("always offers ALL, even for a series shorter than every named range", () => {
    expect(availableHistoryRanges(10).map((range) => range.id)).toEqual(["ALL"]);
  });

  it("offers every range once the series is longer than a year", () => {
    expect(availableHistoryRanges(500)).toHaveLength(HISTORY_RANGES.length);
  });
});

describe("windowSeries", () => {
  it("returns the series untouched for the default windows at full extent", () => {
    const series = makeSeries(120, 90);
    const windowed = windowSeries(series, { historyDays: null, forecastDays: 90 });

    expect(windowed.historyLine).toHaveLength(series.historyLine.length);
    expect(windowed.forecastLine).toHaveLength(series.forecastLine.length);
    expect(windowed.domain.end.getTime()).toBe(series.domain.end.getTime());
  });

  it("keeps only the requested days of history, counted back from the forecast origin", () => {
    const windowed = windowSeries(makeSeries(120, 90), { historyDays: 30, forecastDays: 90 });

    // Daily readings ending a quarter-day before the origin: thirty of them fall inside a
    // 30-day window, and the axis starts at the cutoff rather than at the first of them.
    expect(windowed.historyLine).toHaveLength(30);
    expect(windowed.historyLine[0]!.date.getTime()).toBe(
      ORIGIN.getTime() - LEAD_MS - 29 * MS_PER_DAY,
    );
    expect(windowed.domain.start.getTime()).toBe(ORIGIN.getTime() - 30 * MS_PER_DAY);
  });

  it("slices observations, trend and band at the same index, keeping them aligned", () => {
    const windowed = windowSeries(makeSeries(120, 90), { historyDays: 30, forecastDays: 90 });

    expect(windowed.observations).toHaveLength(windowed.historyLine.length);
    expect(windowed.historyBand).toHaveLength(windowed.historyLine.length);
    expect(windowed.observations[0]!.date.getTime()).toBe(windowed.historyLine[0]!.date.getTime());
  });

  it("keeps the forecast out to the requested horizon and no further", () => {
    const windowed = windowSeries(makeSeries(120, 90), { historyDays: null, forecastDays: 30 });

    // The joined last-history point, plus horizons 0 through 30.
    expect(windowed.forecastLine).toHaveLength(32);
    expect(windowed.forecastBand).toHaveLength(32);
    expect(windowed.domain.end.getTime()).toBe(ORIGIN.getTime() + 30 * MS_PER_DAY);
  });

  it("always keeps the joined vertex, so the forecast never detaches from the trend", () => {
    const series = makeSeries(120, 90);
    const windowed = windowSeries(series, { historyDays: 30, forecastDays: 7 });

    expect(windowed.forecastLine[0]!.date.getTime()).toBe(
      windowed.historyLine.at(-1)!.date.getTime(),
    );
    expect(windowed.forecastLine[0]!.date.getTime()).toBeLessThan(ORIGIN.getTime());
  });

  it("never leaves a single history point, which would draw no line at all", () => {
    // A one-day window over a series whose readings are three weeks apart.
    const sparse = makeSeries(4, 30);
    const windowed = windowSeries(sparse, { historyDays: 0, forecastDays: 30 });

    expect(windowed.historyLine.length).toBeGreaterThanOrEqual(2);
  });

  it("leaves an empty series alone rather than producing an empty domain", () => {
    const empty: ChartSeries = {
      observations: [],
      historyLine: [],
      historyBand: [],
      forecastLine: [],
      forecastBand: [],
      originDate: ORIGIN,
      domain: { start: ORIGIN, end: ORIGIN },
    };

    expect(windowSeries(empty, { historyDays: 30, forecastDays: 30 })).toEqual(empty);
  });
});

describe("defaults", () => {
  it("names defaults that exist in their own option lists", () => {
    expect(HISTORY_RANGES.some((range) => range.id === DEFAULT_HISTORY_RANGE_ID)).toBe(true);
    expect(FORECAST_WINDOWS.some((window) => window.id === DEFAULT_FORECAST_WINDOW_ID)).toBe(true);
  });

  it("offers exactly the horizons the backend publishes", () => {
    expect(FORECAST_WINDOWS.map((window) => window.days)).toEqual([7, 30, 90]);
  });
});
