import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { measurementScatterKg } from "../scatter";

describe("measurementScatterKg", () => {
  it("computes the RMS of each observation against the trajectory's own estimate", () => {
    const { observations, trajectory } = demoAnalysisFixture;
    const expected = Math.sqrt(
      observations.reduce((total, observation, index) => {
        const diff = observation.weight_kg - trajectory[index]!.w_kg;
        return total + diff * diff;
      }, 0) / observations.length,
    );
    expect(measurementScatterKg(observations, trajectory)).toBeCloseTo(expected, 10);
  });

  it("is null when there is nothing to compute from", () => {
    expect(measurementScatterKg([], [])).toBeNull();
  });

  it("is null when observations and trajectory are not index-aligned", () => {
    const { observations, trajectory } = demoAnalysisFixture;
    expect(measurementScatterKg(observations, trajectory.slice(1))).toBeNull();
  });
});
