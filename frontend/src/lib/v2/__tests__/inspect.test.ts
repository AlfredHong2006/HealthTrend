import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { buildChartSeries } from "@/lib/chart/series";
import { buildInspectionPoints, nearestInspectionIndex, stepInspectionIndex } from "../inspect";

const series = buildChartSeries(demoAnalysisFixture);
const points = buildInspectionPoints(series);

describe("buildInspectionPoints", () => {
  it("covers every trajectory point and every forecast point exactly once", () => {
    // The forecast line's first element repeats the last history point so the polylines join;
    // reporting that instant twice in the readout would be a duplicate, not a second point.
    expect(points).toHaveLength(series.historyLine.length + series.forecastLine.length - 1);
  });

  it("pairs each history point with the raw reading recorded at the same instant", () => {
    const first = points[0]!;
    expect(first.isForecast).toBe(false);
    expect(first.readingKg).toBe(demoAnalysisFixture.observations[0]!.weight_kg);
    expect(first.weightKg).toBe(demoAnalysisFixture.trajectory[0]!.w_kg);
  });

  it("carries the published interval on every point, history and forecast alike", () => {
    for (const point of points) {
      expect(point.lowerKg).toBeLessThanOrEqual(point.weightKg);
      expect(point.upperKg).toBeGreaterThanOrEqual(point.weightKg);
    }
  });

  it("gives forecast points no reading, because no measurement exists there", () => {
    const forecastPoints = points.filter((point) => point.isForecast);
    expect(forecastPoints.length).toBeGreaterThan(0);
    expect(forecastPoints.every((point) => point.readingKg === null)).toBe(true);
  });

  it("omits readings rather than mispairing them if the two series ever de-align", () => {
    const deAligned = { ...series, observations: series.observations.slice(1) };
    expect(buildInspectionPoints(deAligned).every((point) => point.readingKg === null)).toBe(true);
  });
});

describe("nearestInspectionIndex", () => {
  it("finds the point closest in time", () => {
    const target = new Date(points[2]!.date.getTime() + 60_000);
    expect(nearestInspectionIndex(points, target)).toBe(2);
  });

  it("clamps to the ends rather than returning nothing for an out-of-range date", () => {
    expect(nearestInspectionIndex(points, new Date("1990-01-01T00:00:00Z"))).toBe(0);
    expect(nearestInspectionIndex(points, new Date("2100-01-01T00:00:00Z"))).toBe(
      points.length - 1,
    );
  });

  it("returns null for an empty series", () => {
    expect(nearestInspectionIndex([], new Date())).toBeNull();
  });
});

describe("stepInspectionIndex", () => {
  it("stops at either end rather than wrapping around the series", () => {
    expect(stepInspectionIndex(0, -1, 5)).toBe(0);
    expect(stepInspectionIndex(4, 1, 5)).toBe(4);
  });

  it("starts at the first or last point depending on the direction of the first step", () => {
    expect(stepInspectionIndex(null, 1, 5)).toBe(0);
    expect(stepInspectionIndex(null, -1, 5)).toBe(4);
  });

  it("has nothing to step through in an empty series", () => {
    expect(stepInspectionIndex(null, 1, 0)).toBeNull();
  });
});
