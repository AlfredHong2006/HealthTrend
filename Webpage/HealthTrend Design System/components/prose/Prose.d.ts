import * as React from 'react';

/**
 * Body-copy container: fixes the measure and the paragraph rhythm.
 */
export interface ProseProps {
  /** One or more <p> children. */
  children?: React.ReactNode;
  size?: 'lede' | 'body' | 'sm';
  /** prose = 34em default. narrow = captions/sidenotes. wide = section openers. */
  width?: 'prose' | 'narrow' | 'wide';
  align?: 'start' | 'center';
  style?: React.CSSProperties;
}
export declare function Prose(props: ProseProps): JSX.Element;
