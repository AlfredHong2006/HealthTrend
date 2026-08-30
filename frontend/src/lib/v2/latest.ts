/**
 * The one comparison the analysis rail is built around: the latest scale reading set beside
 * the estimate for the same instant.
 *
 * This is the whole of "why this estimate?" that today's API can honestly support. It is not
 * a derivation -- `current` *is* the estimate at the last observation (`CurrentEstimateOut`:
 * "the estimate as of the last observation"), so pairing it with the last element of
 * `observations` needs no index alignment and no interpolation. The only arithmetic is a
 * subtraction between two published numbers, which the honesty ledger names as transparent
 * presentation arithmetic.
 *
 * Nothing here explains *why the difference is what it is* -- that would need the
 * per-observation innovation and Kalman gain the core computes and discards at the wire
 * boundary (docs/design/V2_DESIGN.md). Until those are published, the honest answer is the
 * two numbers and their difference.
 */

import type { AnalysisResponse } from "@/lib/api/types";

/** Below this the difference does not survive a one-decimal display, so no sign is claimed. */
const SAME_WEIGHT_TOLERANCE_KG = 0.05;

export interface LatestObservation {
  date: Date;
  /** What the scale read. */
  readingKg: number;
  /** What the model estimates the underlying weight was at that same instant. */
  estimateKg: number;
  /** reading − estimate, signed. */
  differenceKg: number;
  /** Where the reading sits relative to the estimate. */
  direction: "above" | "below" | "level";
  /** The 95% interval on the estimate, as published. */
  lowerKg: number;
  upperKg: number;
}

type AnalysisForLatest = Pick<AnalysisResponse, "observations" | "current">;

/** `null` for a series with no observations, which no analysis response can currently be. */
export function latestObservation(analysis: AnalysisForLatest): LatestObservation | null {
  const observation = analysis.observations.at(-1);
  if (!observation) {
    return null;
  }

  const { current } = analysis;
  const differenceKg = observation.weight_kg - current.w_kg;

  return {
    date: new Date(observation.timestamp),
    readingKg: observation.weight_kg,
    estimateKg: current.w_kg,
    differenceKg,
    direction:
      Math.abs(differenceKg) < SAME_WEIGHT_TOLERANCE_KG
        ? "level"
        : differenceKg > 0
          ? "above"
          : "below",
    lowerKg: current.w_lower95,
    upperKg: current.w_upper95,
  };
}
