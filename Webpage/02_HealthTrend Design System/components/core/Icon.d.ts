import * as React from 'react';

export interface IconProps {
  /** Lucide icon name, kebab-case — e.g. "trending-down", "chevron-down", "info". */
  name: string;
  /** Pixel box. 14 in qualifier rows, 16 default, 18 in nav. */
  size?: number;
  /** Defaults to the system's 1.5 stroke. Do not go heavier. */
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;
