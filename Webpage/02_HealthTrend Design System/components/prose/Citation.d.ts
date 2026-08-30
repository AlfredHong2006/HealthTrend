import * as React from 'react';

export interface CitationProps {
  /** Omit for the inline superscript form; pass for a reference-list row. */
  children?: React.ReactNode;
  marker: string | number;
  href?: string;
}
export declare function Citation(props: CitationProps): JSX.Element;
