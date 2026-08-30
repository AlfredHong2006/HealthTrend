"use client";

import { useMemo, useState } from "react";
import { V2Canvas } from "@/components/v2/V2Canvas/V2Canvas";
import { V2Inspector } from "@/components/v2/V2Inspector/V2Inspector";
import { V2GoalControl } from "@/components/v2/V2Summary/V2GoalControl";
import { V2Summary } from "@/components/v2/V2Summary/V2Summary";
import { HEADLINE_FORECAST_HORIZON_DAYS, horizonPoint } from "@/lib/analysis";
import { buildChartSeries } from "@/lib/chart/series";
import type { DemoAnalysis } from "@/lib/api/types";
import { parseGoalWeightKg, parseTargetWeeklyRateKg } from "@/lib/v2/goal";
import { buildInspectionPoints } from "@/lib/v2/inspect";
import { latestObservation } from "@/lib/v2/latest";
import {
  availableHistoryRanges,
  DEFAULT_FORECAST_WINDOW_ID,
  DEFAULT_HISTORY_RANGE_ID,
  FORECAST_WINDOWS,
  windowSeries,
  type ForecastWindowId,
  type HistoryRangeId,
} from "@/lib/v2/view";
import styles from "./V2Workspace.module.css";

/**
 * The Annotated Canvas: a persistent analytical canvas beside one analysis rail.
 *
 * All the client state the prototype has lives here -- which view windows are selected, which
 * point the crosshair is on, and the ephemeral goal -- because both halves of the workspace
 * read it and the canvas and rail are meant to move together.
 *
 * The DOM order is the *mobile* order the design direction specifies:
 *
 * ```
 * summary -> chart -> inspection
 * ```
 *
 * Desktop reassembles that same single order into two columns with named grid areas, so the
 * split-pane is a layout of one document rather than a second copy of it: reading order,
 * tab order and screen-reader order stay identical on both, and nothing is rendered twice.
 *
 * The rail is two parts with different jobs. The summary answers what the analysis says and
 * stays on screen; the inspector below it opens one detail tier at a time. Neither carries
 * generic model explanation -- that is the same on every series and lives on `/v2/method`.
 *
 * Nothing here is stored. Goal state is component state for the length of the visit, and there
 * is no goal at all until someone asks for one (docs/privacy.md, and the locked decisions).
 */
export function V2Workspace({ analysis }: { analysis: DemoAnalysis }) {
  const [historyRangeId, setHistoryRangeId] = useState<HistoryRangeId>(DEFAULT_HISTORY_RANGE_ID);
  const [forecastWindowId, setForecastWindowId] =
    useState<ForecastWindowId>(DEFAULT_FORECAST_WINDOW_ID);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const [goalDraft, setGoalDraft] = useState("");
  const [targetRateDraft, setTargetRateDraft] = useState("");

  const historyRanges = useMemo(
    () => availableHistoryRanges(analysis.span_days),
    [analysis.span_days],
  );
  const historyDays = historyRanges.find((range) => range.id === historyRangeId)?.days ?? null;
  const forecastDays =
    FORECAST_WINDOWS.find((window) => window.id === forecastWindowId)?.days ?? 30;

  const fullSeries = useMemo(() => buildChartSeries(analysis), [analysis]);
  const series = useMemo(
    () => windowSeries(fullSeries, { historyDays, forecastDays }),
    [fullSeries, historyDays, forecastDays],
  );
  const points = useMemo(() => buildInspectionPoints(series), [series]);

  const headlineForecast = horizonPoint(analysis.forecast, HEADLINE_FORECAST_HORIZON_DAYS);
  const latest = latestObservation(analysis);

  const goalKg = parseGoalWeightKg(goalDraft);
  const targetRateKg = parseTargetWeeklyRateKg(targetRateDraft);

  // A window change re-slices the arrays, so a held index would point at a different instant.
  // Dropping the crosshair is the honest response: the reader chose a new view, not a new point.
  function changeHistoryRange(id: string) {
    setHistoryRangeId(id as HistoryRangeId);
    setInspectIndex(null);
  }

  function changeForecastWindow(id: string) {
    setForecastWindowId(id as ForecastWindowId);
    setInspectIndex(null);
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.summaryArea} aria-label="Analysis summary">
        <V2Summary analysis={analysis} headlineForecast={headlineForecast} />
        <V2GoalControl
          currentTrendKg={analysis.current.w_kg}
          currentWeeklyRateKg={analysis.current.weekly_rate_kg}
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
      </section>

      <div className={styles.canvasArea}>
        <V2Canvas
          series={series}
          points={points}
          inspectIndex={inspectIndex}
          onInspect={setInspectIndex}
          current={{
            weightKg: analysis.current.w_kg,
            lowerKg: analysis.current.w_lower95,
            upperKg: analysis.current.w_upper95,
            timestamp: new Date(analysis.current.timestamp),
            readingKg: latest?.readingKg ?? null,
          }}
          goalKg={goalKg}
          historyRanges={historyRanges}
          historyRangeId={historyRangeId}
          onHistoryRangeChange={changeHistoryRange}
          forecastWindows={FORECAST_WINDOWS}
          forecastWindowId={forecastWindowId}
          onForecastWindowChange={changeForecastWindow}
        />
      </div>

      <section className={styles.inspectArea} aria-label="Analysis detail">
        <V2Inspector analysis={analysis} />
      </section>
    </div>
  );
}
