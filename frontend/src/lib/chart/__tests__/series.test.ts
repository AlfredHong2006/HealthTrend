import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { buildChartSeries } from "../series";

describe("buildChartSeries", () => {
  it("copies one observation point per submitted reading, unchanged", () => {
    const series = buildChartSeries(demoAnalysisFixture);
    expect(series.observations).toHaveLength(demoAnalysisFixture.observations.length);
    expect(series.observations[0]).toEqual({
      date: new Date("2026-04-23T08:50:16.705Z"),
      weightKg: 81.683939,
    });
  });

  it("copies one history point and one band point per trajectory entry", () => {
    const series = buildChartSeries(demoAnalysisFixture);
    expect(series.historyLine).toHaveLength(demoAnalysisFixture.trajectory.length);
    expect(series.historyBand).toHaveLength(demoAnalysisFixture.trajectory.length);
    const lastTrajectory = demoAnalysisFixture.trajectory.at(-1)!;
    expect(series.historyLine.at(-1)).toEqual({
      date: new Date(lastTrajectory.timestamp),
      weightKg: lastTrajectory.w_kg,
    });
    expect(series.historyBand.at(-1)).toEqual({
      date: new Date(lastTrajectory.timestamp),
      lowerKg: lastTrajectory.w_lower95,
      upperKg: lastTrajectory.w_upper95,
    });
  });

  it("joins the forecast line to the last history point, so there is no rendering gap", () => {
    // ADR-0005: forecast.path[0] sits at the origin, lead_days after the last observation --
    // not at the same instant as the last trajectory point. The forecast line must still
    // begin exactly at that last trajectory point, so the two segments share a vertex.
    const series = buildChartSeries(demoAnalysisFixture);
    const lastHistory = series.historyLine.at(-1)!;
    expect(series.forecastLine[0]).toEqual(lastHistory);
    expect(series.forecastLine[0]!.date.getTime()).not.toEqual(series.forecastLine[1]!.date.getTime());
  });

  it("gives the forecast line one point per history-join vertex plus every forecast.path point", () => {
    const series = buildChartSeries(demoAnalysisFixture);
    expect(series.forecastLine).toHaveLength(demoAnalysisFixture.forecast.path.length + 1);
    expect(series.forecastBand).toHaveLength(demoAnalysisFixture.forecast.path.length + 1);
  });

  it("maps the remaining forecast line points from forecast.path in order", () => {
    const series = buildChartSeries(demoAnalysisFixture);
    const path = demoAnalysisFixture.forecast.path;
    for (const [index, point] of path.entries()) {
      expect(series.forecastLine[index + 1]).toEqual({
        date: new Date(point.timestamp),
        weightKg: point.w_kg,
      });
    }
  });

  it("reads the origin date from forecast.origin_timestamp", () => {
    const series = buildChartSeries(demoAnalysisFixture);
    expect(series.originDate).toEqual(new Date(demoAnalysisFixture.forecast.origin_timestamp));
  });

  it("spans from the first observation to the final forecast point", () => {
    const series = buildChartSeries(demoAnalysisFixture);
    expect(series.domain.start).toEqual(series.observations[0]!.date);
    expect(series.domain.end).toEqual(series.forecastLine.at(-1)!.date);
  });

  it("survives a single-observation analysis without crashing", () => {
    const single = {
      observations: [demoAnalysisFixture.observations[0]!],
      trajectory: [demoAnalysisFixture.trajectory[0]!],
      forecast: demoAnalysisFixture.forecast,
    };
    const series = buildChartSeries(single);
    expect(series.observations).toHaveLength(1);
    expect(series.historyLine).toHaveLength(1);
    // The join still applies: the sole history point is still the forecast line's first vertex.
    expect(series.forecastLine[0]).toEqual(series.historyLine[0]);
  });
});
