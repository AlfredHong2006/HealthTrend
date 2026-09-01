import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { hasEstimatedTrend } from "../span";

const sameInstant = "2026-04-26T08:50:16.705Z";

/** Four readings taken at one instant: `span_days` is 0, but there are still four points. */
const sameTimestampBatch = {
  ...demoAnalysisFixture,
  span_days: 0,
  observations: demoAnalysisFixture.observations.map((observation) => ({
    ...observation,
    timestamp: sameInstant,
  })),
  trajectory: demoAnalysisFixture.trajectory.map((point) => ({
    ...point,
    timestamp: sameInstant,
  })),
};

describe("hasEstimatedTrend", () => {
  it("accepts a series with an elapsed span and more than one filtered point", () => {
    expect(hasEstimatedTrend(demoAnalysisFixture)).toBe(true);
  });

  /**
   * The case `trajectory.length > 1` alone let through: several readings, one instant, so the
   * velocity posterior is still exactly the prior and nothing derived from it may be shown.
   */
  it("rejects several readings that share one instant, despite the point count", () => {
    expect(sameTimestampBatch.trajectory.length).toBeGreaterThan(1);
    expect(hasEstimatedTrend(sameTimestampBatch)).toBe(false);
  });

  it("rejects a single filtered point", () => {
    expect(
      hasEstimatedTrend({ ...demoAnalysisFixture, trajectory: [demoAnalysisFixture.trajectory[0]!] }),
    ).toBe(false);
  });

  it("rejects an empty trajectory", () => {
    expect(hasEstimatedTrend({ ...demoAnalysisFixture, span_days: 0, trajectory: [] })).toBe(false);
  });
});
