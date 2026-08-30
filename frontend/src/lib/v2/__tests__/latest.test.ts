import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { latestObservation } from "../latest";

describe("latestObservation", () => {
  it("pairs the last reading with the estimate the backend published for that instant", () => {
    const latest = latestObservation(demoAnalysisFixture)!;

    expect(latest.readingKg).toBe(demoAnalysisFixture.observations.at(-1)!.weight_kg);
    expect(latest.estimateKg).toBe(demoAnalysisFixture.current.w_kg);
    expect(latest.date.toISOString()).toBe(demoAnalysisFixture.current.timestamp);
  });

  it("reports the difference as reading minus estimate, signed", () => {
    const latest = latestObservation(demoAnalysisFixture)!;

    expect(latest.differenceKg).toBeCloseTo(82.1477178 - 81.734891, 6);
    expect(latest.direction).toBe("above");
  });

  it("claims no direction for a difference that would not survive the display", () => {
    // One decimal place is the precision shown everywhere; a 0.01 kg gap rendered as a
    // direction would be a claim the numbers do not support.
    const level = latestObservation({
      ...demoAnalysisFixture,
      observations: [{ timestamp: "2026-04-26T08:50:16.705Z", weight_kg: 81.744891 }],
    })!;

    expect(level.direction).toBe("level");
  });

  it("carries the published interval on the estimate, not a recomputed one", () => {
    const latest = latestObservation(demoAnalysisFixture)!;

    expect(latest.lowerKg).toBe(demoAnalysisFixture.current.w_lower95);
    expect(latest.upperKg).toBe(demoAnalysisFixture.current.w_upper95);
  });

  it("returns null rather than inventing an observation for an empty series", () => {
    expect(latestObservation({ ...demoAnalysisFixture, observations: [] })).toBeNull();
  });
});
