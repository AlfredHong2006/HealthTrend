import * as React from 'react';

export interface EquationProps {
  /** Plain-text notation, mono. Unicode symbols, no image, no LaTeX runtime. */
  children?: React.ReactNode;
  /** Right-aligned equation number. */
  number?: string | number;
  /** false renders inline inside a sentence. */
  display?: boolean;
}
export declare function Equation(props: EquationProps): JSX.Element;
