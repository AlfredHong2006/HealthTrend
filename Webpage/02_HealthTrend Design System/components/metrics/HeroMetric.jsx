import React from 'react';

// TIER 1 — the estimated trajectory. One per view, and nothing else may use this size.
//
// Confidence is a first-class prop, not a caller's styling decision:
//   ok            ink-1, full precision
//   wide          ink-2 (one step back) — the estimate is real but weak; the
//                 caller must also reduce precision via HTFormat.trendWeight
//   insufficient  no hero number at all; a tier-2 statement takes the slot
//   stale         ink-1, but the qualifier row carries the staleness in amber
//
// `digits` reserves character slots so switching kg -> lb (76.2 -> 168.0) does
// not shift the composition. Unit is part of that composition — it sits on the
// hero baseline at tier-2 size, never as a superscript or a small-caps suffix.
const HT_HERO_INK = { ok: 'var(--ink-1)', stale: 'var(--ink-1)', wide: 'var(--ink-2)', insufficient: 'var(--ink-3)' };

export function HeroMetric({
  label, value, unit, interval, asOf, align = 'left',
  confidence = 'ok', digits, insufficientNote = 'Not enough readings to estimate a trajectory',
  stale, rate,
}) {
  const alignItems = align === 'left' ? 'flex-start' : 'center';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems }}>
      {label ? <span className="ht-eyebrow">{label}</span> : null}

      {confidence === 'insufficient' ? (
        <span className="ht-metric-support" style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em', maxWidth: 'var(--measure-prose)' }}>
          {insufficientNote}
        </span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)' }}>
          <span className="ht-metric-hero" style={{
            color: HT_HERO_INK[confidence] || HT_HERO_INK.ok,
            minWidth: digits ? digits + 'ch' : undefined,
            display: digits ? 'inline-block' : undefined,
            textAlign: digits ? (align === 'center' ? 'center' : 'right') : undefined,
          }}>{value}</span>
          {unit ? (
            <span style={{
              fontFamily: 'var(--font-numeric)', fontSize: 'var(--size-metric-support)',
              fontWeight: 'var(--weight-ui)', color: 'var(--text-secondary)', letterSpacing: '-0.01em',
            }}>{unit}</span>
          ) : null}
        </div>
      )}

      {/* Rate sits ADJACENT to the hero, never down in the statistics group. */}
      {rate ? <div style={{ display: 'flex', alignItems: 'baseline' }}>{rate}</div> : null}

      {interval || asOf || stale ? (
        <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'baseline', flexWrap: 'wrap' }}>
          {interval ? <span className="ht-qualifier">{interval}</span> : null}
          {interval && asOf ? <span className="ht-qualifier" style={{ color: 'var(--ink-5)' }}>/</span> : null}
          {asOf ? <span className="ht-qualifier">{asOf}</span> : null}
          {stale ? <span className="ht-qualifier" style={{ color: 'var(--data-stale)' }}>{stale}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
