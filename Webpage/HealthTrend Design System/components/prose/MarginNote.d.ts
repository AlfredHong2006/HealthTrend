import * as React from 'react';

export interface MarginNoteProps {
  children?: React.ReactNode;
  /** Reference marker, e.g. "1" or "†". */
  marker?: string;
  side?: 'right' | 'left';
}
export declare function MarginNote(props: MarginNoteProps): JSX.Element;
