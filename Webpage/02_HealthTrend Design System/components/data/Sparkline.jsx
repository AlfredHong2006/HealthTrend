import React from 'react';

export function Sparkline({ trend = [], width = 120, height = 40, showBand = true, strokeWidth = 1.75 }) {
  if (trend.length < 2) return <svg width={width} height={height} />;
  const ys = [];
  trend.forEach(p => { ys.push(p.y); if (showBand && p.lo68 != null) { ys.push(p.lo68); ys.push(p.hi68); } });
  const min = Math.min.apply(null, ys), max = Math.max.apply(null, ys);
  const sx = i => (i / (trend.length - 1)) * (width - 2) + 1;
  const sy = v => height - 2 - ((v - min) / ((max - min) || 1)) * (height - 4);
  const line = trend.map((p, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ');
  const area = showBand && trend[0].lo68 != null
    ? trend.map((p, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.hi68).toFixed(1)).join(' ')
      + ' ' + trend.slice().reverse().map((p, i) => 'L' + sx(trend.length - 1 - i).toFixed(1) + ' ' + sy(p.lo68).toFixed(1)).join(' ') + ' Z'
    : null;
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {area ? <path d={area} fill="var(--data-band-68)" /> : null}
      <path d={line} fill="none" stroke="var(--data-trend)" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}
