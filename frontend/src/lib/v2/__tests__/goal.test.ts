import { describe, expect, it } from "vitest";
import {
  compareWeeklyRate,
  goalDistance,
  GOAL_MAX_KG,
  GOAL_MIN_KG,
  parseGoalWeightKg,
  parseTargetWeeklyRateKg,
  TARGET_RATE_LIMIT_KG_PER_WEEK,
} from "../goal";

describe("goalDistance", () => {
  it("measures the target against the current estimate, in both directions", () => {
    const below = goalDistance(75.9, 73);
    expect(below.targetKg).toBe(73);
    expect(below.distanceKg).toBeCloseTo(2.9, 6);
    expect(below.direction).toBe("below");

    expect(goalDistance(75.9, 78).direction).toBe("above");
  });

  it("claims no direction for a difference that would not survive the display", () => {
    // One decimal place is the precision shown everywhere; a 0.01 kg gap rendered as a
    // direction would be a claim the number does not support.
    expect(goalDistance(75.9, 75.91)).toEqual({
      targetKg: 75.91,
      distanceKg: 0,
      direction: "level",
    });
  });
});

describe("compareWeeklyRate", () => {
  it("reports the signed difference between the current rate and the target", () => {
    const comparison = compareWeeklyRate(-0.42, -0.5);
    expect(comparison.differenceKgPerWeek).toBeCloseTo(0.08, 6);
    expect(comparison.currentKgPerWeek).toBe(-0.42);
    expect(comparison.targetKgPerWeek).toBe(-0.5);
  });

  it("returns numbers only -- never a verdict about the comparison", () => {
    expect(Object.keys(compareWeeklyRate(-0.42, -0.5)).sort()).toEqual([
      "currentKgPerWeek",
      "differenceKgPerWeek",
      "targetKgPerWeek",
    ]);
  });
});

describe("parseGoalWeightKg", () => {
  it("reads a plain number", () => {
    expect(parseGoalWeightKg("73")).toBe(73);
    expect(parseGoalWeightKg(" 73.5 ")).toBe(73.5);
  });

  it("treats an empty or unusable field as no goal rather than as an error", () => {
    expect(parseGoalWeightKg("")).toBeNull();
    expect(parseGoalWeightKg("   ")).toBeNull();
    expect(parseGoalWeightKg("seventy")).toBeNull();
    expect(parseGoalWeightKg("-")).toBeNull();
  });

  it("rejects values outside the field's bounds", () => {
    expect(parseGoalWeightKg(String(GOAL_MIN_KG - 1))).toBeNull();
    expect(parseGoalWeightKg(String(GOAL_MAX_KG + 1))).toBeNull();
    expect(parseGoalWeightKg(String(GOAL_MIN_KG))).toBe(GOAL_MIN_KG);
  });
});

describe("parseTargetWeeklyRateKg", () => {
  it("accepts a loss, a gain and a maintenance target alike", () => {
    expect(parseTargetWeeklyRateKg("-0.5")).toBe(-0.5);
    expect(parseTargetWeeklyRateKg("0")).toBe(0);
    expect(parseTargetWeeklyRateKg("0.25")).toBe(0.25);
  });

  it("rejects a rate beyond the field's limits in either direction", () => {
    expect(parseTargetWeeklyRateKg(String(TARGET_RATE_LIMIT_KG_PER_WEEK + 1))).toBeNull();
    expect(parseTargetWeeklyRateKg(String(-TARGET_RATE_LIMIT_KG_PER_WEEK - 1))).toBeNull();
  });
});

