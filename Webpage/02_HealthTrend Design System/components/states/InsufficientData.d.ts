/**
 * The early state: enough readings to plot, not enough to estimate a trajectory.
 * Fills the tier-1 region at tier-2 size — the hero slot stays composed, but no
 * number is promoted to hero scale because the model has not produced one.
 */
export interface InsufficientDataProps {
  /** Eyebrow above the statement — the same one the hero would have used. */
  label?: string;
  /** One clause, tier 2. Says what is missing, never apologises. */
  statement?: string;
  /** Qualifier-tier detail, e.g. "estimate available at ~10 readings". */
  detail?: string;
  /** Readings so far. With `needed`, draws the reading-count ticks. */
  readings?: number;
  /** Readings required before the model will estimate (HTFormat.THRESHOLDS.minReadings). */
  needed?: number;
  /** Qualifier line for the most recent raw reading, e.g. "last reading 82.1 kg, yesterday". */
  latest?: string;
  align?: 'left' | 'center';
}
export declare function InsufficientData(props: InsufficientDataProps): JSX.Element;
