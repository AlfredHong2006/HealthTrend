import React from 'react';

// TIER 2 — statistical context beside the trajectory: rate, projection, n, fit.
export function SupportingMetric({ label, value, unit, qualifier, emphasis = 'normal' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 0 }}>
      <span className="ht-eyebrow">{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <span className="ht-metric-support" style={{ color: emphasis === 'accent' ? 'var(--text-accent)' : 'var(--text-display)' }}>{value}</span>
        {unit ? <span className="ht-qualifier" style={{ fontSize: 'var(--size-ui-sm)', color: 'var(--text-secondary)' }}>{unit}</span> : null}
      </div>
      {qualifier ? <span className="ht-qualifier">{qualifier}</span> : null}
    </div>
  );
}
