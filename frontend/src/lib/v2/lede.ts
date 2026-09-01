/**
 * The rail's opening statement: what this analysis says, in one sentence, plus one sentence of
 * support for it. Built in one pure place for the same reason `narrative.ts` is: what the
 * product *says* should be as reviewable as what it computes.
 *
 * Every word here rests on a number the backend actually published. In particular, "trending
 * up"/"down" is not a stylistic default -- it is stated only when the rate's own 95% interval
 * (`lib/v2/velocity.ts`) excludes zero, and "flat" otherwise. That is a fact about a published
 * interval, not a confidence label: nothing here is a status, a probability or a threshold
 * invented in the frontend (docs/product/V2_PRODUCT.md).
 *
 * `src/lib/v2/__tests__/lede.test.ts` asserts the absence of the classifying vocabulary the
 * honesty ledger rules out, the same way `narrative.test.ts` does for `summaryLine`.
 */

import { rateDirection } from "@/lib/v2/velocity";
import { hasEstimatedTrend } from "@/lib/v2/span";
import { formatWeeklyRateUnit, type DisplayUnit } from "@/lib/v2/units";
import type { AnalysisResponse } from "@/lib/api/types";

type AnalysisForLede = Pick<AnalysisResponse, "current" | "span_days" | "trajectory">;

export interface AnalysisLede {
  /** The one-line lede, set large in the rail. */
  headline: string;
  /** The sentence beneath it, naming the rate and what the interval says about it. */
  detail: string;
}

/**
 * The span gate is `lib/v2/span.ts`, the same test every other span-gated surface uses: an
 * elapsed interval for the filter to estimate a rate across, and more than one filtered point
 * (ADR-0005). A single point, none at all, and a batch of readings sharing one instant alike
 * have no trend to describe -- in the last of those the rate would still be the model's prior.
 */
export function analysisLede(analysis: AnalysisForLede, unit: DisplayUnit = "kg"): AnalysisLede {
  if (!hasEstimatedTrend(analysis)) {
    return analysis.trajectory.length === 0
      ? {
          headline: "There is no trend yet.",
          detail: "No readings have been recorded, so there is nothing to estimate a level or a rate from.",
        }
      : {
          headline: "There is no trend yet.",
          detail:
            "Every reading so far falls on the same day, so there is no elapsed span to estimate a rate across.",
        };
  }

  const { current } = analysis;
  const direction = rateDirection(current);
  const rate = formatWeeklyRateUnit(current.weekly_rate_kg, unit);

  const headline =
    direction === "flat"
      ? "The estimated weight is flat within its uncertainty."
      : direction === "down"
        ? "The estimated weight is trending down."
        : "The estimated weight is trending up.";

  const detail =
    direction === "flat"
      ? `The estimated rate is ${rate} — its 95% interval spans zero, so no direction is stated.`
      : `The estimated rate is ${rate}, and its 95% interval does not cross zero.`;

  return { headline, detail };
}
