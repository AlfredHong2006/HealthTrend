import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { summaryLine } from "../narrative";

describe("summaryLine", () => {
  it("states the extent of the evidence and the date of the most recent reading", () => {
    expect(summaryLine(demoAnalysisFixture)).toBe(
      "Estimated from 4 readings spanning 3 days, the most recent on 26 April 2026.",
    );
  });

  it("says 'reading' rather than 'readings' for a single measurement", () => {
    expect(summaryLine({ ...demoAnalysisFixture, n_obs: 1 })).toContain("1 reading spanning");
  });

  it("drops the date clause rather than inventing one for an empty series", () => {
    const line = summaryLine({ ...demoAnalysisFixture, observations: [] });
    expect(line).toBe("Estimated from 4 readings spanning 3 days.");
  });

  /**
   * It repeats none of the figures shown above it. That is the point of this line: the summary
   * block already carries the estimate, the rate and the projection, and restating them in
   * prose is exactly the duplication the rail was rebuilt to remove.
   */
  it("carries no figure the summary block already displays", () => {
    const line = summaryLine(demoAnalysisFixture);
    expect(line).not.toContain("81.7");
    expect(line).not.toContain("kg/week");
    expect(line).not.toContain("95%");
  });

  /**
   * The binding product rule: a qualitative status or confidence label is not a current API
   * capability and must not be manufactured in the frontend.
   */
  it("uses no classifying, judging or medical vocabulary", () => {
    const line = summaryLine(demoAnalysisFixture).toLowerCase();

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
    ]) {
      expect(line).not.toContain(phrase);
    }
  });
});
