/**
 * Tier-1 metric: the model's estimated trajectory value. Exactly one per screen —
 * no other element in the product may use --size-metric-hero.
 *
 * The current RATE is a hero-adjacent metric (brief §8): pass it as `rate` so it
 * sits with the trajectory, and never place it in the tier-2 statistics group
 * alongside n, σ and R².
 */
export interface HeroMetricProps {
  /** Eyebrow, e.g. "ESTIMATED TREND WEIGHT". */
  label?: string;
  /** Pre-formatted by HTFormat.trendWeight() — already rounded to the precision the confidence supports. */
  value?: string | number;
  /** "kg", "lb". Rendered at tier-2 size on the hero baseline, never at hero size. */
  unit?: string;
  /** Credible/confidence interval — always show one if the model produces one. HTFormat.plusMinus(). */
  interval?: string;
  /** e.g. "as of today, 06:40". HTFormat.asOf(). */
  asOf?: string;
  /**
   * From HTFormat.confidence(). `wide` steps the numeral back one ink and expects
   * reduced precision; `insufficient` replaces the number with `insufficientNote`
   * at tier 2 — a hero number is never shown with a caveat attached.
   */
  confidence?: 'ok' | 'wide' | 'stale' | 'insufficient';
  /**
   * Character slots to reserve for the numeral (HTFormat.digitSlots(unit) = 5),
   * so kg -> lb does not reflow the page. Omit only for a fixed-unit surface.
   */
  digits?: number;
  /** Tier-2 statement shown when confidence is `insufficient`. */
  insufficientNote?: string;
  /** Amber staleness clause for the qualifier row. HTFormat.staleness(). */
  stale?: string;
  /** The rate node — TrendDelta or SupportingMetric — rendered adjacent to the hero. */
  rate?: React.ReactNode;
  align?: 'left' | 'center';
}
export declare function HeroMetric(props: HeroMetricProps): JSX.Element;
