"use client";

import { useId, useState, type FormEvent } from "react";
import { datetimeLocalToUtcIso } from "@/lib/time";
import type { ObservationIn } from "@/lib/api/types";
import type { DisplayUnit } from "@/lib/v2/units";
import styles from "./MeasurementFields.module.css";

export interface MeasurementFieldsValues {
  weightText: string;
  unit: DisplayUnit;
  /** A `datetime-local` input's own value shape (`YYYY-MM-DDTHH:mm`), already in local time. */
  datetimeLocal: string;
}

interface MeasurementFieldsProps {
  initial: MeasurementFieldsValues;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  /** The caller's own API-side error, shown alongside (never in place of) a local validation
   * error -- the two can never both be relevant at once, since a local validation failure
   * never reaches the network. */
  apiError: string | null;
  onSubmit: (observation: ObservationIn) => void;
  /** Present only where cancelling makes sense -- editing a stored reading, not the first
   * entry of a new one. */
  onCancel?: () => void;
}

/**
 * The weight/unit/date-time fields QuickLog (create, `/app/log`) and `MeasurementList`'s
 * inline edit (update, `/app/measurements`) both need, factored out once rather than
 * maintaining two independent validation and UTC-conversion implementations. Mirrors the
 * division of responsibility V1's `MeasurementForm` already uses: this validates locally and
 * hands the caller a ready `ObservationIn`; the caller owns the actual network call, its own
 * pending state and any API-side error.
 *
 * Weight is deliberately never coerced -- an unparsable or non-positive entry is a local
 * validation error, not a silently substituted value. The date/time field reuses
 * `datetimeLocalToUtcIso` unchanged (the same timezone/DST assumptions V1's entry form already
 * accepts), rather than re-deriving the conversion here.
 */
export function MeasurementFields({
  initial,
  submitLabel,
  pendingLabel,
  pending,
  apiError,
  onSubmit,
  onCancel,
}: MeasurementFieldsProps) {
  const weightInputId = useId();
  const [weightText, setWeightText] = useState(initial.weightText);
  const [unit, setUnit] = useState<DisplayUnit>(initial.unit);
  const [datetimeLocal, setDatetimeLocal] = useState(initial.datetimeLocal);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setValidationError(null);

    const trimmed = weightText.trim();
    const weight = Number.parseFloat(trimmed);
    if (trimmed === "" || !Number.isFinite(weight) || weight <= 0) {
      setValidationError("Enter a weight greater than zero.");
      return;
    }

    const timestamp = datetimeLocalToUtcIso(datetimeLocal);
    if (timestamp === null) {
      setValidationError("Enter a complete date and time.");
      return;
    }

    onSubmit({ timestamp, weight, unit });
  }

  const displayedError = validationError ?? apiError;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor={weightInputId} className={styles.fieldLabel}>
          Weight
        </label>
        <div className={styles.weightRow}>
          <input
            id={weightInputId}
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            autoComplete="off"
            value={weightText}
            onChange={(event) => setWeightText(event.target.value)}
            className={styles.weightInput}
          />
          <div role="radiogroup" aria-label="Unit" className={styles.unitGroup}>
            {(["kg", "lb"] as const).map((option) => (
              <label
                key={option}
                className={
                  option === unit ? `${styles.unitOption} ${styles.unitOptionOn}` : styles.unitOption
                }
              >
                <input
                  type="radio"
                  name="unit"
                  value={option}
                  checked={unit === option}
                  onChange={() => setUnit(option)}
                  className={styles.unitRadio}
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Date and time</span>
        <input
          type="datetime-local"
          autoComplete="off"
          value={datetimeLocal}
          onChange={(event) => setDatetimeLocal(event.target.value)}
          className={styles.dateInput}
        />
      </label>

      <div className={styles.actions}>
        {onCancel ? (
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>

      {displayedError ? (
        <p role="alert" className={styles.error}>
          {displayedError}
        </p>
      ) : null}
    </form>
  );
}
