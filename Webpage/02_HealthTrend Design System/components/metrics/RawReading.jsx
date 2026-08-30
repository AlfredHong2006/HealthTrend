import React from 'react';

// TIER 3 — a measured value. Small, neutral, never competing with the estimate.
export function RawReading({ date, value, unit, delta, muted }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-5)' }}>
      <span className="ht-qualifier" style={{ minWidth: 74, color: 'var(--text-qualifier)' }}>{date}</span>
      <span className="ht-metric-raw" style={{ color: muted ? 'var(--text-qualifier)' : 'var(--text-body)' }}>
        {value}{unit ? <span style={{ color: 'var(--text-qualifier)' }}> {unit}</span> : null}
      </span>
      {delta ? <span className="ht-qualifier" style={{ color: 'var(--data-raw)' }}>{delta}</span> : null}
    </div>
  );
}
