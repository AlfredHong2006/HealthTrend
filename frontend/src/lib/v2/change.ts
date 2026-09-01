/**
 * The change over a fixed look-back window: the difference between the current estimated level
 * and the trajectory's own point closest to `days` earlier.
 *
 * This is the tier-2 statistics band's "Change, N days" figure. It is a subtraction of two
 * already-published `trajectory[].w_kg` values -- transparent presentation arithmetic, the same
 * kind the honesty ledger names for goal distance (docs/design/V2_DESIGN.md) -- not a new
 * statistic. It deliberately carries no interval: the two points are draws from a correlated
 * posterior, and combining their individual standard deviations into one for the difference
 * would be exactly the kind of invented figure docs/design/IMPLEMENTATION_NOTES.md rules out.
 *
 * When the series does not yet reach `days` back, there is nothing honest to compute -- the 1B
 * Editorial design's "short-window" state, where the slot is absent with a plain explanation
 * rather than approximated from what is available.
 */

import type { TrajectoryPoint } from "@/lib/api/types";

export interface TrajectoryChange {
  deltaKg: number;
  /** How many days actually separate the two points -- close to, but not necessarily, `days`. */
  actualDays: number;
}

export function changeOverDays(
  trajectory: readonly TrajectoryPoint[],
  days: number,
): TrajectoryChange | null {
  if (trajectory.length < 2) {
    return null;
  }
  const last = trajectory.at(-1)!;
  const lastMs = new Date(last.timestamp).getTime();
  const firstMs = new Date(trajectory[0]!.timestamp).getTime();
  const targetMs = lastMs - days * MS_PER_DAY;

  if (firstMs > targetMs) {
    return null;
  }

  let reference = trajectory[0]!;
  for (const point of trajectory) {
    if (new Date(point.timestamp).getTime() > targetMs) {
      break;
    }
    reference = point;
  }

  const actualDays = (lastMs - new Date(reference.timestamp).getTime()) / MS_PER_DAY;
  return { deltaKg: last.w_kg - reference.w_kg, actualDays };
}

const MS_PER_DAY = 86_400_000;
