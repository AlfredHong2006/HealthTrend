import React from 'react';

export function Input({ value, onChange, label, unit, placeholder, width = 160, numeric = true, hint, align = 'left' }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {label ? <span className="ht-eyebrow">{label}</span> : null}
      <span style={{
        display: 'inline-flex', alignItems: 'center', width,
        border: '1px solid ' + (focus ? 'var(--border-accent)' : 'var(--border-control)'),
        borderRadius: 'var(--radius-1)', background: 'var(--surface-page)',
        transition: 'var(--transition-control)', height: 34, padding: '0 10px', gap: 6,
      }}>
        <input
          value={value}
          placeholder={placeholder}
          onChange={e => onChange && onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          inputMode={numeric ? 'decimal' : 'text'}
          style={{
            border: 0, outline: 'none', background: 'transparent', width: '100%',
            fontFamily: numeric ? 'var(--font-numeric)' : 'var(--font-prose)',
            fontSize: numeric ? '16px' : 'var(--size-body-sm)',
            fontVariantNumeric: numeric ? 'tabular-nums' : 'normal',
            color: 'var(--text-display)', textAlign: align,
          }}
        />
        {unit ? <span className="ht-qualifier" style={{ flex: '0 0 auto' }}>{unit}</span> : null}
      </span>
      {hint ? <span className="ht-qualifier">{hint}</span> : null}
    </label>
  );
}
