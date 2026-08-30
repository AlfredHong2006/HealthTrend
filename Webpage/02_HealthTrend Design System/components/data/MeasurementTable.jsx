import React from 'react';
import { OutlierFlag } from '../states/OutlierFlag.jsx';

export function MeasurementTable({ rows, unit = 'kg', columns = ['date', 'reading', 'trend', 'residual'], dense }) {
  const [hover, setHover] = React.useState(-1);
  const head = { date: 'Date', reading: 'Reading', trend: 'Trend', residual: 'vs trend' };
  const pad = dense ? '6px 0' : '9px 0';
  return (
    <table style={{ fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums' }}>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={c} style={{
              textAlign: i === 0 ? 'left' : 'right', padding: pad,
              borderBottom: 'var(--line-divider)', whiteSpace: 'nowrap',
              font: 'var(--weight-ui-strong) var(--size-eyebrow)/1 var(--font-numeric)',
              letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase',
              color: 'var(--text-qualifier)',
            }}>{head[c]}{c === 'reading' || c === 'trend' ? ' (' + unit + ')' : ''}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}
            style={{ background: hover === i ? 'var(--surface-hover)' : 'transparent', transition: 'var(--transition-control)' }}
          >
            {columns.map((c, ci) => (
              <td key={c} style={{
                textAlign: ci === 0 ? 'left' : 'right', padding: pad,
                borderBottom: 'var(--line-hair)', whiteSpace: 'nowrap',
                fontSize: c === 'date' ? 'var(--size-qualifier)' : 'var(--size-metric-raw)',
                color: c === 'date' ? 'var(--text-qualifier)'
                  : c === 'trend' ? 'var(--text-display)'
                  : c === 'residual' ? 'var(--data-raw)' : 'var(--text-body)',
                fontWeight: c === 'trend' ? 'var(--weight-ui-strong)' : 'var(--weight-ui)',
              }}>
                {/* An outlier is marked, never hidden and never recoloured red. */}
                {c === 'reading' && r.outlier ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <OutlierFlag size={8} showRing={true}>{r[c] != null ? r[c] : '\u2014'}</OutlierFlag>
                  </span>
                ) : r[c] != null ? r[c] : '\u2014'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
