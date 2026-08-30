export interface SegmentedOption { value: string; label: string }

export interface SegmentedControlProps {
  /** Strings, or {value,label} pairs. Ranges read "30d", "90d", "1y", "All". */
  options: Array<string | SegmentedOption>;
  value: string;
  onChange?: (value: string) => void;
  /** pill = chart range switcher. underline = page-level tabs. */
  variant?: 'pill' | 'underline';
  size?: 'sm' | 'md';
}
export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element;
