import React from 'react';

const htLegendMarks = {
  trend: <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="var(--data-trend)" strokeWidth="2.25" strokeLinecap="round" /></svg>,
  band: <svg width="20" height="10"><rect x="0" y="1" width="20" height="8" fill="var(--data-band-68)" /><rect x="0" y="0" width="20" height="10" fill="var(--data-band-95)" /></svg>,
  projection: <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="var(--data-projection)" strokeWidth="1.75" strokeDasharray="4 4" /></svg>,
  raw: <svg width="20" height="8"><circle cx="4" cy="4" r="1.7" fill="var(--data-raw-fill)" /><circle cx="10" cy="4" r="1.7" fill="var(--data-raw-fill)" /><circle cx="16" cy="4" r="1.7" fill="var(--data-raw-fill)" /></svg>,
  reference: <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="var(--data-reference)" strokeWidth="1" strokeDasharray="3 3" /></svg>,
};

export function ChartLegend({ items, layout = 'row' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: layout === 'row' ? 'row' : 'column',
      gap: layout === 'row' ? 'var(--space-7)' : 'var(--space-4)',
      flexWrap: 'wrap', alignItems: layout === 'row' ? 'center' : 'flex-start',
    }}>
      {items.map(it => (
        <span key={it.role} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          {htLegendMarks[it.role]}
          <span className="ht-qualifier">{it.label}</span>
        </span>
      ))}
    </div>
  );
}
