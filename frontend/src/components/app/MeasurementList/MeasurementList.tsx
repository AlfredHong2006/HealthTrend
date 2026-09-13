"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { MeasurementFields } from "@/components/app/QuickLog/MeasurementFields";
import { deleteMeasurement, getMeasurements, updateMeasurement } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { formatFullDate } from "@/lib/chart/format";
import type { MeasurementOut, ObservationIn } from "@/lib/api/types";
import { formatNumber, formatTimeOfDay } from "@/lib/v2/format";
import { utcIsoToDatetimeLocal } from "@/lib/time";
import styles from "./MeasurementList.module.css";

type ListState =
  | { status: "loading" }
  | { status: "ready"; measurements: MeasurementOut[] }
  | { status: "error"; message: string };

/** At most one row is ever mid-edit or mid-delete-confirmation at a time. */
type RowAction = { id: string; kind: "edit" | "delete" } | null;

const GENERIC_LOAD_ERROR = "Something went wrong loading your measurements.";
const GENERIC_UPDATE_ERROR = "Something went wrong saving that change.";
const GENERIC_DELETE_ERROR = "Something went wrong deleting that reading.";

function readingLabel(measurement: MeasurementOut): string {
  return `${formatNumber(measurement.weight, 1)} ${measurement.unit} reading from ${formatFullDate(
    new Date(measurement.timestamp),
  )}`;
}

/**
 * `/app/measurements`: the authoritative stored history -- `GET /api/me/measurements`, in the
 * backend's own most-recent-first order, with inline edit and delete. No trend, rate or
 * judgement of any reading is computed here; this is a record of what was entered, not a
 * second analysis surface (that stays `V2Workspace`'s job, via `/app`).
 *
 * Edit and delete are both inline, expanding the row itself rather than a modal -- there is no
 * dialog primitive anywhere else in this codebase to reuse, and a backdrop/focus-trap would be
 * more machinery than one list needs. Edit reuses `MeasurementFields`, the same fields and
 * validation `/app/log` uses, pre-populated from the stored row rather than a second form.
 */
export function MeasurementList() {
  const { notifyMeasurementsChanged } = useAccount();
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [action, setAction] = useState<RowAction>(null);
  const [pending, setPending] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  // No synchronous `setState({ status: "loading" })` at the top of this function: the initial
  // `useState` above already covers the one real mount transition, and a re-fetch after an
  // edit or delete reads more calmly as a quiet background update than a flash back to a
  // loading placeholder over a list that is still perfectly valid until the new one lands.
  const load = useCallback(() => {
    getMeasurements()
      .then((list) => setState({ status: "ready", measurements: list.measurements }))
      .catch((error: unknown) => {
        setState({
          status: "error",
          message:
            error instanceof ApiError || error instanceof NetworkError
              ? error.message
              : GENERIC_LOAD_ERROR,
        });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(id: string) {
    setAction({ id, kind: "edit" });
    setRowError(null);
  }

  function startDelete(id: string) {
    setAction({ id, kind: "delete" });
    setRowError(null);
  }

  function cancelAction() {
    if (pending) {
      return;
    }
    setAction(null);
    setRowError(null);
  }

  async function saveEdit(id: string, observation: ObservationIn) {
    if (pending) {
      return;
    }
    setPending(true);
    setRowError(null);
    try {
      await updateMeasurement(id, observation);
      await notifyMeasurementsChanged();
      setAction(null);
      load();
    } catch (error) {
      setRowError(
        error instanceof ApiError || error instanceof NetworkError
          ? error.message
          : GENERIC_UPDATE_ERROR,
      );
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete(id: string) {
    if (pending) {
      return;
    }
    setPending(true);
    setRowError(null);
    try {
      await deleteMeasurement(id);
    } catch (error) {
      // A 404 here means the row is already gone -- a repeated click, or removed elsewhere --
      // which is the outcome the reader wanted anyway. Refreshing the list below shows the
      // truth either way, so this is not reported as a failure.
      if (!(error instanceof ApiError && error.status === 404)) {
        setRowError(
          error instanceof NetworkError || error instanceof ApiError
            ? error.message
            : GENERIC_DELETE_ERROR,
        );
        setPending(false);
        return;
      }
    }
    await notifyMeasurementsChanged();
    setAction(null);
    setPending(false);
    load();
  }

  if (state.status === "loading") {
    return (
      <div className={styles.state} aria-busy="true">
        <p>Loading your measurements…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={styles.state}>
        <h1 className={styles.title}>Your measurements are unavailable</h1>
        <p>{state.message}</p>
      </div>
    );
  }

  if (state.measurements.length === 0) {
    return (
      <div className={styles.state}>
        <h1 className={styles.title}>No measurements are stored yet.</h1>
        <p>Nothing has been logged to this account yet.</p>
        <Link href="/app/log" className={styles.logLink}>
          Log a reading
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Your measurements</h1>
      <ul className={styles.list}>
        {state.measurements.map((measurement) => {
          const label = readingLabel(measurement);
          const isEditing = action?.id === measurement.id && action.kind === "edit";
          const isConfirmingDelete = action?.id === measurement.id && action.kind === "delete";

          return (
            <li key={measurement.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.weight}>
                  {formatNumber(measurement.weight, 1)} {measurement.unit}
                </span>
                <span className={styles.timestamp}>
                  {formatFullDate(new Date(measurement.timestamp))},{" "}
                  {formatTimeOfDay(new Date(measurement.timestamp))}
                  {measurement.source === "csv" ? (
                    <span className={styles.source}> · imported</span>
                  ) : null}
                </span>
              </div>

              {isEditing ? (
                <div className={styles.editWrap}>
                  <MeasurementFields
                    initial={{
                      weightText: String(measurement.weight),
                      unit: measurement.unit,
                      datetimeLocal: utcIsoToDatetimeLocal(measurement.timestamp),
                    }}
                    submitLabel="Save"
                    pendingLabel="Saving…"
                    pending={pending}
                    apiError={rowError}
                    onSubmit={(observation) => void saveEdit(measurement.id, observation)}
                    onCancel={cancelAction}
                  />
                </div>
              ) : isConfirmingDelete ? (
                <div className={styles.confirm}>
                  <p className={styles.confirmText}>Delete the {label}?</p>
                  {rowError ? (
                    <p role="alert" className={styles.error}>
                      {rowError}
                    </p>
                  ) : null}
                  <div className={styles.confirmActions}>
                    <button
                      type="button"
                      onClick={cancelAction}
                      disabled={pending}
                      className={styles.cancel}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmDelete(measurement.id)}
                      disabled={pending}
                      className={styles.confirmDelete}
                    >
                      {pending ? "Deleting…" : "Delete reading"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    onClick={() => startEdit(measurement.id)}
                    aria-label={`Edit ${label}`}
                    className={styles.rowAction}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => startDelete(measurement.id)}
                    aria-label={`Delete ${label}`}
                    className={styles.rowAction}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
