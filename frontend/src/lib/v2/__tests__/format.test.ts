import { describe, expect, it } from "vitest";
import {
  formatDayCount,
  formatKgMagnitude,
  formatKgPrecise,
  formatMonthYear,
  formatNumber,
  formatRateMagnitude,
  formatSignedKg,
  formatSignedRate,
  formatTimeOfDay,
} from "../format";

describe("formatNumber", () => {
  it("keeps a published parameter at the precision it was published", () => {
    expect(formatNumber(0.008099238707340582, 6)).toBe("0.008099");
    expect(formatNumber(0.15, 2)).toBe("0.15");
  });
});

describe("formatKgPrecise", () => {
  it("shows a standard deviation without rounding it away", () => {
    expect(formatKgPrecise(0.20293022789116452, 3)).toBe("0.203 kg");
  });
});

describe("formatRateMagnitude", () => {
  it("leaves a spread unsigned: a standard deviation has no direction", () => {
    expect(formatRateMagnitude(0.18481625922567604)).toBe("0.18 kg/week");
    expect(formatRateMagnitude(-0.18481625922567604)).toBe("0.18 kg/week");
  });
});

describe("formatKgMagnitude", () => {
  it("leaves a distance unsigned, since the words beside it carry the direction", () => {
    expect(formatKgMagnitude(-2.9)).toBe("2.9 kg");
    expect(formatKgMagnitude(2.9)).toBe("2.9 kg");
  });
});

describe("formatSignedRate", () => {
  it("signs a difference with a true minus sign, not a hyphen", () => {
    expect(formatSignedRate(0.08)).toBe("+0.08 kg/week");
    expect(formatSignedRate(-0.08)).toBe("−0.08 kg/week");
  });

  it("gives no sign at all to a difference that rounds to zero", () => {
    // A sign in front of "0.00" would report a direction that was not measured.
    expect(formatSignedRate(0.001)).toBe("0.00 kg/week");
    expect(formatSignedRate(-0.001)).toBe("0.00 kg/week");
  });
});

describe("formatTimeOfDay", () => {
  it("shows a 24-hour time, so a weigh-in is placed within its day", () => {
    expect(formatTimeOfDay(new Date("2026-08-20T08:50:16.000Z"))).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("formatMonthYear", () => {
  it("labels a long axis by month", () => {
    expect(formatMonthYear(new Date("2026-08-20T00:00:00Z"))).toBe("Aug 2026");
  });
});

describe("formatDayCount", () => {
  it("keeps a fractional span rather than rounding a lead time to nothing", () => {
    expect(formatDayCount(0.25)).toBe("0.25 days");
  });

  it("agrees with itself about singulars", () => {
    expect(formatDayCount(1)).toBe("1 day");
    expect(formatDayCount(119)).toBe("119 days");
    expect(formatDayCount(0)).toBe("0 days");
  });
});

describe("formatSignedKg", () => {
  it("signs a difference with a true minus sign, not a hyphen", () => {
    expect(formatSignedKg(0.41)).toBe("+0.4 kg");
    expect(formatSignedKg(-0.41)).toBe("−0.4 kg");
  });

  it("gives no sign at all to a difference that rounds to zero", () => {
    // A sign in front of "0.0" would report a direction that was not measured.
    expect(formatSignedKg(0.01)).toBe("0.0 kg");
    expect(formatSignedKg(-0.01)).toBe("0.0 kg");
  });
});
