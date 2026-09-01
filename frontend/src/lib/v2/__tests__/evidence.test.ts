import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { daysWithoutReading, readingsPerWeek } from "../evidence";

describe("daysWithoutReading", () => {
  it("is zero when every calendar day in the span has a reading", () => {
    // The fixture has one observation on each of four consecutive days.
    expect(daysWithoutReading(demoAnalysisFixture.observations)).toBe(0);
  });

  it("counts calendar days with no reading, not missing observation slots", () => {
    const observations = [
      { timestamp: "2026-01-01T08:00:00.000Z", weight_kg: 80 },
      { timestamp: "2026-01-04T08:00:00.000Z", weight_kg: 79 },
    ];
    // Jan 1 - Jan 4 inclusive is 4 days; 2 of them (2nd, 3rd) have no reading.
    expect(daysWithoutReading(observations)).toBe(2);
  });

  it("is zero for an empty series", () => {
    expect(daysWithoutReading([])).toBe(0);
  });

  it("counts two same-day readings as covering one day, not zero gap days", () => {
    const observations = [
      { timestamp: "2026-01-01T07:00:00.000Z", weight_kg: 80 },
      { timestamp: "2026-01-01T19:00:00.000Z", weight_kg: 80.2 },
    ];
    expect(daysWithoutReading(observations)).toBe(0);
  });
});

describe("readingsPerWeek", () => {
  it("scales the mean reading rate to a week", () => {
    expect(readingsPerWeek(4, 3)).toBeCloseTo((4 / 3) * 7, 10);
  });

  it("is zero rather than infinite for a zero-day span", () => {
    expect(readingsPerWeek(1, 0)).toBe(0);
  });
});
