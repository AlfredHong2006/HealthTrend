"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { CsvImport } from "@/components/CsvImport/CsvImport";
import surface from "@/components/v2/V2AnalyseWorkspace/V2AnalyseWorkspace.module.css";
import { importMeasurementsBatch } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { MeasurementBatchOut, ObservationIn } from "@/lib/api/types";
import styles from "./AccountImport.module.css";

const GENERIC_IMPORT_ERROR = "Something went wrong adding those measurements.";

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/**
 * `/app/import`: an existing CSV into the signed-in account's history.
 *
 * Reading and validating the file is entirely `CsvImport`, unchanged -- the same
 * `POST /api/ingest/csv` parse, size/timezone/unit handling and review report `/v2/analyse`
 * uses. The only difference is what its accepted rows are handed to: here,
 * `POST /api/me/measurements/batch` (`source: "csv"`) instead of an analysis. The backend skips
 * rows already stored for this account; this component reports its counts verbatim and detects
 * nothing itself.
 *
 * The outcome replaces the form rather than navigating away, so the reader always sees what was
 * actually stored before choosing where to go next.
 */
export function AccountImport() {
  const { notifyMeasurementsChanged } = useAccount();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<MeasurementBatchOut | null>(null);

  async function handleSubmit(observations: ObservationIn[]) {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await importMeasurementsBatch(observations);
      await notifyMeasurementsChanged();
      setOutcome(result);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError || error instanceof NetworkError
          ? error.message
          : GENERIC_IMPORT_ERROR,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Import measurements</h1>

      {outcome ? (
        <div className={styles.outcome} role="status">
          <p className={styles.outcomeLine}>
            {outcome.inserted_count === 0
              ? "No new measurements were added."
              : `Added ${outcome.inserted_count} ${plural(outcome.inserted_count, "measurement", "measurements")} to your history.`}
          </p>
          {outcome.skipped_existing_count > 0 ? (
            <p className={styles.outcomeLine}>
              {outcome.skipped_existing_count}{" "}
              {plural(
                outcome.skipped_existing_count,
                "was already stored for this account, so it was",
                "were already stored for this account, so they were",
              )}{" "}
              not added again.
            </p>
          ) : null}
          <div className={styles.actions}>
            <Link href="/app" className={styles.primaryLink}>
              View trend
            </Link>
            <Link href="/app/measurements" className={styles.secondary}>
              View history
            </Link>
            <button type="button" className={styles.secondary} onClick={() => setOutcome(null)}>
              Import another file
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={styles.intro}>
            Accepted rows are added to your signed-in account history. The file is checked with
            the same CSV rules HealthTrend uses everywhere, and you can review what was understood
            before anything is added. A row matching a measurement already stored for this account
            (the same moment and the same weight) is not added again, so importing the same file
            twice adds nothing new.
          </p>
          <div className={surface.formSurface}>
            <CsvImport
              onSubmit={(observations) => void handleSubmit(observations)}
              submitting={submitting}
              submitError={submitError}
              onInputsChanged={() => setSubmitError(null)}
              submitLabel={(count) =>
                `Add ${count} ${plural(count, "measurement", "measurements")} to history`
              }
              submittingLabel="Adding…"
            />
          </div>
        </>
      )}
    </div>
  );
}
