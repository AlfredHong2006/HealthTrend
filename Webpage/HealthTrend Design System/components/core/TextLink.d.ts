import * as React from 'react';

export interface TextLinkProps {
  children?: React.ReactNode;
  href?: string;
  /** prose = inside serif body copy (inherits size). ui = sans, in chrome. */
  variant?: 'prose' | 'ui';
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export declare function TextLink(props: TextLinkProps): JSX.Element;
