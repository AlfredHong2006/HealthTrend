"use client";

import { useId, useState } from "react";
import { formatWeeklyRateKg, formatWeightKg } from "@/lib/chart/format";
import { formatKgMagnitude, formatSignedRate } from "@/lib/v2/format";
import { compareWeeklyRate, goalDistance } from "@/lib/v2/goal";
import styles from "./V2Summary.module.css";

interface V2GoalControlProps {
  /** The current estimated trend weight the target is measured against. */
  currentTrendKg: number;
  /** The current weekly rate the optional target rate is compared with. */
  currentWeeklyRateKg: number;
  targetDraft: string;
  onTargetDraftChange: (value: string) => void;
  targetRateDraft: string;
  onTargetRateDraftChange: (value: string) => void;
  /** The parsed target, or `null` when the field does not hold a usable number. */
  targetKg: number | null;
  targetRateKg: number | null;
  onClear: () => void;
}

/**
 * The goal reference, and nothing at all until someone asks for one.
 *
 * The prototype opens with no goal: no line on the canvas, no distance, no target field on
 * screen -- just a single restrained control. A goal the product invented and then measured
 * the user against would be a product decision made by a default, and a target nobody chose
 * is not a reference worth drawing.
 *
 * Once a target exists, the two comparisons the honesty ledger permits appear: distance from
 * the current estimate, and the current rate set beside a target rate. There is no ETA, and
 * there cannot be one -- a hitting time needs a distribution the backend does not compute
 * (docs/design/V2_DESIGN.md).
 *
 * The state is ephemeral. It lives in `V2Workspace` for the length of the visit and is written
 * nowhere: no storage, no URL, no backend field.
 */
export function V2GoalControl({
  currentTrendKg,
  currentWeeklyRateKg,
  targetDraft,
  onTargetDraftChange,
  targetRateDraft,
  onTargetRateDraftChange,
  targetKg,
  targetRateKg,
  onClear,
}: V2GoalControlProps) {
  const [editing, setEditing] = useState(false);
  const panelId = useId();
  const weightFieldId = useId();
  const rateFieldId = useId();

  const distance = targetKg === null ? null : goalDistance(currentTrendKg, targetKg);
  const rate = targetRateKg === null ? null : compareWeeklyRate(currentWeeklyRateKg, targetRateKg);
  const untouched = distance === null && !editing && targetDraft.trim() === "";

  // Before anyone has asked for a goal there is no heading, no label and no empty state --
  // one line of text that offers one.
  if (untouched) {
    return (
      <div className={styles.goalIdle}>
        <button
          type="button"
          className={styles.goalAdd}
          aria-expanded={false}
          onClick={() => setEditing(true)}
        >
          + Add a goal
        </button>
      </div>
    );
  }

  return (
    <section className={styles.goal} aria-label="Goal reference">
      <div className={styles.goalHead}>
        <h3 className={styles.goalTitle}>
          Goal reference
          <span className={styles.goalTag}>not saved</span>
        </h3>
        <button
          type="button"
          className={styles.goalToggle}
          aria-expanded={editing}
          aria-controls={editing ? panelId : undefined}
          onClick={() => setEditing((open) => !open)}
        >
          {editing ? "Done" : "Adjust"}
        </button>
      </div>

      {distance === null ? null : (
        <p className={styles.goalReadout}>
          <span className={styles.goalValue}>{formatWeightKg(distance.targetKg)}</span>
          <span className={styles.goalMeta}>
            {distance.direction === "level"
              ? "level with the current estimate"
              : `${formatKgMagnitude(distance.distanceKg)} ${distance.direction} the current estimate`}
          </span>
        </p>
      )}

      {rate === null ? null : (
        <p className={styles.goalRate}>
          <span className={styles.goalRateItem}>
            target {formatWeeklyRateKg(rate.targetKgPerWeek)}
          </span>
          <span className={styles.goalRateItem}>
            current {formatWeeklyRateKg(rate.currentKgPerWeek)}
          </span>
          <span className={styles.goalRateItem}>
            difference {formatSignedRate(rate.differenceKgPerWeek)}
          </span>
        </p>
      )}

      {editing ? (
        <div className={styles.goalForm} id={panelId}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={weightFieldId}>
              Target weight (kg)
            </label>
            <input
              id={weightFieldId}
              className={styles.input}
              type="number"
              inputMode="decimal"
              step="0.1"
              autoFocus
              value={targetDraft}
              onChange={(event) => onTargetDraftChange(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={rateFieldId}>
              Target rate (kg/week, optional)
            </label>
            <input
              id={rateFieldId}
              className={styles.input}
              type="number"
              inputMode="decimal"
              step="0.05"
              value={targetRateDraft}
              onChange={(event) => onTargetRateDraftChange(event.target.value)}
            />
          </div>

          <button
            type="button"
            className={styles.goalClear}
            onClick={() => {
              onClear();
              setEditing(false);
            }}
          >
            Remove goal
          </button>

          <p className={styles.goalNote}>
            Held on this page only. Nothing is saved, and the estimate never sees it — the model
            has no parameter a goal could reach.
          </p>
        </div>
      ) : null}
    </section>
  );
}
