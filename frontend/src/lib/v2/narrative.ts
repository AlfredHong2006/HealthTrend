/**
 * The prose the analysis surface speaks, built in one pure place so that what the product
 * *says* is as reviewable as what it computes.
 *
 * Two rules bind everything here. Every number is copied from the response -- nothing is
 * derived, compared against a threshold or turned into a category, because a qualitative
 * status ("losing steadily", "plateau", "high confidence") is not a current API capability
 * and must not be manufactured in the frontend to compensate (docs/product/V2_PRODUCT.md).
 * And the wording stays hedged and non-medical: *estimated*, *likely*, never *caused by*.
 *
 * The sentences are deliberately few. Generic explanation of how the model works is not
 * analysis-specific, changes almost nothing between one series and the next, and now lives on
 * the Method page instead of in the rail.
 *
 * `src/lib/v2/__tests__/narrative.test.ts` asserts the absence of the classifying vocabulary,
 * so an edit that reintroduces it fails a test rather than reaching a reader.
 */

import { formatFullDate } from "@/lib/chart/format";
import { formatDayCount } from "@/lib/v2/format";
import type { AnalysisResponse } from "@/lib/api/types";

type AnalysisForSummary = Pick<AnalysisResponse, "n_obs" | "span_days" | "observations">;

/**
 * The one supporting sentence under the summary figures: what the estimate was made from.
 *
 * It says what the figures cannot -- the extent of the evidence behind them -- and nothing
 * else. The figures above it already carry the estimate, the rate and the projection, so
 * repeating those in prose would be the duplication this surface exists to avoid.
 */
export function summaryLine(analysis: AnalysisForSummary): string {
  const readings = analysis.n_obs === 1 ? "1 reading" : `${analysis.n_obs} readings`;
  const latest = analysis.observations.at(-1);

  const extent = `Estimated from ${readings} spanning ${formatDayCount(analysis.span_days)}`;
  return latest
    ? `${extent}, the most recent on ${formatFullDate(new Date(latest.timestamp))}.`
    : `${extent}.`;
}
