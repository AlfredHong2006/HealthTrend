/**
 * Measurement scatter: the RMS of each observation against the trajectory's own estimate for
 * that same instant.
 *
 * docs/design/IMPLEMENTATION_NOTES.md, "2. Residual terminology" permits exactly this figure,
 * on the condition it is described as measurement scatter around the estimated trajectory --
 * never as model innovation variance, which is a different, smaller quantity the core computes
 * internally (`FilterStep.innovation_variance`) and does not publish. This function computes the
 * permitted figure: a plain RMS over already-published values, not a diagnostic borrowed from the
 * filter's own bookkeeping.
 */

import type { Observation, TrajectoryPoint } from "@/lib/api/types";

/**
 * `null` when there is nothing to compute a scatter from, or when the trajectory and the
 * observations are not one-for-one (ADR-0005 says they are; this guards the arithmetic rather
 * than assuming it).
 */
export function measurementScatterKg(
  observations: readonly Observation[],
  trajectory: readonly TrajectoryPoint[],
): number | null {
  if (observations.length === 0 || observations.length !== trajectory.length) {
    return null;
  }
  const sumSquares = observations.reduce((total, observation, index) => {
    const diff = observation.weight_kg - trajectory[index]!.w_kg;
    return total + diff * diff;
  }, 0);
  return Math.sqrt(sumSquares / observations.length);
}
