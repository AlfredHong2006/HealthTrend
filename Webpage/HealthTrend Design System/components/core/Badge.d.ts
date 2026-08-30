import * as React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  /** stale = the estimate is out of date (data condition, not a health verdict). */
  variant?: 'neutral' | 'accent' | 'stale' | 'outline';
  style?: React.CSSProperties;
}
export declare function Badge(props: BadgeProps): JSX.Element;
