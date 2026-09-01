"use client";

import { useId, useState } from "react";
import { formatWeeklyRateUnit, formatWeightMagnitudeUnit, formatWeightUnit } from "@/lib/v2/units";
import type { DisplayUnit } from "@/lib/v2/units";
import { compareWeeklyRate, goalDistance } from "@/lib/v2/goal";
import styles from "./V2Summary.module.css";

interface V2GoalControlProps {
  /** The current estimated trend weight the target is measured against. */
  currentTrendKg: number;
  /** The current weekly rate the optional target rate is compared with. */
  currentWeeklyRateKg: number;
  /**
   * Whether an estimated trajectory exists (`lib/v2/span.ts`). Without one the weekly rate is
   * the model's prior rather than a finding about this series, so the target-rate comparison --
   * field and readout alike -- is omitted rather than printed against it.
   */
  hasSpan: boolean;
  unit: DisplayUnit;
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
 * Not part of the frozen 1B Editorial mock: its static preview shows one screen state at a time,
 * and a goal is toggled there as a fixture flag rather than drawn as an editable control. The
 * product definition requires a real one regardless (docs/product/V2_PRODUCT.md, "Goals"), so it
 * keeps the relative placement it has always had -- after the latest reading and before Inspect
 * analysis -- now at the foot of the analysis summary's supporting column rather than in a rail.
 *
 * The prototype opens with no goal: no line on the canvas, no distance, no target field on
 * screen -- just a single restrained control. Once a target exists, the two comparisons the
 * honesty ledger permits appear: distance from the current estimate, and the current rate set
 * beside a target rate. There is no ETA -- a hitting time needs a distribution the backend does
 * not compute (docs/design/V2_DESIGN.md).
 *
 * The distance holds at any observation count -- `current.w_kg` is the honest posterior even
 * from one reading -- but the rate comparison does not: with no elapsed span the weekly rate is
 * still exactly the documented prior, and setting a user's target beside it would present that
 * prior as this series' rate. `hasSpan` therefore removes the target-rate field and its readout
 * altogether rather than showing them empty (docs/product/V2_PRODUCT.md: an unimplemented or
 * unsupported figure is absent, not uncertain).
 *
 * Both fields read and write in whichever unit is currently displayed; `goalDistance` and
 * `compareWeeklyRate` still do their arithmetic in kilograms, so a unit switch never changes what
 * the comparison means, only how it is printed. State is ephemeral: it lives in `V2Workspace` for
 * the length of the visit and is written nowhere.
 */
export function V2GoalControl({
  currentTrendKg,
  currentWeeklyRateKg,
  hasSpan,
  unit,
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
  const rate =
    !hasSpan || targetRateKg === null
      ? null
      : compareWeeklyRate(currentWeeklyRateKg, targetRateKg);
  const untouched = distance === null && !editing && targetDraft.trim() === "";

  // The idle state is one hairline row, label left and affordance right -- the same shape
  // `.goalHead` takes once a goal exists, so the column's rhythm does not change when one is
  // added. A lone button under a rule reads as a fragment with empty space around it; a
  // labelled row reads as a section that happens to be empty.
  if (untouched) {
    return (
      <div className={styles.goalIdle}>
        <span className={styles.eyebrow}>Goal</span>
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
          <span className={styles.goalValue}>{formatWeightUnit(distance.targetKg, unit)}</span>
          <span className={styles.goalMeta}>
            {distance.direction === "level"
              ? "level with the current estimate"
              : `${formatWeightMagnitudeUnit(distance.distanceKg, unit)} ${distance.direction} the current estimate`}
          </span>
        </p>
      )}

      {rate === null ? null : (
        <p className={styles.goalRate}>
          <span className={styles.goalRateItem}>
            target {formatWeeklyRateUnit(rate.targetKgPerWeek, unit)}
          </span>
          <span className={styles.goalRateItem}>
            current {formatWeeklyRateUnit(rate.currentKgPerWeek, unit)}
          </span>
          <span className={styles.goalRateItem}>
            difference {formatWeeklyRateUnit(rate.differenceKgPerWeek, unit)}
          </span>
        </p>
      )}

      {editing ? (
        <div className={styles.goalForm} id={panelId}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={weightFieldId}>
              Target weight ({unit})
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

          {hasSpan ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={rateFieldId}>
                Target rate ({unit}/week, optional)
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
          ) : null}

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
