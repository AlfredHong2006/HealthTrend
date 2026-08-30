import React from 'react';

// Geometry lives in .ht-margin-note (tokens/layout.css) so it can collapse out of
// the gutter below 1180px, where --col-margin is 0.
export function MarginNote({ children, marker, side = 'right' }) {
  return (
    <aside className="ht-margin-note" data-side={side}>
      {marker ? <span className="ht-qualifier" style={{ color: 'var(--text-accent)' }}>{marker}</span> : null}
      <span style={{
        font: 'var(--weight-prose) 14.5px/1.5 var(--font-prose)',
        color: 'var(--text-qualifier)', textWrap: 'pretty',
      }}>{children}</span>
    </aside>
  );
}
