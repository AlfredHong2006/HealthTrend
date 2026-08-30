import * as React from 'react';

export interface IconButtonProps {
  /** Lucide icon name. */
  icon: string;
  /** Required — becomes aria-label and the tooltip text. */
  label: string;
  size?: number;
  active?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
