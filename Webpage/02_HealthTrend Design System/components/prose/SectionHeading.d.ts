import * as React from 'react';

export interface SectionHeadingProps {
  /** Numbered section label, e.g. "SECTION 3". */
  eyebrow?: string;
  children?: React.ReactNode;
  /** 1 = page opener (46px), 2 = section (33px), 3 = subsection (24px). */
  level?: 1 | 2 | 3;
  /** Qualifier line under the heading — scope, sample, or reading time. */
  note?: string;
  /** Hairline above, for chapter breaks in the Method section. */
  rule?: boolean;
}
export declare function SectionHeading(props: SectionHeadingProps): JSX.Element;
