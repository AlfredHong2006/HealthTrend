import React from 'react';

export function Equation({ children, number, display = true }) {
  if (!display) {
    return <span className="ht-notation" style={{ fontSize: '0.94em', color: 'var(--text-display)' }}>{children}</span>;
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: 'var(--space-8)', padding: 'var(--space-7) 0',
      maxWidth: 'var(--measure-prose)',
    }}>
      <span className="ht-notation" style={{ color: 'var(--text-display)', fontSize: '16px' }}>{children}</span>
      {number ? <span className="ht-qualifier" style={{ fontFamily: 'var(--font-notation)' }}>({number})</span> : null}
    </div>
  );
}
