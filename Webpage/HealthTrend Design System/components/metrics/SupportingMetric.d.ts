export interface SupportingMetricProps {
  /** Eyebrow label, e.g. "RATE OF CHANGE". */
  label: string;
  value: string | number;
  /** "kg/week", "days", "%". */
  unit?: string;
  /** Qualifier tier: interval, n, p-value, window. */
  qualifier?: string;
  /** accent tints the numeral azure — use for at most one metric in a row. */
  emphasis?: 'normal' | 'accent';
}
export declare function SupportingMetric(props: SupportingMetricProps): JSX.Element;
