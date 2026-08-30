import React from 'react';

export function Switch({ checked, onChange, label, hint, disabled }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 'var(--space-5)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: 32, height: 18, flex: '0 0 auto', marginTop: 2, borderRadius: 'var(--radius-pill)',
          background: checked ? 'var(--surface-accent)' : 'var(--rule-2)',
          transition: 'background-color var(--dur-2) var(--ease-standard)',
          position: 'relative',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14,
          borderRadius: 'var(--radius-pill)', background: 'var(--surface-page)',
          boxShadow: '0 1px 1.5px rgba(14,20,28,.25)',
          transition: 'left var(--dur-2) var(--ease-standard)',
        }} />
      </span>
      {label ? (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span className="ht-ui">{label}</span>
          {hint ? <span className="ht-qualifier">{hint}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
