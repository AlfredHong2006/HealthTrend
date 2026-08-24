"use client";

import styles from "./error.module.css";

interface DemoScenarioErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Catches anything `page.tsx` throws other than `notFound()` -- in practice, the analysis
 * service being unreachable or returning an unexpected error. Renders no number, estimate
 * or forecast: if the fetch failed, there is nothing honest to show in their place.
 */
export default function DemoScenarioError({ reset }: DemoScenarioErrorProps) {
  return (
    <main className={styles.page}>
      <h1>The analysis service is unavailable</h1>
      <p>
        HealthTrend could not reach the analysis service just now. This is a problem on our side,
        not with anything you did.
      </p>
      <button type="button" onClick={reset} className={styles.retry}>
        Try again
      </button>
    </main>
  );
}
