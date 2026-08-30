import React from 'react';

// A reading the filter down-weighted. Hollow ring, ink-coloured: it is a
// measurement that was KEPT, not an error that was caught. Never red, never an
// exclamation, never removed from the series.
export function OutlierFlag({ residual, size = 9, children, showRing = true, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)',
      fontFamily: 'var(--font-numeric)', fontSize: 'var(--size-qualifier)',
      lineHeight: 'var(--lh-qualifier)', letterSpacing: 'var(--tracking-qualifier)',
      fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', ...style,
    }}>
      {showRing ? (
        <svg width={size} height={size} style={{ flex: '0 0 auto', display: 'block' }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={(size - 2.5) / 2}
            fill="var(--data-outlier-fill)" stroke="var(--data-outlier)" strokeWidth="var(--stroke-outlier)" />
        </svg>
      ) : null}
      {children != null ? children : residual != null ? 'residual ' + residual : null}
    </span>
  );
}
