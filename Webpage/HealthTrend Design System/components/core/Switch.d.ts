export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Names what becomes visible, e.g. "Show raw measurements". */
  label?: string;
  /** Qualifier-tier second line, e.g. "84 readings in range". */
  hint?: string;
  disabled?: boolean;
}
export declare function Switch(props: SwitchProps): JSX.Element;
