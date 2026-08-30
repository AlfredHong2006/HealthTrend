import React from 'react';

// TIER 1 — the estimated trajectory. One per view, and nothing else may use this size.
export function HeroMetric({ label, value, unit, interval, asOf, align = 'left' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: align === 'left' ? 'flex-start' : 'center' }}>
      {label ? <span className="ht-eyebrow">{label}</span> : null}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)' }}>
        <span className="ht-metric-hero">{value}</span>
        {unit ? (
          <span style={{
            fontFamily: 'var(--font-numeric)', fontSize: 'var(--size-metric-support)',
            fontWeight: 'var(--weight-ui)', color: 'var(--text-secondary)', letterSpacing: '-0.01em',
          }}>{unit}</span>
        ) : null}
      </div>
      {interval || asOf ? (
        <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'baseline', flexWrap: 'wrap' }}>
          {interval ? <span className="ht-qualifier">{interval}</span> : null}
          {interval && asOf ? <span className="ht-qualifier" style={{ color: 'var(--ink-5)' }}>/</span> : null}
          {asOf ? <span className="ht-qualifier">{asOf}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
