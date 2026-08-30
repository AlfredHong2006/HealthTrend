import * as React from 'react';

export interface TooltipProps {
  children?: React.ReactNode;
  /** Qualifier-tier text or a small node. Keep to one clause plus figures. */
  content?: React.ReactNode;
  side?: 'top' | 'bottom';
}
export declare function Tooltip(props: TooltipProps): JSX.Element;
