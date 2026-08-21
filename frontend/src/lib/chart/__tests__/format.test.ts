import { describe, expect, it } from "vitest";
import {
  formatFullDate,
  formatShortDate,
  formatWeeklyRateKg,
  formatWeightKg,
  formatWeightRangeKg,
} from "../format";

describe("formatWeightKg", () => {
  it("shows exactly one decimal place", () => {
    expect(formatWeightKg(75.927396)).toBe("75.9 kg");
    expect(formatWeightKg(70)).toBe("70.0 kg");
  });
});

describe("formatWeightRangeKg", () => {
  it("formats both bounds with an en dash and one shared unit", () => {
    expect(formatWeightRangeKg(71.699, 76.513)).toBe("71.7–76.5 kg");
  });
});

describe("formatWeeklyRateKg", () => {
  it("signs a loss with a true minus sign, not a hyphen", () => {
    expect(formatWeeklyRateKg(-0.421428)).toBe("−0.42 kg/week");
    expect(formatWeeklyRateKg(-0.421428)).not.toContain("-0.42"); // hyphen-minus must not appear
  });

  it("signs a gain with a plus sign", () => {
    expect(formatWeeklyRateKg(0.26)).toBe("+0.26 kg/week");
  });

  it("never claims a direction for a rate that rounds to zero", () => {
    expect(formatWeeklyRateKg(0.001)).toBe("0.00 kg/week");
    expect(formatWeeklyRateKg(-0.001)).toBe("0.00 kg/week");
  });
});

describe("formatShortDate", () => {
  it("omits the year, for axis ticks", () => {
    expect(formatShortDate(new Date("2026-04-23T08:50:16.705Z"))).toBe("23 Apr");
  });
});

describe("formatFullDate", () => {
  it("includes the year, for tooltips and accessible labels", () => {
    expect(formatFullDate(new Date("2026-04-23T08:50:16.705Z"))).toBe("23 April 2026");
  });
});
