/**
 * Marks a reading the filter down-weighted, in a table row, a tooltip or beside
 * a raw value. The hollow ring matches the ring `TrajectoryChart` draws for the
 * same reading, so the ledger and the chart agree.
 */
export interface OutlierFlagProps {
  /** Pre-formatted residual, e.g. "+2.8σ". Shown when no children are given. */
  residual?: string;
  /** Ring diameter in px. Match the chart's ring (9) unless space forbids. */
  size?: number;
  children?: React.ReactNode;
  /** false for text-only use inside an already-marked row. */
  showRing?: boolean;
  style?: React.CSSProperties;
}
export declare function OutlierFlag(props: OutlierFlagProps): JSX.Element;
