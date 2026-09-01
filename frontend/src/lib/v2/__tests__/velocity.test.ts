import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { rateDirection, weeklyRateInterval, Z_95 } from "../velocity";

describe("weeklyRateInterval", () => {
  it("builds the 95% interval from the published rate standard deviation", () => {
    const current = { weekly_rate_kg: -0.5, weekly_rate_sd_kg: 0.1 };
    const interval = weeklyRateInterval(current);

    expect(interval.lowerKgPerWeek).toBeCloseTo(-0.5 - Z_95 * 0.1, 10);
    expect(interval.upperKgPerWeek).toBeCloseTo(-0.5 + Z_95 * 0.1, 10);
    expect(interval.excludesZero).toBe(true);
  });

  it("spans zero when the standard deviation is large relative to the rate", () => {
    // The fixture's own numbers: a real series short enough that the rate is not
    // distinguishable from zero within its 95% interval.
    const { current } = demoAnalysisFixture;
    expect(weeklyRateInterval(current).excludesZero).toBe(false);
  });
});

describe("rateDirection", () => {
  it("is flat whenever the interval spans zero, whatever the point estimate's sign", () => {
    expect(rateDirection(demoAnalysisFixture.current)).toBe("flat");
  });

  it("is down or up only when the interval excludes zero", () => {
    expect(rateDirection({ weekly_rate_kg: -0.5, weekly_rate_sd_kg: 0.1 })).toBe("down");
    expect(rateDirection({ weekly_rate_kg: 0.5, weekly_rate_sd_kg: 0.1 })).toBe("up");
  });
});
