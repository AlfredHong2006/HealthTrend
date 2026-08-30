export interface SelectOption { value: string; label: string }

export interface SelectProps {
  options: Array<string | SelectOption>;
  value: string;
  onChange?: (value: string) => void;
  /** Uppercase eyebrow above the field, e.g. "SMOOTHING WINDOW". */
  label?: string;
  width?: number;
  size?: 'sm' | 'md';
}
export declare function Select(props: SelectProps): JSX.Element;
