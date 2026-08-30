import React from 'react';

// THE hero object of HealthTrend. Layer order, bottom to top:
// grid -> 95% band -> 68% band -> raw measurements -> projection -> trajectory -> readout.
function htScale(domain, range) {
  const d = domain[1] - domain[0] || 1;
  return v => range[0] + ((v - domain[0]) / d) * (range[1] - range[0]);
}
function htPath(pts) {
  return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ');
}

export function TrajectoryChart({
  raw = [], trend = [], projection = [], unit = 'kg',
  height = 420, showRaw = true, showBands = true, showProjection = true,
  reference, xTicks = [], onHoverIndex,
}) {
  const wrap = React.useRef(null);
  const [w, setW] = React.useState(900);
  const [hover, setHover] = React.useState(null);

  React.useEffect(() => {
    if (!wrap.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width));
    ro.observe(wrap.current);
    setW(wrap.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const padL = 52, padR = 92, padT = 18, padB = 30;
  const innerW = Math.max(120, w - padL - padR);
  const innerH = height - padT - padB;
  const n = Math.max(1, (showProjection ? trend.length + projection.length : trend.length) - 1);

  const ys = [];
  raw.forEach(p => ys.push(p.y));
  trend.forEach(p => { ys.push(p.hi95 != null ? p.hi95 : p.y); ys.push(p.lo95 != null ? p.lo95 : p.y); });
  if (showProjection) projection.forEach(p => { ys.push(p.hi != null ? p.hi : p.y); ys.push(p.lo != null ? p.lo : p.y); });
  if (reference) ys.push(reference.y);
  const min = Math.min.apply(null, ys), max = Math.max.apply(null, ys);
  const padY = (max - min) * 0.12 || 1;
  const x = htScale([0, n], [padL, padL + innerW]);
  const y = htScale([min - padY, max + padY], [padT + innerH, padT]);

  const yTickVals = [0, 0.25, 0.5, 0.75, 1].map(t => min - padY + t * (max - min + 2 * padY));
  const band = (pts, lo, hi) => htPath(pts.map(p => [x(p.i), y(p[hi])]))
    + ' ' + pts.slice().reverse().map(p => 'L' + x(p.i).toFixed(2) + ' ' + y(p[lo]).toFixed(2)).join(' ') + ' Z';

  const trendPts = trend.map((p, i) => Object.assign({}, p, { i }));
  const projPts = projection.map((p, i) => Object.assign({}, p, { i: trend.length - 1 + i }));
  const last = trend[trend.length - 1];

  const move = e => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    const idx = Math.round(((px - padL) / innerW) * n);
    const clamped = Math.max(0, Math.min(trend.length - 1, idx));
    setHover(clamped);
    if (onHoverIndex) onHoverIndex(clamped);
  };

  const hp = hover != null ? trend[hover] : null;

  return (
    <div ref={wrap} style={{ width: '100%', position: 'relative' }}>
      <svg
        width="100%" height={height} viewBox={'0 0 ' + w + ' ' + height}
        onMouseMove={move} onMouseLeave={() => { setHover(null); if (onHoverIndex) onHoverIndex(null); }}
        style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
      >
        {yTickVals.map((v, i) => (
          <g key={'g' + i}>
            <line x1={padL} x2={padL + innerW} y1={y(v)} y2={y(v)} stroke="var(--data-grid)" strokeWidth="1" />
            <text x={padL - 12} y={y(v) + 3.5} textAnchor="end"
              style={{ font: '400 var(--size-axis) var(--font-notation)', fill: 'var(--data-axis-text)', fontVariantNumeric: 'tabular-nums' }}>
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {showBands && trendPts.length > 1 && trendPts[0].lo95 != null ? (
          <path d={band(trendPts, 'lo95', 'hi95')} fill="var(--data-band-95)" />
        ) : null}
        {showBands && trendPts.length > 1 && trendPts[0].lo68 != null ? (
          <path d={band(trendPts, 'lo68', 'hi68')} fill="var(--data-band-68)" />
        ) : null}

        {showProjection && projPts.length > 1 && projPts[0].lo != null ? (
          <path d={band(projPts, 'lo', 'hi')} fill="var(--data-projection-band)" />
        ) : null}

        {showRaw ? raw.map((p, i) => (
          <circle key={'r' + i} cx={x(p.i != null ? p.i : i)} cy={y(p.y)} r="1.7" fill="var(--data-raw-fill)" />
        )) : null}

        {reference ? (
          <g>
            <line x1={padL} x2={padL + innerW} y1={y(reference.y)} y2={y(reference.y)}
              stroke="var(--data-reference)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={padL + innerW} y={y(reference.y) - 7} textAnchor="end"
              style={{ font: '400 var(--size-axis) var(--font-notation)', fill: 'var(--data-axis-text)' }}>
              {reference.label}
            </text>
          </g>
        ) : null}

        {showProjection && projPts.length > 1 ? (
          <path d={htPath(projPts.map(p => [x(p.i), y(p.y)]))} fill="none"
            stroke="var(--data-projection)" strokeWidth="var(--stroke-projection)" strokeDasharray="4 4" opacity="0.85" />
        ) : null}

        <path d={htPath(trendPts.map(p => [x(p.i), y(p.y)]))} fill="none"
          stroke="var(--data-trend)" strokeWidth="var(--stroke-trend)" strokeLinecap="round" />

        <line x1={padL} x2={padL + innerW} y1={padT + innerH} y2={padT + innerH} stroke="var(--data-grid-zero)" strokeWidth="1" />
        {xTicks.map((t, i) => (
          <text key={'x' + i} x={x(t.i)} y={height - 8} textAnchor="middle"
            style={{ font: '400 var(--size-axis) var(--font-notation)', fill: 'var(--data-axis-text)' }}>{t.label}</text>
        ))}

        {last ? (
          <g>
            <line x1={x(trend.length - 1)} x2={padL + innerW + 8} y1={y(last.y)} y2={y(last.y)}
              stroke="var(--data-trend)" strokeWidth="1" opacity="0.35" />
            <rect x={padL + innerW + 8} y={y(last.y) - 11} width="70" height="22" rx="2" fill="var(--data-trend)" />
            <text x={padL + innerW + 43} y={y(last.y) + 4.5} textAnchor="middle"
              style={{ font: '600 12.5px var(--font-numeric)', fill: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {last.y.toFixed(1)} {unit}
            </text>
          </g>
        ) : null}

        {hp ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH}
              stroke="var(--data-crosshair)" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={x(hover)} cy={y(hp.y)} r="3.5" fill="var(--surface-page)" stroke="var(--data-trend)" strokeWidth="2" />
          </g>
        ) : null}
      </svg>

      {hp ? (
        <div style={{
          position: 'absolute', top: 0,
          left: Math.min(Math.max(x(hover) - 70, 0), Math.max(0, w - 156)),
          pointerEvents: 'none', background: 'var(--surface-page)',
          border: '1px solid var(--border-divider)', borderRadius: 'var(--radius-2)',
          boxShadow: 'var(--shadow-tooltip)', padding: '8px 10px', minWidth: 140,
        }}>
          <div className="ht-qualifier" style={{ color: 'var(--text-qualifier)' }}>{hp.label || ''}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
            <span style={{ font: '450 19px var(--font-numeric)', color: 'var(--text-display)', fontVariantNumeric: 'tabular-nums' }}>{hp.y.toFixed(2)}</span>
            <span className="ht-qualifier">{unit} trend</span>
          </div>
          {hp.lo68 != null ? (
            <div className="ht-qualifier" style={{ marginTop: 2 }}>68% {hp.lo68.toFixed(2)}&ndash;{hp.hi68.toFixed(2)}</div>
          ) : null}
          {hp.rawY != null ? (
            <div className="ht-qualifier" style={{ marginTop: 4, color: 'var(--data-raw-hover)' }}>measured {hp.rawY.toFixed(1)}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
