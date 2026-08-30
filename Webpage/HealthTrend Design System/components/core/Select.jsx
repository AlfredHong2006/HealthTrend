import React from 'react';
import { Icon } from './Icon.jsx';

export function Select({ options, value, onChange, label, width = 168, size = 'md' }) {
  const h = size === 'sm' ? 28 : 34;
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {label ? <span className="ht-eyebrow">{label}</span> : null}
      <span style={{ position: 'relative', display: 'inline-flex', width }}>
        <select
          value={value}
          onChange={e => onChange && onChange(e.target.value)}
          style={{
            appearance: 'none', width: '100%', height: h,
            padding: '0 30px 0 10px',
            background: 'var(--surface-page)', color: 'var(--text-body)',
            border: '1px solid var(--border-control)', borderRadius: 'var(--radius-1)',
            fontFamily: 'var(--font-numeric)', fontSize: size === 'sm' ? 'var(--size-ui-sm)' : 'var(--size-ui)',
            fontVariantNumeric: 'tabular-nums', cursor: 'pointer',
          }}
        >
          {options.map(o => {
            const v = typeof o === 'string' ? o : o.value;
            const l = typeof o === 'string' ? o : o.label;
            return <option key={v} value={v}>{l}</option>;
          })}
        </select>
        <span style={{ position: 'absolute', right: 9, top: 0, height: h, display: 'flex', alignItems: 'center', color: 'var(--text-qualifier)', pointerEvents: 'none' }}>
          <Icon name="chevron-down" size={14} />
        </span>
      </span>
    </label>
  );
}
