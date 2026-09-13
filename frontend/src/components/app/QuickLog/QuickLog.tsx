"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { createMeasurement } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { ObservationIn } from "@/lib/api/types";
import { utcIsoToDatetimeLocal } from "@/lib/time";
import { MeasurementFields } from "./MeasurementFields";
import styles from "./QuickLog.module.css";

const GENERIC_SUBMIT_ERROR = "Something went wrong saving that reading.";

/**
 * `/app/log`: the fast path to today's weigh-in, and the whole point of Stage 5's daily
 * returning-user loop. One field set (`MeasurementFields`), one
 * `POST /api/me/measurements` (bare `ObservationIn`; the backend implies `source: "manual"`
 * for this route on its own), then straight back to `/app` so the reader sees the trajectory
 * move immediately.
 *
 * The unit defaults from the account's own display preference (`MeOut.preferences`), but
 * switching it here is this reading's unit only -- it never calls the preferences endpoint,
 * which is Stage 6 work.
 */
export function QuickLog() {
  const router = useRouter();
  const { account, notifyMeasurementsChanged } = useAccount();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialUnit = account?.preferences.display_unit ?? "kg";
  // Computed once on mount, not re-evaluated every render, so the default doesn't visibly
  // creep forward while the reader is still looking at the form.
  const [initialDatetimeLocal] = useState(() => utcIsoToDatetimeLocal(new Date().toISOString()));

  async function handleSubmit(observation: ObservationIn) {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createMeasurement(observation);
      await notifyMeasurementsChanged();
      router.replace("/app");
    } catch (error) {
      setSubmitError(
        error instanceof ApiError || error instanceof NetworkError
          ? error.message
          : GENERIC_SUBMIT_ERROR,
      );
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Log today&rsquo;s weight</h1>
      <MeasurementFields
        initial={{ weightText: "", unit: initialUnit, datetimeLocal: initialDatetimeLocal }}
        submitLabel="Save"
        pendingLabel="Saving…"
        pending={submitting}
        apiError={submitError}
        onSubmit={(observation) => void handleSubmit(observation)}
      />
    </div>
  );
}
