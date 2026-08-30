import React from 'react';
import { Icon } from '../core/Icon.jsx';

const htQualifierColor = { default: 'var(--text-qualifier)', stale: 'var(--data-stale)', accent: 'var(--azure-700)' };

export function Qualifier({ children, icon, tone = 'default', style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)',
      fontFamily: 'var(--font-numeric)', fontSize: 'var(--size-qualifier)',
      lineHeight: 'var(--lh-qualifier)', letterSpacing: 'var(--tracking-qualifier)',
      fontVariantNumeric: 'tabular-nums', color: htQualifierColor[tone],
      maxWidth: 'var(--measure-qualifier)', ...style,
    }}>
      {icon ? <Icon name={icon} size={12.5} /> : null}
      {children}
    </span>
  );
}
