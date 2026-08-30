import React from 'react';

export function Citation({ children, marker, href = '#' }) {
  const [hover, setHover] = React.useState(false);
  if (marker && !children) {
    return (
      <sup>
        <a href={href} style={{ border: 0, color: 'var(--text-accent)', fontFamily: 'var(--font-numeric)', fontSize: '0.72em', padding: '0 1px' }}>[{marker}]</a>
      </sup>
    );
  }
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid', gridTemplateColumns: '28px 1fr', gap: 'var(--space-5)',
        padding: 'var(--space-5) 0', borderBottom: 'var(--line-hair)',
        background: hover ? 'var(--surface-hover)' : 'transparent',
        transition: 'var(--transition-control)',
      }}
    >
      <span className="ht-qualifier" style={{ fontFamily: 'var(--font-notation)' }}>[{marker}]</span>
      <span style={{ font: 'var(--weight-prose) var(--size-body-sm)/1.5 var(--font-prose)', color: 'var(--text-secondary)' }}>{children}</span>
    </div>
  );
}
