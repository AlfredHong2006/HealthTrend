"use client";

import { useState } from "react";
import { CsvImport } from "@/components/CsvImport/CsvImport";
import { ForecastCallout } from "@/components/ForecastCallout/ForecastCallout";
import { Headline } from "@/components/Headline/Headline";
import { MeasurementForm } from "@/components/MeasurementForm/MeasurementForm";
import { RateReadout } from "@/components/RateReadout/RateReadout";
import { TrendChart } from "@/components/TrendChart/TrendChart";
import { submitAnalysis } from "@/lib/api/browserClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { AnalysisResponse, ObservationIn } from "@/lib/api/types";
import { HEADLINE_FORECAST_HORIZON_DAYS, horizonPoint } from "@/lib/analysis";
import { buildChartSeries } from "@/lib/chart/series";
import styles from "./AnalysisWorkspace.module.css";

const GENERIC_SUBMIT_ERROR = "Something went wrong analysing your measurements.";

type EntryMode = "manual" | "csv";

/**
 * The client-side half of the manual-entry page: entry-mode state, the direct browser call
 * to FastAPI, and rendering whatever it returns. The page itself (`src/app/analyse/page.tsx`)
 * stays a server component holding only static structure and the privacy notice -- this is
 * the one place on this route that needs `useState`, matching this milestone's own
 * justification for a client-side fetch (docs/privacy.md) rather than expanding it further
 * than necessary.
 *
 * `MeasurementForm` and `CsvImport` (M5) are two different ways of arriving at the same
 * `ObservationIn[]`, so both are wired to the identical `handleSubmit` -- CSV import is an
 * adapter in front of the same `POST /api/analyse` call, not a second analysis path, and
 * `AnalysisResult` below (including the `span_days === 0` gate) needs no knowledge of which
 * mode produced its input.
 */
export function AnalysisWorkspace() {
  const [mode, setMode] = useState<EntryMode>("manual");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  function selectMode(next: EntryMode) {
    setMode(next);
    setSubmitError(null);
  }

  return (
    <div className={styles.workspace}>
      <div role="group" aria-label="How to enter measurements" className={styles.modeTabs}>
        <button
          type="button"
          aria-pressed={mode === "manual"}
          className={styles.modeTab}
          onClick={() => {
            selectMode("manual");
          }}
        >
          Manual entry
        </button>
        <button
          type="button"
          aria-pressed={mode === "csv"}
          className={styles.modeTab}
          onClick={() => {
            selectMode("csv");
          }}
        >
          Import CSV
        </button>
      </div>

      {mode === "manual" ? (
        <MeasurementForm onSubmit={handleSubmit} submitting={submitting} submitError={submitError} />
      ) : (
        <CsvImport
          onSubmit={handleSubmit}
          submitting={submitting}
          submitError={submitError}
          onInputsChanged={() => {
            setResult(null);
            setSubmitError(null);
          }}
        />
      )}
      {result && <AnalysisResult result={result} />}
    </div>
  );
}

/**
 * `span_days === 0` covers a single reading and any batch whose entries share one instant
 * alike: in both cases the velocity posterior is exactly the model's prior (ADR-0003), so a
 * rate or a forecast built from it would present the prior as if it were a finding. The
 * estimated weight itself is still the honest posterior at any observation count -- that is
 * `R_0`, the exact result of one Gaussian measurement -- so it renders unconditionally.
 */
function AnalysisResult({ result }: { result: AnalysisResponse }) {
  if (result.span_days === 0) {
    return (
      <section aria-label="Analysis result" className={styles.result}>
        <Headline current={result.current} />
        <p className={styles.notEstablished}>Trend not established yet.</p>
      </section>
    );
  }

  const series = buildChartSeries(result);
  const headlineForecast = horizonPoint(result.forecast, HEADLINE_FORECAST_HORIZON_DAYS);

  return (
    <section aria-label="Analysis result" className={styles.result}>
      <div className={styles.stats}>
        <Headline current={result.current} />
        <RateReadout current={result.current} />
      </div>
      <TrendChart
        series={series}
        summary={{
          currentWeightKg: result.current.w_kg,
          forecastHorizonDays: HEADLINE_FORECAST_HORIZON_DAYS,
          forecastWeightKg: headlineForecast.w_kg,
          forecastLowerKg: headlineForecast.w_lower95,
          forecastUpperKg: headlineForecast.w_upper95,
        }}
      />
      <ForecastCallout forecast={result.forecast} />
    </section>
  );
}
