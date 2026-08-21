import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { horizonPoint } from "../analysis";

describe("horizonPoint", () => {
  it("finds the 30-day horizon", () => {
    const point = horizonPoint(demoAnalysisFixture.forecast, 30);
    expect(point.horizon_days).toBe(30);
    expect(point.w_kg).toBe(72.156);
  });

  it("finds the 7- and 90-day horizons too", () => {
    expect(horizonPoint(demoAnalysisFixture.forecast, 7).horizon_days).toBe(7);
    expect(horizonPoint(demoAnalysisFixture.forecast, 90).horizon_days).toBe(90);
  });

  it("throws rather than silently returning nothing for a horizon the contract does not publish", () => {
    expect(() => horizonPoint(demoAnalysisFixture.forecast, 14)).toThrow(/14-day/);
  });
});
