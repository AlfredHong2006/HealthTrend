"use client";

import { useId, useState } from "react";
import { getAccountJsonExport, getMeasurementsCsvExport } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import styles from "./Settings.module.css";

type ExportKind = "csv" | "json";

const EXPORTS: Record<ExportKind, { fetch: () => Promise<Blob>; filename: string }> = {
  csv: { fetch: getMeasurementsCsvExport, filename: "healthtrend-measurements.csv" },
  json: { fetch: getAccountJsonExport, filename: "healthtrend-account-export.json" },
};

const GENERIC_ERROR = "Something went wrong preparing that export.";

/**
 * Hand a fetched file body to the browser as a download, then let go of it. The object URL is
 * revoked straight away and the blob is not kept anywhere in the app -- this is a download the
 * reader asked for, not application state.
 */
function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * The two exports, kept distinct because they answer different needs.
 *
 * Both are fetched with the session cookie and saved as files rather than linked: the JSON
 * endpoint sends no `Content-Disposition`, so a link would open raw JSON on the API origin, and
 * fetching both keeps a failure (a lapsed session, an outage) as a readable message on this page
 * rather than an error document in a new tab.
 */
export function ExportSetting() {
  const headingId = useId();
  const [pending, setPending] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(kind: ExportKind) {
    if (pending) {
      return;
    }
    setPending(kind);
    setError(null);
    try {
      const blob = await EXPORTS[kind].fetch();
      saveFile(blob, EXPORTS[kind].filename);
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof NetworkError ? caught.message : GENERIC_ERROR,
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Data export
      </h2>

      <div className={styles.exportItem}>
        <button
          type="button"
          className={styles.secondary}
          style={{ alignSelf: "flex-start" }}
          onClick={() => void download("csv")}
          disabled={pending !== null}
        >
          {pending === "csv" ? "Preparing…" : "Download measurements (CSV)"}
        </button>
        <p className={styles.note}>
          Your stored measurements only — timestamp, weight and unit — in a file HealthTrend can
          import again. It does not include your goal or settings.
        </p>
      </div>

      <div className={styles.exportItem}>
        <button
          type="button"
          className={styles.secondary}
          style={{ alignSelf: "flex-start" }}
          onClick={() => void download("json")}
          disabled={pending !== null}
        >
          {pending === "json" ? "Preparing…" : "Download account data (JSON)"}
        </button>
        <p className={styles.note}>
          A versioned file of the account data HealthTrend stores for you: your account details,
          display preference, goal and every measurement.
        </p>
      </div>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
