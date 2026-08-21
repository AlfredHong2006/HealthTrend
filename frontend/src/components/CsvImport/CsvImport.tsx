"use client";

import { useState, type ChangeEvent } from "react";
import { ingestCsv } from "@/lib/api/browserClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { CsvIngestResponse, ObservationIn } from "@/lib/api/types";
import { formatWeightKg } from "@/lib/chart/format";
import { canonicalizeTimeZone, detectLocalTimeZone } from "@/lib/time";
import styles from "./CsvImport.module.css";

/** Mirrors `MAX_CSV_BYTES` in `backend/app/schemas/ingestion.py`. The backend enforces this
 * for real, with a capped stream read; this check only avoids an obviously-doomed upload. */
const MAX_CSV_BYTES = 2 * 1024 * 1024;

const PREVIEW_ROW_LIMIT = 20;
const ISSUE_DISPLAY_LIMIT = 100;

const GENERIC_PARSE_ERROR = "Something went wrong reading that file.";

interface CsvImportProps {
  onSubmit: (observations: ObservationIn[]) => void;
  submitting: boolean;
  submitError: string | null;
  /**
   * Called whenever the file, timezone, or default unit changes after a read -- even one
   * that was never submitted. The parent owns any analysis result derived from a previous
   * read (`AnalysisWorkspace`'s `result`), and only it can invalidate that; this component
   * only knows that its own inputs, and therefore its own report, are now stale.
   */
  onInputsChanged: () => void;
}

/**
 * Read a CSV file, show what was understood and what wasn't, then hand the accepted
 * measurements to the same submission path {@link MeasurementForm} uses. Reading the file
 * (`POST /api/ingest/csv`) and analysing it (`POST /api/analyse`, via `onSubmit`) are two
 * separate steps on purpose: the parse report is a review checkpoint, and `accepted` is
 * already shaped as `ObservationIn`, so `onSubmit` needs no conversion (ADR-0010).
 *
 * Changing the file, the timezone, or the unit after a successful read immediately discards
 * that read: the report and the "Analyse" action must never reflect settings the caller has
 * since changed, and neither must any analysis result already produced from the old read
 * (via `onInputsChanged`).
 */
export function CsvImport({ onSubmit, submitting, submitError, onInputsChanged }: CsvImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [assumedTimezone, setAssumedTimezone] = useState(() => detectLocalTimeZone());
  const [defaultUnit, setDefaultUnit] = useState<"kg" | "lb">("kg");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<CsvIngestResponse | null>(null);

  function invalidateResult() {
    setResult(null);
    setParseError(null);
    onInputsChanged();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    invalidateResult();
  }

  function handleTimezoneChange(event: ChangeEvent<HTMLInputElement>) {
    setAssumedTimezone(event.target.value);
    invalidateResult();
  }

  function handleUnitChange(unit: "kg" | "lb") {
    setDefaultUnit(unit);
    invalidateResult();
  }

  async function handleImport() {
    if (!file) {
      setParseError("Choose a CSV file.");
      return;
    }
    const canonicalTimezone = canonicalizeTimeZone(assumedTimezone);
    if (!canonicalTimezone) {
      setParseError("Enter a valid timezone, for example Europe/London.");
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setParseError(`That file is larger than the ${MAX_CSV_BYTES / (1024 * 1024)} MB limit.`);
      return;
    }

    setParsing(true);
    setParseError(null);
    try {
      // Sent and shown in its canonical IANA form: the browser accepts "america/new_york"
      // case-insensitively, but the backend's zoneinfo lookup does not, so a value the
      // browser considers valid must not reach it in an arbitrarily-cased form.
      const response = await ingestCsv(file, { assumedTimezone: canonicalTimezone, defaultUnit });
      setAssumedTimezone(canonicalTimezone);
      setResult(response);
    } catch (error) {
      setParseError(
        error instanceof ApiError || error instanceof NetworkError
          ? error.message
          : GENERIC_PARSE_ERROR,
      );
    } finally {
      setParsing(false);
    }
  }

  function handleAnalyse() {
    if (result) {
      onSubmit(result.accepted);
    }
  }

  const displayedError = parseError ?? submitError;

  return (
    <section aria-label="Import measurements from a CSV file" className={styles.import}>
      <div className={styles.controls}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Timezone for dates without one</span>
          <input
            type="text"
            autoComplete="off"
            placeholder="Europe/London"
            value={assumedTimezone}
            onChange={handleTimezoneChange}
          />
        </label>

        <div className={styles.unitRow}>
          <span className={styles.unitLabel} id="csv-default-unit-label">
            Default unit
          </span>
          <div
            role="radiogroup"
            aria-labelledby="csv-default-unit-label"
            className={styles.unitGroup}
          >
            {(["kg", "lb"] as const).map((option) => (
              <label key={option} className={styles.unitOption}>
                <input
                  type="radio"
                  name="csv-default-unit"
                  value={option}
                  checked={defaultUnit === option}
                  onChange={() => {
                    handleUnitChange(option);
                  }}
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        <p className={styles.hint}>
          Rows with no timezone are interpreted as {assumedTimezone || "the timezone above"}, and
          a date with no time as 12:00 in that timezone. The default unit applies to a weight
          column with no unit of its own. CSV files must be UTF-8.
        </p>

        <button
          type="button"
          className={styles.importButton}
          onClick={handleImport}
          disabled={parsing}
        >
          {parsing ? "Reading file…" : "Read file"}
        </button>
      </div>

      {displayedError && (
        <p role="alert" className={styles.error}>
          {displayedError}
        </p>
      )}

      {result && (
        <div className={styles.report}>
          <p role="status" className={styles.summary}>
            {summaryText(result)}
          </p>

          {result.rejected.length > 0 && (
            <div className={styles.issuesWrapper}>
              <h3 className={styles.issuesHeading}>Rows that need fixing</h3>
              <ul className={styles.issues}>
                {result.rejected.slice(0, ISSUE_DISPLAY_LIMIT).map((issue, index) => (
                  <li key={`${issue.line}-${index}`}>
                    Line {issue.line}: {issue.message}
                  </li>
                ))}
              </ul>
              {result.rejected.length > ISSUE_DISPLAY_LIMIT && (
                <p className={styles.issuesMore}>
                  …and {result.rejected.length - ISSUE_DISPLAY_LIMIT} more not shown here.
                </p>
              )}
              {result.issues_truncated && (
                <p className={styles.issuesMore}>
                  {result.rejected_count} rows were rejected in total; fix the source file to see
                  the rest.
                </p>
              )}
            </div>
          )}

          {result.accepted.length > 0 && (
            <div className={styles.previewWrapper}>
              <table className={styles.preview}>
                <caption className={styles.previewCaption}>
                  First {Math.min(PREVIEW_ROW_LIMIT, result.accepted.length)} of{" "}
                  {result.accepted_count} measurements to import
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date and time</th>
                    <th scope="col">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {result.accepted.slice(0, PREVIEW_ROW_LIMIT).map((observation, index) => (
                    <tr key={index}>
                      <td>{new Date(observation.timestamp).toLocaleString()}</td>
                      {/* accepted observations are always kg (services/ingestion.py); the
                          raw value can carry lb-conversion float noise (e.g.
                          70.00018890788002), which formatWeightKg's one-decimal-place
                          rounding is presentation only -- the value sent to /api/analyse
                          in `result.accepted` is untouched, full precision. */}
                      <td>{formatWeightKg(observation.weight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            className={styles.submitButton}
            onClick={handleAnalyse}
            disabled={submitting || result.accepted_count === 0}
          >
            {submitting
              ? "Analysing…"
              : `Analyse ${result.accepted_count} measurement${result.accepted_count === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </section>
  );
}

function summaryText(result: CsvIngestResponse): string {
  const parts = [`${result.accepted_count} accepted`];
  if (result.rejected_count > 0) {
    parts.push(`${result.rejected_count} skipped`);
  }
  if (result.duplicate_count > 0) {
    const plural = result.duplicate_count === 1 ? "" : "s";
    parts.push(`${result.duplicate_count} exact duplicate${plural} retained as repeated measurements`);
  }
  if (result.blank_rows_skipped > 0) {
    const plural = result.blank_rows_skipped === 1 ? "" : "s";
    parts.push(`${result.blank_rows_skipped} blank row${plural} ignored`);
  }
  return `${parts.join(", ")}.`;
}
