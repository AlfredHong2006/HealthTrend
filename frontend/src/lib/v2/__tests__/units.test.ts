import { describe, expect, it } from "vitest";
import {
  convertKg,
  formatRateMagnitudeUnit,
  formatSignedWeightUnit,
  formatWeeklyRateUnit,
  formatWeightMagnitudeUnit,
  formatWeightRangeUnit,
  formatWeightUnit,
  KG_PER_LB,
} from "../units";

describe("convertKg", () => {
  it("leaves kg untouched", () => {
    expect(convertKg(80, "kg")).toBe(80);
  });

  it("converts to the exact avoirdupois pound", () => {
    expect(convertKg(1, "lb")).toBeCloseTo(1 / KG_PER_LB, 10);
  });
});

describe("formatWeightUnit", () => {
  it("formats kg at one decimal", () => {
    expect(formatWeightUnit(75.94, "kg")).toBe("75.9 kg");
  });

  it("converts to lb before formatting", () => {
    expect(formatWeightUnit(1, "lb")).toBe("2.2 lb");
  });
});

describe("formatWeightRangeUnit", () => {
  it("shares one unit suffix across the range", () => {
    expect(formatWeightRangeUnit(71.7, 76.5, "kg")).toBe("71.7–76.5 kg");
  });
});

describe("formatWeeklyRateUnit", () => {
  it("always signs a non-zero rate with a true minus sign", () => {
    expect(formatWeeklyRateUnit(-0.42, "kg")).toBe("−0.42 kg/week");
    expect(formatWeeklyRateUnit(0.26, "kg")).toBe("+0.26 kg/week");
  });

  it("drops the sign for a rate that rounds to exactly zero", () => {
    expect(formatWeeklyRateUnit(-0.001, "kg")).toBe("0.00 kg/week");
  });
});

describe("formatRateMagnitudeUnit", () => {
  it("is always unsigned, being a spread rather than a direction", () => {
    expect(formatRateMagnitudeUnit(-0.85, "kg")).toBe("0.85 kg/week");
  });
});

describe("formatSignedWeightUnit and formatWeightMagnitudeUnit", () => {
  it("signs a difference but not a magnitude", () => {
    expect(formatSignedWeightUnit(0.4, "kg")).toBe("+0.4 kg");
    expect(formatSignedWeightUnit(-0.4, "kg")).toBe("−0.4 kg");
    expect(formatWeightMagnitudeUnit(-3.2, "kg")).toBe("3.2 kg");
  });
});
