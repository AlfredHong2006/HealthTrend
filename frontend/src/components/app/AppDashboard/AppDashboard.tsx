"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { V2Workspace, type PersistedGoal } from "@/components/v2/V2Workspace/V2Workspace";
import { getAccountAnalysis } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { AnalysisResponse } from "@/lib/api/types";
import { DEFAULT_DISPLAY_UNIT } from "@/lib/v2/units";
import styles from "./AppDashboard.module.css";

type AnalysisState =
  | { status: "loading" }
  | { status: "ready"; analysis: AnalysisResponse }
  | { status: "error"; message: string };

const GENERIC_ANALYSIS_ERROR = "Something went wrong loading your analysis.";

/**
 * `/app`'s content: the account's own trend, through the same `V2Workspace` a synthetic
 * scenario and a submitted-data analysis already render through. `GET /api/me/analysis`
 * answers in the plain `AnalysisResponse` shape (`meta.source` reads `"account"`), so this
 * needed no new renderer and no prop change to `V2Workspace` at all.
 *
 * At zero stored measurements this deliberately renders no analysis and makes no request:
 * `V2Workspace`'s no-span state exists to describe a real, if inconclusive, filter result --
 * not an account that has never produced one. Checking `measurement_count` first (from the
 * `AccountProvider` result already in hand, not a second `/api/me`) is what keeps this screen
 * from describing an analysis that never ran, and from needlessly hitting the 422
 * `GET /api/me/analysis` would otherwise return for an empty account.
 */
export function AppDashboard() {
  const { account, dataVersion } = useAccount();
  // The account's stored display preference, chosen in Settings. Presentation only: every value
  // in `analysis` stays in kilograms, and changing it never refetches the analysis.
  const unit = account?.preferences.display_unit ?? DEFAULT_DISPLAY_UNIT;
  // The stored goal, handed to `V2Workspace` for display. It is read from `MeOut` alone and is
  // never part of the analysis request below -- the backend has no parameter it could reach.
  const persistedGoal: PersistedGoal = {
    targetKg: account?.goal?.target_weight_kg ?? null,
    targetRateKg: account?.goal?.target_weekly_rate_kg ?? null,
    manageHref: "/app/settings",
  };
  const [state, setState] = useState<AnalysisState>({ status: "loading" });

  const measurementCount = account?.measurement_count ?? 0;

  useEffect(() => {
    if (measurementCount === 0) {
      return;
    }
    // No synchronous `setState({ status: "loading" })` here: the initial value above already
    // covers the one real transition (mount -> first fetch). Re-runs after that -- `dataVersion`
    // changing after a Stage 5 mutation -- fetch quietly in the background and swap in the
    // result once it lands, rather than flashing back to the loading state over an analysis
    // that is still perfectly valid until the new one arrives.
    let cancelled = false;
    getAccountAnalysis()
      .then((analysis) => {
        if (!cancelled) setState({ status: "ready", analysis });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            error instanceof ApiError || error instanceof NetworkError
              ? error.message
              : GENERIC_ANALYSIS_ERROR,
        });
      });
    return () => {
      cancelled = true;
    };
    // `dataVersion` is Stage 5's invalidation signal (`AccountProvider.notifyMeasurementsChanged`):
    // it forces this refetch even when `measurementCount` itself hasn't changed, e.g. an edit.
  }, [measurementCount, dataVersion]);

  if (measurementCount === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.eyebrow}>Estimated trend weight</span>
        <h1 className={styles.title}>No measurements are stored yet.</h1>
        <p className={styles.body}>
          Nothing has been logged to this account yet, so there is nothing to estimate a trend
          from. Nothing is shown here until at least one measurement is stored.
        </p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className={styles.loading} aria-busy="true">
        <p className={styles.body}>Loading your analysis…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={styles.errorState}>
        <h1 className={styles.title}>The analysis service is unavailable</h1>
        <p className={styles.body}>{state.message}</p>
      </div>
    );
  }

  return <V2Workspace analysis={state.analysis} unit={unit} persistedGoal={persistedGoal} />;
}
