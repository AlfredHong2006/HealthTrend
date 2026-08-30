import React from 'react';
import { Icon } from '../core/Icon.jsx';

// The qualifier-tier sentence that states what confidence is doing to the
// estimate. Sits BESIDE the number it qualifies — never in a footnote, never in
// a modal, never behind an info icon. Carries the canonical copy per level so
// the same state reads the same everywhere in the product.
const HT_LEVELS = {
  ok: { icon: null, tone: 'var(--text-qualifier)', copy: null },
  wide: {
    icon: 'circle-slash', tone: 'var(--text-secondary)',
    copy: 'The interval is wide enough that the direction is not yet established.',
  },
  stale: {
    icon: 'clock', tone: 'var(--data-stale)',
    copy: 'Gaps widen the band; they do not move the line.',
  },
  insufficient: {
    icon: 'minus', tone: 'var(--text-secondary)',
    copy: 'Below three readings a week, the estimate is mostly prior.',
  },
};

export function ConfidenceNote({ level = 'ok', children, icon, showIcon = true, style }) {
  const spec = HT_LEVELS[level] || HT_LEVELS.ok;
  const text = children != null ? children : spec.copy;
  if (!text) return null;
  const glyph = icon !== undefined ? icon : spec.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'flex-start', gap: 'var(--space-3)',
      fontFamily: 'var(--font-numeric)', fontSize: 'var(--size-qualifier)',
      lineHeight: 'var(--lh-qualifier)', letterSpacing: 'var(--tracking-qualifier)',
      fontVariantNumeric: 'tabular-nums', color: spec.tone,
      maxWidth: 'var(--measure-qualifier)', ...style,
    }}>
      {showIcon && glyph ? (
        <span style={{ paddingTop: 1, flex: '0 0 auto' }}><Icon name={glyph} size={12.5} /></span>
      ) : null}
      <span>{text}</span>
    </span>
  );
}
