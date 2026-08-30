export interface RangeStripProps {
  /** Whole-history values, one per day. */
  series: number[];
  /** Active window as fractions 0-1. */
  from?: number;
  to?: number;
  height?: number;
  /** Mono labels under the strip. */
  ticks?: string[];
  onChange?: (range: [number, number]) => void;
}
export declare function RangeStrip(props: RangeStripProps): JSX.Element;
