export interface RawReadingProps {
  /** Short date, e.g. "Mon 24 Aug". */
  date: string;
  value: string | number;
  unit?: string;
  /** Residual against the trend line, e.g. "+0.9 vs trend". Neutral grey only. */
  delta?: string;
  muted?: boolean;
}
export declare function RawReading(props: RawReadingProps): JSX.Element;
