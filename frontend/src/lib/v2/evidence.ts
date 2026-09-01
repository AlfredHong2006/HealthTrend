/**
 * Plain counts over the observations the estimate was built from -- for the Evidence tier and
 * the tier-2 statistics band.
 *
 * The 1B Editorial design's fixture generator walked a daily grid and counted the days it chose
 * to skip. The real trajectory carries one point per *observation*, not one per calendar day
 * (ADR-0005), so "a day with no reading" has to be counted from the real observation timestamps
 * instead of read off a grid that does not exist here. Both counts below are arithmetic over
 * already-published values -- a calendar tally and a division -- not a new statistical capability.
 */

import type { Observation } from "@/lib/api/types";

/**
 * How many whole calendar days between the first and last observation (inclusive) have no
 * reading recorded on them, in UTC -- the same normalisation `observations[].timestamp` is
 * already published in.
 */
export function daysWithoutReading(observations: readonly Observation[]): number {
  if (observations.length === 0) {
    return 0;
  }
  const withReading = new Set(observations.map((observation) => calendarDayKey(observation.timestamp)));
  const first = calendarDayStart(observations[0]!.timestamp);
  const last = calendarDayStart(observations.at(-1)!.timestamp);
  const totalDays = Math.round((last - first) / MS_PER_DAY) + 1;
  return Math.max(0, totalDays - withReading.size);
}

const MS_PER_DAY = 86_400_000;

function calendarDayStart(timestamp: string): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function calendarDayKey(timestamp: string): number {
  return calendarDayStart(timestamp);
}

/** Readings per week, averaged across the span -- `n_obs` and `span_days`, divided and scaled. */
export function readingsPerWeek(nObs: number, spanDays: number): number {
  if (spanDays <= 0) {
    return 0;
  }
  return (nObs / spanDays) * 7;
}
