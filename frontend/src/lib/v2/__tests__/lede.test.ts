import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { analysisLede } from "../lede";

describe("analysisLede", () => {
  it("states flat when the rate's 95% interval spans zero, whatever its sign", () => {
    const lede = analysisLede(demoAnalysisFixture);
    expect(lede.headline).toBe("The estimated weight is flat within its uncertainty.");
    expect(lede.detail).toContain("its 95% interval spans zero");
  });

  it("states a direction only when the interval excludes zero", () => {
    const analysis = {
      ...demoAnalysisFixture,
      current: { ...demoAnalysisFixture.current, weekly_rate_kg: -0.5, weekly_rate_sd_kg: 0.05 },
    };
    const lede = analysisLede(analysis);
    expect(lede.headline).toBe("The estimated weight is trending down.");
    expect(lede.detail).toContain("does not cross zero");
  });

  it("says there is no trend yet for a single-point trajectory, without inventing one", () => {
    const analysis = { ...demoAnalysisFixture, trajectory: [demoAnalysisFixture.trajectory[0]!] };
    expect(analysisLede(analysis).headline).toBe("There is no trend yet.");
  });

  it("says there is no trend yet for an empty trajectory", () => {
    const analysis = { ...demoAnalysisFixture, trajectory: [] };
    expect(analysisLede(analysis).headline).toBe("There is no trend yet.");
  });

  /**
   * Several readings at one instant give several trajectory points and a zero span, so a
   * point-count test alone would have stated a direction built from the prior velocity.
   */
  it("states no trend for several readings that share one instant, despite the point count", () => {
    const analysis = {
      ...demoAnalysisFixture,
      span_days: 0,
      current: { ...demoAnalysisFixture.current, weekly_rate_kg: -0.5, weekly_rate_sd_kg: 0.05 },
    };

    expect(analysis.trajectory.length).toBeGreaterThan(1);
    expect(analysisLede(analysis).headline).toBe("There is no trend yet.");
    expect(analysisLede(analysis).detail).not.toContain("kg/week");
  });

  /** The binding product rule: no classifying, judging or medical vocabulary anywhere. */
  it("uses no classifying, judging or medical vocabulary", () => {
    const cases = [
      demoAnalysisFixture,
      {
        ...demoAnalysisFixture,
        current: { ...demoAnalysisFixture.current, weekly_rate_kg: -0.5, weekly_rate_sd_kg: 0.05 },
      },
      { ...demoAnalysisFixture, trajectory: [] },
    ];

    for (const analysis of cases) {
      const lede = analysisLede(analysis);
      const text = `${lede.headline} ${lede.detail}`.toLowerCase();
      for (const phrase of [
        "steadily",
        "steady",
        "plateau",
        "confidence",
        "on track",
        "behind",
        "accelerat",
        "decelerat",
        "healthy",
        "should",
        "risk",
        "caused by",
        "definitely",
        "will reach",
        "not enough evidence",
        "outlier",
        "change point",
      ]) {
        expect(text).not.toContain(phrase);
      }
    }
  });
});
