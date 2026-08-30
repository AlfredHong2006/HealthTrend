import React from 'react';

// Full-history context strip with the active window highlighted (Oura Trends pattern).
export function RangeStrip({ series = [], from = 0, to = 1, height = 56, ticks = [], onChange }) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(900);
  const clipId = React.useMemo(() => 'htclip' + Math.random().toString(36).slice(2, 8), []);
  React.useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width));
    ro.observe(ref.current); setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  if (series.length < 2) return <div ref={ref} style={{ height }} />;
  const min = Math.min.apply(null, series), max = Math.max.apply(null, series);
  const sx = i => (i / (series.length - 1)) * w;
  const sy = v => height - 6 - ((v - min) / ((max - min) || 1)) * (height - 14);
  const area = series.map((v, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(v).toFixed(1)).join(' ')
    + ' L' + w + ' ' + height + ' L0 ' + height + ' Z';
  const x0 = from * w, x1 = to * w;
  const winW = Math.max(2, x1 - x0);
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width="100%" height={height} viewBox={'0 0 ' + w + ' ' + height} style={{ display: 'block', cursor: onChange ? 'pointer' : 'default' }}
        onClick={e => {
          if (!onChange) return;
          const box = e.currentTarget.getBoundingClientRect();
          const c = (e.clientX - box.left) / box.width, half = (to - from) / 2;
          onChange([Math.max(0, c - half), Math.min(1, c + half)]);
        }}>
        <defs>
          <clipPath id={clipId}><rect x={x0} y="0" width={winW} height={height} /></clipPath>
        </defs>
        <path d={area} fill="var(--data-raw-fill)" opacity="0.45" />
        <rect x={x0} y="0" width={winW} height={height} fill="var(--data-selection)" />
        <path d={area} fill="var(--data-trend)" opacity="0.85" clipPath={'url(#' + clipId + ')'} />
        <rect x={x0} y="0.5" width={winW} height={height - 1} fill="none" stroke="var(--rule-3)" strokeWidth="1" />
      </svg>
      {ticks.length ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)' }}>
          {ticks.map(t => <span key={t} className="ht-axis">{t}</span>)}
        </div>
      ) : null}
    </div>
  );
}
