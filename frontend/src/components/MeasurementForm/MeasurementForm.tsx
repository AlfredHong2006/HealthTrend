"use client";

import { useRef, useState, type FormEvent } from "react";
import { datetimeLocalToUtcIso } from "@/lib/time";
import type { ObservationIn } from "@/lib/api/types";
import styles from "./MeasurementForm.module.css";

interface DraftRow {
  id: number;
  datetimeLocal: string;
  weight: string;
}

interface MeasurementFormProps {
  onSubmit: (observations: ObservationIn[]) => void;
  submitting: boolean;
  submitError: string | null;
  /**
   * Called whenever a row or the unit changes. The parent owns any analysis result derived
   * from an earlier submission and only it can invalidate that; this form only knows that
   * its inputs no longer match what was submitted. Optional because the form is usable on
   * its own; `CsvImport` makes the same prop required for the same reason.
   */
  onInputsChanged?: () => void;
}

function emptyRow(id: number): DraftRow {
  return { id, datetimeLocal: "", weight: "" };
}

/**
 * Add, edit and remove measurement rows, entirely client-side, then hand a validated batch
 * up to the caller in one submission. One unit selector governs the whole batch, rather than
 * per row: realistically one person weighs in on one scale in one sitting, and the API is
 * satisfied either way since every {@link ObservationIn} carries its own `unit`.
 *
 * A row with both fields left blank is silently dropped rather than treated as an error, so
 * an unused trailing row does not block submission; a row with only one field filled is a
 * validation error, since that is data the user meant to enter but left incomplete.
 */
export function MeasurementForm({
  onSubmit,
  submitting,
  submitError,
  onInputsChanged,
}: MeasurementFormProps) {
  const nextId = useRef(1);
  const [rows, setRows] = useState<DraftRow[]>([emptyRow(0)]);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [validationError, setValidationError] = useState<string | null>(null);

  function updateRow(id: number, patch: Partial<Omit<DraftRow, "id">>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    onInputsChanged?.();
  }

  function addRow() {
    setRows((current) => [...current, emptyRow(nextId.current++)]);
    onInputsChanged?.();
  }

  function removeRow(id: number) {
    setRows((current) => current.filter((row) => row.id !== id));
    onInputsChanged?.();
  }

  function selectUnit(next: "kg" | "lb") {
    setUnit(next);
    onInputsChanged?.();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setValidationError(null);

    const observations: ObservationIn[] = [];
    for (const [index, row] of rows.entries()) {
      const datetimeLocal = row.datetimeLocal.trim();
      const weightText = row.weight.trim();
      if (datetimeLocal === "" && weightText === "") {
        continue; // an unused row is not an error
      }

      const timestamp = datetimeLocalToUtcIso(datetimeLocal);
      if (timestamp === null) {
        setValidationError(`Row ${index + 1}: enter a complete date and time.`);
        return;
      }

      const weight = Number.parseFloat(weightText);
      if (!Number.isFinite(weight) || weight <= 0) {
        setValidationError(`Row ${index + 1}: enter a weight greater than zero.`);
        return;
      }

      observations.push({ timestamp, weight, unit });
    }

    if (observations.length === 0) {
      setValidationError("Add at least one measurement.");
      return;
    }

    onSubmit(observations);
  }

  const displayedError = validationError ?? submitError;

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      aria-label="Enter your measurements"
      noValidate
    >
      <div className={styles.unitRow}>
        <span className={styles.unitLabel} id="unit-label">
          Unit
        </span>
        <div role="radiogroup" aria-labelledby="unit-label" className={styles.unitGroup}>
          {(["kg", "lb"] as const).map((option) => (
            <label key={option} className={styles.unitOption}>
              <input
                type="radio"
                name="unit"
                value={option}
                checked={unit === option}
                onChange={() => selectUnit(option)}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      <ul className={styles.rows}>
        {rows.map((row, index) => (
          <li key={row.id} className={styles.row}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Date and time</span>
              <input
                type="datetime-local"
                autoComplete="off"
                value={row.datetimeLocal}
                onChange={(event) => updateRow(row.id, { datetimeLocal: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Weight ({unit})</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                autoComplete="off"
                value={row.weight}
                onChange={(event) => updateRow(row.id, { weight: event.target.value })}
              />
            </label>
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => removeRow(row.id)}
              disabled={rows.length === 1}
              aria-label={`Remove row ${index + 1}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        <button type="button" className={styles.addButton} onClick={addRow}>
          Add another measurement
        </button>
        <button type="submit" className={styles.submitButton} disabled={submitting}>
          {submitting ? "Analysing…" : "Analyse"}
        </button>
      </div>

      {displayedError && (
        <p role="alert" className={styles.error}>
          {displayedError}
        </p>
      )}
    </form>
  );
}
