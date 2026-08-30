import React from 'react';
import { Icon } from '../core/Icon.jsx';

// Direction is shown by a glyph, never by red/green.
export function TrendDelta({ value, unit = 'kg/week', direction = 'down', interval, size = 'md' }) {
  const glyph = direction === 'flat' ? 'move-horizontal' : direction === 'up' ? 'arrow-up-right' : 'arrow-down-right';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Icon name={glyph} size={size === 'sm' ? 15 : 20} color="var(--text-secondary)" />
        <span
          className={size === 'sm' ? 'ht-ui' : 'ht-metric-support'}
          style={{ fontWeight: size === 'sm' ? 'var(--weight-ui-strong)' : undefined }}
        >{value}</span>
        <span className="ht-qualifier" style={{ fontSize: 'var(--size-ui-sm)', color: 'var(--text-secondary)' }}>{unit}</span>
      </div>
      {interval ? <span className="ht-qualifier">{interval}</span> : null}
    </div>
  );
}
