import * as React from 'react';

export interface FigureCaptionProps {
  /** "FIGURE 2" — uppercase, mono-ish eyebrow. */
  label: string;
  children?: React.ReactNode;
  /** Data provenance / n, in the qualifier tier. */
  source?: string;
}
export declare function FigureCaption(props: FigureCaptionProps): JSX.Element;
