import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { changeOverDays } from "../change";

describe("changeOverDays", () => {
  it("is absent when the series does not yet span the requested window", () => {
    // The fixture spans 3 days; a 90-day change cannot honestly be computed from it.
    expect(changeOverDays(demoAnalysisFixture.trajectory, 90)).toBeNull();
  });

  it("is absent for a single-point or empty trajectory", () => {
    expect(changeOverDays([demoAnalysisFixture.trajectory[0]!], 7)).toBeNull();
    expect(changeOverDays([], 7)).toBeNull();
  });

  it("subtracts the trajectory's own point nearest the look-back window", () => {
    const change = changeOverDays(demoAnalysisFixture.trajectory, 2);
    const last = demoAnalysisFixture.trajectory.at(-1)!;
    const reference = demoAnalysisFixture.trajectory[1]!; // 2 days before the last point

    expect(change).not.toBeNull();
    expect(change!.deltaKg).toBeCloseTo(last.w_kg - reference.w_kg, 10);
    expect(change!.actualDays).toBeCloseTo(2, 10);
  });
});
