// FIXTURE DATA — deterministic, invented, for layout only.
// These numbers are not model output and must never be shown as product copy.
(function () {
  function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  const r = rand(20260830);
  const N = 420;
  const trend = [], raw = [], history = [];
  let v = 92.4;
  const months = ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'];
  for (let i = 0; i < N; i++) {
    const slope = i < 120 ? -0.03 : i < 260 ? -0.052 : -0.038;
    v += slope + Math.sin(i / 40) * 0.012;
    history.push(v);
  }
  const win = 120;
  for (let i = 0; i < win; i++) {
    const gi = N - win + i;
    const s = 0.13 + 0.42 * Math.exp(-(win - i) / 60) + 0.18 * Math.exp(-(win - i) / 8);
    const day = new Date(2026, 4, 3 + i);
    const measured = i % 7 === 3 && i > 40 ? null : history[gi] + (r() - 0.5) * 2.1;
    trend.push({
      y: history[gi],
      lo68: history[gi] - s, hi68: history[gi] + s,
      lo95: history[gi] - s * 1.96, hi95: history[gi] + s * 1.96,
      label: day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      rawY: measured == null ? undefined : measured,
      date: day,
    });
    if (measured != null) raw.push({ i, y: measured });
  }
  const projection = [];
  let p = history[N - 1], sp = 0.2;
  for (let j = 0; j < 30; j++) { p -= 0.038; sp += 0.035; projection.push({ y: p, lo: p - sp, hi: p + sp }); }
  const rows = trend.slice().reverse().slice(0, 14).map(t => ({
    date: t.label,
    reading: t.rawY == null ? null : t.rawY.toFixed(1),
    trend: t.y.toFixed(2),
    residual: t.rawY == null ? null : (Math.abs(t.rawY - t.y) < 0.005 ? '0.00' : (t.rawY - t.y > 0 ? '+' : '\u2212') + Math.abs(t.rawY - t.y).toFixed(2)),
  }));
  const xTicks = [];
  for (let i = 0; i < win; i += 30) xTicks.push({ i, label: trend[i].label.split(' ').slice(-1)[0] });
  window.HT_FIXTURES = { trend, raw, projection, history, rows, xTicks, months };
})();
