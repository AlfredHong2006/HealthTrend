/**
 * The rate's own interval, computed from the model's published posterior -- not approximated.
 *
 * The 1B Editorial design (docs/design/09_1B_Implementation_Spec, "8.1 Velocity posterior
 * interval") was drawn against a fixture that carried no velocity variance, so it reserved the
 * rate's interval as a slot to fill in "from the model's own posterior for the velocity state"
 * once available -- and named an explicit rule not to substitute an OLS slope standard error or
 * any other approximation (docs/design/IMPLEMENTATION_NOTES.md, "3. Velocity/rate uncertainty").
 *
 * The real API already publishes exactly that quantity: `current.weekly_rate_sd_kg` is
 * `per_day_to_per_week(v_sd)` -- the standard deviation of the Kalman filter's own posterior for
 * the velocity state (`backend/app/core/types.py: StateEstimate.weekly_rate_sd_kg`), the same
 * state the chart's band and the weight interval are built from. There is no contract gap here:
 * the slot the design reserved is one this product already computes.
 *
 * `Z_95` mirrors `backend/app/core/types.py: Z_95` exactly -- the same unrounded two-sided 95%
 * standard-normal quantile the backend uses to build `w_lower95`/`w_upper95`, applied here to the
 * one published interval the wire contract does not already carry pre-built.
 */

import type { CurrentEstimate } from "@/lib/api/types";

/** Two-sided 95% standard-normal quantile, unrounded (backend/app/core/types.py: Z_95). */
export const Z_95 = 1.959963984540054;

export interface RateInterval {
  lowerKgPerWeek: number;
  upperKgPerWeek: number;
  /** Whether the 95% interval excludes zero -- the one fact "direction" may honestly rest on. */
  excludesZero: boolean;
}

export function weeklyRateInterval(current: Pick<CurrentEstimate, "weekly_rate_kg" | "weekly_rate_sd_kg">): RateInterval {
  const half = Z_95 * current.weekly_rate_sd_kg;
  const lowerKgPerWeek = current.weekly_rate_kg - half;
  const upperKgPerWeek = current.weekly_rate_kg + half;
  return { lowerKgPerWeek, upperKgPerWeek, excludesZero: lowerKgPerWeek > 0 || upperKgPerWeek < 0 };
}

export type RateDirection = "up" | "down" | "flat";

/**
 * "up" or "down" only when the 95% interval says the rate is actually away from zero; "flat"
 * otherwise. This is the rule the design names for `TrendDelta` once a real interval exists: a
 * rate whose interval spans zero is not distinguishable from no change, so it is not drawn as one.
 */
export function rateDirection(current: Pick<CurrentEstimate, "weekly_rate_kg" | "weekly_rate_sd_kg">): RateDirection {
  const { excludesZero } = weeklyRateInterval(current);
  if (!excludesZero) {
    return "flat";
  }
  return current.weekly_rate_kg < 0 ? "down" : "up";
}
