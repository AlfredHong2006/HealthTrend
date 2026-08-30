import React from 'react';

// The new-user state. Not an error, not an empty dashboard: a statement of what
// the model needs before it will make a claim. Occupies the hero region so the
// composition does not collapse, but at TIER 2 — there is no number to be huge.
export function InsufficientData({
  label = 'ESTIMATED TREND WEIGHT',
  statement = 'Not enough readings to estimate a trajectory',
  detail,
  readings, needed,
  latest,
  align = 'left',
}) {
  const marks = readings != null && needed != null
    ? Array.from({ length: needed }, (_, i) => i < readings)
    : null;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--space-6)',
      alignItems: align === 'left' ? 'flex-start' : 'center',
      maxWidth: 'var(--measure-prose)',
    }}>
      {label ? <span className="ht-eyebrow">{label}</span> : null}
      <span className="ht-metric-support" style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
        {statement}
      </span>
      {marks ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)', height: 14 }}>
          {marks.map((on, i) => (
            <span key={i} style={{
              width: 3, height: on ? 14 : 7,
              background: on ? 'var(--data-raw)' : 'var(--data-insufficient-frame)',
            }} />
          ))}
        </div>
      ) : null}
      {readings != null && needed != null ? (
        <span className="ht-qualifier">
          {readings} of {needed} readings{detail ? ' \u00b7 ' + detail : ''}
        </span>
      ) : detail ? <span className="ht-qualifier">{detail}</span> : null}
      {latest ? <span className="ht-qualifier" style={{ color: 'var(--ink-5)' }}>{latest}</span> : null}
    </div>
  );
}
