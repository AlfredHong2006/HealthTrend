import * as React from 'react';

/**
 * Action control. HealthTrend uses buttons sparingly — the product is read, not operated.
 */
export interface ButtonProps {
  children?: React.ReactNode;
  /** primary = the one committing action per view. secondary = default. quiet = toolbar. */
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'sm' | 'md';
  /** Lucide icon name, leading. */
  icon?: string;
  /** Lucide icon name, trailing. */
  iconRight?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
