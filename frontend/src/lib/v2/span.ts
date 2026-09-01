/**
 * The one test for "does an estimated trend exist to present?", in one place so every
 * span-gated surface asks the same question.
 *
 * Two conditions, and both are load-bearing:
 *
 * - `span_days > 0` — with no elapsed interval the velocity posterior is exactly the model's
 *   prior (ADR-0003). A rate, a rate interval, a direction or a forecast built from it would
 *   present a documented prior as though it were a finding about this series.
 * - `trajectory.length > 1` — a single filtered point is a level, not a trajectory: there is
 *   no line, no window to slice and nothing for the canvas to draw.
 *
 * Neither implies the other. A batch whose readings all share one instant has as many
 * trajectory points as readings — `trajectory.length > 1` alone passes it straight through to
 * the rate, the projection and the readings-per-week figure, which is exactly the case this
 * module exists to stop. Testing `span_days` alone would admit a one-point series with a
 * nonzero span, which cannot occur but would draw an empty chart if it did.
 *
 * The estimated *weight* is deliberately not gated on this. `current.w_kg` is the honest
 * posterior at any observation count — the exact result of one Gaussian measurement — which is
 * why the no-span state still shows a reading beside the estimate (`lib/v2/latest.ts`), and
 * why V1's `AnalysisWorkspace` renders its headline unconditionally under the same rule.
 *
 * There is no minimum-days threshold here, and there must not be one: a threshold would be a
 * frontend-invented criterion for when an analysis counts, which is not the product's to make
 * (docs/product/V2_PRODUCT.md).
 */

import type { AnalysisResponse } from "@/lib/api/types";

type AnalysisForSpan = Pick<AnalysisResponse, "span_days" | "trajectory">;

/** Whether the response carries an estimated trajectory that may honestly be presented as one. */
export function hasEstimatedTrend(analysis: AnalysisForSpan): boolean {
  return analysis.span_days > 0 && analysis.trajectory.length > 1;
}
