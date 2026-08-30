/**
 * Tier-1 metric: the model's estimated trajectory value. Exactly one per screen.
 */
export interface HeroMetricProps {
  /** Eyebrow, e.g. "ESTIMATED TREND WEIGHT". */
  label?: string;
  /** Pre-formatted, already rounded to the model's meaningful precision. */
  value: string | number;
  /** "kg", "lb". Rendered at tier-2 size, never at hero size. */
  unit?: string;
  /** Credible/confidence interval — always show one if the model produces one. */
  interval?: string;
  /** Staleness, e.g. "as of today, 06:40". */
  asOf?: string;
  align?: 'left' | 'center';
}
export declare function HeroMetric(props: HeroMetricProps): JSX.Element;
