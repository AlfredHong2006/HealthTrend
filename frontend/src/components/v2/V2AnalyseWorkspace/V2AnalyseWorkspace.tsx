"use client";

import { useState } from "react";
import { V2Header } from "@/components/v2/V2Header/V2Header";
import { V2Workspace } from "@/components/v2/V2Workspace/V2Workspace";
import { CsvImport } from "@/components/CsvImport/CsvImport";
import { MeasurementForm } from "@/components/MeasurementForm/MeasurementForm";
import { submitAnalysis } from "@/lib/api/browserClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { AnalysisResponse, ObservationIn } from "@/lib/api/types";
import { DEFAULT_DISPLAY_UNIT, type DisplayUnit } from "@/lib/v2/units";
import styles from "./V2AnalyseWorkspace.module.css";

const GENERIC_SUBMIT_ERROR = "Something went wrong analysing your measurements.";

type EntryMode = "manual" | "csv";

/**
 * "Analyse your data": the real-user entry point the 1B Editorial redesign had stopped
 * exposing. This reuses V1's proven ingestion path exactly -- `MeasurementForm`, `CsvImport`,
 * `submitAnalysis` and `ingestCsv` (via `CsvImport` itself) are the same components and the same
 * `POST /api/analyse` / `POST /api/ingest/csv` calls `src/components/AnalysisWorkspace` already
 * uses -- so every current ingestion behaviour (validation, kg/lb entry, timezone and DST
 * handling in `lib/time.ts`, and error reporting) is unchanged and not duplicated here.
 *
 * The one real difference from `AnalysisWorkspace` is what renders the result: once
 * `submitAnalysis` returns, this hands the plain `AnalysisResponse` to `V2Workspace` -- the same
 * component a synthetic scenario renders through -- so real data gets the identical hero, chart,
 * statistics band, summary and Inspect analysis tiers, with a real kg/lb toggle in the header. No
 * backend contract changes: `AnalysisResponse` is the wire shape already, unmodified.
 */
export function V2AnalyseWorkspace() {
  const [mode, setMode] = useState<EntryMode>("manual");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [unit, setUnit] = useState<DisplayUnit>(DEFAULT_DISPLAY_UNIT);

  async function handleSubmit(observations: ObservationIn[]) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await submitAnalysis({ observations, forecast_from: "now" });
      setResult(response);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError || error instanceof NetworkError
          ? error.message
          : GENERIC_SUBMIT_ERROR,
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Switching mode, or editing the inputs of either mode, discards any result on screen: a
  // result must never outlive the inputs it was produced from (docs/privacy.md), and V2Workspace
  // must never render stale data alongside a form the reader is actively changing.
  function invalidateResult() {
    setResult(null);
    setSubmitError(null);
  }

  function selectMode(next: EntryMode) {
    setMode(next);
    invalidateResult();
  }

  return (
    <>
      <V2Header
        current="analyse"
        meta={result?.meta}
        unit={result ? unit : undefined}
        onUnitChange={result ? setUnit : undefined}
      />

      {result ? (
        <>
          <V2Workspace analysis={result} unit={unit} />

          {/* The way back to the form. Without it the only route from a result to a new one is
              a hard reload: /v2/analyse is already the current route, so the masthead's own
              "Analyse your data" link is a same-route navigation that reconciles rather than
              remounting this component, and the result simply stays on screen.
              It reuses `invalidateResult` rather than introducing a second reset path, so
              returning here is exactly what editing an input already does -- the result is
              dropped, nothing is retained, and the entry column comes back in whichever mode
              was last chosen. */}
          <div className={styles.restart}>
            <button type="button" className={styles.restartAction} onClick={invalidateResult}>
              Analyse different data
            </button>
          </div>
        </>
      ) : (
        <div className={styles.entry}>
          <div className={styles.intro}>
            <span className={styles.eyebrow}>Analyse your data</span>
            <h2 className={styles.title}>Estimate the trend behind your own readings.</h2>
            <p className={styles.privacy}>
              Your measurements are sent to the HealthTrend analysis service for this analysis
              and are not stored. They are not saved anywhere in this browser either, so nothing
              is here if you reload or come back later. Importing a CSV file works the same way:
              the file is read once, to produce measurements for this analysis, and is not kept
              afterwards.
            </p>
          </div>

          <div role="group" aria-label="How to enter measurements" className={styles.modeTabs}>
            <button
              type="button"
              aria-pressed={mode === "manual"}
              className={styles.modeTab}
              onClick={() => selectMode("manual")}
            >
              Manual entry
            </button>
            <button
              type="button"
              aria-pressed={mode === "csv"}
              className={styles.modeTab}
              onClick={() => selectMode("csv")}
            >
              Import CSV
            </button>
          </div>

          {/* The wrapper exists only to open a token scope: it re-declares V1's `--ht-*`
              properties in the 1B Editorial palette so the two reused ingestion components stop
              rendering in V1's (dark-capable) skin. Deliberately a remap rather than a V2 copy
              of either component -- the entry path, validation, unit handling and error
              reporting stay in one implementation, and nothing here can change what is
              submitted. Full reasoning in `V2AnalyseWorkspace.module.css`. */}
          <div className={styles.formSurface}>
            {mode === "manual" ? (
              <MeasurementForm
                onSubmit={handleSubmit}
                submitting={submitting}
                submitError={submitError}
                onInputsChanged={invalidateResult}
              />
            ) : (
              <CsvImport
                onSubmit={handleSubmit}
                submitting={submitting}
                submitError={submitError}
                onInputsChanged={invalidateResult}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
