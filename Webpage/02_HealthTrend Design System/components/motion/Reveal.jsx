import React from 'react';

// Headless scroll-linked reveal. Renders ONE element and nothing else — no
// wrapper chrome, no layout opinion. Reads its easing, duration, offset,
// stagger and threshold from the motion tokens, so a sequence is composed from
// the system rather than hand-tuned per surface.
//
// Three guarantees, from the brief:
//   1. It never gates information — content is in the DOM and the a11y tree
//      from first paint, and it self-reveals if IntersectionObserver is absent.
//   2. It fires once. Scrolling back up does not replay it.
//   3. It never drives scroll. No pinning, no scrubbing, no scroll-jacking.
// Under prefers-reduced-motion it reveals immediately with no transition.
function htTokenNumber(el, name, fallback) {
  if (typeof getComputedStyle === 'undefined' || !el) return fallback;
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return isNaN(v) ? fallback : v;
}

export function Reveal({
  children, as = 'div', index = 0, scale = 'md',
  stagger = 'stagger-1', delay = 0, threshold, once = true,
  style, className, ...rest
}) {
  const ref = React.useRef(null);
  const [shown, setShown] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mq && mq.matches) { setReduced(true); setShown(true); return; }
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const th = threshold != null ? threshold : htTokenNumber(el, '--reveal-threshold', 0.28);
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { setShown(true); if (once) io.disconnect(); }
        else if (!once) setShown(false);
      });
    }, { threshold: Math.min(0.99, Math.max(0, th)), rootMargin: '0px 0px -12% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold]);

  // Stagger flattens past --stagger-cap so a long list never makes the reader wait.
  const cap = htTokenNumber(ref.current, '--stagger-cap', 6);
  const step = htTokenNumber(ref.current, '--' + stagger, stagger === 'stagger-2' ? 70 : 40);
  const total = delay + Math.min(index, cap) * step;

  const Tag = as;
  return (
    <Tag
      ref={ref}
      data-scale={scale === 'lg' ? 'lg' : undefined}
      data-revealed={shown ? '' : undefined}
      className={className ? 'ht-reveal ' + className : 'ht-reveal'}
      style={reduced ? { ...style } : { transitionDelay: total + 'ms', ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
