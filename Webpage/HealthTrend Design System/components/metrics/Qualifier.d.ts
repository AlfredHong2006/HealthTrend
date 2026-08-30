import * as React from 'react';

export interface QualifierProps {
  children?: React.ReactNode;
  /** Optional Lucide glyph — "info", "clock", "sigma". */
  icon?: string;
  /** stale is amber and describes the DATA's age, not the person's health. */
  tone?: 'default' | 'stale' | 'accent';
  style?: React.CSSProperties;
}
export declare function Qualifier(props: QualifierProps): JSX.Element;
