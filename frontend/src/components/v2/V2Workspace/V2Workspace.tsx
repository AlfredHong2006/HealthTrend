"use client";

import { useMemo, useState } from "react";
import { V2Canvas } from "@/components/v2/V2Canvas/V2Canvas";
import { V2Hero } from "@/components/v2/V2Hero/V2Hero";
import { V2InspectPanel, type InspectTier } from "@/components/v2/V2Inspector/V2InspectPanel";
import { V2Inspector } from "@/components/v2/V2Inspector/V2Inspector";
import { V2StatsBand } from "@/components/v2/V2StatsBand/V2StatsBand";
import { V2GoalControl } from "@/components/v2/V2Summary/V2GoalControl";
import { V2Summary } from "@/components/v2/V2Summary/V2Summary";
import { buildChartSeries } from "@/lib/chart/series";
import { formatFullDate } from "@/lib/chart/format";
import { formatTimeOfDay } from "@/lib/v2/format";
import type { AnalysisResponse } from "@/lib/api/types";
import { convertToKg, formatWeightUnit, type DisplayUnit } from "@/lib/v2/units";
import { parseGoalWeightKg, parseTargetWeeklyRateKg } from "@/lib/v2/goal";
import { buildInspectionPoints } from "@/lib/v2/inspect";
import { latestObservation } from "@/lib/v2/latest";
import { hasEstimatedTrend } from "@/lib/v2/span";
import {
  availableHistoryRanges,
  DEFAULT_FORECAST_WINDOW_ID,
  DEFAULT_HISTORY_RANGE_ID,
  FORECAST_WINDOWS,
  windowSeries,
  type HistoryRangeId,
} from "@/lib/v2/view";
import styles from "./V2Workspace.module.css";

/**
 * The 1B Editorial analysis surface, as one centred column: the hero, the canvas, the analysis
 * summary, the tier-2 statistics band, and one Inspect analysis entry that opens
 * Why / Evidence / Statistics beneath everything else.
 *
 * The frozen layout kept the summary in a persistent rail to the right of the canvas
 * (docs/design/09_1B_Implementation_Spec §1, §3). That rail is gone: a reserved 400px column
 * pushed the hero and the chart well left of a wide viewport's centre, so on desktop the page
 * read as left-heavy rather than as a composition. Its content is recomposed, not dropped --
 * `V2Summary` now carries the lede, the latest reading and the goal as a two-column section
 * directly under the chart, in the natural flow. Nothing is rendered twice, and one order
 * serves every width:
 *
 * ```
 * hero + rate -> chart -> what this analysis says + reading/goal -> statistics -> inspect -> [deep panel]
 * ```
 *
 * Desktop and mobile differ only in whether the summary's two columns sit side by side.
 *
 * The functional architecture is unchanged: the same pure `lib/v2` and `lib/chart` modules build
 * the chart series, the inspection points and the goal arithmetic; the goal stays ephemeral,
 * component-only state (docs/privacy.md); and the canvas keeps a single "Trajectory" range
 * control against a fixed 30-day projection.
 */
export function V2Workspace({ analysis, unit }: { analysis: AnalysisResponse; unit: DisplayUnit }) {
  const [historyRangeId, setHistoryRangeId] = useState<HistoryRangeId>(DEFAULT_HISTORY_RANGE_ID);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const [goalDraft, setGoalDraft] = useState("");
  const [targetRateDraft, setTargetRateDraft] = useState("");
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectTab, setInspectTab] = useState<InspectTier>("why");

  // Everything trend-dependent on this screen hangs off one predicate, and it is not
  // `trajectory.length > 1` alone: a batch of readings sharing a single instant has as many
  // filtered points as readings while `span_days` is 0, and the velocity posterior is then
  // exactly the model's prior (ADR-0003). Gating on both is what stops that prior being
  // presented as a rate, an interval, a direction or a projection (`lib/v2/span.ts`).
  const hasSpan = hasEstimatedTrend(analysis);

  const historyRanges = useMemo(
    () => availableHistoryRanges(analysis.span_days),
    [analysis.span_days],
  );
  const historyDays = historyRanges.find((range) => range.id === historyRangeId)?.days ?? null;
  // The forecast window is not a user control in this design: the legend and the tier-2
  // statistics band both name a fixed "Projected, 30 days" figure, so the canvas always draws
  // that same fixed distance ahead (docs/design/09_1B_Implementation_Spec §5.1).
  const forecastDays = FORECAST_WINDOWS.find((w) => w.id === DEFAULT_FORECAST_WINDOW_ID)?.days ?? 30;

  const fullSeries = useMemo(() => buildChartSeries(analysis), [analysis]);
  const series = useMemo(
    () => windowSeries(fullSeries, { historyDays, forecastDays }),
    [fullSeries, historyDays, forecastDays],
  );
  const points = useMemo(() => buildInspectionPoints(series), [series]);

  const latest = latestObservation(analysis);

  // Both fields are typed in whichever unit is currently displayed; converting to kilograms
  // before handing off to `lib/v2/goal.ts` keeps that module's own bounds-checking as the one
  // place a draft is validated, rather than duplicating it per unit.
  const goalKg = parseGoalWeightKg(convertDraftToKg(goalDraft, unit));
  const targetRateKg = parseTargetWeeklyRateKg(convertDraftToKg(targetRateDraft, unit));

  function changeHistoryRange(id: string) {
    setHistoryRangeId(id as HistoryRangeId);
    setInspectIndex(null);
  }

  function openInspect() {
    setInspectOpen(true);
    setInspectTab("why");
  }

  const current = analysis.current;
  const asOfLabel = `as of ${formatFullDate(new Date(current.timestamp))}, ${formatTimeOfDay(new Date(current.timestamp))}`;

  const goalControl = (
    <V2GoalControl
      currentTrendKg={current.w_kg}
      currentWeeklyRateKg={current.weekly_rate_kg}
      hasSpan={hasSpan}
      unit={unit}
      targetDraft={goalDraft}
      onTargetDraftChange={setGoalDraft}
      targetRateDraft={targetRateDraft}
      onTargetRateDraftChange={setTargetRateDraft}
      targetKg={goalKg}
      targetRateKg={targetRateKg}
      onClear={() => {
        setGoalDraft("");
        setTargetRateDraft("");
      }}
    />
  );

  return (
    <div className={styles.workspace}>
      <div className={styles.main}>
        <div className={styles.mainStack}>
          {hasSpan ? (
            <>
              <V2Hero current={current} unit={unit} asOfLabel={asOfLabel} />

              <V2Canvas
                series={series}
                points={points}
                inspectIndex={inspectIndex}
                onInspect={setInspectIndex}
                unit={unit}
                current={{
                  weightKg: current.w_kg,
                  lowerKg: current.w_lower95,
                  upperKg: current.w_upper95,
                  timestamp: new Date(current.timestamp),
                  readingKg: latest?.readingKg ?? null,
                }}
                goalKg={goalKg}
                historyRanges={historyRanges}
                historyRangeId={historyRangeId}
                onHistoryRangeChange={changeHistoryRange}
              />
            </>
          ) : (
            <NoSpanContent analysis={analysis} unit={unit} />
          )}

          <V2Summary analysis={analysis} unit={unit} hasSpan={hasSpan} goal={goalControl} />

          {hasSpan ? (
            <>
              <V2StatsBand analysis={analysis} unit={unit} />

              <V2Inspector hasSpan={hasSpan} onOpen={openInspect} />
            </>
          ) : null}
        </div>
      </div>

      {hasSpan && inspectOpen ? (
        <V2InspectPanel
          analysis={analysis}
          unit={unit}
          tab={inspectTab}
          onTabChange={setInspectTab}
          onClose={() => setInspectOpen(false)}
        />
      ) : null}
    </div>
  );
}

/** A drafted number, in whichever unit is displayed, as a kilogram string `lib/v2/goal.ts` can parse. */
function convertDraftToKg(draft: string, unit: DisplayUnit): string {
  const trimmed = draft.trim();
  if (trimmed === "") {
    return "";
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? String(convertToKg(parsed, unit)) : "";
}

/**
 * The "no-span" state: a series with no elapsed interval for the filter to estimate a rate
 * across. `span_days` is elapsed days from the first observation to the last
 * (`backend/app/core/analyse.py`), so it reaches zero three ways -- no readings, one reading,
 * or a batch of readings all recorded at the same instant -- and each gets its own sentence
 * rather than a plural that only fits one of them.
 *
 * No trajectory, no rate, no rate interval and no projection are drawn or invented here
 * (docs/design/09_1B_Implementation_Spec §7). The estimated *weight* is not disowned: it is the
 * honest posterior at any observation count, which is why `V2Summary` below still sets the
 * latest reading against it.
 */
function NoSpanContent({ analysis, unit }: { analysis: AnalysisResponse; unit: DisplayUnit }) {
  const count = analysis.observations.length;

  return (
    <div className={styles.noSpan}>
      <div className={styles.noSpanIntro}>
        <span className={styles.noSpanEyebrow}>Estimated trend weight</span>
        <h2 className={styles.noSpanTitle}>Trend not established yet.</h2>
        <p className={styles.noSpanBody}>
          {count === 0
            ? "There are no readings yet, so there is nothing to estimate a trajectory from: no trajectory, no rate, no interval around a rate and no projection are produced, and this screen draws none of them."
            : count === 1
              ? "There is one reading so far, so no time has elapsed across the series: no trajectory, no rate, no interval around a rate and no projection are produced, and this screen draws none of them."
              : "Every reading here carries the same timestamp, so no time has elapsed across the series: no trajectory, no rate, no interval around a rate and no projection are produced, and this screen draws none of them."}
        </p>
        <p className={styles.noSpanBodyQuiet}>
          As soon as the readings are spread across time, the filter has an interval to estimate a
          rate over. The chart, the rate and Inspect analysis appear at that point, not before.
        </p>
      </div>

      <div className={styles.noSpanReadings}>
        <span className={styles.noSpanEyebrow}>Readings so far</span>
        {count > 0 ? (
          <ul className={styles.noSpanList}>
            {/* Keyed by position, not timestamp: this state exists precisely because several
                readings can share one instant, so a timestamp is not a unique key here. */}
            {analysis.observations.map((observation, index) => (
              <li key={`${observation.timestamp}-${index}`} className={styles.noSpanRow}>
                <span>{formatFullDate(new Date(observation.timestamp))}</span>
                <span className={styles.noSpanReading}>
                  {formatWeightUnit(observation.weight_kg, unit)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.noSpanBody}>
            The first reading appears here as soon as it is logged. Nothing is estimated from it
            on its own.
          </p>
        )}
      </div>
    </div>
  );
}
