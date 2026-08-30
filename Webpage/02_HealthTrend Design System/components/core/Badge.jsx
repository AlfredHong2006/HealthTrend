import React from 'react';

const htBadgeSkins = {
  neutral: { background: 'var(--surface-hover)', color: 'var(--text-secondary)' },
  accent: { background: 'var(--surface-accent-tint)', color: 'var(--azure-700)' },
  stale: { background: 'var(--surface-stale)', color: 'var(--data-stale)' },
  outline: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-control)' },
};

export function Badge({ children, variant = 'neutral', style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 19, padding: '0 6px',
      borderRadius: 'var(--radius-1)', fontFamily: 'var(--font-numeric)',
      fontSize: 'var(--size-qualifier)', fontWeight: 'var(--weight-ui-strong)',
      letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      ...htBadgeSkins[variant], ...style,
    }}>{children}</span>
  );
}
