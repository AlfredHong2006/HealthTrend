"use client";

import { useId, useState } from "react";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { updatePreferences } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { DisplayUnit } from "@/lib/v2/units";
import styles from "./Settings.module.css";

const GENERIC_ERROR = "Something went wrong saving your display unit.";

/**
 * The stored display unit: how weights are shown on Trend and the unit a new reading starts in.
 *
 * Saved as soon as it is chosen (`PUT /api/me/preferences`), then `reloadAccount()` re-reads
 * `GET /api/me` so every consumer sees the authoritative stored value. It changes nothing stored:
 * each reading keeps the unit it was entered in, and the analysis is unaffected.
 */
export function DisplayUnitSetting() {
  const { account, reloadAccount } = useAccount();
  const headingId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current: DisplayUnit = account?.preferences.display_unit ?? "kg";

  async function choose(unit: DisplayUnit) {
    if (saving || unit === current) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePreferences({ display_unit: unit });
      await reloadAccount();
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof NetworkError ? caught.message : GENERIC_ERROR,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Display unit
      </h2>
      <div role="radiogroup" aria-label="Display unit" className={styles.unitGroup}>
        {(["kg", "lb"] as const).map((option) => (
          <label
            key={option}
            className={
              option === current ? `${styles.unitOption} ${styles.unitOptionOn}` : styles.unitOption
            }
          >
            <input
              type="radio"
              name="display-unit"
              value={option}
              checked={current === option}
              disabled={saving}
              onChange={() => void choose(option)}
              className={styles.visuallyHiddenInput}
            />
            {option}
          </label>
        ))}
      </div>
      <p className={styles.note}>
        How weights are shown on Trend, and the unit a new reading starts in. Readings you have
        already stored keep the unit they were entered in, and the estimate itself is unaffected.
      </p>
      {saving ? (
        <p role="status" className={styles.status}>
          Saving…
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
