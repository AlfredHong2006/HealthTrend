import styles from "./V2Inspector.module.css";

interface V2InspectorProps {
  /** Whether the model has an estimated trajectory at all to inspect (`lib/v2/span.ts`). */
  hasSpan: boolean;
  onOpen: () => void;
}

/**
 * The single entry into the deep tiers: an offer to go deeper, not the depth itself. It closes
 * the centred stack, directly below the chart, the analysis summary and the tier-2 statistics
 * band. `V2Workspace` renders the deep tier itself (`V2InspectPanel`) as a separate block below
 * that stack, so there is exactly one entry point and exactly one place the tiers render;
 * neither is duplicated.
 *
 * `Inspect analysis is unavailable, not empty, when there is no span`: all three tiers describe
 * an estimated trajectory, and a series with one or no readings has none to describe
 * (Implementation Spec §6).
 */
export function V2Inspector({ hasSpan, onOpen }: V2InspectorProps) {
  return (
    <div className={styles.entry}>
      <div className={styles.entryContent}>
        <h2 className={styles.entryTitle}>Inspect analysis</h2>
        {hasSpan ? (
          <p className={styles.entryBody}>
            Why the model reached this estimate, the observations that support it, and the
            inference behind the forecast.
          </p>
        ) : (
          <p className={styles.entryQuiet}>
            Unavailable: there is no estimated trajectory to inspect. Why, Evidence and Statistics
            all describe one, and the model has produced none from too short a history.
          </p>
        )}
      </div>

      {hasSpan ? (
        <button
          type="button"
          className={styles.enter}
          onClick={onOpen}
          aria-label="Inspect analysis. Opens Why, Evidence, Statistics."
        >
          <span aria-hidden="true">Inspect analysis</span>
          <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </div>
  );
}
