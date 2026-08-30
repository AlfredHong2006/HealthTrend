import React from 'react';

// Lucide (1.5px stroke) is HealthTrend's icon set — loaded from CDN, see readme ICONOGRAPHY.
const LUCIDE_SRC = 'https://unpkg.com/lucide@0.475.0/dist/umd/lucide.min.js';
let pending;
function loadLucide() {
  if (pending) return pending;
  pending = new Promise(resolve => {
    if (window.lucide) return resolve(window.lucide);
    const s = document.createElement('script');
    s.src = LUCIDE_SRC;
    s.onload = () => resolve(window.lucide);
    document.head.appendChild(s);
  });
  return pending;
}

export function Icon({ name, size = 16, strokeWidth, color = 'currentColor', style }) {
  const host = React.useRef(null);
  React.useEffect(() => {
    let alive = true;
    loadLucide().then(lucide => {
      if (!alive || !host.current || !lucide) return;
      host.current.innerHTML = '';
      const el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      host.current.appendChild(el);
      lucide.createIcons({
        nameAttr: 'data-lucide',
        attrs: { width: size, height: size, stroke: color, 'stroke-width': strokeWidth || 1.5 },
      });
    });
    return () => { alive = false; };
  }, [name, size, color, strokeWidth]);
  return <span ref={host} aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', width: size, height: size, flex: '0 0 auto', ...style }} />;
}
