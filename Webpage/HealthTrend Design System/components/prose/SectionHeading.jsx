import React from 'react';

export function SectionHeading({ eyebrow, children, level = 2, note, rule = false }) {
  const cls = level === 1 ? 'ht-display' : level === 2 ? 'ht-title' : 'ht-subtitle';
  return (
    <header style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--space-5)',
      maxWidth: 'var(--measure-wide)',
      paddingTop: rule ? 'var(--space-7)' : 0,
      borderTop: rule ? 'var(--line-divider)' : 'none',
    }}>
      {eyebrow ? <span className="ht-eyebrow">{eyebrow}</span> : null}
      <h2 className={cls} style={{ font: 'inherit' }}>
        <span className={cls}>{children}</span>
      </h2>
      {note ? <span className="ht-qualifier">{note}</span> : null}
    </header>
  );
}
