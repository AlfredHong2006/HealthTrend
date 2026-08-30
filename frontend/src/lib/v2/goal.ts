/**
 * Goal arithmetic for the prototype: a target weight, an optional target weekly rate, and the
 * two comparisons the honesty ledger explicitly permits.
 *
 * What is allowed here is stated precisely in docs/design/V2_DESIGN.md: goal *distance* (a
 * target against the current trend weight) and a *comparison* of the backend-computed current
 * rate against a user-supplied target rate are transparent arithmetic over published numbers.
 * A goal **ETA** is not -- that needs a hitting-time distribution the backend does not
 * compute -- so nothing in this module returns a date, a duration or a probability, and
 * nothing classifies the comparison as good, bad, ahead or behind.
 *
 * Goal state itself is ephemeral: it lives in component state for the duration of the visit
 * and is written nowhere (docs/privacy.md, and the locked prototype decisions in V2_DESIGN).
 */

/** Bounds for the target-weight field. Input validation, not a claim about anybody's weight. */
export const GOAL_MIN_KG = 20;
export const GOAL_MAX_KG = 400;

/** Bounds for the optional target-rate field, in kg/week, either direction. */
export const TARGET_RATE_LIMIT_KG_PER_WEEK = 5;

/** Below this the difference does not survive the one-decimal display, so it is not claimed. */
const SAME_WEIGHT_TOLERANCE_KG = 0.05;

export interface GoalDistance {
  targetKg: number;
  /** Unsigned distance between the target and the current estimated trend weight. */
  distanceKg: number;
  /** Where the target sits relative to the current estimate. */
  direction: "below" | "above" | "level";
}

/**
 * Compare a target weight with the current estimated trend weight -- not with the latest
 * scale reading, which is one noisy measurement rather than the estimate of the trajectory.
 */
export function goalDistance(currentTrendKg: number, targetKg: number): GoalDistance {
  const difference = targetKg - currentTrendKg;
  if (Math.abs(difference) < SAME_WEIGHT_TOLERANCE_KG) {
    return { targetKg, distanceKg: 0, direction: "level" };
  }
  return {
    targetKg,
    distanceKg: Math.abs(difference),
    direction: difference < 0 ? "below" : "above",
  };
}

export interface RateComparison {
  targetKgPerWeek: number;
  currentKgPerWeek: number;
  /** current − target, signed. Stated as a number; never labelled ahead, behind or on track. */
  differenceKgPerWeek: number;
}

export function compareWeeklyRate(
  currentKgPerWeek: number,
  targetKgPerWeek: number,
): RateComparison {
  return {
    targetKgPerWeek,
    currentKgPerWeek,
    differenceKgPerWeek: currentKgPerWeek - targetKgPerWeek,
  };
}

/**
 * Read a target weight typed into the goal field, or `null` if it is not a usable number.
 *
 * `null` means "no goal reference": the chart simply draws no goal line. There is no error
 * state here beyond that, because a half-typed number is not a mistake worth interrupting.
 */
export function parseGoalWeightKg(value: string): number | null {
  return parseBounded(value, GOAL_MIN_KG, GOAL_MAX_KG);
}

/** Read an optional target weekly rate. Negative, zero and positive are all meaningful. */
export function parseTargetWeeklyRateKg(value: string): number | null {
  return parseBounded(value, -TARGET_RATE_LIMIT_KG_PER_WEEK, TARGET_RATE_LIMIT_KG_PER_WEEK);
}

function parseBounded(value: string, min: number, max: number): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

