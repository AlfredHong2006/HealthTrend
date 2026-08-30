export interface InputProps {
  value?: string | number;
  onChange?: (value: string) => void;
  /** Uppercase eyebrow above the field. */
  label?: string;
  /** Static unit suffix inside the field, e.g. "kg". */
  unit?: string;
  placeholder?: string;
  width?: number;
  /** true (default) sets the tabular numeric face — every quantity field. */
  numeric?: boolean;
  /** Qualifier-tier hint below, e.g. "last reading 82.1 kg". */
  hint?: string;
  align?: 'left' | 'right';
}
export declare function Input(props: InputProps): JSX.Element;
