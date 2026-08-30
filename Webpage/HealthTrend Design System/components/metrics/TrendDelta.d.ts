export interface TrendDeltaProps {
  /** Signed, pre-formatted rate, e.g. "−0.42". Use the minus sign U+2212. */
  value: string | number;
  unit?: string;
  /** Glyph only — no colour change. flat when the interval spans zero. */
  direction?: 'up' | 'down' | 'flat';
  /** e.g. "95% CI −0.61 to −0.23 kg/week". */
  interval?: string;
  size?: 'sm' | 'md';
}
export declare function TrendDelta(props: TrendDeltaProps): JSX.Element;
