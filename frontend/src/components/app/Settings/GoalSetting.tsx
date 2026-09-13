"use client";

import { useId, useState, type FormEvent } from "react";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { deleteGoal, updateGoal } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import {
  GOAL_MAX_KG,
  GOAL_MIN_KG,
  parseGoalWeightKg,
  parseTargetWeeklyRateKg,
  TARGET_RATE_LIMIT_KG_PER_WEEK,
} from "@/lib/v2/goal";
import {
  convertKg,
  convertToKg,
  formatWeeklyRateUnit,
  formatWeightUnit,
  type DisplayUnit,
} from "@/lib/v2/units";
import styles from "./Settings.module.css";

const GENERIC_SAVE_ERROR = "Something went wrong saving your goal.";
const GENERIC_REMOVE_ERROR = "Something went wrong removing your goal.";

/** A stored kilogram value as an editable draft in the display unit, at the precision shown. */
function toDraft(kg: number | null, unit: DisplayUnit, fractionDigits: number): string {
  return kg === null ? "" : String(Number(convertKg(kg, unit).toFixed(fractionDigits)));
}

/**
 * Read a draft typed in the display unit through one of `lib/v2/goal.ts`'s own parsers, so its
 * bounds stay the single place a goal value is validated (they match the backend's `GoalIn`).
 * `undefined` means the field is empty; `null` means it holds something unusable.
 */
function readDraft(
  draft: string,
  unit: DisplayUnit,
  parse: (kgText: string) => number | null,
): number | null | undefined {
  const trimmed = draft.trim();
  if (trimmed === "") {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? parse(String(convertToKg(value, unit))) : null;
}

/**
 * The stored goal: an optional target weight and an optional target weekly rate, entered in the
 * display unit and stored in kilograms (`PUT /api/me/goal`, a full replacement), or removed
 * (`DELETE /api/me/goal`). `reloadAccount()` then re-reads `GET /api/me`, which is what Trend
 * displays the goal from.
 *
 * A goal is a reference, nothing more: the analysis never receives it, and nothing derived from
 * it here is an ETA, a probability or a verdict on progress.
 *
 * Keyed on the display unit by its parent, so switching unit re-seeds the drafts from the stored
 * kilogram values rather than leaving numbers typed in the old unit.
 */
export function GoalSetting({ unit }: { unit: DisplayUnit }) {
  const { account, reloadAccount } = useAccount();
  const headingId = useId();
  const weightId = useId();
  const rateId = useId();
  const stored = account?.goal ?? null;

  // The canonical kilogram values this form was seeded from (or last saved/removed), beside the
  // exact rounded text each was shown as. A field whose text still equals its seeded text has not
  // been edited, so its canonical kilograms are sent as they are rather than re-derived from the
  // rounded display text -- otherwise a no-op save in lb would nudge the stored goal each time.
  const [baseline, setBaseline] = useState(() => {
    const weightKg = stored?.target_weight_kg ?? null;
    const rateKg = stored?.target_weekly_rate_kg ?? null;
    return {
      weightKg,
      rateKg,
      weightText: toDraft(weightKg, unit, 1),
      rateText: toDraft(rateKg, unit, 2),
    };
  });
  const [weightDraft, setWeightDraft] = useState(baseline.weightText);
  const [rateDraft, setRateDraft] = useState(baseline.rateText);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const hasStoredGoal =
    stored !== null && (stored.target_weight_kg !== null || stored.target_weekly_rate_kg !== null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setStatus(null);

    const weightUnchanged = weightDraft.trim() === baseline.weightText;
    const rateUnchanged = rateDraft.trim() === baseline.rateText;
    const weightKg = weightUnchanged
      ? (baseline.weightKg ?? undefined)
      : readDraft(weightDraft, unit, parseGoalWeightKg);
    const rateKg = rateUnchanged
      ? (baseline.rateKg ?? undefined)
      : readDraft(rateDraft, unit, parseTargetWeeklyRateKg);

    if (weightKg === undefined && rateKg === undefined) {
      setError("Enter a target weight, a target rate, or both. To clear the goal, use Remove goal.");
      return;
    }
    if (weightKg === null) {
      setError(
        `Enter a target weight between ${formatWeightUnit(GOAL_MIN_KG, unit)} and ${formatWeightUnit(GOAL_MAX_KG, unit)}.`,
      );
      return;
    }
    if (rateKg === null) {
      setError(
        `Enter a target rate between ${formatWeeklyRateUnit(-TARGET_RATE_LIMIT_KG_PER_WEEK, unit)} and ${formatWeeklyRateUnit(TARGET_RATE_LIMIT_KG_PER_WEEK, unit)}.`,
      );
      return;
    }
    if (weightUnchanged && rateUnchanged) {
      setStatus("No changes to save.");
      return;
    }

    setPending(true);
    try {
      await updateGoal({
        target_weight_kg: weightKg ?? null,
        target_weekly_rate_kg: rateKg ?? null,
      });
      setBaseline({
        weightKg: weightKg ?? null,
        rateKg: rateKg ?? null,
        weightText: weightDraft.trim(),
        rateText: rateDraft.trim(),
      });
      await reloadAccount();
      setStatus("Goal saved.");
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof NetworkError
          ? caught.message
          : GENERIC_SAVE_ERROR,
      );
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      await deleteGoal();
      setBaseline({ weightKg: null, rateKg: null, weightText: "", rateText: "" });
      await reloadAccount();
      setWeightDraft("");
      setRateDraft("");
      setStatus("Goal removed.");
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof NetworkError
          ? caught.message
          : GENERIC_REMOVE_ERROR,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Goal
      </h2>
      <p className={styles.note}>
        {hasStoredGoal
          ? "Shown on Trend as a reference beside the estimate."
          : "No goal is set. A goal is optional and is shown on Trend as a reference beside the estimate."}{" "}
        It is never used in the estimate.
      </p>

      <form onSubmit={(event) => void handleSave(event)} noValidate>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor={weightId} className={styles.fieldLabel}>
              Target weight ({unit}, optional)
            </label>
            <input
              id={weightId}
              type="number"
              inputMode="decimal"
              step="0.1"
              autoComplete="off"
              value={weightDraft}
              onChange={(event) => setWeightDraft(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={rateId} className={styles.fieldLabel}>
              Target rate ({unit}/week, optional)
            </label>
            <input
              id={rateId}
              type="number"
              inputMode="decimal"
              step="0.05"
              autoComplete="off"
              value={rateDraft}
              onChange={(event) => setRateDraft(event.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.actions} style={{ marginTop: "var(--v2-space-5)" }}>
          <button type="submit" className={styles.primary} disabled={pending}>
            {pending ? "Saving…" : "Save goal"}
          </button>
          {hasStoredGoal ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void handleRemove()}
              disabled={pending}
            >
              Remove goal
            </button>
          ) : null}
        </div>
      </form>

      {status ? (
        <p role="status" className={styles.status}>
          {status}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
