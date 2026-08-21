import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { buildChartSeries } from "../series";
import { buildHoverPoints, nearestHoverPoint } from "../hover";

describe("buildHoverPoints", () => {
  it("has one entry per history point plus one per forecast.path point (the join vertex is not duplicated)", () => {
    const series = buildChartSeries(demoAnalysisFixture);
    const points = buildHoverPoints(series);
    expect(points).toHaveLength(
      demoAnalysisFixture.trajectory.length + demoAnalysisFixture.forecast.path.length,
    );
  });

  it("is chronological, history before forecast", () => {
    const series = buildChartSeries(demoAnalysisFixture);
    const points = buildHoverPoints(series);
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i]!.date.getTime()).toBeGreaterThanOrEqual(points[i - 1]!.date.getTime());
    }
    expect(points.filter((p) => p.isForecast)).toHaveLength(demoAnalysisFixture.forecast.path.length);
  });
});

describe("nearestHoverPoint", () => {
  const points = [
    { date: new Date("2026-01-01T00:00:00Z"), weightKg: 80, lowerKg: 79, upperKg: 81, isForecast: false },
    { date: new Date("2026-01-05T00:00:00Z"), weightKg: 79, lowerKg: 78, upperKg: 80, isForecast: false },
    { date: new Date("2026-01-10T00:00:00Z"), weightKg: 78, lowerKg: 77, upperKg: 79, isForecast: true },
  ];

  it("returns the exact match when the date coincides", () => {
    expect(nearestHoverPoint(points, new Date("2026-01-05T00:00:00Z"))).toBe(points[1]);
  });

  it("returns the closer of two candidates", () => {
    expect(nearestHoverPoint(points, new Date("2026-01-03T12:00:00Z"))).toBe(points[1]);
    expect(nearestHoverPoint(points, new Date("2026-01-02T00:00:00Z"))).toBe(points[0]);
  });

  it("returns the nearest endpoint outside the range", () => {
    expect(nearestHoverPoint(points, new Date("2020-01-01T00:00:00Z"))).toBe(points[0]);
    expect(nearestHoverPoint(points, new Date("2030-01-01T00:00:00Z"))).toBe(points[2]);
  });

  it("returns undefined for an empty array", () => {
    expect(nearestHoverPoint([], new Date())).toBeUndefined();
  });
});
