import React from 'react';

export function SegmentedControl({ options, value, onChange, variant = 'pill', size = 'md' }) {
  const pill = variant === 'pill';
  const h = size === 'sm' ? 26 : 30;
  return (
    <div
      role="tablist"
      style={pill ? {
        display: 'inline-flex', gap: 2, padding: 2, background: 'var(--surface-hover)',
        borderRadius: 'var(--radius-pill)',
      } : {
        display: 'inline-flex', gap: 'var(--space-7)', borderBottom: 'var(--line-hair)',
      }}
    >
      {options.map(o => {
        const key = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        const on = key === value;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange && onChange(key)}
            style={pill ? {
              height: h, padding: '0 12px', border: 0, cursor: 'pointer',
              borderRadius: 'var(--radius-pill)',
              background: on ? 'var(--surface-page)' : 'transparent',
              boxShadow: on ? '0 1px 1px rgba(14,20,28,.07)' : 'none',
              color: on ? 'var(--text-display)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-numeric)', fontSize: 'var(--size-ui-sm)',
              fontWeight: on ? 'var(--weight-ui-strong)' : 'var(--weight-ui)',
              fontVariantNumeric: 'tabular-nums',
              transition: 'var(--transition-control)',
            } : {
              height: h + 6, padding: '0 0 8px', border: 0, background: 'transparent', cursor: 'pointer',
              color: on ? 'var(--text-display)' : 'var(--text-secondary)',
              borderBottom: on ? 'var(--line-accent)' : '2px solid transparent',
              marginBottom: -1,
              fontFamily: 'var(--font-numeric)', fontSize: 'var(--size-ui)',
              fontWeight: on ? 'var(--weight-ui-strong)' : 'var(--weight-ui)',
              transition: 'var(--transition-control)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
